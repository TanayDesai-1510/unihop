// Performance check of the rider flow at 4x CPU throttling (Chrome DevTools Protocol).
// Run against a production build so React isn't in dev mode:
//
//   npm run build && npx next start -p 3100      # in another terminal
//   BASE_URL=http://localhost:3100 npm run perf
//
// Writes a Chrome trace (open in DevTools > Performance > Load profile) and prints, per segment,
// the frame count, p95 frame time and dropped frames (intervals > 25ms, i.e. a missed 60Hz vsync).
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = resolve(__dirname, "..", "screenshots", "perf");
const RIDER1 = "00000000-0000-0000-0000-000000000101";
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 4);

declare global {
  interface Window {
    __perf: { seg: string; frames: Array<{ seg: string; dt: number }>; loaf: Array<{ seg: string; dur: number; blocking: number }> };
  }
}

async function segment(page: Page, name: string, fn: () => Promise<void>) {
  await page.evaluate((n) => (window.__perf.seg = n), name);
  await fn();
  await page.evaluate(() => (window.__perf.seg = "idle"));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  // Plain-string init script: tsx injects a `__name` helper into compiled functions, which doesn't
  // exist in the page, so a serialized function would throw before recording anything.
  await context.addInitScript({
    content: `
      if (!sessionStorage.getItem("perf-init")) {
        sessionStorage.setItem("perf-init", "1");
        sessionStorage.setItem("unihop.splash.v1", "1");
        localStorage.removeItem("unihop.mockdb.v1");
        localStorage.setItem("unihop.token", "mock.${RIDER1}");
      }
      window.__perf = { seg: "idle", frames: [], loaf: [] };
      (function () {
        var last = performance.now();
        function tick(now) {
          window.__perf.frames.push({ seg: window.__perf.seg, dt: now - last });
          last = now;
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        try {
          new PerformanceObserver(function (list) {
            list.getEntries().forEach(function (e) {
              var top = (e.scripts || []).slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 3).map(function (sc) {
                return { d: Math.round(sc.duration), inv: sc.invoker, fn: sc.sourceFunctionName, src: (sc.sourceURL || "").split("/").pop() };
              });
              window.__perf.loaf.push({ seg: window.__perf.seg, dur: e.duration, blocking: e.blockingDuration || 0, render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), top: top });
            });
          }).observe({ type: "long-animation-frame", buffered: true });
        } catch (e) {}
      })();
    `,
  });

  // NO_BLUR=1: diagnostic run with backdrop blur disabled (separates GPU/raster cost from JS cost).
  if (process.env.NO_BLUR) await context.addInitScript({ content: `addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s)})` });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${BASE_URL}/rider`, { waitUntil: "networkidle" });
  await page.getByText("Where to?").first().waitFor();
  await page.waitForTimeout(1500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await browser.startTracing(page, { path: join(OUT, "ride-flow-trace.json"), screenshots: true });

  const handle = page.getByRole("button", { name: /sheet/ });
  const drag = async (dy: number, steps = 24) => {
    const b = (await handle.boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x, y + (dy * i) / steps);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);
  };

  await segment(page, "sheet drag up (peek to full)", () => drag(-420));
  await segment(page, "sheet drag down (full to peek)", () => drag(420));
  await segment(page, "home to options (morph + camera)", async () => {
    await page.getByRole("button", { name: "Cook", exact: true }).click();
    await page.getByText("Choose a ride").waitFor();
    await page.waitForTimeout(1800);
  });
  await segment(page, "options to confirm (shared element)", async () => {
    await page.getByRole("button", { name: "Confirm pickup" }).click();
    await page.getByText(/confirm your pickup/i).waitFor();
    await page.waitForTimeout(1600);
  });
  await segment(page, "request to matching", async () => {
    await page.getByRole("button", { name: "Request UniHop" }).click();
    await page.getByText(/Finding your driver|Checking nearby/).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
  });
  await segment(page, "matching to en route (car glide, route draw)", async () => {
    await page.getByText(/Meet at/).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(4500);
  });

  await browser.stopTracing();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const data = await page.evaluate(() => window.__perf);
  await browser.close();

  const segs = [...new Set(data.frames.map((f) => f.seg))].filter((s) => s !== "idle");
  const rows = segs.map((seg) => {
    const dts = data.frames.filter((f) => f.seg === seg).map((f) => f.dt).sort((a, b) => a - b);
    const p95 = dts[Math.floor(dts.length * 0.95)] ?? 0;
    const dropped = dts.filter((d) => d > 25).length;
    const worst = dts[dts.length - 1] ?? 0;
    const loaf = data.loaf.filter((l) => l.seg === seg);
    return { seg, frames: dts.length, p95: +p95.toFixed(1), dropped, droppedPct: +((dropped / Math.max(dts.length, 1)) * 100).toFixed(1), worst: +worst.toFixed(1), longFrames: loaf.length };
  });
  console.log(`CPU throttling ${THROTTLE}x, ${BASE_URL}`);
  console.table(rows);
  writeFileSync(join(OUT, "frames.json"), JSON.stringify({ throttle: THROTTLE, rows, loaf: data.loaf }, null, 2));
  console.log(`trace: ${join(OUT, "ride-flow-trace.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
