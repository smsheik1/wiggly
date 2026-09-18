# Shaz Research Playbook

This playbook defines how the host coding agent conducts topic research and framing for the Shaz Puppet Runtime format.

A great script cannot be written from thin research. Without surprising facts, concrete stories, counterintuitive angles, and emotional resonance, a script becomes well-structured fluff.

---

## 1. Channel Identity & Voice Goals

- **Format:** Animated short-form video (30–60s) or mid-form (2–5 min) driven by character Shaz.
- **Narrator:** Shaz — a smart, relatable friend explaining something you didn't know you needed to hear.
- **North Star:** Find topics at the intersection of *what people are already curious about* and *what contains enough surprising, emotional, story-rich material to carry the video.*
- **Golden Rule:** The content is the star. Personality is seasoning.

---

## 2. The 5 Proven Content Framing Templates

Use these 5 templates as inspiration and framing tools:

### 1. The Underestimated Champion
- *"Why [Subject] is the Most Underrated [Category]"*
- Triggers in-group bias — viewers want to be the ones who "finally get it."
- *Example:* "Why the 1-second pause is the most underrated communication tool."

### 2. The Comparison Gap
- *"[Small Number] vs [Massive Number]: The [Subject] Secret"*
- Creates a psychological bridge viewers feel compelled to cross.
- *Example:* "30 seconds vs 30 days: Why fast habits stick and slow habits die."

### 3. The Death of a Concept
- *"The Tragic Downfall of [Habit / Tool / Strategy]"*
- Fear of loss is stronger than desire for gain.
- *Example:* "The quiet death of the 8-hour workday."

### 4. The System Decoder
- *"How [Unexpected Person / Company] Actually Solved [Painful Problem]"*
- Positions the insight as a cheat code or exposé.
- *Example:* "How professional animators actually fix creative burnout."

### 5. The Hyper-Specific Absolute
- *"The Only [Rule / Framework] You Need in [Context]"*
- Reduces decision fatigue. Sounds definitive and authoritative.
- *Example:* "The only dog training rule that actually matters."

---

## 3. The 3 Pillars Every Topic Must Have

Before moving to the script stage, verify that your research contains all three pillars:

1. **The Counterintuitive Angle:**
   - What does common sense say? What is the *actual* reality?
   - *Example:* Common sense says getting a dog brings people together; reality is that a dog exposes the least disciplined person in the house.

2. **Concrete Proof or Vivid Analogy:**
   - Never rely on abstract words ("it is challenging", "efficiency is vital").
   - Use concrete, visual, sensory details or numbers (e.g., chewing shoes, 16% gap, 400ms pause, hair-thin bridge).

3. **Emotional Resonance (The Payoff):**
   - Start with curiosity or humor, but build toward a human insight.
   - Choose one emotional payoff:
     - **Validation:** "You're not broken; the system was designed this way."
     - **Reframe:** "It felt like a mistake at the time, but it taught you who you actually are."
     - **Empowerment / Challenge:** "One tiny shift today fixes the next 5 years."

---

## 4. Research Package Output Structure (`research.json`)

When you research a topic, package your findings in this structure:

```json
{
  "topic": "Puppy parenting and family discipline",
  "title": "What puppy parenting taught us about human discipline",
  "template": "The Hyper-Specific Absolute",
  "counterintuitiveAngle": "We thought getting a puppy was about training the dog, but it actually exposed which human has the least discipline in the house.",
  "concreteFactsAndStories": [
    "Puppy chewed through two pairs of sneakers in 48 hours.",
    "The house had three completely conflicting sets of rules from day one.",
    "A dog is only as well-trained as the least disciplined person in the household."
  ],
  "emotionalPayoff": {
    "type": "reframe",
    "insight": "Leo wasn't a bad dog—we were just chaotic roommates who couldn't agree on a bedtime."
  }
}
```
