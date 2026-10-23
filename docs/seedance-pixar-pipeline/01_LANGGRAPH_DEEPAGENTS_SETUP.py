"""
SEEDANCE 2.5 PIXAR ANIMATION PIPELINE — LANGGRAPH DEEP AGENTS RUNTIME
===================================================================
A deterministic, multi-agent production harness that synthesizes Pixar-grade
3D animated shorts using Seedance 2.5, GPT Image 2, Seedream 5.0, and Nano Banana Pro.

Authors: Antigravity AI & Dan Kieft Architecture
License: MIT
"""

import os
import re
import subprocess
from typing import Annotated, Dict, List, Optional, Tuple, TypedDict
from pydantic import BaseModel, Field

# LangGraph & LangChain Imports
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# ============================================================================
# 1. DATA CONTRACTS & STATE DEFINITIONS
# ============================================================================

class VerbatimDialogue(BaseModel):
    speaker_tag: str = Field(description="Tagged character handle, e.g., '@Ben'")
    line: str = Field(description="Exact verbatim line enclosed in braces {}")
    is_voiceover: bool = False
    is_off_camera: bool = False

class Shot(BaseModel):
    shot_number: int
    start_sec: int
    end_sec: int
    camera_and_staging: str
    dialogue: Optional[VerbatimDialogue] = None
    cut_type: str = Field(default="Hard cut.", description="e.g. 'Hard cut.' or 'Fire wipe'")
    is_continuous_move: bool = False

    @property
    def duration(self) -> int:
        return self.end_sec - self.start_sec

class SegmentScript(BaseModel):
    segment_id: int
    title: str
    total_duration_sec: int = Field(le=30, description="Hard 30s ceiling")
    goal_summary: str
    continuity_locks: List[str]
    shots: List[Shot]

class CharacterDesign(BaseModel):
    name: str
    element_tag: str  # e.g., "@Mia"
    age: int
    heads_tall: float
    silhouette_shape: str
    exaggeration: str
    counterpart: str
    skin_zoning: str  # "Light" or "Deep"
    single_saturated_accent: str  # Must be worn or attached!
    master_render_prompt: str
    format_b_sheet_prompt: Optional[str] = None

class LocationPlate(BaseModel):
    name: str
    element_tag: str  # e.g., "@classroom"
    camera_staging: str
    primary_geometry: str
    lighting_key: str
    plate_prompt: str

class PixarProductionState(TypedDict):
    # Core narrative input
    premise: str
    
    # Generated Script Cards
    script_segments: List[SegmentScript]
    
    # Visual Assets
    characters: Dict[str, CharacterDesign]
    locations: Dict[str, LocationPlate]
    
    # Compiled Video Prompts ready for Seedance 2.5
    compiled_seedance_prompts: List[str]
    
    # Deterministic Validation Logs
    lint_errors: List[str]
    
    # Human-in-the-Loop Approval Flag
    script_approved: bool

# ============================================================================
# 2. DETERMINISTIC LINTER & MATHEMATICAL VALIDATOR NODE
# ============================================================================

def deterministic_pipeline_linter(state: PixarProductionState) -> Dict[str, List[str]]:
    """
    Zero-token deterministic validator that enforces Dan Kieft's hard mathematical
    constraints and syntax rules before any credits are spent on rendering.
    """
    errors = []

    # Check 1: 30-Second Hard Ceiling & Timecode Continuity
    for segment in state.get("script_segments", []):
        total_time = sum(shot.duration for shot in segment.shots)
        if total_time > 30:
            errors.append(f"Segment {segment.segment_id} runtime ({total_time}s) exceeds hard 30s ceiling!")
        
        current_time = 0
        for shot in segment.shots:
            if shot.start_sec != current_time:
                errors.append(f"Shot {shot.shot_number} start time ({shot.start_sec}s) does not match previous end ({current_time}s).")
            if not isinstance(shot.start_sec, int) or not isinstance(shot.end_sec, int):
                errors.append(f"Shot {shot.shot_number} has fractional seconds. All timecodes must be whole integers.")
            current_time = shot.end_sec

    # Check 2: Seedance 10-Block Video Prompts Linting
    for idx, prompt in enumerate(state.get("compiled_seedance_prompts", [])):
        # Must contain all mandatory blocks
        mandatory_blocks = [
            "[REFERENCE MATERIALS]", "[VOICES]", "[GOAL]", "[CONTINUITY]",
            "[SHOTS]", "[VISUAL STYLE]", "[CAMERA AND PERFORMANCE]",
            "[AUDIO]", "[EXCLUSIONS]", "[MAINTAIN CONSISTENCY]"
        ]
        for block in mandatory_blocks:
            if block not in prompt:
                errors.append(f"Prompt {idx+1} is missing mandatory block: {block}")

        # Check for Live-Action Token Contamination in Visual Style
        banned_tokens = ["photorealistic", "film stock", "grain", "kodak", "35mm", "pore detail", "paparazzi"]
        for token in banned_tokens:
            if re.search(rf"\b{token}\b", prompt, re.IGNORECASE):
                # Ensure it's not negated
                if not re.search(rf"\b(no|not)\s+{token}\b", prompt, re.IGNORECASE):
                    errors.append(f"Prompt {idx+1} contains forbidden live-action token: '{token}'")

        # Check Dialogue Isolation in {}
        brace_dialogue_count = len(re.findall(r"\{[^}]+\}", prompt))
        tagged_speaker_count = len(re.findall(r"@[\w_]+(?:\s*,\s*voiceover)?:\s*\{[^}]+\}", prompt))
        if brace_dialogue_count != tagged_speaker_count:
            errors.append(f"Prompt {idx+1} has unanchored dialogue braces. Found {brace_dialogue_count} braces but only {tagged_speaker_count} properly tagged with @Speaker:.")

    return {"lint_errors": errors}

# ============================================================================
# 3. AGENT NODES IMPLEMENTATION
# ============================================================================

def story_director_node(state: PixarProductionState, llm_callable=None) -> Dict:
    """
    Parses user premise, applies Rule of Three, structures escalating running gag,
    locks verbatim dialogue, and budgets shots into <=30s segments.
    """
    # System prompt enforcing Section 0 of Dan Kieft's Prompter
    system_prompt = """You are the Pixar Story Director.
Direct, don't transcribe. Apply:
1. Ordinary World Contrast: The baseline setting must be completely ordinary so the reveal lands.
2. Rule of Three: 2 straight presentations, 1 subversive climax.
3. Escalating Running Gag: Visible ladder across 3-4 distinct physical stages.
4. Business Beats Dialogue: Characters performing physical tasks with hands.
5. Dialogue Budget: Short line = 2s, 2 lines = 4s, silent beat = 2s. Total segment <= 30s.
Output structured SegmentScript cards with verbatim dialogue in braces {}.
"""
    # LLM execution placeholder (inject client here)
    # Returns structured script_segments and sets script_approved=False for human gate
    return {
        "script_segments": state.get("script_segments", []),
        "script_approved": False  # Pauses for Human-in-the-Loop review
    }

def character_architect_node(state: PixarProductionState, llm_callable=None) -> Dict:
    """
    Generates Master 3D CG Character Renders for GPT Image 2 following
    head-height proportions, exaggeration counterparts, and skin zoning.
    """
    system_prompt = """You are the Pixar Character Architect.
Rules:
- Toddler: 4 heads; Child (5-8): 4.5-5 heads (long torso, short legs); Adult: 7 heads.
- Exaggeration + Counterpart balance (never exaggerate alone).
- Skin zoning: Light skin (pink nose, translucent red ears) vs Deep skin (red-orange nose, plum cheeks, cool grey-violet).
- Exactly ONE signature saturated accent, WORN, NEVER HELD.
- Hands: large, rounded forms, thick blunt fingertips, soft simple palms.
- Backdrop: flat mid-grey #B5B5B5 studio backdrop, empty, 50mm lens at chest height.
"""
    # Generates master character prompts
    return {"characters": state.get("characters", {})}

def model_sheet_node(state: PixarProductionState, llm_callable=None) -> Dict:
    """
    Compiles Format B 12-Panel Character Model Sheets for Seedream 5.0 Pro (2K).
    Top row: 4 full-body turnarounds. Bottom rows: 8 standardized expressions.
    """
    system_prompt = """You are the Pixar Model Sheet Compiler.
Produce Format B Character Sheets:
- Canvas: Flat mid-grey #B5B5B5 across the entire canvas.
- Top Row: 4 turnaround figures (front, 3/4, side, back) on the exact same baseline.
- Bottom Rows: 8 standard expressions (neutral, happy, delighted, sad, surprised, confused, angry, talking).
- Clean skin guarantee: Explicitly declare 'arms, wrists and hands are completely clean and unmarked — no ink, no tattoos, no markings of any kind.'
"""
    return {"characters": state.get("characters", {})}

def location_scout_node(state: PixarProductionState, llm_callable=None) -> Dict:
    """
    Generates empty environment plates for Nano Banana Pro (16:9).
    Enforces 'completely empty of people' and limits text to max 1 hand-lettered sign.
    """
    system_prompt = """You are the Pixar Location Scout.
Rules:
1. Always include 'completely empty of people'.
2. Symmetrical or one-point perspective matching the script's camera axis.
3. Max 1 paper hand-lettered sign (e.g. drooping 'MY FAMILY' banner). No other wall text.
4. Anchor directional key light from unseen windows.
"""
    return {"locations": state.get("locations", {})}

def seedance_compiler_node(state: PixarProductionState, llm_callable=None) -> Dict:
    """
    Compiles the 10-block declarative Seedance 2.5 prompt.
    1 block = 1 shot. Continuous moves stay in 1 block.
    """
    system_prompt = """You are the Seedance 2.5 Prompt Compiler.
Assemble the official 10-block schema:
[REFERENCE MATERIALS], [VOICES], [GOAL], [CONTINUITY], [SHOTS],
[VISUAL STYLE], [CAMERA AND PERFORMANCE], [AUDIO], [EXCLUSIONS], [MAINTAIN CONSISTENCY].
Rules:
- Hard 30s ceiling, whole-second timecodes.
- Tag all elements inline with @handles.
- 1 block = 1 cut. Continuous moves marked with 'One continuous move — the camera never stops and never cuts.'
- Body broad, face honest. Staggered non-unison ensemble.
"""
    return {"compiled_seedance_prompts": state.get("compiled_seedance_prompts", [])}

# ============================================================================
# 4. LANGGRAPH GRAPH TOPOLOGY & EXECUTION ENGINE
# ============================================================================

def human_approval_condition(state: PixarProductionState):
    """Human-in-the-Loop check: Halts pipeline until script is approved."""
    if state.get("script_approved", False):
        return "proceed_to_assets"
    return "wait_for_human_approval"

def lint_check_condition(state: PixarProductionState):
    """Evaluates linter feedback. Loops back to compiler if syntax/math failed."""
    if state.get("lint_errors"):
        return "recompile_prompts"
    return END

def create_pixar_animation_graph():
    """Builds the deterministic LangGraph state machine."""
    workflow = StateGraph(PixarProductionState)

    # Add Nodes
    workflow.add_node("story_director", story_director_node)
    workflow.add_node("character_architect", character_architect_node)
    workflow.add_node("model_sheet_compiler", model_sheet_node)
    workflow.add_node("location_scout", location_scout_node)
    workflow.add_node("seedance_compiler", seedance_compiler_node)
    workflow.add_node("deterministic_linter", deterministic_pipeline_linter)

    # Set Entry Point
    workflow.set_entry_point("story_director")

    # Story Director -> Human Gate
    workflow.add_conditional_edges(
        "story_director",
        human_approval_condition,
        {
            "proceed_to_assets": "character_architect",
            "wait_for_human_approval": END  # Graph halts for human review
        }
    )

    # Parallel Execution: Character Architect & Location Scout
    workflow.add_edge("character_architect", "model_sheet_compiler")
    workflow.add_edge("story_director", "location_scout")

    # Model Sheet + Location Scout -> Seedance Compiler
    workflow.add_edge("model_sheet_compiler", "seedance_compiler")
    workflow.add_edge("location_scout", "seedance_compiler")

    # Seedance Compiler -> Linter
    workflow.add_edge("seedance_compiler", "deterministic_linter")

    # Linter Reflection Loop
    workflow.add_conditional_edges(
        "deterministic_linter",
        lint_check_condition,
        {
            "recompile_prompts": "seedance_compiler",
            END: END
        }
    )

    return workflow.compile()

# ============================================================================
# 5. POST-PRODUCTION AUDIO STEM EXTRACTOR (FFMPEG ENGINE)
# ============================================================================

def export_black_screen_voice_stem(
    source_video_path: str,
    dialogue_cuts: List[Tuple[float, float]],
    output_mp4_path: str
) -> str:
    """
    Slices character dialogue from Generation 1 and packages it into a black-screen
    MP4 container under 30 seconds for Seedance voice persistence in Extend mode.
    """
    if not os.path.exists(source_video_path):
        raise FileNotFoundError(f"Source video not found: {source_video_path}")

    select_expr = " + ".join([f"between(t,{start},{end})" for start, end in dialogue_cuts])
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=black:s=640x360:r=30",
        "-i", source_video_path,
        "-filter_complex", f"[1:a]aselect='{select_expr}',asetpts=N/SR/TB[outa]",
        "-map", "0:v", "-map", "[outa]",
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_mp4_path
    ]
    subprocess.run(cmd, check=True)
    return output_mp4_path

if __name__ == "__main__":
    print("Pixar Seedance 2.5 LangGraph Pipeline Initialized Successfully.")
    pipeline = create_pixar_animation_graph()
    print("Graph Compiled with 6 Nodes and Deterministic Reflection Edge.")
