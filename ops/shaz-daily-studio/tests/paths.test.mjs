import assert from "node:assert/strict";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getDefaultLedgerPath } from "../content-ledger.mjs";
import { findSecretsEnvPath } from "../secrets.mjs";
import { DEFAULT_CONFIG_PATH, KIT_ROOT, loadStudioConfig, STUDIO_ROOT } from "../studio-daily.mjs";
import { groboldFontPath } from "../vertical-letterbox.mjs";

test("relocated ops/shaz-daily-studio resolves kit, config, external ledger, secrets.env, and agent-bridge paths accurately", async () => {
  assert.equal(fsSync.existsSync(KIT_ROOT), true, `KIT_ROOT missing: ${KIT_ROOT}`);
  assert.equal(fsSync.existsSync(STUDIO_ROOT), true, `STUDIO_ROOT missing: ${STUDIO_ROOT}`);
  assert.equal(
    fsSync.existsSync(path.join(KIT_ROOT, "runner.mjs")),
    true,
    "KIT_ROOT/runner.mjs must exist",
  );
  assert.equal(
    fsSync.existsSync(groboldFontPath),
    true,
    `GROBOLD.ttf missing at ${groboldFontPath}`,
  );
  assert.equal(
    fsSync.existsSync(path.join(STUDIO_ROOT, "editorial-backlog.json")),
    false,
    "editorial-backlog.json must be removed in Phase 2",
  );
  assert.equal(fsSync.existsSync(DEFAULT_CONFIG_PATH), true, "studio.config.json must exist");
  const cfg = await loadStudioConfig();
  assert.equal(cfg.writerAgent, "agy");
  assert.equal(cfg.batchSize, 3);

  const expectedDefault = path.join(os.homedir(), ".wiggly", "shaz-daily-studio", "published-topics.json");
  assert.equal(
    getDefaultLedgerPath({}),
    expectedDefault,
    "default v2 ledger must live outside the repo under ~/.wiggly/shaz-daily-studio",
  );
  assert.equal(
    getDefaultLedgerPath({ WIGGLY_STUDIO_HOME: "/tmp/custom-studio" }),
    "/tmp/custom-studio/published-topics.json",
  );
  assert.equal(
    fsSync.existsSync(path.resolve(KIT_ROOT, "../../../lib/agent-bridge.ts")),
    true,
    "agent-bridge.ts must resolve from KIT_ROOT",
  );

  // Even when invoked from an unrelated directory (/tmp), secrets lookup falls back to repo root via STUDIO_ROOT
  const origCwd = process.cwd();
  try {
    process.chdir(os.tmpdir());
    const found = findSecretsEnvPath();
    const repoSecrets = path.resolve(STUDIO_ROOT, "../../secrets.env");
    if (fsSync.existsSync(repoSecrets)) {
      assert.equal(fsSync.realpathSync(found), fsSync.realpathSync(repoSecrets));
    }
  } finally {
    process.chdir(origCwd);
  }
});
