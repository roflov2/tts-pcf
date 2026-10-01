// Captures the preview page (mock API) to docs/: `npm run screenshot`.
//
// Starts the Vite preview server itself, so nothing else needs to be running.
// Uses Playwright's Chromium; set CHROMIUM_PATH to use another Chrome/Chromium
// binary (on Bazzite, e.g. the Flatpak's /var/lib/flatpak/exports/bin/org.chromium.Chromium
// won't work headless; install Playwright's browser in the dev container instead).
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");
mkdirSync(docs, { recursive: true });

const server = await createServer({ configFile: join(root, "dev", "vite.config.ts"), server: { port: 5174, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];

const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath });

const shots = [
  { file: "screenshot.png", query: "?dictionary=maker&ask=What%20are%20the%2010%20most%20common%20values%20of%20other_product_name%3F", width: 1400, wait: "text=Results (10 rows)" },
  { file: "screenshot-empty.png", query: "", width: 1400, wait: "text=Ask anything about the table" },
  { file: "screenshot-phone.png", query: "?width=narrow&ask=How%20many%20reports%20are%20there%3F", width: 760, wait: "text=Results (1 row)" },
  { file: "screenshot-dark.png", query: "?theme=dark&ask=delete%20old%20rows", width: 1400, wait: "text=Failed attempts (2)" },
];

try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: 900 } });
    await page.goto(base + shot.query);
    await page.waitForSelector(shot.wait, { timeout: 20_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(docs, shot.file) });
    console.log(`Saved docs/${shot.file}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
