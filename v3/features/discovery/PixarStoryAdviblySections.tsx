"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, Download } from "lucide-react";
import Link from "next/link";
import { DiscoveryFormatHandoff } from "./DiscoveryFormatHandoff";
import type { DiscoveryFormatProfile } from "./types";
import { mcpSetupAgents } from "./mcpSetupAgents";

const installCommand = "npx skills add wiggly-app/skills -s my-pixar-story";
const agentSentence = "Make a Pixar-style story from our family memories.";
const manualInstall = `git clone https://github.com/wiggly-app/skills.git
cp -R my-pixar-story ~/.claude/skills/`;
const poster = "/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-poster.jpg";
const filmSrc = "/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-web.mp4";
const skillHref = "/format-repositories/my-pixar-story-v1/downloads/my-pixar-story.skill";
const zipHref = "/format-repositories/my-pixar-story-v1/downloads/wiggly-my-pixar-story-format-kit.zip";
const sourceHref = "https://github.com/wiggly-app/skills/blob/main/my-pixar-story/SKILL.md";

const phrases = [
  agentSentence,
  "3D animated family memoir from our memories",
  "Warm big-eyed feature-animation film about my dad",
  "Pixar-style tribute for my mom's birthday",
];

const heroCards = [
  { label: "Young Shaz", className: "left-[2%] top-[8%] h-[280px] w-[168px] -rotate-6", position: "object-[8%_center]" },
  { label: "The Accord", className: "left-[7%] top-[46%] h-[220px] w-[140px] rotate-3", position: "object-[28%_40%]" },
  { label: "Mia", className: "right-[2%] top-[6%] h-[300px] w-[176px] rotate-6", position: "object-[78%_center]" },
  { label: "The porch", className: "right-[8%] top-[48%] h-[230px] w-[146px] -rotate-3", position: "object-[62%_30%]" },
];

const castClips = [
  { label: "Young Shaz", position: "object-left" },
  { label: "Adult Shaz", position: "object-center" },
  { label: "Mia", position: "object-right" },
];

const relatedSkills = [
  {
    href: "/formats/three-d-breakdown",
    kicker: "Explainers",
    title: "3D Breakdown",
    text: "One evidence-backed product story becomes a fast 3D explanation.",
  },
  {
    href: "/formats/talking-fish-news",
    kicker: "Reports",
    title: "Talking Fish News",
    text: "One real current story becomes a short deadpan fish report.",
  },
  {
    href: "/formats/jingle",
    kicker: "Audio",
    title: "Jingle",
    text: "One buyer truth becomes a 20-second hook people can sing back.",
  },
  {
    href: "/formats/lego-music-video",
    kicker: "Music",
    title: "Lego Music Video",
    text: "One brand becomes an original song in a miniature world.",
  },
];

export function PixarStoryNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <nav className="pointer-events-auto flex w-full max-w-[860px] items-center justify-between gap-4 rounded-full border border-black/5 bg-white px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
        <Link href="/" aria-label="Wiggly home" className="pl-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="h-7 w-auto" src="/wiggly-wordmark-3d-crop.png" alt="" />
        </Link>
        <div className="hidden items-center gap-6 text-sm text-[#3a3834] sm:flex">
          <Link href="/mcp-setup" className="hover:text-black">
            MCP
          </Link>
          <Link href="/discover" className="hover:text-black">
            Skills
          </Link>
        </div>
        <a
          href="#install"
          className="rounded-full bg-[#171614] px-4 py-2 text-sm font-semibold text-white"
        >
          Install the skill
        </a>
      </nav>
    </div>
  );
}

export function PixarStoryHeroAction({
  format,
}: {
  format?: DiscoveryFormatProfile;
} = {}) {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        {heroCards.map((card) => (
          <PortraitClip
            key={card.label}
            label={card.label}
            className={card.className}
            position={card.position}
            src={filmSrc}
            poster={poster}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[640px] text-center">
        <Link href="/discover" className="inline-flex items-center gap-1.5 text-sm text-[#6f6b62]">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All skills
        </Link>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">
          Family memoir · Wiggly skill
        </p>
        <h1 className="pixar-display mt-4 text-[clamp(48px,6vw,68px)] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#141311]">
          My Pixar Story
        </h1>
        <p className="mx-auto mt-5 max-w-[34rem] text-[17px] leading-7 text-[#4d4a44]">
          Give your agent your family&apos;s memories. It builds a consistent 3D cast and hands back a narrated widescreen film of about 72 seconds. The film on this page is one it made.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {format?.handoff ? <DiscoveryFormatHandoff format={format} tone="dark" /> : null}
          <a
            href="#install"
            className="inline-flex items-center rounded-full bg-[#171614] px-5 py-3 text-sm font-semibold text-white"
          >
            Install the skill
          </a>
          <a
            href={zipHref}
            download
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[#171614] shadow-sm"
          >
            <Download className="size-4" aria-hidden="true" />
            Download free skill file
          </a>
        </div>
        <div className="mx-auto mt-4 max-w-[560px]">
          <PixarStoryInstallCommand />
        </div>
        <p className="mt-3 text-sm text-[#6f6b62]">Free and open source.</p>
        <div className="mt-8">
          <p className="text-sm text-[#6f6b62]">Built for</p>
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {mcpSetupAgents.map((agent) => (
              <li key={agent.slug}>
                <AgentMark name={agent.name} src={agent.src} slug={agent.slug} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PixarStoryInstallCommand({
  tone = "onLight",
}: {
  tone?: "onLight" | "onDark";
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] px-4 py-3 text-left text-white ${
        tone === "onDark" ? "bg-[#09090b]" : "bg-[#171614]"
      }`}
    >
      <span aria-hidden="true" className="font-mono text-sm text-[#a39e94]">
        $
      </span>
      <span className="min-w-0 flex-1 break-all font-mono text-[13px]">{installCommand}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(installCommand);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2c2a26] px-3 py-1.5 text-xs font-medium text-white"
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function AgentMark({ name, src, slug }: { name: string; src: string; slug: string }) {
  return (
    <Link
      href={`/mcp-setup/${slug}`}
      title={name}
      aria-label={`Set up the Wiggly MCP in ${name}`}
      className="inline-flex size-8 items-center justify-center rounded-lg transition-transform hover:-translate-y-0.5 hover:scale-110"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-7 object-contain" />
    </Link>
  );
}

function PortraitClip({
  src,
  poster,
  label,
  className,
  position,
}: {
  src: string;
  poster: string;
  label: string;
  className: string;
  position: string;
}) {
  return (
    <div className={`absolute overflow-hidden rounded-[22px] bg-[#e7e4dc] shadow-[0_18px_40px_rgba(0,0,0,0.16)] ${className}`}>
      <video
        className={`h-full w-full object-cover ${position}`}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {label}
      </span>
    </div>
  );
}

export function PixarStoryAdviblySections({
  film,
}: {
  film: DiscoveryFormatProfile["proofEntries"][number];
}) {
  const clipSrc = film?.media.kind === "video" ? film.media.src : filmSrc;
  const clipPoster = film?.media.kind === "video" ? film.media.poster : poster;
  const pipelineSteps = [
    {
      num: 1,
      short: "Cast and story",
      title: "Story Director (Beats & Thesis)",
      desc: "The skill reads your questionnaire memories, builds an original protagonist across life stages (childhood, young adult, adult) and hero props (vehicles, instruments, keepsakes), then writes a 5–7 beat script paced to time with an earned thesis. Mandatory approval gate before rendering video.",
    },
    {
      num: 2,
      short: "Character lineups",
      title: "4K Character Lineup Sheets",
      desc: "One expressive feature-3D character lineup sheet with Nano Banana 2.1 via Google Flow, generated sequentially for character continuity: large eyes with catchlights, tactile materials, warm volumetric light, and creamy depth of field. A weak still is re-rolled cheaply here, never repaired in video.",
    },
    {
      num: 3,
      short: "Places and plates",
      title: "Spatial 3D Environment Plates",
      desc: "Spatial 3D environment plates with soft rounded shapes, volumetric lighting, and storybook depth of field.",
    },
    {
      num: 4,
      short: "Storyboard panels",
      title: "16:9 Storyboard Direct Panels",
      desc: "Native 16:9 2K storyboard panels locking camera moves, character eyelines, and physical staging for human director approval.",
    },
    {
      num: 5,
      short: "Animate and score",
      title: "Seedance 2.5 Emergent Multimodal Audio",
      desc: "ByteDance Seedance 2.5 generates expressive 3D character acting and ambient Foley in the visual latent space, mixed with a continuous 72-second emotional piano score and authentic parent voiceover narrating across the scene cuts.",
    },
    {
      num: 6,
      short: "Stitch the film",
      title: "Lossless FFmpeg Concat & Dailies",
      desc: "Lossless FFmpeg assembly stitches the clips into a master 72-second 1080p film with automated dailies contact sheets.",
    },
  ];

  const modelStack = [
    {
      name: "Claude Haiku 5.5 / Meta Muse",
      role: "Screenplay Director",
      description: "Extracts true facts, balances humor and tenderness, discovers the closing thesis, and drafts natural spoken lines.",
    },
    {
      name: "Nano Banana 2.1",
      role: "Character & Prop Sheets",
      description: "Multi-character reference lineups, hero vehicles, and spatial environment plates with a 3D feature-animation look.",
    },
    {
      name: "Seedance 2.5",
      role: "Video & Acoustic Diffusion",
      description: "Generates widescreen 16:9 clips with emergent synced ambience, character Foley, and room tone.",
    },
    {
      name: "ByteDance Video Upscaler",
      role: "1080p Theatrical Upscaler",
      description: "Temporal super-resolution for a clear 1080p master.",
    },
    {
      name: "Lossless FFmpeg",
      role: "Conform & Dailies Assembly",
      description: "Automatic lossless concatenation, audio balance, and a 9-frame story contact sheet.",
    },
  ];

  const playbook = [
    {
      file: "beats",
      href: `${sourceHref}#2-the-7-beat-screenplay-architecture-72-seconds-total`,
      text: "The 7-beat arc, life-stage timing, and the approval gate before any video.",
    },
    {
      file: "lineup",
      href: `${sourceHref}#3-character--hero-prop-prompt-recipes-nano-banana-21`,
      text: "The lineup and hero-prop formulas, the reference chain, and still QA.",
    },
    {
      file: "scenes",
      href: `${sourceHref}#4-scene-prompting-architecture-seedance-25-negative-audio-lock`,
      text: "Scene prompt structure, camera locks, and what the shot is allowed to do.",
    },
    {
      file: "score",
      href: `${sourceHref}#1-the-core-philosophy`,
      text: "Parent voiceover, the piano bed, and why a weak still is re-rolled instead of repaired in video.",
    },
  ];

  const limits = [
    "The look is original feature-film 3D animation. “Pixar-style” is shorthand for warm light, large eyes, and tactile materials, not a studio's characters or logo.",
    "The lineup sheet is locked before any video. Character drift is fixed by regenerating the still, not by adding motion.",
    "Hands, eyes, and small text can garble. The still is regenerated with a tighter constraint.",
    "The parent voiceover and piano score carry the 72 seconds. Animation waits until the storyboard is approved.",
    "Every family gets its own cast. Nothing is reused as a house mascot.",
  ];

  const questions = [
    {
      q: "Is this made with Pixar, or does it copy Pixar characters?",
      a: "Neither. The skill aims at warm, big-eyed feature-film 3D animation: catchlights, tactile materials, and storybook light. Characters come from the family's answers and photos.",
    },
    {
      q: "What do I have to give the agent?",
      a: "A questionnaire of real memories across childhood, teen, adult, and the closing moment, plus optional family photos. The agent writes the beat map and waits for approval.",
    },
    {
      q: "How long is the film, and how long does it take?",
      a: "About 72 seconds, widescreen 16:9. You approve the cast sheet and the storyboard stills. Animation, voice, and the score run after that yes.",
    },
    {
      q: "What does it cost?",
      a: "The skill is free to install. The agent quotes credits before each still. After you approve the storyboard, it shows the credit total for the animation and waits. A short balance gets a payment link.",
    },
    {
      q: "Which agents can run it?",
      a: "Any agent that can install a skill and call the Wiggly MCP: Claude Code, Claude, Cursor, Codex, VS Code, Windsurf, ChatGPT, Antigravity, Grokbot, and Meta Muse.",
    },
  ];

  return (
    <div className="w-full text-[#141311]">
      <section className="bg-[#f3f1ea] px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Just ask</p>
          <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.035em] sm:text-6xl">
            Say the word, <em className="font-medium italic">it runs.</em>
          </h2>
          <p className="mt-4 text-[#5c5850]">The skill fires on natural requests like these. No commands to memorize.</p>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {phrases.map((phrase) => (
              <li
                key={phrase}
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-[#141311] shadow-sm"
              >
                “{phrase}”
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[720px]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">The pipeline</p>
          <h2 className="pixar-display mt-3 text-center text-5xl font-extrabold tracking-[-0.035em] sm:text-6xl">
            What the skill <em className="font-medium italic">does for you.</em>
          </h2>
          <ol className="relative mt-14 space-y-8 border-l border-black/10 pl-8">
            {pipelineSteps.map((step) => (
              <li key={step.title} className="relative">
                <span className="absolute -left-[42px] flex size-7 items-center justify-center rounded-full bg-[#eceae3] text-xs font-semibold text-[#3a3834]">
                  {step.num}
                </span>
                <h3 className="text-lg font-semibold">{step.short}</h3>
                <p className="sr-only">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#5c5850]">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#eceae3] px-4 py-16 text-center sm:px-8">
        <p className="pixar-display mx-auto max-w-[640px] text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          The memory gets a face. The family gets the ending.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-[#5c5850]">
          Approve the cast sheet, then the storyboard. Animation, voice, and score run after that.
        </p>
      </section>

      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1040px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Original casts</p>
            <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.035em]">
              A new cast for every family.
            </h2>
            <p className="mt-4 text-[#5c5850]">
              No borrowed characters and no house mascot pasted onto every film. Each family gets its own protagonist across life stages, written from the questionnaire.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-[#3a3834]">
              {[
                "Original characters and settings only, never a franchise character or a studio logo",
                "Life stages stay the same person: child, teen, and adult",
                "Hero props, the car, the instrument, the keepsake, are locked before the shots",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {castClips.map((clip) => (
              <figure key={clip.label} className="overflow-hidden rounded-[22px] bg-[#e7e4dc] shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
                <div className="relative aspect-[9/16]">
                  <video
                    className={`h-full w-full object-cover ${clip.position}`}
                    src={clipSrc}
                    poster={clipPoster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                  <figcaption className="absolute bottom-3 left-3 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {clip.label}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="examples" className="px-4 pb-8 sm:px-8">
        <div className="mx-auto max-w-[1040px]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Finished memoir</p>
          <h2 className="pixar-display mt-3 text-center text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            {film?.title ?? "The film."}
          </h2>
          {film?.media.kind === "video" ? (
            <video
              className="mt-10 block aspect-video w-full rounded-2xl bg-black object-contain shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
              src={film.media.src}
              poster={film.media.poster}
              controls
              playsInline
              preload="metadata"
            />
          ) : null}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto grid max-w-[1040px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">The model stack</p>
            <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.03em]">
              Short shots, <em className="font-medium italic">on purpose.</em>
            </h2>
            <p className="mt-4 max-w-md text-[#5c5850]">
              Each model has one job. The still carries the look: the eyes, the light, the silhouette. Nano Banana 2.1 makes every character and location plate, and Seedance 2.5 moves it.
            </p>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d897f]">What you get</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#3a3834]">
              {[
                "A finished widescreen 3D memoir, about 72 seconds",
                "An approved cast sheet and 5–7 beat script",
                "Storyboard panels locked before any animation",
                "Parent voiceover and a piano score, mixed in",
                "A 1080p master and a dailies contact sheet",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a href={sourceHref} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline decoration-black/30 underline-offset-4">
              Read the source
            </a>
          </div>
          <div className="divide-y divide-black/10">
            {modelStack.map((model) => (
              <div key={model.name} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-white px-2 py-1 text-sm font-semibold">{model.name}</code>
                  <span className="text-xs font-medium text-[#8d897f]">{model.role}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#5c5850]">{model.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="install" className="scroll-mt-24 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-[1040px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Install</p>
          <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.03em]">Add it in seconds.</h2>
          <p className="mt-4 max-w-2xl text-[#5c5850]">
            Install the skill, then connect the Wiggly MCP so the agent has tools to call.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {mcpSetupAgents.map((agent) => (
              <li key={agent.slug}>
                <AgentMark name={agent.name} src={agent.src} slug={agent.slug} />
              </li>
            ))}
          </ul>
          <Link
            href="/mcp-setup"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline decoration-black/30 underline-offset-4"
          >
            Connect the Wiggly MCP first
          </Link>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h3 className="text-lg font-semibold">One click, no terminal</h3>
              <p className="mt-2 text-sm leading-6 text-[#5c5850]">
                Drop the .skill file into Claude → Settings → Skills, or unzip the folder into ~/.claude/skills or .cursor/skills.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={skillHref} download className="inline-flex items-center gap-2 rounded-full bg-[#171614] px-4 py-2 text-sm font-semibold text-white">
                  <Download className="size-4" aria-hidden="true" />
                  Download .skill
                </a>
                <a href={zipHref} download className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold">
                  <Download className="size-4" aria-hidden="true" />
                  Download .zip
                </a>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h3 className="text-lg font-semibold">One command (any agent)</h3>
              <p className="mt-2 text-sm leading-6 text-[#5c5850]">
                Installs the skill into the workspace your agent already has open.
              </p>
              <div className="mt-5">
                <PixarStoryInstallCommand tone="onDark" />
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <h3 className="text-lg font-semibold">Manual</h3>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-[#171614] p-3 font-mono text-xs leading-relaxed text-[#d7ff6a]">
                {manualInstall}
              </pre>
              <p className="mt-3 text-sm text-[#5c5850]">
                Or in Claude Desktop: Settings → Skills → Install and select the skill folder.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-[1040px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Bundled references</p>
          <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.03em]">The playbook.</h2>
          <p className="mt-4 max-w-2xl text-[#5c5850]">
            The skill file holds the recipes the agent loads, so the craft is baked in.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {playbook.map((doc) => (
              <a key={doc.file} href={doc.href} className="rounded-2xl border border-black/10 bg-white p-5">
                <code className="text-sm font-semibold">{doc.file}</code>
                <p className="mt-2 text-sm leading-6 text-[#5c5850]">{doc.text}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-[720px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Honest limits</p>
          <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.03em]">What to watch for.</h2>
          <ul className="mt-8 space-y-4">
            {limits.map((limit) => (
              <li key={limit} className="border-t border-black/10 pt-4 text-sm leading-6 text-[#3a3834]">
                {limit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Credits</p>
          <h2 className="pixar-display mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            The agent asks <em className="font-medium italic">before it spends.</em>
          </h2>
          <p className="mt-4 text-lg leading-8 text-[#5c5850]">
            The skill is free to install. The agent quotes credits before each still. After you approve the storyboard, it shows the credit total for the animation and waits. A short balance gets a payment link.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-[720px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d897f]">Questions</p>
          <h2 className="pixar-display mt-3 text-5xl font-extrabold tracking-[-0.03em]">Before you install it.</h2>
          <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
            {questions.map((item) => (
              <details key={item.q} className="group py-4 text-left">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                  {item.q}
                  <span aria-hidden="true" className="text-xl font-normal text-[#8d897f] group-open:hidden">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#5c5850]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#171614] px-4 py-20 text-white sm:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="pixar-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            Your family, starring in its own short film.
          </h2>
          <p className="mt-4 text-[#c8c4bb]">
            Install the skill, connect the Wiggly MCP, and tell your agent which memory gets the lead.
          </p>
          <div className="mx-auto mt-8 max-w-[560px]">
            <PixarStoryInstallCommand tone="onDark" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
            <a href={zipHref} download className="rounded-full bg-white px-4 py-2 font-semibold text-[#171614]">
              Download free skill file
            </a>
            <a href={skillHref} download className="underline decoration-white/40 underline-offset-4">
              Download the .skill file
            </a>
            <a href={sourceHref} className="underline decoration-white/40 underline-offset-4">
              Read the source
            </a>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-[1040px]">
          <h2 className="pixar-display text-5xl font-extrabold tracking-[-0.035em]">Keep building.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedSkills.map((skill) => (
              <Link key={skill.href} href={skill.href} className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d897f]">{skill.kicker}</p>
                <h3 className="mt-2 text-lg font-semibold">{skill.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5c5850]">{skill.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
