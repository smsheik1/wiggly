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
- **30-Second Short:** **70 to 85 words maximum**. (Scripts over 90 words will spill over or sound rushed).
- **60-Second Video:** **140 to 165 words maximum**.

---

## 6. The 26 Banned AI Buzzwords & Tells (Automated Gate)

The script linter will automatically **fail** any script containing these robotic phrases:

| Banned Phrase / Pattern | Why it is banned | What to use instead |
|---|---|---|
| *"in today's fast-paced world"* | Classic AI filler | Just state the observation |
| *"it's important to note"* | Empty throat-clearing | Say the fact directly |
| *"delve into"* / *"dive into"* | AI clichéd metaphor | *"look at"*, *"break down"*, or start |
| *"game-changing"* / *"revolutionary"* | Hype inflation | Describe the actual specific change |
| *"at the end of the day"* | Cliché padding | Cut it |
| *"in conclusion"* / *"to sum up"* | School essay framing | Deliver the final punchline |
| *"let's dive in"* / *"here's the thing"* | Collaborative meta-chatter | Cut it |
| *"not only... but also..."* | Stilted rhetorical cadence | Write two clean sentences |
| *"testament to"* / *"stands as"* | Flowery academic prose | Use *"is"* or *"shows"* |
| *"paradigm shift"* | Corporate jargon | Explain what actually shifted |
| *"tapestry"* / *"interplay"* | AI favorite metaphors | Plain English |
| *"multifaceted"* / *"nuanced"* | Academic dodging | Pick a specific angle |
| *"fosters"* / *"empowers"* | Corporate pitch talk | Concrete active verbs |
| *"landscape"* / *"realm"* | Vague abstraction | Name the specific space |
| *"crucial"* / *"vital"* / *"pivotal"* | Inflated adjective | Show the consequence |
| *"seamless"* / *"mastery"* | Marketer speak | Describe what works |
| *"beacon of"* | Melodramatic trope | Describe the reality |
| *"journey"* (as abstract concept) | Self-help cliché | Describe the specific struggle |
| *"dynamic"* (as buzzword) | Vague filler | Show the movement |
| *"unveil"* / *"unlock"* | Generic teaser word | Reveal the fact directly |
| *"rich history"* | Tourist brochure copy | Share the specific story |
| *"explore"* / *"deep dive"* | Meta-announcement | Get into the subject |
| *"key takeaway"* | Corporate meeting bullet | State the lesson plainly |
| *"furthermore"* / *"moreover"* | Academic transition | Use *"therefore"* or *"but"* |
| *"in essence"* | Filler | Say the thing |
| *"plethora"* / *"myriad"* | Thesaurus padding | Use *"lots of"*, *"dozens"*, or the number |

---

## 7. Landing Types (Final 10–15% of Duration)

End on a strong, definitive beat. Never wind down or summarize:
- **The Reframe:** Look back at the premise with new meaning (*"Leo wasn't a bad dog—we were just chaotic roommates."*).
- **The Challenge:** One concrete thing to do today.
- **The Twist:** A final revelation that turns the premise on its head.
- **The Thought-Provoking Question:** An open question the viewer keeps thinking about after scrolling.

---

## 8. TypeSafe AI Jev Voice Linter (Optional BYOK Gate)

When a `TYPESAFE_API_KEY` is present in `secrets.env` or the environment, `npm run lint:script` complements the deterministic 26-tell regex suite with an instant System One semantic check:
- **Model:** `jev-latest` at sub-200ms latency (~$0.00003 per script).
- **Check:** Measures probability of corporate PR speak, soulless buzzword density, and conversational authenticity.
- **Fail Boundary:** Automatically blocks scripts if Jev identifies a corporate/PR probability ≥ 75%, flagging the text to be rewritten with more direct, personal human phrasing before voice synthesis.
- If no key is set, the linter runs purely offline on the deterministic regex and causality rules.
