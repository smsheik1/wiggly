import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { GET as getRender } from "../app/api/mcp/renders/[jobId]/[tag]/route";
import { GET as getPhoto } from "../app/api/mcp/photos/[accountId]/[filename]/route";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { cleanExpiredUploads, containedPath, photoFilename, photoSignatureValid, savePhoto, signPhoto, signRender } from "../features/mcp/photo-store";
import { draftMedia } from "../features/mcp/render-stage";

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

test("the render route serves stills and master-video with proper Content-Type headers", async () => {
  process.env.MCP_PHOTO_SECRET = "test-secret";
  const jobId = `test-render-${Date.now()}`;
  const jobDir = path.join(process.cwd(), "data", "format-runs", jobId);
  const outputsDir = path.join(jobDir, "outputs");
  const stillPath = path.join(outputsDir, "sheet.png");
  const videoPath = path.join(outputsDir, "master-video.mp4");
  await mkdir(outputsDir, { recursive: true });
  await writeFile(stillPath, Buffer.from("fake-png-data"));
  await writeFile(videoPath, Buffer.from("fake-mp4-data"));
  await writeFile(
    path.join(outputsDir, "state.json"),
    JSON.stringify({
      assetFiles: { "sheet-1": stillPath, "master-video": videoPath },
      masterVideo: { videoPath },
    }),
  );

  try {
    const expiresAt = Date.now() + 60_000;
    const stillUrl = `https://wiggly.agentenamel.com${signRender("test-secret", jobId, "sheet-1", expiresAt)}`;
    const stillRes = await getRender(new Request(stillUrl), { params: Promise.resolve({ jobId, tag: "sheet-1" }) });
    assert.equal(stillRes.status, 200);
    assert.equal(stillRes.headers.get("Content-Type"), "image/png");
    assert.equal(await stillRes.text(), "fake-png-data");

    const videoUrl = `https://wiggly.agentenamel.com${signRender("test-secret", jobId, "master-video", expiresAt)}`;
    const videoRes = await getRender(new Request(videoUrl), { params: Promise.resolve({ jobId, tag: "master-video" }) });
    assert.equal(videoRes.status, 200);
    assert.equal(videoRes.headers.get("Content-Type"), "video/mp4");
    assert.equal(await videoRes.text(), "fake-mp4-data");

    const badRes = await getRender(new Request(`${videoUrl}bad`), { params: Promise.resolve({ jobId, tag: "master-video" }) });
    assert.equal(badRes.status, 401);

    const missingUrl = `https://wiggly.agentenamel.com${signRender("test-secret", jobId, "unknown-tag", expiresAt)}`;
    const missingRes = await getRender(new Request(missingUrl), { params: Promise.resolve({ jobId, tag: "unknown-tag" }) });
    assert.equal(missingRes.status, 404);
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
});

test("the photo route serves uploaded photos with proper Content-Type headers", async () => {
  process.env.MCP_PHOTO_SECRET = "test-secret";
  const accountId = `user_test_${Date.now()}`;
  const uploadDir = path.join(process.cwd(), "data", "mcp-uploads", accountId);
  const photoFile = path.join(uploadDir, "leo.jpg");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(photoFile, Buffer.from("fake-jpg-data"));

  try {
    const expiresAt = Date.now() + 60_000;
    const photoUrl = `https://wiggly.agentenamel.com${signPhoto("test-secret", accountId, "leo.jpg", expiresAt)}`;
    const photoRes = await getPhoto(new Request(photoUrl), { params: Promise.resolve({ accountId, filename: "leo.jpg" }) });
    assert.equal(photoRes.status, 200);
    assert.equal(photoRes.headers.get("Content-Type"), "image/jpeg");
    assert.equal(await photoRes.text(), "fake-jpg-data");

    const badRes = await getPhoto(new Request(`${photoUrl}bad`), { params: Promise.resolve({ accountId, filename: "leo.jpg" }) });
    assert.equal(badRes.status, 401);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("photoFilename handles multiple photos of the same label without overwriting", () => {
  assert.equal(photoFilename("Z", "photo1.jpg"), "Z.jpg");
  assert.equal(photoFilename("Z", "photo1.jpg", 0), "Z.jpg");
  assert.equal(photoFilename("Z", "photo2.png", 1), "Z-2.png");
  assert.equal(photoFilename("Z", "photo3.jpeg", 2), "Z-3.jpeg");
  assert.equal(photoFilename("Z", "photo4.webp", 3), "Z-4.webp");
});

test("cleanExpiredUploads prunes accounts older than TTL and preserves recent accounts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wiggly-prune-"));
  const oldDir = path.join(root, "old_account");
  const newDir = path.join(root, "new_account");
  await mkdir(oldDir, { recursive: true });
  await mkdir(newDir, { recursive: true });
  await writeFile(path.join(oldDir, "test.jpg"), "photo");
  await writeFile(path.join(newDir, "test.jpg"), "photo");

  try {
    // Prune with a maxAgeMs of 0 to simulate expired accounts
    const pruned = await cleanExpiredUploads(root, 0);
    assert.ok(pruned.includes("old_account"));
    assert.ok(pruned.includes("new_account"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("draftMedia dynamically generates fresh signatures on every read even if videoUrl had an expired signature", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wiggly-dynamic-media-"));
  const outputs = path.join(root, "outputs");
  await mkdir(outputs, { recursive: true });
  const masterPath = path.join(outputs, "master-video.mp4");
  await writeFile(masterPath, "fake-mp4");

  const stateFile = path.join(outputs, "state.json");
  // Seed with an old expired URL (1 hour in the past)
  const expiredUrl = `https://wiggly.agentenamel.com/api/mcp/renders/job_1/master-video?exp=${Date.now() - 3600000}&sig=expired`;
  await writeFile(
    stateFile,
    JSON.stringify({
      assetFiles: { "master-video": masterPath },
      masterVideo: { videoPath: masterPath },
      videoUrl: expiredUrl,
    }),
  );

  try {
    const media = await draftMedia(stateFile, "job_1", "test-secret");
    assert.ok(media.videoUrl, "videoUrl must exist");
    assert.notEqual(media.videoUrl, expiredUrl, "videoUrl must be dynamically re-signed with fresh expiration");

    const parsed = new URL(media.videoUrl!);
    const exp = Number(parsed.searchParams.get("exp"));
    assert.ok(exp > Date.now() + 3600000, "Fresh signature expiration must be in the future (~2h)");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
