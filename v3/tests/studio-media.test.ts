import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorizeStudioRequest,
  isTimingSafeSecretMatch,
  validateStudioStorageCandidate,
} from "../convex/studioMediaAuth";

assert.equal(isTimingSafeSecretMatch("abc123", "abc123"), true);
assert.equal(isTimingSafeSecretMatch("abc123", "abc124"), false);
assert.equal(isTimingSafeSecretMatch("abc12", "abc123"), false);
assert.equal(isTimingSafeSecretMatch("", "abc123"), false);
assert.equal(isTimingSafeSecretMatch(null, "abc123"), false);
assert.equal(isTimingSafeSecretMatch("abc123", ""), false);

const missingSecret = authorizeStudioRequest(
  { headers: new Headers({ "x-studio-secret": "anything" }) },
  undefined,
);
assert.equal(missingSecret.ok, false);
assert.equal(missingSecret.status, 500);

const wrongSecret = authorizeStudioRequest(
  { headers: new Headers({ "x-studio-secret": "wrong-secret" }) },
  "expected-secret",
);
assert.equal(wrongSecret.ok, false);
assert.equal(wrongSecret.status, 401);

const missingHeader = authorizeStudioRequest(
  { headers: new Headers() },
  "expected-secret",
);
assert.equal(missingHeader.ok, false);
assert.equal(missingHeader.status, 401);

const validAuth = authorizeStudioRequest(
  { headers: new Headers({ "x-studio-secret": "expected-secret" }) },
  "expected-secret",
);
assert.equal(validAuth.ok, true);
assert.equal(validAuth.status, 200);

const now = 1_700_000_000_000;
assert.deepEqual(
  validateStudioStorageCandidate({
    ticket: null,
    storageMetadata: { _creationTime: now, size: 1024 },
    bytes: 1024,
    now,
  }),
  { ok: false, status: 403, error: "Invalid studio upload ticket." },
);

assert.deepEqual(
  validateStudioStorageCandidate({
    ticket: { createdAt: now - 10_000, expiresAt: now + 60_000, consumedAt: now - 1_000 },
    storageMetadata: { _creationTime: now, size: 1024 },
    bytes: 1024,
    now,
  }),
  { ok: false, status: 409, error: "Studio upload ticket was already used." },
);

assert.deepEqual(
  validateStudioStorageCandidate({
    ticket: { createdAt: now - 700_000, expiresAt: now - 1_000 },
    storageMetadata: { _creationTime: now, size: 1024 },
    bytes: 1024,
    now,
  }),
  { ok: false, status: 410, error: "Studio upload ticket expired." },
);

assert.deepEqual(
  validateStudioStorageCandidate({
    ticket: { createdAt: now - 1_000, expiresAt: now + 60_000 },
    storageMetadata: { _creationTime: now - 120_000, size: 1024 },
    bytes: 1024,
    now,
  }),
  { ok: false, status: 403, error: "Storage object predates the studio upload ticket and is refused." },
);

const mismatchResult = validateStudioStorageCandidate({
  ticket: { createdAt: now - 1_000, expiresAt: now + 60_000 },
  storageMetadata: { _creationTime: now, size: 2048 },
  bytes: 1024,
  now,
});
assert.equal(mismatchResult.ok, false);
if (!mismatchResult.ok) {
  assert.equal(mismatchResult.status, 400);
}

assert.deepEqual(
  validateStudioStorageCandidate({
    ticket: { createdAt: now - 1_000, expiresAt: now + 60_000 },
    storageMetadata: { _creationTime: now, size: 1024 },
    bytes: 1024,
    now,
  }),
  { ok: true },
);

const httpSource = readFileSync("convex/http.ts", "utf8");
assert.ok(httpSource.includes('path: "/studio/upload-url"'));
assert.ok(httpSource.includes('path: "/studio/file-url"'));
assert.ok(httpSource.includes('path: "/studio/delete"'));

const cronsSource = readFileSync("convex/crons.ts", "utf8");
assert.ok(cronsSource.includes("internal.studioMedia.sweepExpired"));

console.log("studio-media tests passed");
