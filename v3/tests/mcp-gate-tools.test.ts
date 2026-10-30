import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { approveDraft, runDraftTick } from "../features/mcp/draft-worker";
import { runWritingJob } from "../features/mcp/gate-tools";
import { signRender } from "../features/mcp/photo-store";
import { publicOrigin } from "../features/mcp/public-origin";
import { draftMedia } from "../features/mcp/render-stage";
import { MemoryFilmLedger, type Storyboard } from "../features/mcp/film-ledger";

const studioParent = "/Users/shaz/Projects/wiggly-my-pixar-story-studio/public/format-repositories";
const studioRoot = path.join(studioParent, "my-pixar-story-v2");
process.env.WIGGLY_FORMAT_STUDIOS = studioParent;

const storyboard: Storyboard = {
  format: "my-pixar-story",
  title: "Sunday",
  subject: "Leo",
  beats: Array.from({ length: 7 }, () => ({ duration_sec: 4, action: "Leo looks up.", camera: "Wide." })),
  characters: [{ name: "Leo", skinTone: "olive", description: "A round face with warm olive skin and short dark hair." }],
  hero_props: [],
};

function fixture(name: string) {
  return JSON.parse(readFileSync(path.join(studioRoot, "tests/fixtures", name), "utf8"));
}

function openJob(runsRoot: string) {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  ledger.attachPhotos("user_1", ["Leo"]);
  const started = ledger.submitDraft("user_1", { storyboard });
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error("submit failed");
  return { ledger, jobId: String(started.data.job_id), runsRoot };
}

async function putState(job: ReturnType<typeof openJob>, state: Record<string, unknown>) {
  const stateFile = path.join(job.runsRoot, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(state));
  job.ledger.setRun("user_1", job.jobId, { runId: job.jobId, stateFile });
  return stateFile;
}

test("the format kit tells the agent the writing tool order", () => {
  const skill = readFileSync(path.join(process.cwd(), "public/format-repositories/my-pixar-story-v1/SKILL.md"), "utf8");
  assert.match(skill, /wiggly_story_director/);
  assert.match(skill, /wiggly_character_architect/);
  assert.match(skill, /wiggly_get_draft/);
  assert.match(skill, /wiggly_seedance_compiler/);
  assert.doesNotMatch(skill, /wiggly_submit_film/);
});

test("a bad story-director draft returns gate errors and spends nothing", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-bad-${Date.now()}`);
  const job = openJob(runsRoot);
  await putState(job, { status: "writing", inputs: { subject: "Leo", answers: {}, photoReferences: [] }, attempts: {}, passed: {} });
  const result = await runWritingJob({
    job: "story-director",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    draft: {},
    runsRoot,
  });
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /SCHEMA_REJECTED|failed the deterministic gate/);
  const account = job.ledger.exportState("user_1");
  assert.equal(account.monthlyCredits + account.purchasedCredits, 1900);
  assert.equal(account.jobs[0].creditsCharged, 0);
});

test("storyboard is refused before the sheet assets are approved", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-board-${Date.now()}`);
  const job = openJob(runsRoot);
  await putState(job, {
    status: "writing",
    passed: { "story-director": true, "character-architect": true, "location-scout": true },
    characterArchitect: { output: { characters: [{ imageTag: "@Image 1" }] } },
    locationScout: { output: { locations: [{ elementTag: "@Loc 1" }] } },
    approvedAssets: {},
  });
  const result = await runWritingJob({
    job: "storyboard-artist",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    runsRoot,
  });
  assert.equal(result.ok, false);
  assert.match(result.message ?? "", /Approve the sheet assets first/);
  assert.equal(job.ledger.exportState("user_1").monthlyCredits, 1900);
});

test("the story director packet hides the photo path and the character architect returns the file", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-photo-${Date.now()}`);
  const photo = path.join(runsRoot, "Leo.jpg");
  await mkdir(runsRoot, { recursive: true });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await writeFile(photo, jpeg);
  const story = fixture("good-stage-play.json");
  const card = structuredClone(story.cast[0]);
  card.photoRef = "Leo";
  const look = {
    id: "Leo",
    name: "Leo",
    realPerson: "Leo",
    skinTone: "olive",
    description: "A round face with warm olive skin and short dark hair.",
    path: photo,
    url: "https://wiggly.example/Leo.jpg",
  };
  const director = openJob(runsRoot);
  await putState(director, {
    status: "writing",
    inputs: { subject: "Leo", answers: {}, photoReferences: [look] },
  });
  const directed = await runWritingJob({
    job: "story-director",
    ledger: director.ledger,
    accountId: "user_1",
    jobId: director.jobId,
    runsRoot,
  });
  assert.equal(directed.ok, true);
  const packet = JSON.stringify(directed.data?.input);
  assert.equal(packet.includes(photo), false);
  const person = (directed.data?.input as { photoCharacters: Array<{ skinTone: string; description: string }> }).photoCharacters[0];
  assert.equal(person.skinTone, "olive");
  assert.ok(person.description.length >= 10);

  const architect = openJob(path.join(runsRoot, "architect"));
  const state = {
    status: "writing",
    inputs: { subject: "Leo", answers: {}, photoReferences: [look] },
    storyDirector: { ...story, cast: [card, ...story.cast.slice(1)] },
    passed: { "story-director": true },
  };
  await putState(architect, state);
  const drawn = await runWritingJob({
    job: "character-architect",
    ledger: architect.ledger,
    accountId: "user_1",
    jobId: architect.jobId,
    runsRoot: architect.runsRoot,
  });
  assert.equal(drawn.ok, true, drawn.message);
  const notes = (drawn.data?.input as { photoNotes: Array<{ photoFile?: string }> }).photoNotes;
  const note = notes.find((item) => item.photoFile);
  assert.match(note?.photoFile ?? "", /^\/references\/photos\/Leo\.jpg$/);
  const { photoFilesFor } = await import(pathToFileURL(path.join(studioRoot, "graph/deep-agent-node.mjs")).href);
  const mapped = photoFilesFor("character-architect", drawn.data?.input, state);
  assert.equal(mapped[note?.photoFile ?? ""], photo);
  assert.equal(existsSync(photo), true);
  assert.equal(drawn.images?.[0]?.mimeType, "image/jpeg");
  assert.equal(drawn.images?.[0]?.data, jpeg.toString("base64"));
});

test("a character-architect retry keeps a character that already passed", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-merge-${Date.now()}`);
  const job = openJob(runsRoot);
  const story = fixture("good-stage-play.json");
  const sheets = fixture("good-character-sheets.json");
  const keptTag = sheets.characters[0].elementTag as string;
  const broken = structuredClone(sheets);
  broken.characters[1].masterRenderPrompt.promptText += " He holds a heavy firefighter axe in his hands.";
  const stateFile = await putState(job, {
    status: "writing",
    storyDirector: story,
    passed: { "story-director": true },
    attempts: {},
  });
  const first = await runWritingJob({
    job: "character-architect",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    draft: broken,
    runsRoot,
  });
  assert.equal(first.ok, false);
  assert.match(first.message ?? "", /failed the deterministic gate/);
  const afterFirst = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(typeof afterFirst.keptCharacters[keptTag], "object");
  assert.equal(afterFirst.keptCharacters[broken.characters[1].elementTag], undefined);

  const retry = structuredClone(sheets);
  retry.characters[0].masterRenderPrompt.promptText += " He holds a heavy firefighter axe in his hands.";
  const second = await runWritingJob({
    job: "character-architect",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    draft: retry,
    runsRoot,
  });
  const afterSecond = JSON.parse(await readFile(stateFile, "utf8"));
  const saved = afterSecond.characterArchitect?.output?.characters?.find((item: { elementTag: string }) => item.elementTag === keptTag)
    ?? afterSecond.keptCharacters?.[keptTag];
  assert.equal(saved.elementTag, keptTag);
  assert.equal(String(saved.masterRenderPrompt.promptText).includes("firefighter axe"), false);
  assert.equal(second.ok, true, second.message);
  assert.equal(job.ledger.exportState("user_1").jobs[0].creditsCharged, 0);
});

test("an animatic rejection reopens the named writer and refuses Seedance", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-reject-${Date.now()}`);
  const job = openJob(runsRoot);
  const story = fixture("good-stage-play.json");
  const sheets = fixture("good-character-sheets.json");
  const plates = fixture("good-location-plates.json");
  await putState(job, {
    status: "writing",
    storyDirector: story,
    characterArchitect: { output: sheets },
    locationScout: { output: plates },
    passed: {
      "story-director": true,
      "character-architect": true,
      "location-scout": true,
      "storyboard-artist": true,
    },
    approvedShotTimings: [{ shotId: "1.1", startSec: 0, endSec: 2, durationSec: 2 }],
    animaticApproval: { decision: "reject", target: "storyboard-artist", notes: "Cut the bike shot." },
    revisionNotes: { "storyboard-artist": "Cut the bike shot." },
  });
  const seedance = await runWritingJob({
    job: "seedance-compiler",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    runsRoot,
  });
  assert.equal(seedance.ok, false);
  assert.match(seedance.message ?? "", /wiggly_storyboard_artist/);
  const board = await runWritingJob({
    job: "storyboard-artist",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    runsRoot,
  });
  assert.equal(board.ok, true, board.message);
  assert.match(String(board.data?.retryNotes ?? ""), /Cut the bike shot/);
});

test("passed look jobs render one sheet and pause for the person's approval", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-sheet-${Date.now()}`);
  const job = openJob(runsRoot);
  await putState(job, {
    status: "writing",
    passed: { "story-director": true, "character-architect": true, "location-scout": true },
    characterArchitect: {
      output: {
        characters: [{
          imageTag: "@Image 1",
          name: "Leo",
          characterId: "leo",
          masterRenderPrompt: { promptText: "Leo stands in a studio.", aspectRatio: "1:1" },
        }],
      },
    },
    locationScout: { output: { locations: [] } },
  });
  let calls = 0;
  let stored = job.ledger.exportState("user_1");
  const lines = await runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [] }],
    loadAccount: () => stored,
    saveAccount: (_id, next) => { stored = next; },
    runsRoot,
    renderStill: async (request) => {
      calls += 1;
      await mkdir(path.dirname(String(request.dest)), { recursive: true });
      await writeFile(String(request.dest), "png");
      return { dest: request.dest };
    },
    renderClip: async () => { throw new Error("A clip must not render with the sheets."); },
  });
  assert.equal(calls, 1);
  assert.match(lines[0] ?? "", /awaiting-approval/);
  assert.equal(stored.jobs[0]?.creditsCharged, 8);
  assert.equal(stored.monthlyCredits, 1892);
});

test("a short balance pauses the sheet and does not call the painter", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-short-${Date.now()}`);
  const job = openJob(runsRoot);
  const account = job.ledger.exportState("user_1");
  account.monthlyCredits = 0;
  job.ledger.importState("user_1", account);
  await putState(job, {
    status: "writing",
    passed: { "story-director": true, "character-architect": true, "location-scout": true },
    characterArchitect: {
      output: {
        characters: [{
          imageTag: "@Image 1",
          name: "Leo",
          characterId: "leo",
          masterRenderPrompt: { promptText: "Leo stands in a studio.", aspectRatio: "1:1" },
        }],
      },
    },
    locationScout: { output: { locations: [] } },
  });
  let calls = 0;
  let stored = job.ledger.exportState("user_1");
  const lines = await runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [] }],
    loadAccount: () => stored,
    saveAccount: (_id, next) => { stored = next; },
    runsRoot,
    renderStill: async () => {
      calls += 1;
      return { dest: "/tmp/should-not-render.png" };
    },
    renderClip: async () => { throw new Error("no clip"); },
  });
  assert.equal(calls, 0);
  assert.match(lines[0] ?? "", /awaiting-credits/);
  assert.equal(stored.jobs[0]?.creditsCharged, 0);
});

test("a topped-up balance resumes the paused sheet and charges one still", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-resume-${Date.now()}`);
  const job = openJob(runsRoot);
  const account = job.ledger.exportState("user_1");
  account.monthlyCredits = 0;
  job.ledger.importState("user_1", account);
  await putState(job, {
    status: "writing",
    passed: { "story-director": true, "character-architect": true, "location-scout": true },
    characterArchitect: {
      output: {
        characters: [{
          imageTag: "@Image 1",
          name: "Leo",
          characterId: "leo",
          masterRenderPrompt: { promptText: "Leo stands in a studio.", aspectRatio: "1:1" },
        }],
      },
    },
    locationScout: { output: { locations: [] } },
  });
  let stored = job.ledger.exportState("user_1");
  const tick = (renderStill: (request: { dest?: string }) => Promise<{ dest?: string }>) => runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [] }],
    loadAccount: () => stored,
    saveAccount: (_id, next) => { stored = next; },
    runsRoot,
    renderStill,
    renderClip: async () => { throw new Error("no clip"); },
  });
  await tick(async () => { throw new Error("the painter must wait"); });
  stored.monthlyCredits = 8;
  job.ledger.importState("user_1", stored);
  stored = job.ledger.exportState("user_1");
  let calls = 0;
  const lines = await tick(async (request) => {
    calls += 1;
    await mkdir(path.dirname(String(request.dest)), { recursive: true });
    await writeFile(String(request.dest), "png");
    return { dest: request.dest };
  });
  assert.equal(calls, 1);
  assert.match(lines[0] ?? "", /awaiting-approval/);
  assert.equal(stored.jobs[0]?.creditsCharged, 8);
});

test("an approval with no picture is refused", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-blind-${Date.now()}`);
  const job = openJob(runsRoot);
  const stateFile = await putState(job, {
    status: "awaiting-approval",
    renderStage: "sheets",
    pendingApproval: ["@Image 1"],
    assetFiles: {},
  });
  const result = await approveDraft({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    decision: { approvedAssets: { "@Image 1": "missing" } },
    resumeGraph: async () => { throw new Error("resume must not run"); },
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /pictures are not ready/);
  const media = await draftMedia(stateFile, job.jobId, "secret");
  assert.deepEqual(media.stills, []);
});

test("a rendered sheet is returned as a signed url and an image", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-media-${Date.now()}`);
  const job = openJob(runsRoot);
  const picture = path.join(runsRoot, job.jobId, "assets", "leo.png");
  await mkdir(path.dirname(picture), { recursive: true });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  await writeFile(picture, png);
  const stateFile = await putState(job, { status: "awaiting-approval", assetFiles: { "@Image 1": picture } });
  const media = await draftMedia(stateFile, job.jobId, "secret");
  assert.equal(media.stills[0]?.tag, "@Image 1");
  const exp = Number(new URL(media.stills[0]!.url).searchParams.get("exp"));
  assert.equal(media.stills[0]?.url, `${publicOrigin()}${signRender("secret", job.jobId, "@Image 1", exp)}`);
  assert.equal(media.images[0]?.data, png.toString("base64"));
});

test("a passed storyboard renders panels from the approved sheet files", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-panels-${Date.now()}`);
  const job = openJob(runsRoot);
  const story = fixture("good-stage-play.json");
  const sheets = fixture("good-character-sheets.json");
  const plates = fixture("good-location-plates.json");
  const { selectStoryboardArtistInput } = await import(pathToFileURL(path.join(studioRoot, "crew/storyboard-artist/input.mjs")).href);
  const { draftStoryboard } = await import(pathToFileURL(path.join(studioRoot, "tests/fixtures/storyboard-draft.mjs")).href);
  const look = { storyDirector: story, characterArchitect: { output: sheets }, locationScout: { output: plates } };
  const boardInput = selectStoryboardArtistInput(look);
  const output = draftStoryboard(boardInput);
  const sheetFile = path.join(runsRoot, "sheet.png");
  await mkdir(runsRoot, { recursive: true });
  await writeFile(sheetFile, "png");
  const approved: Record<string, string> = {};
  const assetFiles: Record<string, string> = {};
  for (const character of sheets.characters ?? []) {
    approved[character.imageTag] = "paid";
    assetFiles[character.imageTag] = sheetFile;
  }
  for (const location of plates.locations ?? []) {
    approved[location.elementTag] = "paid";
    assetFiles[location.elementTag] = sheetFile;
  }
  await putState(job, {
    status: "writing",
    ...look,
    storyboardArtist: { output },
    passed: {
      "story-director": true,
      "character-architect": true,
      "location-scout": true,
      "storyboard-artist": true,
    },
    approvedAssets: approved,
    assetFiles,
  });
  const refs: string[][] = [];
  let stored = job.ledger.exportState("user_1");
  const lines = await runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [] }],
    loadAccount: () => stored,
    saveAccount: (_id, next) => { stored = next; },
    runsRoot,
    renderStill: async (request) => {
      refs.push(request.referencePaths ?? []);
      await mkdir(path.dirname(String(request.dest)), { recursive: true });
      await writeFile(String(request.dest), "png");
      return { dest: request.dest };
    },
    renderClip: async () => { throw new Error("A clip must not render with the panels."); },
  });
  assert.ok(refs.length > 0, lines[0]);
  assert.ok(refs.some((paths) => paths.includes(sheetFile)));
  assert.match(lines[0] ?? "", /awaiting-approval/);
  assert.equal(stored.jobs[0]?.creditsCharged, refs.length * 8);
});

test("an approved production renders a two-second clip for 42 credits and assembles the film", async () => {
  const { execFileSync } = await import("node:child_process");
  const runsRoot = path.join(tmpdir(), `wiggly-gate-clip-${Date.now()}`);
  const job = openJob(runsRoot);
  const picture = path.join(runsRoot, "sheet.png");
  await mkdir(runsRoot, { recursive: true });
  await writeFile(picture, "png");
  await putState(job, {
    status: "writing",
    passed: {
      "story-director": true,
      "character-architect": true,
      "location-scout": true,
      "storyboard-artist": true,
      "seedance-compiler": true,
    },
    characterArchitect: { output: { characters: [{ imageTag: "@Image 1" }] } },
    locationScout: { output: { locations: [] } },
    approvedAssets: { "@Image 1": "paid" },
    approvedShotTimings: [{ shotId: "1.1", startSec: 0, endSec: 2, durationSec: 2 }],
    assetFiles: { "@Image 1": picture },
    seedanceCompiler: { output: { segments: [{ segmentId: 1, totalDurationSec: 2 }] } },
  });
  let clips = 0;
  let stored = job.ledger.exportState("user_1");
  const paused = await runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [] }],
    loadAccount: () => stored,
    saveAccount: (_id, next) => { stored = next; },
    runsRoot,
    renderStill: async () => { throw new Error("no still"); },
    renderClip: async () => {
      clips += 1;
      throw new Error("the clip must wait for production approval");
    },
  });
  assert.equal(clips, 0);
  assert.match(paused[0] ?? "", /awaiting-approval/);
  job.ledger.importState("user_1", stored);
  const approved = await approveDraft({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    decision: { decision: "approve" },
    resumeGraph: async () => { throw new Error("the text crew must not resume"); },
    renderStill: async () => { throw new Error("no still"); },
    renderClip: async (request) => {
      clips += 1;
      assert.equal(request.duration, 2);
      const dest = path.join(runsRoot, job.jobId, "clip.mp4");
      await mkdir(path.dirname(dest), { recursive: true });
      execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-pix_fmt", "yuv420p", dest], { stdio: "ignore" });
      return { dest, videoPath: dest };
    },
  });
  assert.equal(approved.ok, true, approved.ok ? "" : approved.message);
  assert.equal(clips, 1);
  assert.equal(job.ledger.exportState("user_1").jobs[0]?.creditsCharged, 42);
  const stateFile = job.ledger.exportState("user_1").jobs[0]?.stateFile ?? "";
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(existsSync(state.assetFiles?.["master-video"]), true);
  assert.match(state.videoUrl, /^https?:\/\/.+\/api\/mcp\/renders\/.+\/master-video\?/);
  assert.equal(job.ledger.exportState("user_1").jobs[0]?.stage, "ready");
});

test("a passed draft sent again does not burn an attempt", async () => {
  const runsRoot = path.join(tmpdir(), `wiggly-gate-again-${Date.now()}`);
  const job = openJob(runsRoot);
  const stateFile = await putState(job, {
    status: "writing",
    passed: { "story-director": true },
    attempts: { "story-director": 2 },
    inputs: { subject: "Leo", answers: {}, photoReferences: [] },
  });
  const result = await runWritingJob({
    job: "story-director",
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    draft: { junk: true },
    runsRoot,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data?.attempt, 2);
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(state.attempts["story-director"], 2);
});
