import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3020/formats/shaz-puppet-runtime...");
  await page.goto("http://localhost:3020/formats/shaz-puppet-runtime", { waitUntil: "networkidle" });

  const tutorial = page.locator("[data-testid='shaz-pose-science-tutorial']");
  await tutorial.scrollIntoViewIfNeeded();

  console.log("Capturing tutorial unit initial screenshot...");
  await tutorial.screenshot({ path: "/Users/shaz/.gemini/antigravity/brain/57c110ab-a9a5-43fe-aedb-1be7d415996e/tutorial_unit_initial.png" });

  console.log("Clicking Shot 02 Present pill...");
  const presentButton = tutorial.locator("button:has-text('POSE 02/11')");
  await presentButton.click();
  await page.waitForTimeout(500);

  console.log("Capturing screenshot after clicking Present pill...");
  await tutorial.screenshot({ path: "/Users/shaz/.gemini/antigravity/brain/57c110ab-a9a5-43fe-aedb-1be7d415996e/tutorial_unit_present_clicked.png" });

  await browser.close();
  console.log("Browser QA validation passed!");
}

main().catch((err) => {
  console.error("Browser QA failed:", err);
  process.exit(1);
});
