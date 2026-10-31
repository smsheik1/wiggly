import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryFilmLedger, type Storyboard } from "../features/mcp/film-ledger";
import { advanceRender, dueStage } from "../features/mcp/render-stage";

const studioParent = "/Users/shaz/Projects/wiggly-my-pixar-story-studio/public/format-repositories";
const studioRoot = path.join(studioParent, "my-pixar-story-v2");
if (existsSync(studioRoot)) {
  process.env.WIGGLY_FORMAT_STUDIOS = studioParent;
}

const storyboard: Storyboard = {
  format: "my-pixar-story",
  title: "Sunday",
  subject: "Leo",
  beats: Array.from({ length: 7 }, () => ({ duration_sec: 10, action: "Leo looks up.", camera: "Wide." })),
  characters: [{ name: "Leo", skinTone: "olive", description: "An adult man with short dark hair and a trimmed beard." }],
  hero_props: [],
};

function createRunningJob(accountId = "test_user") {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount(accountId, { subscribed: true, monthlyCredits: 1900 });
  ledger.attachPhotos(accountId, ["Leo"]);
  const submitted = ledger.submitDraft(accountId, { storyboard });
  if (!submitted.ok) throw new Error("Job creation failed in test");
  const jobId = String(submitted.data.job_id);
  ledger.setStage(accountId, jobId, "running");
  return { ledger, jobId };
}

test("dueStage self-heals a job falsely marked awaiting-approval when pictures are missing", async () => {
  if (!existsSync(studioRoot)) return;
  const stateWithMissingPics = {
    status: "awaiting-approval",
    passed: {
      "character-architect": true,
      "location-scout": true,
    },
    characterArchitect: {
      output: {
        characters: [{ imageTag: "@Image 1", characterId: "c1", name: "Leo" }],
      },
    },
    locationScout: {
      output: {
        locations: [{ elementTag: "@Loc 1", locationId: "l1", name: "Kitchen" }],
      },
    },
    approvedAssets: {},
    assetFiles: {},
  };

  const stage = await dueStage(stateWithMissingPics, "my-pixar-story");
  assert.equal(stage, "sheets", "dueStage must rewind to 'sheets' when assets were never generated");
});

test("dueStage respects awaiting-approval when all asset pictures are ready", async () => {
  if (!existsSync(studioRoot)) return;
  const stateWithReadyPics = {
    status: "awaiting-approval",
    passed: {
      "character-architect": true,
      "location-scout": true,
    },
    characterArchitect: {
      output: {
        characters: [{ imageTag: "@Image 1", characterId: "c1", name: "Leo" }],
      },
    },
    locationScout: {
      output: {
        locations: [{ elementTag: "@Loc 1", locationId: "l1", name: "Kitchen" }],
      },
    },
    approvedAssets: {},
    assetFiles: {
      "@Image 1": "/tmp/img1.png",
      "@Loc 1": "/tmp/loc1.png",
    },
  };

  const stage = await dueStage(stateWithReadyPics, "my-pixar-story");
  assert.equal(stage, null, "dueStage must return null when pictures are actually generated and awaiting human decision");
});

test("advanceRender halts at status: 'failed' when still rendering fails, never entering awaiting-approval", async () => {
  if (!existsSync(studioRoot)) return;
  const runDir = path.join(tmpdir(), `wiggly-render-halt-${Date.now()}`);
  await mkdir(path.join(runDir, "outputs"), { recursive: true });
  await mkdir(path.join(runDir, "assets"), { recursive: true });

  const { ledger, jobId } = createRunningJob("halt_user");

  const state = {
    status: "running",
    renderStage: "sheets",
    passed: {
      "character-architect": true,
      "location-scout": true,
    },
    characterArchitect: {
      output: {
        characters: [{
          imageTag: "@Image 1",
          characterId: "c1",
          name: "Leo",
          masterRenderPrompt: { promptText: "Leo Pixar style", aspectRatio: "1:1" },
        }],
      },
    },
    locationScout: {
      output: {
        locations: [],
      },
    },
    approvedAssets: {},
    assetFiles: {},
  };

  try {
    const result = await advanceRender({
      state,
      runDir,
      ledger,
      accountId: "halt_user",
      jobId,
      renderStill: async () => {
        throw new Error("HTTP 401: Replicate API token invalid or missing");
      },
      renderClip: async () => ({ dest: "/tmp/clip.mp4" }),
    });

    assert.ok(result, "advanceRender must return a merged state");
    assert.equal(result.status, "failed", "failed still generation must halt with status: 'failed'");
    assert.notEqual(result.status, "awaiting-approval", "failed still generation must NEVER enter awaiting-approval");
    assert.deepEqual(result.assetFiles ?? {}, {}, "no assets should be recorded on failure");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("advanceRender removes checkpoint.json on fresh render passes but preserves it on resume", async () => {
  if (!existsSync(studioRoot)) return;
  const runDir = path.join(tmpdir(), `wiggly-checkpoint-${Date.now()}`);
  const checkpointFile = path.join(runDir, "outputs", "checkpoint.json");
  const destFile = path.join(runDir, "assets", "Image 1-c1.png");
  await mkdir(path.join(runDir, "outputs"), { recursive: true });
  await mkdir(path.join(runDir, "assets"), { recursive: true });
  await writeFile(checkpointFile, JSON.stringify({ dummy: "stale_checkpoint" }));

  const { ledger, jobId } = createRunningJob("checkpoint_user");

  const state = {
    status: "awaiting-approval",
    renderStage: "sheets",
    passed: {
      "character-architect": true,
      "location-scout": true,
    },
    characterArchitect: {
      output: {
        characters: [{
          imageTag: "@Image 1",
          characterId: "c1",
          name: "Leo",
          masterRenderPrompt: { promptText: "Leo Pixar style", aspectRatio: "1:1" },
        }],
      },
    },
    locationScout: {
      output: {
        locations: [],
      },
    },
    approvedAssets: {},
    assetFiles: {},
  };

  try {
    const result = await advanceRender({
      state,
      runDir,
      ledger,
      accountId: "checkpoint_user",
      jobId,
      renderStill: async () => {
        await writeFile(destFile, "image_bytes");
        return { dest: destFile };
      },
      renderClip: async () => ({ dest: "/tmp/clip.mp4" }),
    });

    assert.ok(result, "advanceRender must complete");
    assert.equal(result.status, "awaiting-approval", "successful still pass should now pause at awaiting-approval with real images");
    const assetFiles = (result.assetFiles ?? {}) as Record<string, string>;
    assert.ok(assetFiles["@Image 1"], "asset file must be recorded");
    assert.equal(assetFiles["@Image 1"], destFile);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
