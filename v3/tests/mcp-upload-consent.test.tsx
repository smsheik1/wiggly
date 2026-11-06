import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import UploadPage from "../app/upload/[uploadId]/page";
import { POST as handleUploadPost } from "../app/api/mcp/upload/[uploadId]/route";
import { setSaveUploadLabelsHookForTest, setUploadSessionHookForTest } from "../features/mcp/convex-ledger";

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      return null;
    }
  }
}

test("upload page renders mandatory consent checkbox in Playwright headless browser", async () => {
  // 1. Unregistered / expired session
  setUploadSessionHookForTest(async () => null);
  const expiredHtml = renderToStaticMarkup(
    await UploadPage({
      params: Promise.resolve({ uploadId: "expired-test" }),
      searchParams: Promise.resolve({}),
    })
  );
  assert.ok(expiredHtml.includes("This upload link has expired"), "Unregistered session must show expired notice");

  // 2. Active session
  setUploadSessionHookForTest(async () => ({
    accountId: "user_test_consent",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }));

  const activeHtml = renderToStaticMarkup(
    await UploadPage({
      params: Promise.resolve({ uploadId: "session-12345" }),
      searchParams: Promise.resolve({}),
    })
  );

  assert.ok(activeHtml.includes("Label each photo"), "Active session must render upload form");
  assert.ok(activeHtml.includes('id="consent"'), "Form must contain consent checkbox");
  assert.ok(activeHtml.includes('name="consent"'), "Form must contain consent input name");
  assert.ok(activeHtml.includes("required"), "Consent checkbox must be marked required");
  assert.ok(activeHtml.includes("I confirm I have the right to upload these photos"), "Form must contain explicit consent attestation text");

  // 3. Verify in real headless Chromium browser via Playwright when available
  const browser = await launchBrowser();
  if (browser) {
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
      await page.setContent(activeHtml);

      // Verify checkbox properties in real browser DOM
      const checkbox = page.locator('input#consent[name="consent"][type="checkbox"]');
      assert.equal(await checkbox.isVisible(), true, "Consent checkbox must be visible in the DOM");
      assert.equal(await checkbox.isChecked(), false, "Consent checkbox must be unchecked by default");
      assert.equal(await checkbox.getAttribute("required"), "", "Consent checkbox must have HTML5 required attribute");

      // Verify label association and text
      const label = page.locator('label[for="consent"]');
      assert.equal(await label.isVisible(), true, "Consent label must be visible");
      const labelText = await label.textContent();
      assert.ok(
        labelText?.includes("I confirm I have the right to upload these photos"),
        "Label must attest right to upload"
      );
      assert.ok(
        labelText?.includes("parental/guardian consent for minors"),
        "Label must attest minor parental/guardian consent"
      );

      // Check interaction: clicking the checkbox checks it
      await checkbox.check();
      assert.equal(await checkbox.isChecked(), true, "Checkbox can be checked by user");
    } finally {
      await browser.close();
    }
  }
  setUploadSessionHookForTest(null);
});

test("upload API route rejects submissions without consent attestation with HTTP 400", async () => {
  setUploadSessionHookForTest(async (id: string) => ({
    accountId: "user_test_consent",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }));

  try {
    // 1. Submit FormData WITHOUT consent
    const formWithoutConsent = new FormData();
    formWithoutConsent.append("label-0", "Mom");
    const blob = new Blob(["fake-photo-data"], { type: "image/jpeg" });
    formWithoutConsent.append("photo-0", blob, "mom.jpg");

    const reqWithoutConsent = new Request("https://wiggly.agentenamel.com/api/mcp/upload/session-12345", {
      method: "POST",
      body: formWithoutConsent,
    });

    const resWithoutConsent = await handleUploadPost(reqWithoutConsent, {
      params: Promise.resolve({ uploadId: "session-12345" }),
    });

    assert.equal(resWithoutConsent.status, 400, "Must return HTTP 400 when consent is missing");
    const errText = await resWithoutConsent.text();
    assert.equal(
      errText,
      "Consent attestation is required to upload photos. Confirm you have rights/consent for identifiable individuals."
    );

    // 2. Submit FormData WITH consent="on" (simulating browser checkbox checked)
    const formWithConsent = new FormData();
    formWithConsent.append("consent", "on");
    // Without photos, it should fail with "Add a photo and a label...", NOT the consent error
    const reqWithConsent = new Request("https://wiggly.agentenamel.com/api/mcp/upload/session-12345", {
      method: "POST",
      body: formWithConsent,
    });

    const resWithConsent = await handleUploadPost(reqWithConsent, {
      params: Promise.resolve({ uploadId: "session-12345" }),
    });

    assert.equal(resWithConsent.status, 400);
    const photoErr = await resWithConsent.text();
    assert.equal(photoErr, "Add a photo and a label for each person, such as Mom or Leo.");
    assert.notEqual(photoErr, errText, "Consent check passed successfully when consent='on'");

    // 3. Submit valid photos WITH consent and verify consentRecord audit trail is passed to ledger
    let capturedConsent: { consentedAt: number; ip?: string; userAgent?: string } | undefined;
    setSaveUploadLabelsHookForTest(async (_id, _labels, _photos, consent) => {
      capturedConsent = consent;
    });

    const validForm = new FormData();
    validForm.append("consent", "on");
    validForm.append("label-0", "Mom");
    validForm.append("photo-0", new Blob(["valid-photo-data"], { type: "image/jpeg" }), "mom.jpg");

    const validReq = new Request("https://wiggly.agentenamel.com/api/mcp/upload/session-12345", {
      method: "POST",
      headers: {
        "x-forwarded-for": "198.51.100.42, 10.0.0.1",
        "user-agent": "Mozilla/5.0 TestBrowser",
      },
      body: validForm,
    });

    const validRes = await handleUploadPost(validReq, {
      params: Promise.resolve({ uploadId: "session-12345" }),
    });

    assert.equal(validRes.status, 303, "Valid submission redirects with 303");
    assert.ok(capturedConsent, "Consent audit record must be passed to ledger");
    assert.equal(capturedConsent.ip, "198.51.100.42", "Must capture client IP from x-forwarded-for header");
    assert.equal(capturedConsent.userAgent, "Mozilla/5.0 TestBrowser", "Must capture user-agent header");
    assert.ok(capturedConsent.consentedAt > 0, "Must record timestamp of consent");

    // 4. Verify x-real-ip takes precedence over spoofed x-forwarded-for
    const realIpReq = new Request("https://wiggly.agentenamel.com/api/mcp/upload/session-12345", {
      method: "POST",
      headers: {
        "x-real-ip": "203.0.113.195",
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
        "user-agent": "Mozilla/5.0 TestBrowser",
      },
      body: validForm,
    });
    await handleUploadPost(realIpReq, {
      params: Promise.resolve({ uploadId: "session-12345" }),
    });
    assert.equal(capturedConsent?.ip, "203.0.113.195", "Must prioritize x-real-ip over spoofed x-forwarded-for");
  } finally {
    setUploadSessionHookForTest(null);
    setSaveUploadLabelsHookForTest(null);
  }
});
