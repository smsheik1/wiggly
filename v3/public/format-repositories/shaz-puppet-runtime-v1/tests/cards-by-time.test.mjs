import assert from "node:assert/strict";
import test from "node:test";

import { deriveMultiShotPlan, deriveMultiShotPlanWithJev } from "../runtime/multi-shot-timeline.mjs";

function makeTimedTranscript() {
  // Produces 7+ distinct beats (>= 7 words + 800ms pauses so groupTranscriptIntoBeats splits cleanly):
  // hook (0..2200ms), beat-0 (3000..16200ms spanning 5 beats), landing (17000..19200ms)
  const sentences = [
    ["Wait", "everybody", "look", "at", "this", "wild", "hardware", "leak", "today."],
    ["Sony", "just", "dropped", "retail", "prices", "on", "every", "slim", "bundle."],
    ["Big", "box", "retailers", "are", "cutting", "console", "prices", "this", "morning."],
    ["Initial", "store", "inventory", "vanished", "within", "minutes", "across", "major", "cities."],
    ["Preorder", "waitlists", "already", "stretched", "into", "next", "month", "for", "buyers."],
    ["Players", "online", "keep", "debating", "whether", "the", "upgrade", "even", "matters."],
    ["Would", "you", "actually", "spend", "cash", "right", "now", "on", "this?"],
  ];
  const raw = [];
  let t = 0;
  for (const words of sentences) {
    for (const w of words) {
      raw.push([w, t, t + 240]);
      t += 260;
    }
    t += 850;
  }
  return {
    text: raw.map(([w]) => w).join(" "),
    words: raw.map(([text, startMs, endMs], i) => ({
      id: `w${i + 1}`,
      text,
      startMs,
      endMs,
    })),
  };
}

const SCRIPT = {
  hook: {
    text: "Wait everybody look at this wild hardware leak today.",
    cardHeadline: "HOOK LEAK",
    cardBadge: "BREAKING",
  },
  beats: [
    {
      text: "Sony just dropped retail prices on every slim bundle. Big box retailers are cutting console prices this morning. Initial store inventory vanished within minutes across major cities. Preorder waitlists already stretched into next month for buyers. Players online keep debating whether the upgrade even matters.",
      cardHeadline: "MID PRICE DROP",
      cardBadge: "PRICE CUT",
    },
  ],
  landing: {
    text: "Would you actually spend cash right now on this?",
    cardHeadline: "CLOSING CALL",
    cardBadge: "VERDICT",
  },
};

test("deriveMultiShotPlan maps OTS headlines by audio time-span overlap, not clamped array index", () => {
  const transcript = makeTimedTranscript();
  const plan = deriveMultiShotPlan({
    transcript,
    script: SCRIPT,
    audioDurationSeconds: 22.8,
    brollMediaList: ["media/a.png", "media/b.png", "media/c.png"],
  });

  const otsShots = plan.shots.filter((s) => s.shotType === "talk-to-camera" && s.otsGraphic);
  assert.ok(otsShots.length >= 1, "expected at least one OTS shot");

  // Middle shots overlapping beat-0 [3000..19000ms] must all carry "MID PRICE DROP", never premature "CLOSING CALL"
  for (const shot of otsShots) {
    const midMs = (((shot.startFrame + shot.endFrameExclusive) / 2) / 24) * 1000;
    if (midMs >= 3200 && midMs <= 19000) {
      assert.equal(shot.otsGraphic.headline, "MID PRICE DROP");
    }
  }
});

test("deriveMultiShotPlanWithJev maps OTS headlines by time-span overlap across extra transcript beats", async () => {
  const transcript = makeTimedTranscript();
  const plan = await deriveMultiShotPlanWithJev({
    transcript,
    script: SCRIPT,
    audioDurationSeconds: 22.8,
    brollMediaList: ["media/a.png", "media/b.png", "media/c.png"],
    apiKey: "test-key",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        answers: {
          shot_type: { choice: "talk-to-camera" },
          shaz_puppet_pose: { choice: "present" },
          chibi_pose: { choice: "talk-gesture" },
          camera_motion: { choice: "zoom-in" },
          badge_category: { choice: "BREAKING" },
          is_punchline: { noul: 0.1 },
        },
      }),
    }),
  });

  const otsShots = plan.shots.filter((s) => s.shotType === "talk-to-camera" && s.otsGraphic);
  assert.ok(otsShots.length >= 1, "expected OTS shots on non-overlapping present/neutral poses");
  for (const shot of otsShots) {
    const midMs = (((shot.startFrame + shot.endFrameExclusive) / 2) / 24) * 1000;
    if (midMs >= 3200 && midMs <= 19000) {
      assert.equal(shot.otsGraphic.headline, "MID PRICE DROP");
    }
  }
});
