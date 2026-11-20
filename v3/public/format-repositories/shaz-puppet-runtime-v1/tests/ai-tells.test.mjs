import assert from "node:assert/strict";
import test from "node:test";

import { AI_TELL_WORDS, describeAiTellsForPrompt, findAiTells } from "../runtime/ai-tells.mjs";
import { validateScript } from "../runtime/validate-script.mjs";

const ids = (text) => findAiTells(text).map((f) => f.id);

const MUST_CATCH = [
  ["forced-negation", "That's not a patch, that's a roommate moving in."],
  ["forced-negation", "That's not soft, that's math."],
  ["forced-negation", "You don't have a team problem. You have a calendar problem."],
  ["forced-negation", "It isn't a console. It's a PC in a trench coat."],
  ["forced-negation", "It's not about the price, it's about respect."],
  ["repetition", "It's loud. It's broken. It's expensive."],
  ["repetition", "Raise the price of anything else. Raise the price of Labo cardboard."],
  ["repetition", "Old games hid stuff for fun. New games hide stuff behind a store page."],
  ["repetition", "The price moves for reasons, could be demand, could be your wallet, could be you sighing."],
  ["echo-fragment", "It went from 50 gigs to 366. Small."],
  ["echo-fragment", "Sony is testing dynamic pricing. Again."],
  ["question-then-answer", "The reason? An AI-driven memory shortage."],
  ["question-then-answer", "And honestly? He earned it."],
  ["label-opener", "Confession: I check the store every day."],
  ["label-opener", "Look at this. Respectfully, the reality check is crunch."],
  ["word", "Somebody answered the question nobody asked."],
  ["word", "That yet is doing a lot of heavy lifting."],
  ["word", "Microsoft swears it's a console, but let's be real, it's a PC."],
];

for (const [id, text] of MUST_CATCH) {
  test(`catches ${id}: ${text.slice(0, 48)}`, () => {
    assert.ok(ids(text).includes(id), `expected ${id} in ${JSON.stringify(findAiTells(text))}`);
  });
}

const MUST_ALLOW = [
  "You can explore Vice City on day one and unlock a hidden character.",
  "Journey is still a beautiful game, and Realm Royale is still around.",
  "Sony's dynamic pricing test is back on the PS5 store.",
  "It's not cheap, but it works.",
  "I'm not sure it's worth it. It's a lot of money for a controller.",
  "Honestly, I'd buy it. Look, the price is fine.",
  "Would you buy a console that runs your whole Steam library?",
  "The landscape mode on the Switch 2 looks great.",
  "The PS5 Pro costs $499.99 worldwide, and version 2.5 of the patch is 40.5 GB.",
  // Approved style samples (2026-11-18), each 74-82 words, must stay clean.
  "Nier: Automata got a small update on Steam, and the install went from 50 gigs to 366. I've lived in apartments with less storage than that. The game is about robots wondering why they exist, and after this download my SSD is wondering the same thing. Somewhere a developer typed minor fixes into the patch notes and went to lunch. I'm scared to see what a major update looks like. Probably ships with a building permit and a moving truck.",
  "I check the PlayStation Store the way my uncle checks crypto, and now Sony's been caught testing dynamic pricing on PS5 again. Nobody outside Sony knows what makes the price move, so I'm assuming it reacts to me sighing near the console. A disc on a shelf never did this to me. It cost what the sticker said and minded its own business. I'm going back to physical copies, and my shelf is thrilled about the company.",
  "IShowSpeed just passed 60 million YouTube subscribers and is now the most-followed streamer on the whole platform. That's a stadium full of people who signed up to watch one guy yell at everything with his entire chest, and he earned every one of them. Nobody on YouTube commits to a bit harder. Meanwhile I spent last night rendering one cartoon blink. What's the most unhinged thing you'd do on camera for that many subscribers?",
];

for (const text of MUST_ALLOW) {
  test(`allows normal speech: ${text.slice(0, 48)}`, () => {
    assert.deepEqual(findAiTells(text), []);
  });
}

test("validateScript rejects a structural tell and names the offending text", () => {
  const script = {
    schemaVersion: "shaz-script-v1",
    title: "Tell Test",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Valid research insight for testing purposes",
      counterintuitiveAngle: "Valid counterintuitive angle for testing",
      concreteFactOrStory: "Valid concrete fact or story detail",
    },
    hook: { formula: "uncomfortable-truth", text: "That's not a patch, that's a roommate moving into your SSD tonight." },
    beats: [{ id: "beat-01", connector: "THEREFORE", text: "Steam says the install is huge now.", impliedQuestion: "How big?" }],
    landing: { type: "reframe", text: "Buy a bigger drive before the next small update lands." },
  };
  assert.throws(() => validateScript(script), (err) => {
    assert.match(err.message, /banned AI buzzwords\/tells/);
    assert.match(err.message, /forced negation/);
    assert.match(err.message, /That's not a patch, that's/);
    return true;
  });
});

test("prompt text is generated from the same list the validator uses", () => {
  const prompt = describeAiTellsForPrompt();
  for (const w of AI_TELL_WORDS) assert.ok(prompt.includes(w.name), `prompt missing ${w.name}`);
  for (const label of ["Forced negation", "Repetition", "Echo fragments", "Question-then-answer", "Label openers"]) {
    assert.ok(prompt.includes(label), `prompt missing ${label}`);
  }
});

test("over-broad bans stay removed (real terms must not be blocked)", () => {
  const names = AI_TELL_WORDS.map((w) => w.name).join(" | ");
  for (const removed of ["dynamic", "explore", "unlock", "realm"]) {
    assert.ok(!new RegExp(`(^|[ /|])${removed}([ /|]|$)`).test(names), `${removed} should not be banned`);
  }
});
