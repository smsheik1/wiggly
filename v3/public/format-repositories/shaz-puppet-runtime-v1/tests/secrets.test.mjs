import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findSecretsEnvPath, parseSecretsEnv, readSecret } from "../runtime/secrets.mjs";

test("parseSecretsEnv supports comments, export prefix, quotes, and '=' inside values", () => {
  const parsed = parseSecretsEnv(
    [
      "# comment line",
      "",
      'export SERPER_API_KEY="serp==value=="',
      "  CARTESIA_API_KEY='cart_123='",
      "export   PLAIN_KEY = abc=def ",
      "INVALID_LINE_WITHOUT_EQUALS",
    ].join("\n"),
  );

  assert.equal(parsed.SERPER_API_KEY, "serp==value==");
  assert.equal(parsed.CARTESIA_API_KEY, "cart_123=");
  assert.equal(parsed.PLAIN_KEY, "abc=def");
  assert.equal("INVALID_LINE_WITHOUT_EQUALS" in parsed, false);
});

test("readSecret locates secrets via explicit secretsPath/startDir regardless of process.cwd()", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kit-secrets-test-"));
  const nested = path.join(tmpDir, "a", "b", "c");
  const secretsFile = path.join(tmpDir, "secrets.env");
  const origCwd = process.cwd();

  try {
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(secretsFile, 'export TEST_SECRET="val==123"\n', "utf8");

    process.chdir(os.tmpdir());
    const located = findSecretsEnvPath(nested, null);
    assert.equal(located, secretsFile);

    assert.equal(
      readSecret("TEST_SECRET", { env: {}, secretsPath: located }),
      "val==123",
    );
    assert.equal(
      readSecret("TEST_SECRET", { env: { TEST_SECRET: "from-env" }, secretsPath: located }),
      "from-env",
    );
    assert.equal(
      readSecret("TEST_SECRET", { env: {}, secretsPath: null }),
      null,
    );
  } finally {
    process.chdir(origCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
