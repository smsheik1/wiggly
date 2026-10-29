import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { containedPath, photoSignatureValid, savePhoto, signPhoto } from "../features/mcp/photo-store";

test("an upload session keeps labels on that account and photos stay inside its directory", async () => {
  const ledger = new MemoryFilmLedger();
  const opened = ledger.openUpload("user_1");
  const uploadId = opened.uploadUrl.split("/").pop() ?? "";
  const session = ledger.findUpload(uploadId);
  assert.equal(session?.accountId, "user_1");
  ledger.attachPhotos("user_1", ["Mom", "Leo"]);
  assert.deepEqual(ledger.exportState("user_1").labels, ["Mom", "Leo"]);

  const root = await mkdtemp(path.join(tmpdir(), "wiggly-photos-"));
  const saved = await savePhoto(root, "user_1", "../../secrets.env", Buffer.from("photo"));
  const stored = await readFile(path.join(root, "user_1", saved));
  assert.equal(stored.toString(), "photo");
  assert.equal(saved, "secrets.env");
  assert.throws(() => containedPath(root, "../etc", "a.jpg"));
});

test("a signed photo link expires and a bad signature is refused", () => {
  const secret = "test-secret";
  const expiresAt = Date.now() + 60_000;
  const url = new URL(`https://wiggly.agentenamel.com${signPhoto(secret, "user_1", "mom.jpg", expiresAt)}`);
  const signature = url.searchParams.get("sig") ?? "";
  assert.equal(photoSignatureValid(secret, "user_1", "mom.jpg", expiresAt, signature), true);
  assert.equal(photoSignatureValid(secret, "user_2", "mom.jpg", expiresAt, signature), false);
  assert.equal(photoSignatureValid(secret, "user_1", "mom.jpg", Date.now() - 1000, signature), false);
});
