import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// 1. Read API Key from secrets.env
function loadApiKey() {
  const secretsPath = path.resolve(process.cwd(), "secrets.env");
  if (fs.existsSync(secretsPath)) {
    const lines = fs.readFileSync(secretsPath, "utf-8").split("\n");
    for (const line of lines) {
      if (line.startsWith("TYPESAFE_API_KEY=")) {
        return line.split("=")[1].trim();
      }
    }
  }
  return process.env.TYPESAFE_API_KEY || null;
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("❌ No TYPESAFE_API_KEY found in secrets.env");
  process.exit(1);
}

// 2. Sample 5-Beat Shaz Commentary Script
const scriptBeats = [
  {
    beat: 1,
    label: "Hook / Breaking News",
    sentence: "Sony just dropped the PS5 Pro announcement, and it is seventy percent more expensive than anyone expected.",
  },
  {
    beat: 2,
    label: "The Unbelievable Detail",
    sentence: "Seven hundred dollars for a home console, and they didn't even include a disc drive or the vertical stand in the box.",
  },
  {
    beat: 3,
    label: "Skeptical Analysis",
    sentence: "Let's be completely honest with ourselves. Who exactly is upgrading their existing console for slightly shinier reflections in Spider-Man?",
  },
  {
    beat: 4,
    label: "Community Roast / Punchline",
    sentence: "The community reaction has been pure chaos. People are legitimately joking that buying a plane ticket to Japan to buy a Japanese PS5 is cheaper.",
  },
  {
    beat: 5,
    label: "Outro / Question to Viewers",
    sentence: "Drop a comment below: are you actually buying this thing on day one, or is Sony completely out of touch?",
  },
];

// 3. Contrast Scripts for Test 2 (Script Linter / AI-Tell Gate)
const corporateAiScript = `In today's ever-evolving gaming landscape, Sony Interactive Entertainment has unveiled its latest hardware offering, the PlayStation 5 Pro. Featuring state-of-the-art graphical fidelity and enhanced computational capabilities, this premium system represents a notable step forward. However, consumer discourse remains polarized regarding its premium price point. It remains to be seen how the market will respond in the quarters ahead.`;

const authenticScoutScript = `Sony really looked gamers in the face and said 'seven hundred dollars, and buy your own disc drive.' The Reddit threads are in complete meltdown. Mark Gurman called the pricing aggressive, but gamers are calling it an eviction notice.`;

async function callJev(state, questions) {
  const t0 = performance.now();
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state,
      questions,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const elapsedMs = Math.round(performance.now() - t0);
  return { data, elapsedMs };
}

async function runEvaluation() {
  console.log("================================================================================");
  console.log("🚀 TESTING JEV UTILITY FOR SHAZ PUPPET RUNTIME (LIVE BENCHMARK)");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: The 5-Beat Director (Pose + Camera + Theme)
  // ---------------------------------------------------------------------------
  console.log("🎬 TEST 1: Full 5-Beat Video Director (Simulating analyzeSentenceSemantics & Camera)");
  console.log("Evaluating entire script beat-by-beat with Jev...\n");

  let totalTokens = 0;
  let totalTime = 0;

  for (const item of scriptBeats) {
    const { data, elapsedMs } = await callJev(item.sentence, {
      chibi_pose: {
        type: "choice",
        instructions: "Which animated Shaz character gesture fits the comedic tone of this beat best?",
        criteria: {
          "point-emphasis": "Asserting a fact, dropping a bomb, pointing out something crucial",
          "facepalm": "Total disbelief, exasperation, facepalm moment at stupidity",
          "shrug-open": "Confusion, questioning who this is for, 'who knows', helplessness",
          "think-chin": "Analyzing logically, skeptical thinking, pondering",
          "present-card": "Presenting data, asking a question, welcoming, wrapping up",
          "talk-gesture": "General speaking animation, narrative momentum",
        },
      },
      camera_motion: {
        type: "choice",
        instructions: "Which virtual camera move matches the drama and pacing of this line?",
        criteria: {
          "snap-punch": "Sudden hard punch-in on a shocking detail or comedic punchline",
          "slow-push": "Slow gradual cinematic push-in building dramatic tension",
          "slow-pull": "Pulling back to reveal context or wide reaction",
          "static": "Calm holding shot for neutral setup or outro",
        },
      },
      badge_category: {
        type: "choice",
        instructions: "What short graphic badge category should display on the topic card?",
        criteria: {
          "BREAKING": "Breaking news, fresh announcement, new reveal",
          "THE CLASH": "Controversy, fight, debate, community outrage, chaos",
          "REALITY CHECK": "Skeptical analysis, logic check, questioning claims",
          "COMMUNITY ROAST": "Jokes, memes, viral comments, roasts",
          "YOUR VERDICT": "Audience call to action, question to the viewer",
        },
      },
      is_punchline: {
        type: "noul",
        instructions: "Is this sentence delivering a comedic punchline or sarcastic joke?",
      },
    });

    totalTokens += (data.usage?.input_tokens || 0);
    totalTime += elapsedMs;

    const answers = data.answers;
    console.log(`[Beat ${item.beat}] "${item.label}"`);
    console.log(`  🗣️ Line: "${item.sentence}"`);
    console.log(`  ⚡ Latency: ${elapsedMs}ms | Tokens: ${data.usage?.input_tokens}`);
    console.log(`  🎭 Pose: [${answers.chibi_pose.choice}] (confidence: ${Math.round(answers.chibi_pose.confidence * 100)}%)`);
    console.log(`  🎥 Camera: [${answers.camera_motion.choice}] (confidence: ${Math.round(answers.camera_motion.confidence * 100)}%)`);
    console.log(`  🏷️ Badge: [${answers.badge_category.choice}] (confidence: ${Math.round(answers.badge_category.confidence * 100)}%)`);
    console.log(`  💥 Punchline Probability: ${Math.round(answers.is_punchline.noul * 100)}%`);
    console.log("--------------------------------------------------------------------------------");
  }

  const avgLatency = Math.round(totalTime / scriptBeats.length);
  const costEstimate = (totalTokens / 1_000_000) * 0.042;
  console.log(`\n📊 TEST 1 SUMMARY:`);
  console.log(`   - Average beat latency: ${avgLatency}ms`);
  console.log(`   - Total input tokens: ${totalTokens}`);
  console.log(`   - Total cost for directing full 5-beat video: $${costEstimate.toFixed(6)} (< 1/500th of a cent!)\n`);

  // ---------------------------------------------------------------------------
  // TEST 2: Script Quality & AI-Tell Linter (Corporate PR vs Authentic Gamer Scoop)
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("🛡️ TEST 2: Script AI-Tell & Authentic Voice Linter (validate-script.mjs)");
  console.log("================================================================================\n");

  const linterQuestions = {
    is_corporate_pr_speak: {
      type: "noul",
      instructions: "Does this read like canned, corporate PR buzzwords or an automated generic AI summary ('in today's landscape', 'polarizing discourse', 'notable step forward')?",
    },
    has_authentic_voice: {
      type: "noul",
      instructions: "Does this have the authentic voice of a human internet creator speaking directly and bluntly to their audience?",
    },
    script_grade: {
      type: "choice",
      instructions: "Grade the script quality for an entertaining commentary video.",
      criteria: {
        "pass": "Authentic, punchy, conversational, engaging",
        "reject-corporate": "Dry, wooden, reads like a press release or LinkedIn post",
        "reject-cliche": "Uses standard AI clichés and generic filler phrases",
      },
    },
  };

  console.log("Analyzing Sample A: Corporate ChatGPT Summary...");
  const sampleA = await callJev(corporateAiScript, linterQuestions);
  console.log(`  ⚡ Latency: ${sampleA.elapsedMs}ms`);
  console.log(`  ⚠️ Corporate PR Speak Probability: ${Math.round(sampleA.data.answers.is_corporate_pr_speak.noul * 100)}%`);
  console.log(`  🎙️ Authentic Human Voice Probability: ${Math.round(sampleA.data.answers.has_authentic_voice.noul * 100)}%`);
  console.log(`  🚦 Decision: [${sampleA.data.answers.script_grade.choice}] (confidence: ${Math.round(sampleA.data.answers.script_grade.confidence * 100)}%)\n`);

  console.log("Analyzing Sample B: Authentic Reddit Scout Scoop...");
  const sampleB = await callJev(authenticScoutScript, linterQuestions);
  console.log(`  ⚡ Latency: ${sampleB.elapsedMs}ms`);
  console.log(`  ⚠️ Corporate PR Speak Probability: ${Math.round(sampleB.data.answers.is_corporate_pr_speak.noul * 100)}%`);
  console.log(`  🎙️ Authentic Human Voice Probability: ${Math.round(sampleB.data.answers.has_authentic_voice.noul * 100)}%`);
  console.log(`  🚦 Decision: [${sampleB.data.answers.script_grade.choice}] (confidence: ${Math.round(sampleB.data.answers.script_grade.confidence * 100)}%)\n`);

  console.log("================================================================================");
  console.log("🏁 ALL TESTS COMPLETE!");
  console.log("================================================================================");
}

runEvaluation().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
