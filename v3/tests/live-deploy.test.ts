import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync("../.github/workflows/deploy-v3-oracle.yml", "utf8");
const script = readFileSync("../scripts/deploy-v3-oracle.sh", "utf8");
const makerSetup = readFileSync("scripts/setup-maker-analysis.sh", "utf8");
const makerOcr = readFileSync("scripts/maker-reference-ocr.py", "utf8");
const runtimeDoc = readFileSync("../docs/v3-production-runtime.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

assert.ok(workflow.includes("workflow_dispatch"), "v3 deploy must remain manually triggerable for retries.");
assert.ok(workflow.includes("push:") && workflow.includes("- main"), "v3 deploy must auto-run when main is updated.");
assert.ok(workflow.includes("V3_CONVEX_DEPLOY_KEY"), "v3 deploy must use a v3-specific Convex deploy key.");
assert.ok(!workflow.includes("secrets.CONVEX_DEPLOY_KEY"), "v3 deploy must not use the legacy Convex deploy key.");
assert.ok(workflow.includes("scripts/deploy-v3-oracle.sh"), "v3 workflow must call the v3 deploy script.");
assert.ok(
  workflow.includes("git restore --worktree -- v3/convex/_generated/api.d.ts v3/next-env.d.ts"),
  "v3 deploy must discard generated-file drift before pulling a new release.",
);
assert.ok(workflow.includes("REPLICATE_API_TOKEN: ${{ secrets.REPLICATE_API_TOKEN }}"), "Maker deploy must receive the Replicate secret.");
for (const providerSecret of [
  "BRANDFETCH_API_KEY",
  "FISH_STUDIO_APIKEY",
  "ELEVENLABS_API_KEY",
]) {
  assert.ok(
    workflow.includes(providerSecret + ": ${{ secrets." + providerSecret + " }}"),
    `v3 deploy must receive ${providerSecret}.`,
  );
}
assert.ok(workflow.includes('WIGGLY_MAKER_LIVE_ANALYSIS: "true"'), "Production dogfood must enable live Maker analysis.");
assert.ok(workflow.includes("command_timeout: 40m"), "The first PaddleOCR install needs an explicit SSH timeout.");

for (const requiredScript of [
  "npm run test",
  "npm run typecheck",
  "npm run build",
  "npm run remotion:still",
  "npm run runtime:health",
]) {
  assert.ok(script.includes(requiredScript), `v3 deploy script must run ${requiredScript}.`);
}

assert.ok(
  script.includes("pm2 start npm") && script.includes("run render-worker:watch"),
  "v3 deploy script must run the render worker through PM2.",
);
assert.ok(
  script.includes("for attempt in {1..12}") && script.includes("Render worker did not become healthy"),
  "v3 deploy must wait for the worker heartbeat instead of racing its Remotion startup.",
);
assert.ok(script.includes("wiggly-v3"), "v3 app must have its own PM2 app name.");
assert.ok(script.includes("wiggly-v3-render-worker"), "v3 render worker must have its own PM2 app name.");
assert.ok(script.includes("run mcp-draft-worker:watch"), "v3 deploy must keep the MCP draft worker running beside the ad render worker.");
assert.ok(
  script.includes("WIGGLY_FORMAT_STUDIOS") && script.includes("/home/ubuntu/wiggly-format-studios"),
  "v3 deploy must point the draft worker at format studios on the server.",
);
assert.ok(script.includes("wiggly-v3-mcp-draft"), "the MCP draft worker must have its own PM2 app name.");
assert.ok(script.includes("npx convex deploy"), "v3 deploy must sync Convex functions before smoke.");
for (const convexRuntimeValue of [
  "BRANDFETCH_API_KEY",
  "REPLICATE_API_TOKEN",
  "FISH_STUDIO_APIKEY",
  "ELEVENLABS_API_KEY",
  "WIGGLY_PUBLIC_BASE_URL",
]) {
  assert.ok(
    script.includes(convexRuntimeValue),
    `v3 deploy must sync ${convexRuntimeValue} into the Convex runtime.`,
  );
}
assert.ok(script.includes("OPENROUTER_API_KEY REPLICATE_API_TOKEN"), "Maker deploy must fail visibly when provider secrets are missing.");
assert.ok(script.includes("MAKER_REQUIREMENTS_HASH"), "Maker deploy must cache PaddleOCR by requirements hash.");
assert.ok(script.includes("bash scripts/setup-maker-analysis.sh"), "Maker deploy must install and prewarm PaddleOCR.");
assert.ok(
  script.indexOf("npx convex deploy") < script.indexOf("bash scripts/setup-maker-analysis.sh") &&
    script.indexOf("npm run runtime:health") < script.indexOf("bash scripts/setup-maker-analysis.sh"),
  "Maker OCR bootstrap must not block the core Convex and app deployment.",
);
for (const setting of [
  'engine="transformers"',
  'device="cpu"',
  'lang="en"',
  'ocr_version="PP-OCRv5"',
  "use_doc_orientation_classify=False",
  "use_doc_unwarping=False",
  "use_textline_orientation=False",
  "return_word_box=False",
]) {
  assert.ok(makerSetup.includes(setting) && makerOcr.includes(setting), `Maker prewarm must match runtime OCR setting ${setting}.`);
}
assert.ok(script.includes("CONVEX_DEPLOY_KEY=\"$V3_CONVEX_DEPLOY_KEY\""), "script must map v3 key to Convex CLI env.");
assert.ok(
  script.includes("npm ci --workspaces=false --include=optional"),
  "v3 deploy must install from the standalone v3 lockfile with optional native packages.",
);
assert.ok(script.includes("V3_PUBLIC_HOST"), "v3 deploy script must own the optional public host route.");
assert.ok(script.includes("proxy_pass http://127.0.0.1:$V3_PORT"), "v3 public host must proxy to the v3 app port.");
assert.ok(script.includes("/etc/letsencrypt/live/$V3_PUBLIC_HOST"), "v3 deploy script must preserve HTTPS when a cert exists.");
assert.ok(
  script.includes('sudo test -f "$V3_CERT_FULLCHAIN"') && script.includes('sudo test -f "$V3_CERT_PRIVKEY"'),
  "v3 deploy script must check root-owned Let's Encrypt cert files with sudo.",
);
assert.ok(!script.includes("apps/web"), "v3 deploy script must not deploy the legacy web app.");
assert.ok(!script.includes("deploy-oracle.sh"), "v3 deploy script must not shell into legacy deploy script.");
assert.ok(packageJson.scripts["runtime:health"], "v3 package must expose runtime health.");
assert.ok(runtimeDoc.includes("V3_CONVEX_DEPLOY_KEY"));
assert.ok(runtimeDoc.includes("Do not reuse the legacy `CONVEX_DEPLOY_KEY`"));
assert.ok(runtimeDoc.includes("V3_PUBLIC_HOST"));
assert.ok(workflow.includes("V3_PUBLIC_HOST: wiggly.agentenamel.com"));
assert.ok(
  !workflow.includes("vars.V3_PUBLIC_HOST"),
  "v3 deploy must not let a stale repo variable override the canonical HTTPS preview host.",
);

console.log("live-deploy tests passed");
