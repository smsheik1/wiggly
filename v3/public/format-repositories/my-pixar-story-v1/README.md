# Wiggly My Pixar Story

Generate cinematic 3D animated Pixar-style family memoirs and emotional legacy films directly from questionnaire memories.

## Overview

`My Pixar Story` transforms personal memories into a cohesive, 72-second animated family story with continuous character identities, hero prop permanence, and synchronized acoustic dialogue.

## Getting Started

```bash
# Add the skill to your favorite AI agent
npx skills add wiggly/my-pixar-story

# Or run the studio format package
git clone https://github.com/smsheik1/wiggly-my-pixar-story-studio.git
cd wiggly-my-pixar-story-studio
npm install
npm test
```

## Assembly Line

1. **Questionnaire**: Extract core emotional themes, character relationships, and hero props from user memories.
2. **Screenplay**: Author a 7-beat structured emotional arc with precise camera directions and dialogue.
3. **Cast & Hero Props**: Generate 4K multi-angle character sheets and prop turnaround references.
4. **Scene Synthesis**: Render high-fidelity video clips using Seedance 2.5 with native audio.
5. **4K Upscaling**: Enhance video fidelity using SeedVR2 on Modal H100 GPUs.
6. **Lossless Assembly**: Losslessly conform, stitch, and deliver the final master MP4.

## Requirements

- Node.js 20+
- FFmpeg 6.0+
- Wiggly MCP Server (Tollbooth) or direct Replicate / Modal API keys
