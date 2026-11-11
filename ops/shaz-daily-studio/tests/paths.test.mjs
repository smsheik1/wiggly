import assert from "node:assert/strict";
import fsSync from "node:fs";
import path from "node:path";
import test from "node:test";

import { DEFAULT_LEDGER_PATH } from "../content-ledger.mjs";
import { DEFAULT_BACKLOG_PATH, KIT_ROOT, STUDIO_ROOT } from "../studio-daily.mjs";
import { groboldFontPath } from "../vertical-letterbox.mjs";

test("relocated ops/shaz-daily-studio resolves kit, font, ledger, backlog, and agent-bridge paths accurately", () => {
  assert.equal(fsSync.existsSync(KIT_ROOT), true, `KIT_ROOT missing: ${KIT_ROOT}`);
  assert.equal(fsSync.existsSync(STUDIO_ROOT), true, `STUDIO_ROOT missing: ${STUDIO_ROOT}`);
  assert.equal(
    fsSync.existsSync(path.join(KIT_ROOT, "runner.mjs")),
    true,
    "KIT_ROOT/runner.mjs must exist"
  );
  assert.equal(
    fsSync.existsSync(groboldFontPath),
    true,
    `GROBOLD.ttf missing at ${groboldFontPath}`
  );
  assert.equal(
    fsSync.existsSync(DEFAULT_BACKLOG_PATH),
    true,
    `editorial-backlog.json missing at ${DEFAULT_BACKLOG_PATH}`
  );
  assert.equal(
    path.dirname(DEFAULT_BACKLOG_PATH),
    STUDIO_ROOT,
    "backlog must stay inside ops/shaz-daily-studio"
  );
  assert.equal(
    DEFAULT_LEDGER_PATH,
    path.join(KIT_ROOT, "agent-runs", "published-topics.json"),
    "ledger path must stay pinned inside kit/agent-runs for Phase 1"
  );
  assert.equal(
    fsSync.existsSync(path.dirname(DEFAULT_LEDGER_PATH)),
    true,
    `ledger parent dir missing: ${path.dirname(DEFAULT_LEDGER_PATH)}`
  );
  assert.equal(
    fsSync.existsSync(path.resolve(KIT_ROOT, "../../../lib/agent-bridge.ts")),
    true,
    "agent-bridge.ts must resolve from KIT_ROOT"
  );
});
