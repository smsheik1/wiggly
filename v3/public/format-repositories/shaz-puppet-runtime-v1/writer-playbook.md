# Shaz Scriptwriting Playbook

This playbook defines how the host coding agent writes scripts for the Shaz Puppet Runtime format.
A great script sounds like Shaz speaking naturally to a friend—never like generic AI prose.

---

## 1. The #1 Non-Negotiable Rule: "Therefore / But", Never "And Then"

Every narrative beat and block transition must connect with **THEREFORE** (causation) or **BUT** (tension/contrast) — never **AND THEN** (list of events).

- **Dead Script (Boring listicle):**
  > "We got a puppy. And then he started chewing shoes. And then my mom got mad. And then we tried to train him. And then we realized it was hard."
- **Alive Script (Compelling causality):**
  > "We got a puppy because we thought it would bring the house together. **BUT** from day one, we had zero idea what we were doing. **THEREFORE** Leo immediately identified the weakest link. **BUT** the real punchline wasn't the chewed sneakers..."

---

## 2. Channel Voice & Tone Standards

Shaz's voice is:
1. **Conversational, not academic:** Speaks like a smart friend, not a professor.
2. **Spoken contractions:** Always write *"it's"*, *"you're"*, *"we'd"*, *"didn't"*.
3. **Natural speech rhythm:** Light conversational connectors (*"honestly"*, *"basically"*, *"look"*) are welcome, but no corporate filler.
4. **Curious, not preachy:** Explores the human comedy with the viewer instead of lecturing them.
5. **Light self-deprecation:** Pokes gentle fun at relatable personal mistakes and small family absurdities.
6. **Vivid and concrete:** Paint pictures with specific nouns and actions. Hit the *"bridge over Hell"* standard—make the viewer see it immediately.

---

## 3. The 4 Hook Formulas (First 20–30% of Duration)

The hook must start *in medias res* (in the middle of the tension) without warm-up:

1. **The Uncomfortable Truth:**
   > *"Most people think getting a dog brings a family closer together. In reality, a dog just exposes who has the least discipline in the house."*
2. **The Surprising Stat / Fact:**
   > *"A puppy makes roughly 400 micro-decisions an hour. And in our house, he figured out who gives out unauthorized treats in under two minutes."*
3. **The Personal Confession:**
   > *"When my family decided to get a dog, we promised we'd be strict, disciplined trainers. We had no idea what we were doing."*
4. **The Setup-Payoff Tease:**
   > *"There's an unwritten golden rule in dog training that almost nobody talks about. And the punchline is: it has nothing to do with the dog."*

---

## 4. The 4-Shot Visual Alignment

Write beats with the Wiggly 4-shot studio palette in mind:

| Beat Role | Visual Match | Writing Style |
|---|---|---|
| **Hook / Intro** | `talk-to-camera` | Direct-to-audience conversational address with Shaz |
| **Core Claim / Thesis** | `text-card` | Short, punchy phrase (4–10 words) with key words to highlight |
| **Illustration / Context** | `b-roll` | Sensory description of an external event, setting, or object |
| **Reaction / Breakdown** | `chibi-commentary` | Witty takeaway paired with a topic card and Chibi routine |
| **Sign-Off / Punchline** | `talk-to-camera` | Warm, memorable final line delivering the emotional landing |

---

## 5. Pacing & Word Count Bounds

Speaking rate in animation is **140 to 160 words per minute** (approx. 2.4 to 2.6 words per second):
- **30-Second Short:** **70 to 85 words recommended** (`70–88` words hard gate in daily studio grounding; `55–88` words / `110–175 WPM` baseline kit validator range). Over 90 words sounds rushed.
- **60-Second Video:** **140 to 165 words maximum**.

---

## 6. Banned AI Tells (Automated Gate)

The single source of truth is `runtime/ai-tells.mjs`. `validateScript` rejects any script that trips a rule and names the offending text, and the daily studio prints the same list into the writer prompt. If this table and the code ever disagree, the code wins.

### 6a. Banned sentence patterns

| Pattern | Example (banned) | Write instead |
|---|---|---|
| Forced negation | *"That's not a patch, that's a roommate."* / *"You don't have a team problem. You have a calendar problem."* / *"It's not about X, it's about Y."* | Say the Y directly: *"The update moved in like a roommate."* |
| Repetition | *"It's loud. It's broken. It's expensive."* / *"Raise the price... Raise the price..."* / *"Old games hid... New games hide..."* / *"could be X, could be Y, could be Z"* | Vary how sentences start; make the point once |
| Echo fragments | *"Small."* / *"Sixty million."* / *"Again."* / *"Deserved."* | Fold it into a full sentence |
| Question-then-answer | *"The reason? An AI shortage."* / *"And honestly? Deserved."* | State it. A real question to the viewer is fine |
| Label openers | *"Respectfully, ..."* / *"Confession: ..."* / *"Hot take: ..."* | Just say the line |

Also avoid (not auto-checked): rhetorical lists of three, em dashes, and stacked adverbs like *"brutally"* or *"furiously"*.

Not banned on purpose: a plain concession like *"It's not cheap, but it works."*, and casual openers like *"honestly"* or *"look"* (Section 2).

### 6b. Banned words and stock phrases

| Banned | Write instead |
|---|---|
| *"in today's fast-paced world"*, *"it's important to note"*, *"at the end of the day"*, *"in conclusion"*, *"to sum up"*, *"in essence"*, *"key takeaway"* | Cut it and say the fact |
| *"delve into"*, *"dive into"*, *"let's dive in"*, *"deep dive"*, *"here's the thing"* | Start with the subject |
| *"game-changing"*, *"game changer"*, *"revolutionary"*, *"paradigm shift"* | Name the specific change |
| *"not only... but also..."* | Two plain sentences |
| *"testament to"*, *"stands as"*, *"beacon of"*, *"rich history"* | *"is"*, *"shows"*, or the specific story |
| *"tapestry"*, *"interplay"*, *"multifaceted"*, *"nuanced"* | Plain English, one specific angle |
| *"fosters"*, *"empowers"*, *"seamless"*, *"mastery"* | Concrete verbs, what actually works |
| *"the gaming/tech/media/... landscape"* | Name the specific space |
| *"crucial"*, *"vital"*, *"pivotal"* | Show the consequence |
| *"my/our/your/the whole journey"* (abstract) | The specific struggle |
| *"unveil"* | *"showed"*, *"announced"* |
| *"furthermore"*, *"moreover"* | *"therefore"* or *"but"* |
| *"plethora"*, *"myriad"* | *"lots of"* or the number |
| *"the question nobody asked"*, *"doing a lot of heavy lifting"*, *"let that sink in"*, *"calling it now"*, *"make it make sense"*, *"said no one ever"*, *"plot twist"*, *"buckle up"*, *"you can't make this up"*, *"we need to talk about"*, *"in a world where"*, *"it's giving"*, *"and that's the point/kicker"*, *"here's the kicker/catch"*, *"let's be real/honest"* | Stock internet filler: cut it |

Removed on 2026-11-18 because they blocked real terms: *"dynamic"* (dynamic pricing), *"explore"* (explore Vice City), *"unlock"* (unlock a character), *"realm"* and bare *"journey"* / *"landscape"* (game names, landscape mode).

---

## 7. Landing Types (Final 10–15% of Duration)

End on a strong, definitive beat. Never wind down or summarize:
- **The Reframe:** Look back at the premise with new meaning (*"Turns out Leo was the best-behaved one in that house the whole time."*).
- **The Challenge:** One concrete thing to do today.
- **The Twist:** A final revelation that turns the premise on its head.
- **The Thought-Provoking Question:** An open question the viewer keeps thinking about after scrolling.

---

## 8. TypeSafe AI Jev Voice Linter (Mandatory BYOK Gate)

When running `npm run lint:script`, `TYPESAFE_API_KEY` must be configured in `secrets.env`:
- **Model:** `jev-latest` at sub-200ms latency (~$0.00003 per script).
- **Check:** Measures probability of corporate PR speak, soulless buzzword density, and conversational authenticity.
- **Fail Boundary:** Automatically blocks scripts if Jev identifies a corporate/PR probability ≥ 75%, flagging the text to be rewritten with more direct, personal human phrasing before voice synthesis.
- **Zero Fallback Policy:** If `TYPESAFE_API_KEY` is missing or fails, execution halts immediately with clear setup instructions.

---

## 9. Temporal Grounding & Current Reality Rule (Mandatory Gate)

To prevent outdated AI slop and inaccurate timeframes:
1. **Present-Moment Grounding:** All scripts must be strictly calculated against the current calendar date (`new Date()`).
2. **Relative Countdown Accuracy:** If a headline or event lists a date (e.g. November 19, 2026), calculate exact days or weeks remaining relative to today. Never say "two years away", "years in advance", or "a year early" for an event in the same year or month.
3. **No Outdated Year References:** Past years (e.g. 2023, 2024, 2025) must never be framed as future launch targets.
4. **Automated Gate:** The script validator will automatically reject scripts containing hallucinated relative timeframes conflicting with the topic timeline.
