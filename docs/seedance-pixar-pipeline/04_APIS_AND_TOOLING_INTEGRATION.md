# APIS, TOOLING & POST-PRODUCTION INFRASTRUCTURE

> **TARGET ENVIRONMENT:** Node.js / Python 3.11+ / Next.js / Remotion / FFmpeg  
> **API PROVIDERS:** ByteDance Seedance 2.5, OpenAI GPT Image 2, Seedream 5.0 Pro, Nano Banana Pro  
> **INTEGRITY PROTOCOL:** No silent fallbacks on external API failures (Wiggly Rule 12)

---

# PART I: API INTEGRATION SPECIFICATIONS

### 1.1 Provider Key Management (BYOK Standard)
All provider credentials must be loaded in memory from the root secrets configuration (`secrets.env`).
* `HIGGSFIELD_API_KEY`: Orchestrates Seedance 2.5, Seedream 5.0 Pro, and Nano Banana Pro.
* `OPENAI_API_KEY`: Orchestrates GPT Image 2 master character renders.
* `VOLCANO_ARK_API_KEY`: Direct ByteDance Volcano Engine API fallback for Seedance 2.5.

```bash
# Example secrets.env configuration
HIGGSFIELD_API_KEY=hf_live_xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
VOLCANO_ARK_API_KEY=ark_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 1.2 Seedance 2.5 Video Generation API

#### Endpoint
`POST https://api.higgsfield.ai/v1/video/seedance-2-5` (or Volcano Engine Ark Video Endpoint)

#### Headers
```http
Authorization: Bearer $HIGGSFIELD_API_KEY
Content-Type: application/json
Accept: application/json
```

#### Request Payload Schema
```json
{
  "model": "seedance-2.5",
  "mode": "extend",
  "direction": "sequel",
  "duration": 29,
  "resolution": "1080p",
  "aspect_ratio": "16:9",
  "bitrate": "high",
  "source_video_id": "vid_prev_segment_001",
  "elements": [
    {
      "tag": "@classroom",
      "element_id": "elem_classroom_plate_01"
    },
    {
      "tag": "@location1",
      "element_id": "elem_classroom_staging_01"
    },
    {
      "tag": "@Mia",
      "element_id": "elem_mia_sheet_01"
    },
    {
      "tag": "@Ben",
      "element_id": "elem_ben_sheet_01"
    },
    {
      "tag": "@Sofia",
      "element_id": "elem_sofia_sheet_01"
    },
    {
      "tag": "@Miss_Park",
      "element_id": "elem_misspark_sheet_01"
    },
    {
      "tag": "@ben-drawing",
      "element_id": "elem_bens_drawing_01"
    },
    {
      "tag": "@mia-drawing1",
      "element_id": "elem_mias_drawing_01"
    },
    {
      "tag": "@sofia-drawing",
      "element_id": "elem_sofias_drawing_01"
    },
    {
      "tag": "@Ben_voice",
      "element_id": "elem_ben_black_mp4_stem_01"
    }
  ],
  "prompt": "<10-Block Compiled Prompt String>"
}
```

#### Response Payload Schema
```json
{
  "task_id": "task_s25_984729184",
  "status": "queued",
  "estimated_time_sec": 180,
  "cost_credits": 281
}
```

---

### 1.3 Image Generation API Specifications

#### A. Master Character Render: GPT Image 2
* **Endpoint**: `POST https://api.openai.com/v1/images/generations` (or Higgsfield Image Gateway)
* **Parameters**:
  ```json
  {
    "model": "gpt-image-2",
    "prompt": "<Master Character Render Prompt>",
    "size": "1024x1024",
    "quality": "high",
    "n": 1
  }
  ```

#### B. Character Model Sheets: Seedream 5.0 Pro
* **Endpoint**: `POST https://api.higgsfield.ai/v1/image/seedream-5`
* **Parameters**:
  ```json
  {
    "model": "seedream-5.0-pro",
    "prompt": "<Format B Turnaround + 8-Expression Sheet Prompt>",
    "resolution": "2K",
    "aspect_ratio": "16:9",
    "reference_image_url": "https://cdn.wiggly.app/renders/master_mia.png"
  }
  ```

#### C. Empty Location Plates: Nano Banana Pro
* **Endpoint**: `POST https://api.higgsfield.ai/v1/image/nano-banana-pro`
* **Parameters**:
  ```json
  {
    "model": "nano-banana-pro",
    "prompt": "<Empty Location Plate Prompt>",
    "resolution": "4K",
    "aspect_ratio": "16:9"
  }
  ```

---

# PART II: POST-PRODUCTION AUTOMATION ENGINES

### 2.1 The Black-Screen MP4 Voice Extractor

Seedance 2.5 requires voice references to be packaged inside an **MP4 container with video**, even though the video track is blank. Passing raw MP3 or WAV files frequently triggers HTTP 400 format errors or timing desynchronization in Seedance.

#### Implementation: `extract_voice_stem.py`
```python
import subprocess
import os
from typing import List, Tuple

def create_black_screen_voice_reference(
    source_video_path: str,
    dialogue_intervals: List[Tuple[float, float]],
    output_mp4_path: str
):
    """
    Extracts dialogue ranges, concatenates audio, and combines with a black video canvas.
    Total duration must be under 30 seconds.
    """
    if not os.path.exists(source_video_path):
        raise FileNotFoundError(f"Missing source generation: {source_video_path}")

    # Build FFmpeg between() filter expression
    filters = " + ".join([f"between(t,{start},{end})" for start, end in dialogue_intervals])
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=black:s=640x360:r=30",
        "-i", source_video_path,
        "-filter_complex", f"[1:a]aselect='{filters}',asetpts=N/SR/TB[outa]",
        "-map", "0:v", "-map", "[outa]",
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_mp4_path
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    print(f"Successfully generated black-screen voice reference: {output_mp4_path}")

if __name__ == "__main__":
    # Example: Cut Ben's dialogue from Gen 1 (at 0-3s and 7-9s)
    # create_black_screen_voice_reference("gen1.mp4", [(0.0, 3.0), (7.0, 9.0)], "ben_voice_stem.mp4")
    pass
```

---

### 2.2 The Gen 1 + Gen 2 Anomaly Splicer (FFmpeg EDL Assembler)

When Gen 1 has an anomaly in Shot 4 (e.g. dad bursting through a solid wall), this script cuts the clean shots from Gen 1 and splices the corrected Shot 4 from Gen 2 seamlessly:

```python
import subprocess
import json

def splice_generations(
    gen1_path: str,
    gen2_path: str,
    edit_decision_list: list[dict],
    output_final_path: str
):
    """
    EDL Schema:
    [
      {"source": 1, "start": 0, "end": 9},   # Take shots 1-3 from Gen 1
      {"source": 2, "start": 9, "end": 14},  # Take shot 4 from Gen 2
      {"source": 1, "start": 14, "end": 29}  # Take shots 5-9 from Gen 1
    ]
    """
    filter_complex = []
    concat_inputs = []
    
    for idx, cut in enumerate(edit_decision_list):
        src_stream = f"[{cut['source']-1}:v]"
        src_audio = f"[{cut['source']-1}:a]"
        duration = cut["end"] - cut["start"]
        
        # Trim video
        filter_complex.append(
            f"{src_stream}trim=start={cut['start']}:end={cut['end']},setpts=PTS-STARTPTS[v{idx}];"
        )
        # Trim audio
        filter_complex.append(
            f"{src_audio}atrim=start={cut['start']}:end={cut['end']},asetpts=PTS-STARTPTS[a{idx}];"
        )
        concat_inputs.append(f"[v{idx}][a{idx}]")
        
    concat_str = "".join(concat_inputs)
    filter_complex.append(f"{concat_str}concat=n={len(edit_decision_list)}:v=1:a=1[outv][outa]")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", gen1_path,
        "-i", gen2_path,
        "-filter_complex", "".join(filter_complex),
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-crf", "18", "-preset", "slow",
        "-c:a", "aac", "-b:a", "320k",
        output_final_path
    ]
    
    print(f"Executing EDL Assembly...")
    subprocess.run(cmd, check=True)
    print(f"Master clean cut exported to: {output_final_path}")
```
