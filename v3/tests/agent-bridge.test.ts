import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  AgentOutputError,
  AgentUnavailableError,
  askActiveAgent,
} from "../lib/agent-bridge";

async function writeFakeCli(binDir: string, name: string, body: string): Promise<void> {
  const filePath = path.join(binDir, name);
  await fs.writeFile(filePath, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`, { mode: 0o755 });
}

async function runTests(): Promise<void> {
  const origPath = process.env.PATH;
  const origHome = process.env.HOME;
  const origAgy = process.env.ANTIGRAVITY_AGENT;
  const origClaude = process.env.CLAUDECODE;

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-bridge-test-"));
  const fakeBin = path.join(tmpRoot, "bin");
  const fakeHome = path.join(tmpRoot, "home");
  await fs.mkdir(fakeBin, { recursive: true });
  await fs.mkdir(fakeHome, { recursive: true });

  try {
    process.env.HOME = fakeHome;
    delete process.env.ANTIGRAVITY_AGENT;
    delete process.env.CLAUDECODE;

    // 1. Pinned missing CLI throws AgentUnavailableError even when the other CLI exists
    await writeFakeCli(fakeBin, "claude", 'echo \'{"ok":"from-claude"}\'');
    process.env.PATH = `${fakeBin}:/usr/bin:/bin`;
    await assert.rejects(
      () => askActiveAgent("test", { agent: "agy", requireJson: true }),
      (err: unknown) => err instanceof AgentUnavailableError && /Pinned agent CLI 'agy' is unavailable/.test(err.message),
    );

    // 2. Resolves agy from ~/.local/bin when omitted from PATH
    const localBin = path.join(fakeHome, ".local", "bin");
    await fs.mkdir(localBin, { recursive: true });
    await writeFakeCli(
      localBin,
      "agy",
      [
        `args=" $* "`,
        `[[ "$args" == *" --output-format json "* ]] || { echo "missing --output-format json" >&2; exit 2; }`,
        `[[ "$args" == *" --disable-slash-commands "* ]] || { echo "missing --disable-slash-commands" >&2; exit 2; }`,
        `[[ "$args" == *" --print-timeout 5s "* ]] || { echo "missing --print-timeout 5s" >&2; exit 2; }`,
        `echo '{"response":"\`\`\`json\\n{\\"picked\\":true}\\n\`\`\`"}'`,
      ].join("\n"),
    );
    process.env.PATH = "/usr/bin:/bin";
    const localRes = await askActiveAgent("test", { agent: "agy", requireJson: true, timeoutMs: 5000 });
    assert.deepEqual(localRes, { picked: true });

    // 3. Claude --output-format json unwraps .result JSON cleanly when pinned
    process.env.PATH = `${fakeBin}:/usr/bin:/bin`;
    await writeFakeCli(
      fakeBin,
      "claude",
      `echo '{"type":"result","is_error":false,"result":"{\\"source\\":\\"claude\\"}"}'`,
    );
    const claudeRes = await askActiveAgent("test", { agent: "claude", requireJson: true });
    assert.deepEqual(claudeRes, { source: "claude" });

    // 4. Non-JSON text fails with AgentOutputError when requireJson: true
    await writeFakeCli(fakeBin, "agy", `echo '{"response":"definitely not json"}'`);
    process.env.PATH = `${fakeBin}:/usr/bin:/bin`;
    await assert.rejects(
      () => askActiveAgent("test", { agent: "agy", requireJson: true }),
      (err: unknown) =>
        err instanceof AgentOutputError &&
        /malformed JSON/.test(err.message) &&
        err.preview.includes("definitely not json"),
    );

    // 5. Pinned array JSON fails with AgentOutputError when object is required
    await writeFakeCli(fakeBin, "agy", `echo '{"response":"[1,2,3]"}'`);
    await assert.rejects(
      () => askActiveAgent("test", { agent: "agy", requireJson: true }),
      (err: unknown) => err instanceof AgentOutputError,
    );

    // 6. Legacy path (without requireJson) keeps returning raw text cleanly for Pixar compatibility
    await writeFakeCli(fakeBin, "agy", `echo 'plain raw text output'`);
    const legacyOut = await askActiveAgent("test");
    assert.equal(legacyOut, "plain raw text output");

    // 7. Hung agent process is killed cleanly and throws AgentUnavailableError on timeoutMs
    await writeFakeCli(fakeBin, "agy", `sleep 5\necho '{"ok":true}'`);
    await assert.rejects(
      () => askActiveAgent("test", { agent: "agy", timeoutMs: 150, requireJson: true }),
      (err: unknown) => err instanceof AgentUnavailableError && /timed out after 150ms/.test(err.message),
    );

    console.log("agent-bridge tests passed");
  } finally {
    process.env.PATH = origPath;
    process.env.HOME = origHome;
    if (origAgy !== undefined) process.env.ANTIGRAVITY_AGENT = origAgy;
    if (origClaude !== undefined) process.env.CLAUDECODE = origClaude;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
