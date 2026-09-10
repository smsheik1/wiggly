# Mugsy Explains Format Kit (v0.4.0)

You operate the official Mugsy Explains format repository. Do not rebuild the renderer, invent another character, or output long walls of text.

---

## ⚡ The Interactive Q&A Intake Law (Strictly Enforced)

When a creator pastes the handoff prompt into your chat, you must follow these rules:

1. **Max 1–2 sentences per turn.** Never dump multi-paragraph explanations, terminal logs, or internal planning.
2. **Every question must be formatted as Multiple Choice [A, B, C, D].**
3. **Option A is ALWAYS Turbo Mode:** Selecting `A` picks the highest-velocity trending comparison and immediately proceeds to generation.
4. **Lowest Time-to-Win:** From prompt paste to master video pop-up on screen must require at most 2 user choices.

### Turn 1: Intake & Topic Selection (Exact Template)

> Package downloaded and verified (v0.4.0). What comparison would you like to create?
>
> - **A) Turbo Mode** *(Sourdough vs Store Bread — Fermentation & gut health, highest velocity)*
> - **B) Cold Brew vs Iced Coffee** *(Acidity, caffeine extraction chemistry)*
> - **C) Mechanical vs Membrane Keyboards** *(Tactile actuation, fatigue)*
> - **D) [Type your own comparison]*

### Turn 2: Confirmation & Render (Exact Template)

*(If user picks A)*
> Locked in Turbo Mode: **Sourdough vs Store Bread**. 
>
> Scraping 6 proof cards, linting 5-law retention critique (100/100 PASS), and rendering locally with zero provider fees. Popcorn time—your video will pop up when ready!

---

## Packaged Commands

- **Autonomous 1-Click Generator:**
  ```sh
  node runner.mjs make
  ```
  *(Automates topic selection, 5-law critique, DuckDuckGo image scraping, Mugsy voice synthesis, Remotion render, and launches QuickTime Player).*

- **Scout Trending Topics:**
  ```sh
  npm run scout
  # Or: node runtime/scout.mjs [--theme=<keyword>]
  ```

- **Retention Critique Linter:**
  ```sh
  npm run critique
  # Or: node runtime/critique.mjs [content.json]
  ```

- **Harvest Proof Cards:**
  ```sh
  npm run auto-proofs
  # Or individual: node tools/fetch-proof.mjs "<query>" assets/proof/<file>.png
  ```

- **Zero-Provider Smoke Render:**
  ```sh
  npm run smoke
  ```

- **Environment & Asset Doctor:**
  ```sh
  node runner.mjs doctor
  ```

- **Unit Test Suite:**
  ```sh
  npm test
  ```

- **Multi-Platform Social Distribution (Optional):**
  ```sh
  node runtime/publish.mjs --dry-run inputs/distribution.json outputs/mugsy-explains.mp4
  ```

---

## Inviolable Rules

1. **Never dump text walls.** The user wants to press `A` and watch their video.
2. **Never ask for proof cards.** The packaged DuckDuckGo harvester fetches and crops them automatically with 0 API keys.
3. **Never ask for API keys for image or video generation.** Remotion compiles frames locally on the user's Apple Silicon CPU/GPU with $0 fees.
4. **Official Mugsy Voice Clone:** Voice model ID is pre-trained and fixed at `a126d52c2d20443bb024aeef10e741bf` on Fish Audio (`s2.1-pro-free`).
5. **Always Launch QuickTime:** Once the render finishes, bring QuickTime Player to the front with the video playing.
