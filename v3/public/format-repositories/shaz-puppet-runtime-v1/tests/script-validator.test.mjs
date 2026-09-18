import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateScript, countWords, BANNED_AI_PATTERNS } from "../runtime/validate-script.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(root, "../fixtures/script/sample-script.json");

test("sample-script.json validates cleanly against contract and linter", async () => {
  const raw = await fs.readFile(fixturePath, "utf8");
  const script = JSON.parse(raw);
  const result = validateScript(script);

  assert.equal(result.valid, true);
  assert.ok(result.totalWords >= 55 && result.totalWords <= 90);
  assert.equal(result.targetDurationSeconds, 30);
  assert.equal(result.beatCount, 3);
});

test("validateScript rejects banned AI tells with exact pattern name", () => {
  const badScript = {
    schemaVersion: "shaz-script-v1",
    title: "Bad AI Script",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Valid research insight for testing purposes",
      counterintuitiveAngle: "Valid counterintuitive angle for testing",
      concreteFactOrStory: "Valid concrete fact or story detail"
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "In today's fast-paced world, puppy training is a crucial journey."
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Let's dive in and delve into this game-changing paradigm shift.",
        impliedQuestion: "What is this topic about?"
      }
    ],
    landing: {
      type: "reframe",
      text: "At the end of the day, dogs foster deeper connections."
    }
  };

  assert.throws(
    () => validateScript(badScript),
    (err) => {
      assert.match(err.message, /banned AI buzzwords/);
      assert.match(err.message, /in today's fast-paced world/);
      assert.match(err.message, /delve\/dive into/);
      assert.match(err.message, /game-changing/);
      return true;
    }
  );
});

test("validateScript rejects missing causality connectors (NONE after beat 1)", () => {
  const disconnectedScript = {
    schemaVersion: "shaz-script-v1",
    title: "Disconnected Script",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Valid research insight for testing purposes",
      counterintuitiveAngle: "Valid counterintuitive angle for testing",
      concreteFactOrStory: "Valid concrete fact or story detail"
    },
    hook: {
      formula: "personal-confession",
      text: "I used to think training our puppy was going to be simple and quick."
    },
    beats: [
      {
        id: "beat-01",
        connector: "NONE",
        text: "First we bought a crate and placed it in the living room.",
        impliedQuestion: "What happened next?"
      },
      {
        id: "beat-02",
        connector: "NONE",
        text: "Then he started howling every morning at five thirty AM.",
        impliedQuestion: "Why did he howl?"
      }
    ],
    landing: {
      type: "challenge",
      text: "So check your schedule before bringing home a lively four-month puppy."
    }
  };

  assert.throws(
    () => validateScript(disconnectedScript),
    /All beats after the first must connect with 'THEREFORE' or 'BUT'/
  );
});

test("validateScript rejects word counts that violate pacing bounds", () => {
  const bloatedScript = {
    schemaVersion: "shaz-script-v1",
    title: "Bloated Script",
    targetDurationSeconds: 15,
    research: {
      primaryInsight: "Valid research insight for testing purposes",
      counterintuitiveAngle: "Valid counterintuitive angle for testing",
      concreteFactOrStory: "Valid concrete fact or story detail"
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "This is a ridiculously long hook designed to pack so many words into a fifteen second video that it would be physically impossible for any human or character to speak without sounding like a machine gun firing syllables across the microphone."
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "And here is another block of forty words just continuing on and on without stopping or taking a breath to prove that word count validation works properly.",
        impliedQuestion: "Will it ever end?"
      }
    ],
    landing: {
      type: "reframe",
      text: "Finally we conclude this paragraph with even more words to guarantee failure."
    }
  };

  assert.throws(
    () => validateScript(bloatedScript),
    /Total script word count/
  );
});
