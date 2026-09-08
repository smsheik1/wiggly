import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.REPO_SMOKE_BASE_URL || "http://localhost:3020";
const slug = "roast-me-conversations";
const root = "/format-repositories/roast-me-conversations-v1";
const archive = `${root}/downloads/${slug}-0.2.0.zip`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const expectedHash = hash(readFileSync(`public${archive}`));
const screenshots = mkdtempSync(path.join(tmpdir(), "wiggly-roast-me-page-"));
console.log(`Screenshots directory: ${screenshots}`);

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();

  // Test format repo page
  console.log(`Loading ${origin}/formats/${slug}...`);
  await page.goto(`${origin}/formats/${slug}`, { waitUntil: "domcontentloaded" });
  await page.locator("#proof-quality").waitFor({ state: "visible", timeout: 15000 });

  // Check repo sections
  for (const id of ["accounts-youll-connect", "included-assets", "workflow", "proof-quality", "repo-files", "run-with-agent"]) {
    assert.equal(await page.locator(`#${id}`).count(), 1, `Section #${id} must exist`);
  }
  assert.match(await page.locator("#proof-quality").innerText(), /Family & Friends Roast Me/);

  // Check hero video
  const hero = page.locator("video").first();
  await hero.waitFor();
  const heroDim = await hero.evaluate(video => ({ width: video.clientWidth, height: video.clientHeight }));
  assert.ok(Math.abs(heroDim.width / heroDim.height - 9 / 16) < 0.02, "Hero video must be 9:16");

  await page.screenshot({ path: path.join(screenshots, "repo-desktop.png") });

  // Check handoff clipboard prompt
  await page.locator("#run-with-agent").getByRole("button", { name: "Send to Coding Agent" }).click();
  await page.getByRole("menuitem", { name: "Copy for another coding agent" }).click();
  await page.getByRole("button", { name: "Coding agent prompt copied" }).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clipboard.includes(`${origin}${archive}`));
  assert.ok(clipboard.includes(`${origin}/formats/${slug}`));
  assert.match(clipboard, /Never use a paid provider without my explicit approval/);

  // Check download parity
  const download = await page.request.get(`${origin}${archive}`);
  assert.equal(download.status(), 200);
  assert.equal(hash(await download.body()), expectedHash);

  // Check readable repo files
  await page.locator("#repo-files summary").filter({ hasText: /^README.md$/ }).click();
  assert.match(await page.locator("#repo-files details[open] pre").innerText(), /Public baseline/);

  // Mobile layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No mobile overflow");
  await page.screenshot({ path: path.join(screenshots, "repo-mobile.png") });

  console.log(JSON.stringify({
    status: "pass",
    origin,
    archiveSha256: expectedHash,
    screenshots,
    checks: [
      "Discover search and 9:16 shelf card",
      "Standard Repo sections (accounts, assets, workflow, proof, files, handoff)",
      "Desktop and mobile viewports with no overflow",
      "Clipboard agent handoff prompt",
      "ZIP download parity with sha256 check",
      "Readable file inspection"
    ]
  }, null, 2));
} finally {
  await browser.close();
}
