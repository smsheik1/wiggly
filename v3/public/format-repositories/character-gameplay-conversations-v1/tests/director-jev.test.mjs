import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directGameplayConversation,
  evaluateGameplayTurnDirector,
  getTypesafeApiKey,
  planGameplayTurnDeterministic,
  VALID_DELIVERY_ATTITUDES,
  VALID_TURN_ROLES,
  VALID_VISUAL_EMPHASES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const benchmarkInputPath = path.join(rootDir, "inputs", "why-batman-wont-kill-joker.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test gameplay state",
        questions: {},
        apiKey: null,
        fetchFn: () => {
          throw new Error("Should not fetch when key is missing");
        },
      });
    },
    (err) => {
      assert.match(err.message, /TYPESAFE_API_KEY IS MISSING/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/dashboard/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/keys/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/billing/);
      assert.match(err.message, /secrets\.env/);
      assert.match(err.message, /TYPESAFE_API_KEY=your_copied_key_here/);
      return true;
    }
  );
});

test("Rule 12: director-jev throws a loud error with baby steps on HTTP API failure", async () => {
  const mockFailingFetch = async () => ({
    ok: false,
    status: 402,
    text: async () => JSON.stringify({ error: "Insufficient credits" }),
  });

  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test state",
        questions: {},
        apiKey: "test-fake-key",
        fetchFn: mockFailingFetch,
      });
    },
    (err) => {
      assert.match(err.message, /JEV DIRECTOR API ERROR \(HTTP 402\)/);
      assert.match(err.message, /Insufficient credits/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/billing/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/keys/);
      return true;
    }
  );
});

test("evaluateGameplayTurnDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        turn_role: {
          choice: "forensic-counter",
          confidence: 0.96,
        },
        delivery_attitude: {
          choice: "deadpan-stoic",
          confidence: 0.98,
        },
        visual_emphasis: {
          choice: "punch-in-cut",
          confidence: 0.92,
        },
        is_punchline: {
          condition: false,
          probability: 0.08,
        },
      },
    }),
  });

  const evaluation = await evaluateGameplayTurnDirector(
    { speaker: "batman", text: "If I cross that line, I become what I swore to destroy.", durationSeconds: 4.2 },
    {
      apiKey: "mock-key",
      fetchFn: mockFetch,
      turnContext: {
        turnIndex: 1,
        totalTurns: 4,
        recentAttitudes: ["incredulous-banter"],
        recentEmphases: ["steady-focus"],
      },
    }
  );

  assert.equal(evaluation.turnRole, "forensic-counter");
  assert.equal(evaluation.deliveryAttitude, "deadpan-stoic");
  assert.equal(evaluation.visualEmphasis, "punch-in-cut");
  assert.equal(evaluation.isPunchline, false);
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
});

test("variety-first planner prevents monotonous delivery attitudes and visual emphases", () => {
  const raw = JSON.parse(readFileSync(benchmarkInputPath, "utf8"));
  const turns = raw.turns;

  const recentAttitudes = [];
  const recentEmphases = [];

  for (let i = 0; i < turns.length; i += 1) {
    const context = {
      turnIndex: i,
      totalTurns: turns.length,
      recentAttitudes: [...recentAttitudes],
      recentEmphases: [...recentEmphases],
    };

    const plan = planGameplayTurnDeterministic(turns[i], { turnContext: context });

    assert.ok(VALID_TURN_ROLES.includes(plan.turnRole));
    assert.ok(VALID_DELIVERY_ATTITUDES.includes(plan.deliveryAttitude));
    assert.ok(VALID_VISUAL_EMPHASES.includes(plan.visualEmphasis));

    if (recentAttitudes.length > 0) {
      assert.notEqual(plan.deliveryAttitude, recentAttitudes[0], `Turn ${i} repeated attitude ${recentAttitudes[0]}`);
    }
    if (recentEmphases.length > 0) {
      assert.notEqual(plan.visualEmphasis, recentEmphases[0], `Turn ${i} repeated emphasis ${recentEmphases[0]}`);
    }

    recentAttitudes.unshift(plan.deliveryAttitude);
    recentEmphases.unshift(plan.visualEmphasis);
  }
});

test("directGameplayConversation produces valid contract-compliant episode output in deterministic mode", async () => {
  const raw = JSON.parse(readFileSync(benchmarkInputPath, "utf8"));
  const directed = await directGameplayConversation(raw, { mode: "deterministic" });

  assert.equal(directed.schemaVersion, 1);
  assert.equal(directed.turns.length, raw.turns.length);

  for (const turn of directed.turns) {
    assert.ok(VALID_TURN_ROLES.includes(turn.direction.turnRole));
    assert.ok(VALID_DELIVERY_ATTITUDES.includes(turn.direction.deliveryAttitude));
    assert.ok(VALID_VISUAL_EMPHASES.includes(turn.direction.visualEmphasis));
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const raw = JSON.parse(readFileSync(benchmarkInputPath, "utf8"));
  const singleTurn = raw.turns[0];

  try {
    const res = await evaluateGameplayTurnDirector(singleTurn, {
      apiKey,
      turnContext: {
        turnIndex: 0,
        totalTurns: raw.turns.length,
        recentAttitudes: [],
        recentEmphases: [],
      },
    });

    assert.ok(VALID_TURN_ROLES.includes(res.turnRole));
    assert.ok(VALID_DELIVERY_ATTITUDES.includes(res.deliveryAttitude));
    assert.ok(VALID_VISUAL_EMPHASES.includes(res.visualEmphasis));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
