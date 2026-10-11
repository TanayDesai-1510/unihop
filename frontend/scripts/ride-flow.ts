// Records the rider golden path against the mocks: home -> options -> confirm pickup (map drag) ->
// request -> matching -> en route -> arrived -> trip -> complete -> rating. One video per color
// scheme plus a screenshot at each state. Output: frontend/screenshots/flow/ (gitignored).
//
//   npm run dev                 # in another terminal (NEXT_PUBLIC_USE_MOCKS=true)
//   npm run ride-flow           # both schemes
//   npm run ride-flow -- dark   # one scheme
import { chromium, type Page } from "playwright";
import { mkdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(__dirname, "..", "screenshots", "flow");
const RIDER1 = "00000000-0000-0000-0000-000000000101";
const W = 375;
const H = 812;

async function shot(page: Page, scheme: string, name: string) {
  await page.screenshot({ path: join(OUT, `${scheme}-${name}.png`) });
  console.log(`  ${scheme}-${name}.png`);
}

async function waitText(page: Page, text: string | RegExp, timeout = 45_000) {
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}

async function run(scheme: "light" | "dark") {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });
  await context.addInitScript((rider) => {
    if (sessionStorage.getItem("flow-init")) return;
    sessionStorage.setItem("flow-init", "1");
    sessionStorage.setItem("unihop.splash.v1", "1");
    localStorage.removeItem("unihop.mockdb.v1");
    localStorage.setItem("unihop.token", `mock.${rider}`);
  }, RIDER1);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  console.log(`[${scheme}]`);
  await page.goto(`${BASE_URL}/rider`, { waitUntil: "networkidle" });
  await waitText(page, "Where to?");
  await page.waitForTimeout(1200);
  await shot(page, scheme, "1-home");

  await page.getByRole("button", { name: "Cook", exact: true }).click();
  await waitText(page, "Choose a ride");
  await page.waitForTimeout(1600);
  await shot(page, scheme, "2-options");

  await page.getByRole("button", { name: "Confirm pickup" }).click();
  await waitText(page, /confirm your pickup/i);
  await page.waitForTimeout(1400);
  // Drag the map a little under the fixed pin; it snaps back to the nearest hub.
  const map = page.locator(".leaflet-container");
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + 230, { steps: 12 });
  await page.waitForTimeout(250);
  await shot(page, scheme, "3-confirm-dragging");
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await shot(page, scheme, "3-confirm");

  await page.getByRole("button", { name: "Request UniHop" }).click();
  await waitText(page, /Finding your driver|Checking nearby drivers/);
  await page.waitForTimeout(1500);
  await shot(page, scheme, "4-matching");

  await waitText(page, /Meet at/);
  await page.waitForTimeout(4000);
  await shot(page, scheme, "5-enroute");

  await waitText(page, /Your driver is here/);
  await page.waitForTimeout(800);
  await shot(page, scheme, "6-arrived");

  await waitText(page, /Arriving at/);
  await page.waitForTimeout(5000);
  await shot(page, scheme, "7-trip");

  await waitText(page, /You've arrived/, 60_000);
  await page.waitForTimeout(1800);
  await shot(page, scheme, "8-done");
  await page.getByRole("radio", { name: "5 stars" }).click();
  await page.waitForTimeout(1200);
  await shot(page, scheme, "9-rated");

  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const path = await video.path();
    const target = join(OUT, `ride-flow-${scheme}.webm`);
    renameSync(path, target);
    console.log(`  video: ${target}`);
  }
  if (errors.length) {
    console.error(`  page errors:\n    ${errors.join("\n    ")}`);
    process.exitCode = 1;
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const arg = process.argv[2];
  const schemes: Array<"light" | "dark"> = arg === "light" || arg === "dark" ? [arg] : ["light", "dark"];
  for (const s of schemes) await run(s);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
