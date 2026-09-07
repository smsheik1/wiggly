import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import {
  discoveryFormatSlugs,
  getDiscoveryFormatProfile,
} from "../features/discovery/formatProof.server";
import { richFormatRepoSlugs } from "../features/discovery/formatRepoPage.server";
import {
  filterDiscoveryEntries,
  getPublishedDiscoveryEntries,
  groupDiscoveryEntriesByShelf,
} from "../features/discovery/catalog";

const baseUrl = process.env.REPO_SMOKE_BASE_URL || "http://localhost:3020";
const screenshots = mkdtempSync(path.join(tmpdir(), "wiggly-repo-pages-"));
console.log(`Screenshots: ${screenshots}`);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL,
});
const specialized = new Set<string>(richFormatRepoSlugs);
try {
  const discovery = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await discovery.route(/\.(mp4|mp3|wav|glb)(\?.*)?$/i, (route) => route.abort());
  const entries = getPublishedDiscoveryEntries();
  const shelves = groupDiscoveryEntriesByShelf(entries);
  const response = await discovery.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Discover must load.");
  await discovery.locator('h3[id^="shelf-"]').first().waitFor();
  assert.deepEqual(
    await discovery.locator('h3[id^="shelf-"]').allTextContents(),
    shelves.map((shelf) => shelf.title),
    "Discover must render the approved Repo order.",
  );
  for (const shelf of shelves) {
    const section = discovery.locator(`section[aria-labelledby="shelf-${shelf.id}"]`);
    assert.deepEqual(
      await section.locator("article").evaluateAll((cards) => cards.map((card) => card.id)),
      shelf.entries.map((entry) => entry.id),
      `${shelf.title}: all examples must remain together and in order.`,
    );
    assert.deepEqual(
      await section.getByRole("link", { name: "Open format", exact: true }).evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
      shelf.entries.map((entry) => `/formats/${entry.format.slug}`),
      `${shelf.title}: Repo links must be preserved.`,
    );
  }
  await discovery.screenshot({ path: path.join(screenshots, "discover-top.png") });
  await discovery.getByRole("button", { name: "Sell a product", exact: true }).click();
  const sellingShelves = groupDiscoveryEntriesByShelf(filterDiscoveryEntries(entries, "", "sell"));
  await discovery.waitForFunction(
    (ids) => JSON.stringify([...document.querySelectorAll('h3[id^="shelf-"]')].map((heading) => heading.id)) === JSON.stringify(ids),
    sellingShelves.map((shelf) => `shelf-${shelf.id}`),
  );
  await discovery.getByRole("button", { name: "For you", exact: true }).click();
  await discovery.getByRole("searchbox", { name: "Search finished ads" }).fill("Lego Music Video");
  await discovery.waitForFunction(() => document.querySelectorAll('h3[id^="shelf-"]').length === 1 && document.querySelectorAll("article").length === 2);
  assert.deepEqual(await discovery.locator('h3[id^="shelf-"]').allTextContents(), ["Lego Music Video"]);
  await discovery.getByRole("searchbox", { name: "Search finished ads" }).fill("Wiggly Repo Builder");
  await discovery.waitForFunction(() => document.querySelectorAll('h3[id^="shelf-"]').length === 1 && document.querySelectorAll("article").length === 1);
  assert.deepEqual(await discovery.locator('h3[id^="shelf-"]').allTextContents(), ["Wiggly Repo Builder"]);
  assert.equal(await discovery.getByText("1 authoring kit", { exact: true }).count(), 1);
  assert.equal(await discovery.getByText("1 ad", { exact: true }).count(), 0);
  await discovery.getByRole("link", { name: "Open format", exact: true }).click();
  await discovery.waitForURL("**/formats/repo-builder");
  assert.equal(await discovery.getByText("Baseline authoring kit", { exact: true }).count(), 1);
  await discovery.locator("#examples").getByRole("link", { name: "See proof & limits" }).click();
  await discovery.waitForURL("**/formats/repo-builder#proof-quality");
  assert.match(discovery.url(), /#proof-quality$/);
  assert.equal(await discovery.getByText("Fresh-agent real-media proof", { exact: true }).count(), 1);
  assert.match(await discovery.locator("#proof-quality").innerText(), /remain unverified/);
  assert.equal(await discovery.getByRole("link", { name: "Open finished ad" }).count(), 0);
  const builder = getDiscoveryFormatProfile("repo-builder")!;
  const archive = await discovery.request.get(`${baseUrl}${builder.repositoryHref}`);
  assert.equal(archive.status(), 200);
  assert.equal(createHash("sha256").update(await archive.body()).digest("hex"), "7cf18546f887516dc2420ed443d43bddf49f316a49e13e6d40e04f46ee3dc3dc");
  await discovery.goto(`${baseUrl}/s/repo-builder-overview`, { waitUntil: "domcontentloaded" });
  assert.equal(await discovery.getByText("Workflow illustration", { exact: true }).count(), 1);
  assert.equal(await discovery.getByText("Finished ad", { exact: true }).count(), 0);
  await discovery.getByRole("link", { name: /Open the authoring kit/ }).click();
  await discovery.waitForURL("**/formats/repo-builder");
  await discovery.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" });
  await discovery.getByRole("searchbox", { name: "Search finished ads" }).fill("");
  await discovery.waitForFunction((count) => document.querySelectorAll('h3[id^="shelf-"]').length === count, shelves.length);
  await discovery.setViewportSize({ width: 390, height: 844 });
  await discovery.locator("#shelf-skai-generated").scrollIntoViewIfNeeded();
  const discoveryDimensions = await discovery.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(discoveryDimensions.content <= discoveryDimensions.width + 1, "Discover must not overflow on mobile.");
  await discovery.screenshot({ path: path.join(screenshots, "discover-image-filters-mobile.png") });
  await discovery.close();
  console.log(`PASS: Discover's ${shelves.length} ordered groups, all example links, filters, search, and mobile layout.`);
  const pending = [...discoveryFormatSlugs];
  let checked = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      // Media playback is checked interactively; avoid downloading every example in this coverage sweep.
      await page.route(/\.(mp4|mp3|wav|glb)(\?.*)?$/i, (route) =>
        route.abort(),
      );
      for (let slug = pending.shift(); slug; slug = pending.shift()) {
        const format = getDiscoveryFormatProfile(slug)!;
        const response = await page.goto(`${baseUrl}/formats/${slug}`, {
          waitUntil: "domcontentloaded",
        });
        assert.equal(response?.status(), 200, `${slug}: page must load.`);
        const assetsSelector = slug === "squilliam-news" ? "#anchors" : "#included-assets";
        await page.locator(assetsSelector).waitFor();
        if (slug === "squilliam-news") {
          assert.equal(await page.locator("#included-assets").count(), 0);
          assert.equal(await page.getByRole("heading", { name: "Choose your anchor." }).count(), 1);
        }
        for (const selector of [
          "#accounts-youll-connect",
          assetsSelector,
          "#examples",
          "#run-with-agent",
          ...(specialized.has(slug)
            ? ["#how-it-works", '[id$="-quality"]', '[id$="-repo"]']
            : ["#workflow", "#proof-quality", "#repo-files"]),
        ]) {
          assert.equal(
            await page.locator(selector).count(),
            1,
            `${slug}: missing or duplicate ${selector}`,
          );
        }
        if (format.repositoryHref) {
          assert.ok(
            await page
              .locator(`a[download][href="${format.repositoryHref}"]`)
              .count(),
            `${slug}: missing download control`,
          );
          const archive = await page.request.head(
            `${baseUrl}${format.repositoryHref}`,
          );
          assert.equal(
            archive.status(),
            200,
            `${slug}: download must be served.`,
          );
        }
        const dimensions = await page.evaluate(() => ({
          width: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.ok(
          dimensions.content <= dimensions.width + 1,
          `${slug}: desktop horizontal overflow`,
        );
        if (++checked % 10 === 0)
          console.log(
            `${checked}/${discoveryFormatSlugs.length} live routes checked`,
          );
      }
      await page.close();
    }),
  );
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  for (const slug of [
    "three-d-breakdown",
    "passport-click",
    "jingle",
    "newsletter-writer",
    "otaku-explainer",
    "repo-builder",
    "character-gameplay-conversations",
  ]) {
    await page.goto(`${baseUrl}/formats/${slug}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator("#accounts-youll-connect")
      .screenshot({ path: path.join(screenshots, `${slug}-services.png`) });
    await page
      .locator("#included-assets")
      .screenshot({ path: path.join(screenshots, `${slug}-assets.png`) });
    await page
      .locator("#repo-files summary")
      .filter({ hasText: /^README.md$/ })
      .click();
    assert.ok(await page.locator("#repo-files details[open] pre").innerText());
    await page
      .locator("#run-with-agent")
      .screenshot({ path: path.join(screenshots, `${slug}-run.png`) });
    await page
      .locator("#run-with-agent")
      .getByRole("button", { name: "Send to Coding Agent" })
      .click();
    await page.getByRole("menuitem", { name: "Send to Codex" }).waitFor();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#accounts-youll-connect").scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.content <= dimensions.width + 1,
      `${slug}: mobile horizontal overflow`,
    );
    await page.screenshot({
      path: path.join(screenshots, `${slug}-mobile.png`),
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  console.log(
    `PASS: all ${discoveryFormatSlugs.length} routes, package downloads, and representative desktop/mobile controls. Screenshots: ${screenshots}`,
  );
} finally {
  await browser.close();
}
