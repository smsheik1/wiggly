import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateScript, countWords, BANNED_AI_PATTERNS, validateTemporalGrounding } from "../runtime/validate-script.mjs";

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

test("validateScript rejects hallucinated multi-year timeframe when event is in current year", () => {
  const badTemporalScript = {
    schemaVersion: "shaz-script-v1",
    title: "GTA 6 Delay Hallucination",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Rockstar announced the official launch date for Grand Theft Auto VI.",
      counterintuitiveAngle: "Gamers are already calculating whether they can take time off.",
      concreteFactOrStory: "November 19, 2026 is confirmed as the target date for GTA 6.",
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "Mark November nineteenth on your calendar so you know the exact day your life officially ends.",
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Rockstar finally dropped the target date and every publisher is clearing their calendar.",
        impliedQuestion: "Did Rockstar lock the launch?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "That also means we still have two full years of watching clickbait YouTubers dissect blurry palm trees.",
        impliedQuestion: "Why is the wait painful?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Draft your fake doctor excuse now because nobody is showing up to work.",
        impliedQuestion: "What should gamers do?",
      },
    ],
    landing: {
      type: "question",
      text: "Are you booking PTO two years in advance or waiting for the inevitable delay?",
    },
  };

  const topic = {
    title: "Grand Theft Auto VI Is Scheduled for November 2026 Release",
    snippet: "Reports identify November 19, 2026, as the planned release date for Grand Theft Auto VI.",
  };
  const now = new Date("2026-11-07T12:00:00Z");

  assert.throws(
    () => validateScript(badTemporalScript, { topic, now }),
    (err) => {
      assert.match(err.message, /Script rejected by Temporal Linter/);
      assert.match(err.message, /two years/);
      return true;
    }
  );
});

test("validateScript rejects year-early claims when event is near-term in current year", () => {
  const badEarlyScript = {
    schemaVersion: "shaz-script-v1",
    title: "PS5 Pro Hoarding Hallucination",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Retailers report widespread shortages of PS5 consoles ahead of GTA 6.",
      counterintuitiveAngle: "Gamers are buying hardware immediately before launch.",
      concreteFactOrStory: "Limited console inventory reported in November 2026.",
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "You are dropping seven hundred bucks on a PS5 Pro, but storage is running out everywhere.",
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Retailers are running dry as desperate gamers hoard consoles a year early.",
        impliedQuestion: "Why are stores out of stock?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "Leaks say the install size sits at over two hundred massive gigabytes.",
        impliedQuestion: "What is the problem?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "You will literally have to delete your entire backlog just to see mud physics.",
        impliedQuestion: "What is the tradeoff?",
      },
    ],
    landing: {
      type: "question",
      text: "Are you ready to sacrifice every game you own just to rob gas stations in Florida?",
    },
  };

  const topic = {
    title: "GTA VI Anticipation Brings PS5 Shortages in November 2026",
    snippet: "Retailers report limited availability of PS5 consoles in November 2026.",
  };
  const now = new Date("2026-11-07T12:00:00Z");

  assert.throws(
    () => validateScript(badEarlyScript, { topic, now }),
    (err) => {
      assert.match(err.message, /Script rejected by Temporal Linter/);
      assert.match(err.message, /a year early/);
      return true;
    }
  );
});

test("validateScript rejects past years treated as future launch dates", () => {
  const staleFutureScript = {
    schemaVersion: "shaz-script-v1",
    title: "Stale Target Script",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Take-Two reiterated their release schedule.",
      counterintuitiveAngle: "Rumors of delay are rampant despite official statements.",
      concreteFactOrStory: "Financial earnings report reiterated the launch calendar.",
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "Everyone is arguing about GTA six, but the actual launch timeline never changed.",
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Take-Two reiterated the game is scheduled for Fall 2025 across all platforms.",
        impliedQuestion: "What did Take-Two say?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "The internet enters complete meltdown mode over a random tweet with zero proof.",
        impliedQuestion: "Why are fans panicking?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Publisher earnings reports remain the only source of reliable release information.",
        impliedQuestion: "What should gamers follow?",
      },
    ],
    landing: {
      type: "reframe",
      text: "So relax and stop believing every single fake leak on your feed.",
    },
  };

  const now = new Date("2026-11-07T12:00:00Z");

  assert.throws(
    () => validateScript(staleFutureScript, { now }),
    (err) => {
      assert.match(err.message, /references 2025 as an upcoming or target date/);
      return true;
    }
  );
});

test("validateScript accepts properly grounded temporal scripts", () => {
  const goodGroundedScript = {
    schemaVersion: "shaz-script-v1",
    title: "Properly Grounded GTA 6 Script",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "With GTA 6 dropping November 19, gaming enters lockdown in twelve days.",
      counterintuitiveAngle: "After twelve years of delays, the real panic is our destroyed sleep schedules.",
      concreteFactOrStory: "November 19, 2026 is less than two weeks away.",
    },
    hook: {
      formula: "uncomfortable-truth",
      text: "We spent over a decade convincing ourselves GTA Six was a myth, but we're twelve days away.",
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "November nineteenth is locked in, and the entire internet is clearing its calendar right now.",
        impliedQuestion: "Why is everyone scrambling?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "Nobody actually prepared for the reality of losing two hundred hours of sleep before Thanksgiving.",
        impliedQuestion: "What is the consequence?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Call your boss today, because Vice City takes over in less than two weeks.",
        impliedQuestion: "What should gamers do?",
      },
    ],
    landing: {
      type: "challenge",
      text: "Wrap up your real life chores this weekend, because after November nineteenth, we're gone.",
    },
  };

  const topic = {
    title: "Grand Theft Auto VI Is Scheduled for November 19, 2026 Release",
    snippet: "Reports identify November 19, 2026, as the planned release date for Grand Theft Auto VI.",
  };
  const now = new Date("2026-11-07T12:00:00Z");

  const result = validateScript(goodGroundedScript, { topic, now });
  assert.equal(result.valid, true);
});

test("validateScript accepts valid backgroundId and hashtags, and rejects invalid backgroundId", async () => {
  const raw = await fs.readFile(fixturePath, "utf8");
  const baseScript = JSON.parse(raw);

  // Valid background IDs
  for (const bg of ["living-room", "map-photo-zone", "sisters-room", "pure-white"]) {
    const valid = validateScript({ ...baseScript, backgroundId: bg, hashtags: ["#gaming", "#news"] });
    assert.equal(valid.valid, true);
  }

  // Invalid background ID
  assert.throws(
    () => validateScript({ ...baseScript, backgroundId: "underwater-cave" }),
    /script\.backgroundId 'underwater-cave' is invalid/
  );

  // Invalid hashtags
  assert.throws(
    () => validateScript({ ...baseScript, hashtags: "not-an-array" }),
    /script\.hashtags must be an array/
  );
});

