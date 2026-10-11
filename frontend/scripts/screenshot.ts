// Visual check: captures routes at 375x812 in light and dark mode against a running dev server
// with mocks on (NEXT_PUBLIC_USE_MOCKS=true). Screenshots go to frontend/screenshots/ (gitignored).
//
//   npm run dev                       # in another terminal
//   npm run screenshot                # default route list
//   npm run screenshot -- /rider /payment@rider2 /dev/components:tall
//
// Route spec: <path>[@<seed user>][:tall]
//   @rider1 (default) | @rider2 | @driver1..@driver5 | @anon (signed out)
//   :tall   captures a 375x6400 viewport, for long scroll pages like /dev/components
// Env: BASE_URL (default http://localhost:3000)
import { chromium, type Browser } from "playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = resolve(__dirname, "..", "screenshots");
const WIDTH = 375;
const HEIGHT = 812;
const TALL_HEIGHT = 6400;
const SETTLE_MS = 1200; // mock latency is 250-800ms

const USERS: Record<string, string | null> = {
  anon: null,
  rider1: "00000000-0000-0000-0000-000000000101",
  rider2: "00000000-0000-0000-0000-000000000102",
  driver1: "00000000-0000-0000-0000-000000000201",
  driver2: "00000000-0000-0000-0000-000000000202",
  driver3: "00000000-0000-0000-0000-000000000203",
  driver4: "00000000-0000-0000-0000-000000000204",
  driver5: "00000000-0000-0000-0000-000000000205",
};

/** Routes finished so far. Add each route here when its issue lands. */
const DEFAULT_ROUTES = [
  "/dev/components@anon:tall",
  "/rider",
  "/driver@driver1",
  "/history",
  "/payment",
  "/earnings@driver1",
  "/profile",
  "/rider/ride/demo",
];

interface Shot {
  path: string;
  user: string;
  tall: boolean;
}

function parse(spec: string): Shot {
  const tall = spec.endsWith(":tall");
  const body = tall ? spec.slice(0, -5) : spec;
  const [path, user = "rider1"] = body.split("@");
  if (!(user in USERS)) throw new Error(`Unknown user "${user}" in "${spec}". Use one of: ${Object.keys(USERS).join(", ")}`);
  return { path, user, tall };
}

function slug(s: Shot): string {
  const base = s.path === "/" ? "home" : s.path.replace(/^\//, "").replace(/[/[\]]+/g, "_");
  return `${base}${s.user === "rider1" ? "" : `@${s.user}`}${s.tall ? "-tall" : ""}`;
}

async function capture(browser: Browser, shot: Shot, scheme: "light" | "dark"): Promise<{ file: string; errors: string[] }> {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: shot.tall ? TALL_HEIGHT : HEIGHT },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    isMobile: true,
    hasTouch: true,
  });
  const token = USERS[shot.user];
  // Fresh mock state for every shot, signed in as the requested seed user.
  await context.addInitScript(
    ({ token }) => {
      try {
        if (sessionStorage.getItem("shot-init")) return;
        sessionStorage.setItem("shot-init", "1");
        localStorage.removeItem("unihop.mockdb.v1");
        if (token) localStorage.setItem("unihop.token", `mock.${token}`);
        else localStorage.removeItem("unihop.token");
      } catch {
        // storage blocked: shot proceeds signed out
      }
    },
    { token },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE_URL + shot.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);
  const file = join(OUT_DIR, `${slug(shot)}-${scheme}.png`);
  await page.screenshot({ path: file });
  await context.close();
  return { file, errors };
}

async function main() {
  const specs = process.argv.slice(2);
  const shots = (specs.length ? specs : DEFAULT_ROUTES).map(parse);

  try {
    const res = await fetch(BASE_URL, { method: "HEAD" });
    if (!res.ok && res.status !== 307) throw new Error(String(res.status));
  } catch {
    console.error(`Dev server not reachable at ${BASE_URL}. Start it with: npm run dev`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let failed = false;
  for (const shot of shots) {
    for (const scheme of ["light", "dark"] as const) {
      const { file, errors } = await capture(browser, shot, scheme);
      console.log(`${errors.length ? "WARN" : "ok  "} ${file}`);
      for (const e of errors) console.log(`       ${e}`);
      // The /dev/components health check fails by design when no backend is running.
      if (errors.some((e) => !e.includes("Failed to load resource") && !e.includes("/api/health"))) failed = true;
    }
  }
  await browser.close();
  if (failed) {
    console.error("\nSome pages logged errors (see above).");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
