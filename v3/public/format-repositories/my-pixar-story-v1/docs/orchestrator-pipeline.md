# ORCHESTRATOR (LangGraph + SQLite, plain code, not an LLM)

dispatches every agent · stores every lock · enforces every gate · routes your messages

Every agent below is a deep agent: skill file + scoped inputs + plan + scratch files
+ scoped tools + typed submit. Doers make. Reviewers judge. Neither approves or locks.
Retries are capped; after the cap the stage goes to you.

## INTAKE
You answer the questionnaire
   ↓                              ↑ clarifying questions
Answers Organizer (questionnaire + your answers + skill)
   ↓
Questionnaire Reviewer (original answers + organized inputs + rubric + skill)
   ↓ you confirm → **ANSWERS LOCK**

## SCRIPT
Script Engineer (locked answers + your creative directions + skill)
   ↓                              ↑ evidenced notes and revisions
Script Reviewer (script + locked answers + rubric + skill)
   ↓ you approve the script and proposed cast → **SCRIPT LOCK**

## VOICE
Voice Clone Engineer (Cartesia; 10-30s sample + the typed line "this is my own or i have permission to use it" on first clone, or a verified existing clone + skill)
   ↓                              ↑ approve/reject + problem (bad sample → back to you)
Voice Clone Reviewer (original sample + audition line + similarity score + skill)
   ↓ you hear it and approve → **VOICE LOCK**

## NARRATION
Audio Engineer (Cartesia; voice ID + locked script + skill)
   ↓ 4 beat files, each exactly 15.0s, never sped up
Audio Reviewer (4 beat files + joined file + reference sample + locked script + measured results [ffprobe, speech-to-text diff, speaking rate, speaker similarity] + skill)
   ↓ pass     ↑ reject + evidence (too long → Script Engineer, with your OK)
   ↓ you play each beat and approve → **NARRATION LOCK**

══════ nothing visual (image or video) starts above this line ══════

## CHARACTERS (one pass per character and age)
Character Prompt Engineer (cast entry + photos + answers + skill)
   ↓ → Muse Image, 3 candidates
Character Image Reviewer (3 images + photos + cast entry + Pixar rules + skill)
   ↓                              ↑ reject + revision notes (bad photos → back to you)
   ↓ you pick 1 of 3
Sheet Prompter (chosen image + Pixar md + skill) → Muse Image → turnaround + 8 expressions
   ↓ reviewed again, you approve → **CAST LOCK** (once every character is done)

## BACKGROUNDS (one pass per location and angle)
Background Prompt Engineer (location entry + script + answers + character sheets + skill)
   ↓ → Muse Image, 3 candidates, no people
Background Image Reviewer (3 images + location entry + character sheets + skill)
   ↓                              ↑ reject + notes
   ↓ you pick 1 of 3 per location, approve each angle → **BACKGROUNDS LOCK**

## SHOT PLAN (order still open, see below)
Shot Planner (locked script + narration timing + cast + backgrounds + skill)
   ↓                              ↑ revisions
Shot Plan Reviewer (plan + script + cast + backgrounds + skill)
   ↓ you approve → **SHOT PLAN LOCK**

## KEYFRAMES (one per beat)
Keyframe Composer (shot plan + character sheets + background + skill)
   ↓ → Muse Image, 16:9, production-sized
Keyframe Reviewer (frame + same references + skill)
   ↓                              ↑ reject + notes
   ↓ you approve all 4 → **KEYFRAMES LOCK**

## VIDEO (one pass per beat, 4 total)
Video Prompt Engineer (beat script + beat audio + sheets + background + keyframe + skill)
   ↓                              ↑ revisions
Video Prompt Reviewer (video prompt + beat audio + references + skill)
   ↓ you approve prompts and exact spend → **SPEND APPROVED**
Seedance 2.0 Mini, 480p (silent clip; first frame = approved keyframe; own audio discarded)
   ↓                              ↑ repair notes (retries within spend cap)
Video Watcher Reviewer (clip + prompt + references + measured results + Gemini look + skill)
   ↓ you watch each clip and approve → **CLIPS LOCK**

## SOUND (optional; generation can start after narration lock, you approve after clips lock)
Sound Producer (locked script + narration word timings and silence windows + skill)
   ↓ → music model (instrumental only)
Sound Reviewer (stems + test mix + measured results + skill)
   ↓                              ↑ reject + evidence (capped retries, then narration only)
   ↓ you listen with the picture, or skip → **SOUND LOCK**

## FINISH
Compositor (4 clips + locked narration + sound mix + skill) → hard cuts, exactly 60.0s
   ↓
Final Reviewers, picture and audio separately (final film + locked narration + measured results + skill)
   ↓ you give final approval → **FINAL FILM**

---

## ARCHITECTURE UPGRADE: THE CASCADE PATTERN (FAST GATES)

To optimize for cost and latency, the Reviewer stage utilizes a **Model Cascade**:

1. **Fast Gate (Decisions API):** A fast, multi-modal decision model acts as the first line of defense. It evaluates the Doer's output for obvious objective failures (e.g., bad aspect ratio, malformed anatomy, missing subjects, continuity breaks).
   * *If FAIL:* Immediately route back to the Doer for a retry (bypassing the expensive Reviewer entirely).
   * *If PASS / UNSURE:* Escalate to the Heavy Reviewer.
2. **Heavy Reviewer (Frontier Model):** Only invoked if the Fast Gate is passed. It performs nuanced, computationally expensive subjective critique (e.g., "Does this perfectly match Pixar rendering rules?", "Is the emotional pacing correct?").
3. **Human Lock:** The final approval gate.

This ensures heavy models (and human attention) are never wasted on blatantly botched generations.
