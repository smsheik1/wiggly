"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  Sparkles,
  Layers,
  Cpu,
  Bot,
  Volume2,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  Maximize2,
} from "lucide-react";
import Link from "next/link";
import type { DiscoveryFormatProfile } from "./types";
import { DesktopChatShowcase } from "./DesktopChatShowcase";

export function PixarStoryAdviblySections({
  format,
}: {
  format: DiscoveryFormatProfile;
}) {
  const [copiedCommand, setCopiedCommand] = useState(false);

  const installCommand = "npx skills add smsheik1/wiggly -s my-pixar-story";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const samplePrompts = [
    "Make a Pixar-style story for my daughter",
    "3D animated family memoir from our memories",
    "Warm big-eyed feature-animation film about my dad",
    "Pixar-style tribute for my mom's birthday",
  ];

  const pipelineSteps = [
    {
      num: 1,
      title: "Story Director (Beats & Thesis)",
      desc: "The skill reads your questionnaire memories, builds an original protagonist across life stages (childhood, young adult, adult) and hero props (vehicles, instruments, keepsakes), then writes a 5–7 beat script paced to time with an earned thesis. Mandatory approval gate before rendering video.",
    },
    {
      num: 2,
      title: "4K Character Lineup Sheets",
      desc: "One expressive feature-3D character lineup sheet with Nano Banana 2.1 via Google Flow, generated sequentially for character continuity: large eyes with catchlights, tactile materials, warm volumetric light, and creamy depth of field. A weak still is re-rolled cheaply here, never repaired in video.",
    },
    {
      num: 3,
      title: "Spatial 3D Environment Plates",
      desc: "Spatial 3D environment plates with soft rounded shapes, volumetric lighting, and storybook depth of field.",
    },
    {
      num: 4,
      title: "16:9 Storyboard Direct Panels",
      desc: "Native 16:9 2K storyboard panels locking camera moves, character eyelines, and physical staging for human director approval.",
    },
    {
      num: 5,
      title: "Seedance 2.5 Emergent Multimodal Audio",
      desc: "ByteDance Seedance 2.5 generates expressive 3D character acting and ambient Foley in the visual latent space, mixed with a continuous 72-second emotional piano score and authentic parent voiceover narrating across the scene cuts.",
    },
    {
      num: 6,
      title: "Lossless FFmpeg Concat & Dailies",
      desc: "Lossless FFmpeg assembly stitches the clips into a master 72-second 1080p film with automated dailies contact sheets.",
    },
  ];

  const agentLogos = [
    { name: "Claude Code", tag: "Official", color: "#d97706" },
    { name: "Claude", tag: "Anthropic", color: "#ea580c" },
    { name: "Cursor", tag: "Native", color: "#0284c7" },
    { name: "Codex", tag: "OpenAI", color: "#16a34a" },
    { name: "VS Code", tag: "Copilot", color: "#2563eb" },
    { name: "Windsurf", tag: "Codeium", color: "#06b6d4" },
    { name: "ChatGPT", tag: "OpenAI", color: "#10b981" },
    { name: "Antigravity", tag: "Google", color: "#8b5cf6" },
    { name: "Grokbot", tag: "xAI", color: "#e11d48" },
    { name: "Meta Muse", tag: "Meta", color: "#4f46e5" },
  ];

  const modelStack = [
    {
      name: "Claude Haiku 5.5 / Meta Muse",
      badge: "High Reasoning",
      role: "Screenplay Director",
      description: "Extracts true facts, balances humor and tenderness, discovers the closing thesis, and drafts natural spoken lines.",
    },
    {
      name: "Nano Banana 2.1",
      badge: "Google Flow",
      role: "Character & Prop Sheets",
      description: "Multi-character reference lineups, hero vehicles, and spatial environment plates with 3D Pixar stylized aesthetic.",
    },
    {
      name: "ByteDance Seedance 2.5",
      badge: "Native Audio",
      role: "Video & Acoustic Diffusion",
      description: "Generates widescreen 16:9 video clips with emergent synced dialogue, acoustic room ambience, and character Foley.",
    },
    {
      name: "ByteDance Video Upscaler",
      badge: "HD Master",
      role: "1080p Theatrical Upscaler",
      description: "Temporal super-resolution upscaler via Replicate (ByteDance SeedVR lab) for crystal-clear theatrical 1080p quality.",
    },
    {
      name: "Lossless FFmpeg",
      badge: "Zero Loss",
      role: "Conform & Dailies Assembly",
      description: "Automatic lossless concatenation demuxer, audio balance verification, and 9-frame story contact sheets.",
    },
  ];

  return (
    <div className="w-full text-[#080817]">
      {/* 1. JUST ASK SECTION */}
      <section className="border-t-2 border-[#080817] bg-[#f9f6ef] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[980px]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#667087]">
            Just ask
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            The skill fires on natural requests like these.
          </h2>
          <p className="mt-4 text-lg font-bold text-[#596176]">
            No complex terminal commands or rigid parameters to memorize.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {samplePrompts.map((prompt) => (
              <span
                key={prompt}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#080817] bg-white px-5 py-3 text-base font-black shadow-[4px_4px_0_#080817]"
              >
                <Sparkles className="size-4 text-[#ff8c42]" />
                “{prompt}”
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 2. THE PIPELINE SECTION */}
      <section className="border-t-2 border-[#080817] bg-white px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[980px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#667087]">
                The pipeline
              </p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                How an agent directs your film.
              </h2>
            </div>
            <p className="max-w-md text-sm font-bold text-[#596176]">
              Approve the cast sheet, then the storyboard. Animation, voice and score run after that.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pipelineSteps.map((step) => (
              <div
                key={step.num}
                className="flex flex-col justify-between rounded-xl border-2 border-[#080817] bg-[#fbf9f4] p-6 shadow-[5px_5px_0_#080817]"
              >
                <div>
                  <div className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-[#080817] bg-[#52d6ff] text-xl font-black">
                    {step.num}
                  </div>
                  <h3 className="mt-4 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-[#424254]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. ORIGINAL CASTS & PROPS */}
      <section className="border-t-2 border-[#080817] bg-[#dff8ff] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1040px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#31566e]">
              Original casts &amp; hero props
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Real people. Never stock avatars.
            </h2>
            <p className="mt-4 max-w-3xl text-lg font-bold leading-relaxed text-[#30374b]">
              No borrowed characters and no house mascot pasted onto every story. For each family the skill designs its own protagonist across childhood to adult stages, along with hero vehicles and keepsakes, written directly from the facts in your questionnaire answers.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-5 shadow-[4px_4px_0_#080817]">
                <div className="flex items-center gap-2 text-sm font-black text-[#080817]">
                  <CheckCircle2 className="size-4 text-[#0091ff]" />
                  <span>Strict Fidelity</span>
                </div>
                <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                  Facts, ages, settings, and spoken memories are 100% faithful to your real family answers.
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-5 shadow-[4px_4px_0_#080817]">
                <div className="flex items-center gap-2 text-sm font-black text-[#080817]">
                  <CheckCircle2 className="size-4 text-[#0091ff]" />
                  <span>Life-Stage Continuity</span>
                </div>
                <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                  Persistent facial structure, hair silhouette, and wardrobe styling across 3 distinct life stages.
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-5 shadow-[4px_4px_0_#080817]">
                <div className="flex items-center gap-2 text-sm font-black text-[#080817]">
                  <CheckCircle2 className="size-4 text-[#0091ff]" />
                  <span>100% Original IP</span>
                </div>
                <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                  Whimsical 3D stylized models designed from scratch; never borrowed franchise characters or logos.
                </p>
              </div>
            </div>
          </div>

          {/* Full-width 4K Lineup Showcase Card */}
          <div className="mt-10 overflow-hidden rounded-2xl border-2 border-[#080817] bg-white p-4 shadow-[8px_8px_0_#080817] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#080817]/10 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md border-2 border-[#080817] bg-[#52d6ff] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#080817]">
                  4K Character Sheet
                </span>
                <span className="text-sm font-black text-[#080817]">
                  Actual Master Lineup (Shaz, Sister, Mia across life stages)
                </span>
              </div>
              <a
                href="/format-repositories/my-pixar-story-v1/examples/character-lineup.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#080817] bg-[#f5f1e8] px-3.5 py-1.5 text-xs font-black text-[#080817] shadow-[2px_2px_0_#080817] transition hover:bg-[#52d6ff]"
              >
                <Maximize2 className="size-3.5" />
                Open Full 4K Image
              </a>
            </div>

            <div className="overflow-hidden rounded-xl border-2 border-[#080817] bg-[#f0f0f0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/format-repositories/my-pixar-story-v1/examples/character-lineup.png"
                alt="4K Character Lineup Compilation Sheet"
                className="block w-full object-contain"
              />
            </div>
            <p className="mt-3 text-center text-xs font-bold text-[#596176]">
              Locked before any video frames are rendered to guarantee character, clothing, and color continuity across all 7 scenes.
            </p>
          </div>
        </div>
      </section>

      {/* 4. THE MODEL STACK */}
      <section className="border-t-2 border-[#080817] bg-[#fffdf8] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[980px]">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#667087]">
            The model stack
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Each model has one job.
          </h2>
          <p className="mt-4 max-w-2xl text-lg font-bold text-[#596176]">
            The still carries the look: the eyes, the light, the silhouette. Nano Banana 2.1 makes every character and location plate, and Seedance 2.5 synthesizes the visual movement and emergent audio in one coherent pass.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modelStack.map((m) => (
              <div
                key={m.name}
                className="flex flex-col justify-between rounded-xl border-2 border-[#080817] bg-white p-5 shadow-[4px_4px_0_#080817]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md border-2 border-[#080817] bg-[#c9ff55] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">
                      {m.badge}
                    </span>
                    <Cpu className="size-4 text-[#667087]" />
                  </div>
                  <h3 className="mt-3 text-lg font-black">{m.name}</h3>
                  <p className="mt-1 text-xs font-black uppercase tracking-wider text-[#ff78bd]">
                    {m.role}
                  </p>
                  <p className="mt-3 text-xs font-bold leading-relaxed text-[#596176]">
                    {m.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHAT YOU GET */}
      <section className="border-t-2 border-[#080817] bg-[#ffecf5] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1040px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff4081]">
              Final deliverables
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              What you get.
            </h2>
            <p className="mt-4 max-w-3xl text-lg font-bold leading-relaxed text-[#30374b]">
              A complete, archival-grade animated short film deliverable package. Everything from the approved character blueprints to the final lossless theatrical master.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-4 shadow-[4px_4px_0_#080817]">
                <div className="inline-flex size-7 items-center justify-center rounded-md border-2 border-[#080817] bg-[#ff78bd] text-xs font-black">
                  1
                </div>
                <h4 className="mt-3 text-base font-black">72-Second Master Film</h4>
                <p className="mt-1.5 text-xs font-bold leading-relaxed text-[#596176]">
                  Finished widescreen 16:9 3D animated memoir in 1080p theatrical quality.
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-4 shadow-[4px_4px_0_#080817]">
                <div className="inline-flex size-7 items-center justify-center rounded-md border-2 border-[#080817] bg-[#52d6ff] text-xs font-black">
                  2
                </div>
                <h4 className="mt-3 text-base font-black">4K Turnaround Sheets</h4>
                <p className="mt-1.5 text-xs font-bold leading-relaxed text-[#596176]">
                  Approved multi-character reference lineup and 3D hero vehicle &amp; keepsake plates.
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-4 shadow-[4px_4px_0_#080817]">
                <div className="inline-flex size-7 items-center justify-center rounded-md border-2 border-[#080817] bg-[#c9ff55] text-xs font-black">
                  3
                </div>
                <h4 className="mt-3 text-base font-black">&apos;Up&apos; Audio Architecture</h4>
                <p className="mt-1.5 text-xs font-bold leading-relaxed text-[#596176]">
                  Continuous 72-second emotional piano score, ambient room Foley, and authentic parent voiceover.
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#080817] bg-white/95 p-4 shadow-[4px_4px_0_#080817]">
                <div className="inline-flex size-7 items-center justify-center rounded-md border-2 border-[#080817] bg-[#ff8c42] text-xs font-black">
                  4
                </div>
                <h4 className="mt-3 text-base font-black">9-Frame Master Dailies</h4>
                <p className="mt-1.5 text-xs font-bold leading-relaxed text-[#596176]">
                  Full-story contact sheet and uncompressed master archive ready to share with family.
                </p>
              </div>
            </div>
          </div>

          {/* Full-width Story Grid Showcase Card */}
          <div className="mt-10 overflow-hidden rounded-2xl border-2 border-[#080817] bg-white p-4 shadow-[8px_8px_0_#080817] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#080817]/10 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md border-2 border-[#080817] bg-[#ff78bd] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#080817]">
                  Master Story Grid
                </span>
                <span className="text-sm font-black text-[#080817]">
                  9-Frame Dailies Contact Sheet (Childhood to Porch Light)
                </span>
              </div>
              <a
                href="/format-repositories/my-pixar-story-v1/examples/story-grid.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#080817] bg-[#f5f1e8] px-3.5 py-1.5 text-xs font-black text-[#080817] shadow-[2px_2px_0_#080817] transition hover:bg-[#ff78bd]"
              >
                <Maximize2 className="size-3.5" />
                Open Full-Res Story Grid
              </a>
            </div>

            <div className="overflow-hidden rounded-xl border-2 border-[#080817] bg-[#080817]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/format-repositories/my-pixar-story-v1/examples/story-grid.png"
                alt="1080p Full Story Grid"
                className="block w-full object-contain"
              />
            </div>
            <p className="mt-3 text-center text-xs font-bold text-[#596176]">
              Master 9-Frame Theatrical Story Grid assembled via lossless FFmpeg. Shows camera framing, color script arc, and lighting progression from the initial memories to the emotional conclusion.
            </p>
          </div>
        </div>
      </section>

      {/* 6. TRANSPARENT STUDIO PRICING */}
      <section className="border-t-2 border-[#080817] bg-[#fdfaf5] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[980px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff8c42]">
                Studio Pricing
              </p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Pay per film, not per minute.
              </h2>
            </div>
            <p className="max-w-md text-sm font-bold text-[#596176]">
              Iterate the story and draft cheaply. Only unlock the theatrical 1080p master once the family loves the screening preview.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Tier 1: 720p Draft Preview */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-[#080817] bg-white p-7 shadow-[6px_6px_0_#080817]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md border-2 border-[#080817] bg-[#e2e8f0] px-3 py-1 text-xs font-black uppercase tracking-wider">
                    Screening Draft
                  </span>
                  <span className="text-3xl font-black text-[#080817]">$19</span>
                </div>
                <h3 className="mt-4 text-2xl font-black">720p Screening Preview</h3>
                <p className="mt-2 text-sm font-bold text-[#596176]">
                  Fast turnaround for family review and story sign-off. Everything you need to experience the emotional arc.
                </p>

                <ul className="mt-6 space-y-3">
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#10b981] mt-0.5" />
                    <span>Complete 72-second 7-beat animated film in 720p</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#10b981] mt-0.5" />
                    <span>Continuous emotional piano score and Foley mix</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#10b981] mt-0.5" />
                    <span>9-Frame Dailies contact sheet for quick inspection</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#10b981] mt-0.5" />
                    <span>1 automated vision-QC retry per shot (up to 3 per film)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t-2 border-dashed border-[#e2e8f0] pt-5 text-xs font-bold text-[#71717a]">
                Generated via Replicate Seedance 2.5 with negative audio lock.
              </div>
            </div>

            {/* Tier 2: 1080p Theatrical Master */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-[#080817] bg-[#fff9eb] p-7 shadow-[8px_8px_0_#080817] relative">
              <div className="absolute -top-3.5 right-6 rounded-full border-2 border-[#080817] bg-[#ff8c42] px-3.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                Best For Keepsakes
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md border-2 border-[#080817] bg-[#c9ff55] px-3 py-1 text-xs font-black uppercase tracking-wider">
                    Theatrical Master
                  </span>
                  <span className="text-3xl font-black text-[#080817]">$69</span>
                </div>
                <h3 className="mt-4 text-2xl font-black">1080p Theatrical Master</h3>
                <p className="mt-2 text-sm font-bold text-[#596176]">
                  Archival heirloom release with ByteDance temporal super-resolution, 4K character sheet, and parent voiceover mix.
                </p>

                <ul className="mt-6 space-y-3">
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#ff8c42] mt-0.5" />
                    <span><strong>1080p Theatrical Master</strong> via ByteDance Video Upscaler</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#ff8c42] mt-0.5" />
                    <span><strong>Authentic Parent Voiceover</strong> clone ducked under piano score</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#ff8c42] mt-0.5" />
                    <span><strong>4K Multi-Character Lineup Sheet</strong> &amp; 3D Hero Prop Turnarounds</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-bold text-[#30374b]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#ff8c42] mt-0.5" />
                    <span>Permanent cloud link, uncompressed master MP4, &amp; lossless archive</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t-2 border-dashed border-[#e2e8f0] pt-5 text-xs font-bold text-[#71717a]">
                Full commercial and personal keepsake rights included.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ZERO-TIMEOUT MCP CLOUD ENGINE */}
      <section className="border-t-2 border-[#080817] bg-[#f0f9ff] px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[980px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0284c7]">
                Studio Cloud Engine
              </p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                3 discrete MCP tools. Zero timeouts.
              </h2>
            </div>
            <p className="max-w-md text-sm font-bold text-[#596176]">
              Your client agent is the creative director. Heavy diffusion rendering and 1080p upscaling run asynchronously on Wiggly’s high-performance cloud GPUs.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Tool 1 */}
            <div className="rounded-xl border-2 border-[#080817] bg-white p-6 shadow-[5px_5px_0_#080817]">
              <div className="inline-flex items-center gap-2 rounded-md border-2 border-[#080817] bg-[#52d6ff] px-2.5 py-1 text-xs font-black uppercase">
                Step 1: Submit
              </div>
              <h3 className="mt-3 font-mono text-base font-black text-[#080817]">
                wiggly_submit_film
              </h3>
              <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                Dispatches generation pass in &lt;500ms. Accepts screenplay, family photo URLs for facial likeness, and an idempotency key to guarantee safe, durable job dispatch.
              </p>
              <div className="mt-4 rounded-lg bg-[#080817] p-3 text-[11px] font-mono text-[#52d6ff]">
                returns: &#123; jobId, status: &quot;queued&quot; &#125;
              </div>
            </div>

            {/* Tool 2 */}
            <div className="rounded-xl border-2 border-[#080817] bg-white p-6 shadow-[5px_5px_0_#080817]">
              <div className="inline-flex items-center gap-2 rounded-md border-2 border-[#080817] bg-[#c9ff55] px-2.5 py-1 text-xs font-black uppercase">
                Step 2: Poll
              </div>
              <h3 className="mt-3 font-mono text-base font-black text-[#080817]">
                wiggly_get_film
              </h3>
              <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                Resilient polling with retryAfterSec: 15. Never drops sockets in Cursor or Claude Code. Returns live stage, 720p draft URL, and 3x3 contact sheets.
              </p>
              <div className="mt-4 rounded-lg bg-[#080817] p-3 text-[11px] font-mono text-[#c9ff55]">
                returns: &#123; stage, previewUrl, contactSheet &#125;
              </div>
            </div>

            {/* Tool 3 */}
            <div className="rounded-xl border-2 border-[#080817] bg-white p-6 shadow-[5px_5px_0_#080817]">
              <div className="inline-flex items-center gap-2 rounded-md border-2 border-[#080817] bg-[#ff8c42] px-2.5 py-1 text-xs font-black uppercase">
                Step 3: Finalize
              </div>
              <h3 className="mt-3 font-mono text-base font-black text-[#080817]">
                wiggly_finalize_film
              </h3>
              <p className="mt-2 text-xs font-bold leading-relaxed text-[#596176]">
                Human approval gate. Trigger a single shot reroll with director feedback (1 free auto-retry per shot, max 3 per film), or order the 1080p master.
              </p>
              <div className="mt-4 rounded-lg bg-[#080817] p-3 text-[11px] font-mono text-[#ff8c42]">
                actions: approve | reroll | master
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. INSTALL SECTION (INTERACTIVE DESKTOP CHAT SHOWCASE & INSTALL) */}
      <section
        id="install"
        className="border-t-2 border-[#080817] bg-[#080817] px-4 py-16 text-white sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-[1040px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#52d6ff]">
                Live Desktop Simulation
              </p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Direct your film in chat.
              </h2>
            </div>
            <p className="max-w-md text-sm font-bold text-[#a1a1aa]">
              Talk naturally to your AI agent. Review the 4K character sheet before video renders, then get your 72-second 1080p master.
            </p>
          </div>

          {/* Interactive macOS Desktop Chat Showcase */}
          <div className="mt-10">
            <DesktopChatShowcase />
          </div>

          {/* Supported Coding Agents Grid */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {agentLogos.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center gap-3 rounded-lg border border-[#27272a] bg-[#18181b] p-3 transition hover:border-[#52d6ff]"
              >
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <div>
                  <p className="text-sm font-black">{agent.name}</p>
                  <p className="text-[10px] font-bold text-[#71717a]">{agent.tag}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Install Action Cards */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* One-click Downloads */}
            <div className="rounded-xl border-2 border-[#27272a] bg-[#121215] p-6 sm:p-8">
              <h3 className="text-xl font-black">One click, no terminal</h3>
              <p className="mt-2 text-sm font-bold text-[#a1a1aa]">
                Drop the .skill file into Claude → Settings → Skills, or unzip the folder into ~/.claude/skills or .cursor/skills.
              </p>
              <div className="mt-5 flex flex-wrap gap-4">
                <a
                  href="/format-repositories/my-pixar-story-v1/downloads/my-pixar-story.skill"
                  download
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-white bg-white px-5 py-3 text-sm font-black text-[#080817] shadow-[4px_4px_0_#52d6ff] transition hover:bg-[#52d6ff]"
                >
                  <Download className="size-4" />
                  Download .skill
                </a>
                <a
                  href="/format-repositories/my-pixar-story-v1/downloads/wiggly-my-pixar-story-format-kit.zip"
                  download
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-[#27272a] bg-[#18181b] px-5 py-3 text-sm font-black text-white hover:border-white"
                >
                  <Download className="size-4" />
                  Download .zip
                </a>
              </div>
            </div>

            {/* One-command Install */}
            <div className="rounded-xl border-2 border-[#27272a] bg-[#121215] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black">One command (any agent)</h3>
                <p className="mt-2 text-sm font-bold text-[#a1a1aa]">
                  Installs the official skill directly into your active workspace.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-[#27272a] bg-[#09090b] px-4 py-3 font-mono text-sm">
                <span className="text-[#52d6ff]">{installCommand}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(installCommand)}
                  className="inline-flex items-center gap-1.5 rounded bg-[#27272a] px-3 py-1 text-xs font-bold text-white hover:bg-[#3f3f46]"
                >
                  {copiedCommand ? (
                    <>
                      <Check className="size-3.5 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
