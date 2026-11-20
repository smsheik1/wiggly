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

test("validateScript enforces opt-in grounded claims, quote verification, spoken numeric fidelity, and studio word bounds", async () => {
  const articleText = [
    "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026 for PlayStation 5 and Xbox Series X consoles.",
    "The base digital edition will retail for $69.99 worldwide with a 120GB storage footprint according to storefront listings.",
    "Analysts expect pre-orders to open across participating retail stores next Monday morning.",
  ].join(" ");

  const buildGrounded = (overrides = {}) => ({
    schemaVersion: "shaz-script-v1",
    sourceUrl: "https://news.example.com/gta6-date",
    title: "GTA 6 Launches November 19",
    headline: "GTA 6 NOVEMBER LAUNCH",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Rockstar locked the November launch date and base retail pricing globally.",
      counterintuitiveAngle: "Console players still need 120GB of free SSD space ready before pre-load day.",
      concreteFactOrStory: "Digital copies cost $69.99 on PlayStation 5 and Xbox Series X at launch.",
    },
    claims: [
      {
        target: "hook",
        says: "Rockstar confirmed GTA VI launches November 19, 2026 for PS5 and Xbox Series X.",
        quote: "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026",
      },
      {
        target: "beat-01",
        says: "Base price is $69.99 with 120GB storage required.",
        quote: "base digital edition will retail for $69.99 worldwide with a 120GB storage footprint",
      },
    ],
    hook: {
      formula: "surprising-stat",
      text: "Rockstar just confirmed GTA six launches in 12 days on console, and your home storage drive is officially cooked right now.",
    },
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Clear out 120GB right now because the base digital edition alone costs $69.99 worldwide.",
        impliedQuestion: "What does the base game cost and require?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "At least pre-orders open across retail stores Monday morning so you still have time to budget.",
        impliedQuestion: "When do pre-orders actually go live?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Delete three bloated shooters tonight before everybody else starts downloading Vice City at launch.",
        impliedQuestion: "What should players prepare tonight?",
      },
    ],
    landing: {
      type: "question",
      text: "Are you paying $69.99 on day one or waiting until next month?",
    },
    ...overrides,
  });

  const topic = { title: "Grand Theft Auto VI Launches November 19, 2026" };
  const now = new Date("2026-11-07T12:00:00Z");

  // Valid grounded script (~85 words? Wait — let's check exact range inside 70–88!)
  const okRes = validateScript(buildGrounded(), {
    topic,
    now,
    minWords: 70,
    maxWords: 88,
    articleText,
    requireGroundedClaims: true,
  });
  assert.equal(okRes.valid, true);
  assert.ok(okRes.totalWords >= 70 && okRes.totalWords <= 88);

  // Under 70 words fails under tight studio bounds (even though legacy kit allows 55)
  const shortGrounded = buildGrounded({
    hook: {
      formula: "surprising-stat",
      text: "Rockstar just confirmed GTA six launches in 12 days right now.",
    },
    landing: { type: "question", text: "Buying day one or waiting later tonight?" },
  });
  assert.throws(
    () =>
      validateScript(shortGrounded, {
        topic,
        now,
        minWords: 70,
        maxWords: 88,
        articleText,
        requireGroundedClaims: true,
      }),
    /70–88 words/,
  );

  // Missing hook claim fails
  assert.throws(
    () =>
      validateScript(
        buildGrounded({
          claims: [
            { target: "beat-01", says: "Pricing confirmed at $69.99 worldwide.", quote: "base digital edition will retail for $69.99 worldwide with a 120GB" },
            { target: "beat-02", says: "Pre-orders open Monday morning at stores.", quote: "pre-orders to open across participating retail stores next Monday" },
          ],
        }),
        { topic, now, minWords: 70, maxWords: 88, articleText, requireGroundedClaims: true },
      ),
    /at least one claim targeting 'hook'/,
  );

  // Quote not present in article fails
  assert.throws(
    () =>
      validateScript(
        buildGrounded({
          claims: [
            { target: "hook", says: "Runs on Xbox One consoles too.", quote: "also launching natively on Xbox One consoles worldwide" },
            { target: "beat-01", says: "Base price is $69.99.", quote: "base digital edition will retail for $69.99 worldwide" },
          ],
        }),
        { topic, now, minWords: 70, maxWords: 88, articleText, requireGroundedClaims: true },
      ),
    /did not appear verbatim/,
  );

  // Hallucinated price in spoken text fails even if quotes match
  assert.throws(
    () =>
      validateScript(
        buildGrounded({
          landing: {
            type: "question",
            text: "Are you paying $99.99 on day one or waiting until next month?",
          },
        }),
        { topic, now, minWords: 70, maxWords: 88, articleText, requireGroundedClaims: true },
      ),
    /Unfounded numeric claim in speech.*\$99\.99/,
  );

  // Smart quotes in claim quotes still match straight ASCII quotes in article
  const quotedArticle = articleText + " “Rockstar’s launch lineup stays locked for consoles.”";
  const smartQuoteRes = validateScript(
    buildGrounded({
      claims: [
        { target: "hook", says: "Launch lineup is locked.", quote: "\"Rockstar's launch lineup stays locked for consoles.\"" },
        { target: "beat-01", says: "Base price is $69.99.", quote: "base digital edition will retail for $69.99 worldwide" },
      ],
    }),
    { topic, now, minWords: 70, maxWords: 88, articleText: quotedArticle, requireGroundedClaims: true },
  );
  assert.equal(smartQuoteRes.valid, true);
});


