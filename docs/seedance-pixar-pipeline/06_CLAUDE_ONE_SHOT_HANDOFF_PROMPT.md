# THE ONE-SHOT HANDOFF PROMPT FOR CLAUDE

> **INSTRUCTIONS FOR USER:**  
> Copy the text block below and paste it directly into a new Claude chat (or your development agent) tomorrow. It contains all context, constraints, data schemas, skills, and code templates required to build the entire pipeline in a single turn without back-and-forth.

---

```text
You are an elite Autonomous AI Systems Engineer and LangGraph Architect. Your objective is to build out a complete, production-grade AI Animation Pipeline that replicates Dan Kieft's Pixar-level multi-shot workflow using ByteDance Seedance 2.5, OpenAI GPT Image 2, ByteDance Seedream 5.0 Pro, and Nano Banana Pro.

### 1. Architectural Mandates (Do Not Deviate)
1. NO LLM ORCHESTRATOR: State tracking and routing must be handled deterministically by LangGraph's native StateGraph and Python transitions. Do not use an LLM supervisor.
2. NO LLM REVIEWER: Use a deterministic Python validation function for all mathematical checks (30s hard ceiling, integer whole seconds, non-overlapping timecodes, brace-isolated dialogue, element tag parity, live-action token bans).
3. HUMAN-IN-THE-LOOP CHECKPOINT: Include an approval gate after the script/storyboard stage before asset synthesis begins.
4. TWO-TIER SKILL ARCHITECTURE: Use a shared Core Engine (house style, 30s limit, #B5B5B5 backdrop) + specialized role-specific overlays (StoryDirector, CharacterArchitect, ModelSheetCompiler, LocationScout, SeedanceCompiler).
5. 1 BLOCK = 1 CUT: In video prompt compilation, paragraph breaks inside [SHOTS] indicate cuts. Continuous camera moves must stay in one single block with "One continuous move — the camera never stops and never cuts."
6. VOCAL CONTINUITY VIA BLACK MP4 STEMS: Implement the FFmpeg utility that cuts dialogue stems from Gen 1 and creates <30s black-screen MP4 containers to bind as @Char_voice in Extend/Sequel mode.

### 2. State & Data Models
Implement the following Pydantic schemas:
- VerbatimDialogue: speaker_tag, line in {}, is_voiceover, is_off_camera.
- Shot: shot_number, start_sec, end_sec, camera_and_staging, dialogue, cut_type, is_continuous_move.
- SegmentScript: segment_id, title, total_duration_sec (<=30), goal_summary, continuity_locks, shots.
- CharacterDesign: name, element_tag, age, heads_tall (Toddler 4, Child 5, Adult 7), silhouette_shape, exaggeration, counterpart, skin_zoning, single_saturated_accent, master_render_prompt, format_b_sheet_prompt.
- LocationPlate: name, element_tag, camera_staging, primary_geometry, lighting_key, plate_prompt ("completely empty of people", max 1 sign).
- PixarProductionState: premise, script_segments, characters, locations, compiled_seedance_prompts, lint_errors, script_approved.

### 3. Pipeline Nodes
Implement:
1. story_director_node: Applies Rule of Three, contrast, escalating gag, locks verbatim dialogue, budgets shots into <=30s segments.
2. character_architect_node: Generates master renders for GPT Image 2 with head ratios, skin zoning, and single worn accent.
3. model_sheet_node: Generates Format B 12-panel sheets for Seedream 5.0 Pro (4 turnaround views + 8 standard expressions on #B5B5B5).
4. location_scout_node: Generates empty plates for Nano Banana Pro (completely empty of people, key light defined).
5. seedance_compiler_node: Compiles the 10-block declarative schema ([REFERENCE MATERIALS], [VOICES], [GOAL], [CONTINUITY], [SHOTS], [VISUAL STYLE], [CAMERA AND PERFORMANCE], [AUDIO], [EXCLUSIONS], [MAINTAIN CONSISTENCY]).
6. deterministic_pipeline_linter: Python regex & arithmetic validator. Loops back to compiler if lint fails; finishes if clean.

### 4. Supporting Tooling
Implement:
- export_black_screen_voice_stem: Python/FFmpeg function generating black MP4 audio references.
- splice_generations: Python/FFmpeg EDL engine splicing clean cuts from Gen 1 and Gen 2.

Output the entire implementation in clean, production-grade, typed Python code.
```
