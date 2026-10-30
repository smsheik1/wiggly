"use client";

import { useState, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Film,
  Maximize2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  User,
} from "lucide-react";

interface ClientBrand {
  id: string;
  name: string;
  tag: string;
  color: string;
  avatarBg: string;
  systemNotice: string;
}

const CLIENT_BRANDS: ClientBrand[] = [
  {
    id: "meta-muse",
    name: "Meta Muse",
    tag: "Meta AI Studio",
    color: "#4f46e5",
    avatarBg: "bg-[#4f46e5]",
    systemNotice: "Powered by Meta Muse Director & Seedance 2.5",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    tag: "OpenAI Desktop",
    color: "#10b981",
    avatarBg: "bg-[#10b981]",
    systemNotice: "Grounded with Wiggly Pixar Story Custom GPT",
  },
  {
    id: "grokbot",
    name: "Grokbot",
    tag: "xAI Autonomous Agent",
    color: "#e11d48",
    avatarBg: "bg-[#e11d48]",
    systemNotice: "Grok Bot persistent studio runtime enabled",
  },
  {
    id: "claude",
    name: "Claude",
    tag: "Anthropic Desktop",
    color: "#ea580c",
    avatarBg: "bg-[#ea580c]",
    systemNotice: "Skill loaded: wiggly-app/skills -s my-pixar-story",
  },
  {
    id: "cursor",
    name: "Cursor",
    tag: "Native IDE Agent",
    color: "#0284c7",
    avatarBg: "bg-[#0284c7]",
    systemNotice: ".cursor/skills/my-pixar-story active",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    tag: "Google DeepMind",
    color: "#8b5cf6",
    avatarBg: "bg-[#8b5cf6]",
    systemNotice: "Google Flow 2.1 & Replicate backend connected",
  },
];

const SIDEBAR_THREADS = [
  {
    id: "mia",
    title: "Mia's 7th Birthday",
    status: "Done · 4:40 PM",
    color: "#ea580c",
    active: true,
  },
  {
    id: "grandpa",
    title: "Grandpa's Accord Legacy",
    status: "Master conformed",
    color: "#4f46e5",
    active: false,
  },
  {
    id: "mom",
    title: "Mom's Porch Light Film",
    status: "Cast approved",
    color: "#0284c7",
    active: false,
  },
  {
    id: "bike",
    title: "Leo's First Bike",
    status: "Dailies ready",
    color: "#10b981",
    active: false,
  },
];

export function DesktopChatShowcase() {
  const [activeClient, setActiveClient] = useState<ClientBrand>(CLIENT_BRANDS[0]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Auto-loop timer: cycles steps 1 -> 2 -> 3
  useEffect(() => {
    if (!isPlaying) return;

    const durations = [4500, 5500, 6000]; // Duration per step in ms
    const currentDuration = durations[activeStep - 1] || 5000;

    const timer = setTimeout(() => {
      setActiveStep((prev) => (prev >= 3 ? 1 : prev + 1));
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [activeStep, isPlaying]);

  return (
    <div className="w-full">
      {/* 1. Client Branding Switcher Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#94a3b8]">
            Preview Agent:
          </span>
          {CLIENT_BRANDS.map((client) => {
            const isSelected = activeClient.id === client.id;
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => setActiveClient(client)}
                className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-xs font-black transition ${
                  isSelected
                    ? "border-white bg-white text-[#080817] shadow-[2px_2px_0_#52d6ff]"
                    : "border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:border-white hover:text-white"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
                {client.name}
              </button>
            );
          })}
        </div>

        {/* Step Scrubber & Play/Pause */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#27272a] bg-[#121215] p-1 text-xs">
            {[
              { num: 1, label: "The Ask" },
              { num: 2, label: "Review Cast" },
              { num: 3, label: "Master Film" },
            ].map((step) => (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  setActiveStep(step.num);
                  setIsPlaying(false);
                }}
                className={`rounded-md px-2.5 py-1 font-black transition ${
                  activeStep === step.num
                    ? "bg-[#52d6ff] text-[#080817]"
                    : "text-[#71717a] hover:text-white"
                }`}
              >
                {step.num}. {step.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[#27272a] bg-[#18181b] text-white hover:border-white"
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. macOS Desktop Window Frame */}
      <div className="overflow-hidden rounded-2xl border-2 border-[#27272a] bg-[#09090b] shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* macOS Title Bar */}
        <div className="flex items-center justify-between border-b border-[#27272a] bg-[#121215] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ff5f56]" />
            <span className="size-3 rounded-full bg-[#ffbd2e]" />
            <span className="size-3 rounded-full bg-[#27c93f]" />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#a1a1aa]">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: activeClient.color }}
            />
            <span className="text-white font-black">{activeClient.name}</span>
            <span>—</span>
            <span>{activeClient.tag}</span>
            <span className="hidden sm:inline text-[#71717a]">
              ({activeClient.systemNotice})
            </span>
          </div>

          <div className="w-12 text-right text-[11px] font-bold text-[#71717a]">
            {isPlaying ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            ) : (
              <span>Paused</span>
            )}
          </div>
        </div>

        {/* Desktop App Body: 2-Column Layout */}
        <div className="grid lg:grid-cols-[260px_1fr] min-h-[540px]">
          {/* Left Sidebar: Threads Roster */}
          <div className="hidden lg:flex flex-col justify-between border-r border-[#27272a] bg-[#0d0d10] p-4">
            <div>
              {/* Search Bar */}
              <div className="flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b] px-3 py-2 text-xs text-[#71717a]">
                <Search className="size-3.5" />
                <span>Search memories...</span>
              </div>

              {/* Roster List */}
              <div className="mt-4 space-y-1">
                {SIDEBAR_THREADS.map((thread) => (
                  <div
                    key={thread.id}
                    className={`flex items-start gap-3 rounded-lg p-2.5 transition ${
                      thread.active
                        ? "bg-[#1e1e24] text-white"
                        : "text-[#a1a1aa] hover:bg-[#151518]"
                    }`}
                  >
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: thread.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">{thread.title}</p>
                      <p className="truncate text-[11px] text-[#71717a]">
                        {thread.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 border-t border-[#27272a] pt-3 text-xs">
              <div className="flex size-7 items-center justify-center rounded-full bg-[#27272a] font-black text-white">
                SS
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-white">Shahzeb Sheikh</p>
                <p className="truncate text-[10px] text-[#71717a]">
                  Creative Director
                </p>
              </div>
            </div>
          </div>

          {/* Right Chat Canvas */}
          <div className="flex flex-col justify-between bg-[#09090b] p-4 sm:p-6">
            <div className="space-y-5">
              {/* Message 1: The User Ask */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#1e1e24] px-4 py-3 text-sm font-medium text-white shadow-md">
                  <p className="leading-relaxed">
                    Make a Pixar-style 3D memoir for my daughter Mia about the time we
                    fixed the 2000 Honda Accord together in the driveway.
                  </p>
                </div>
              </div>

              {/* Message 2: Agent Response with Structured Checklist & Character Lineup */}
              {activeStep >= 2 && (
                <div className="flex justify-start transition-opacity duration-300">
                  <div className="max-w-[92%] space-y-3">
                    <div className="rounded-2xl rounded-tl-sm border border-[#27272a] bg-[#121215] p-4 text-xs text-[#e4e4e7] shadow-lg">
                      {/* Structured Checklist */}
                      <div className="space-y-1.5 font-mono text-[11px] text-[#a1a1aa]">
                        <p className="flex items-center gap-2 text-emerald-400">
                          <Check className="size-3.5" />
                          <span>Questionnaire parsed → 4 distinct life stages locked</span>
                        </p>
                        <p className="flex items-center gap-2 text-emerald-400">
                          <Check className="size-3.5" />
                          <span>
                            7-Beat screenplay → &quot;I Still Leave the Porch Light On&quot;
                          </span>
                        </p>
                        <p className="flex items-center gap-2 text-emerald-400">
                          <Check className="size-3.5" />
                          <span>
                            Hero Prop turnaround → 2000 Honda Accord coupe model locked
                          </span>
                        </p>
                      </div>

                      {/* Anxiety-Relief Assurance */}
                      <p className="mt-3 text-xs font-bold leading-relaxed text-[#f4f4f5]">
                        The 4K lineup sheet and 7-beat script are sitting on your screen.
                        Nothing renders into video until you&apos;ve had a look and approved the
                        cast.
                      </p>

                      {/* Embedded 4K Character Lineup Sheet Preview Card */}
                      <div className="mt-3 overflow-hidden rounded-xl border border-[#27272a] bg-[#09090b]">
                        <div className="flex items-center justify-between border-b border-[#27272a] bg-[#18181b] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#a1a1aa]">
                          <span className="text-[#52d6ff]">Approval Gate</span>
                          <span>4K Lineup: Shaz, Sister, Mia</span>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/format-repositories/my-pixar-story-v1/examples/character-lineup.png"
                          alt="Character lineup preview"
                          className="h-28 sm:h-36 w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message 3: User Approval */}
              {activeStep >= 2 && (
                <div className="flex justify-end transition-opacity duration-300">
                  <div className="relative max-w-[85%] rounded-2xl rounded-tr-sm bg-[#1e1e24] px-4 py-3 text-sm font-medium text-white shadow-md">
                    <p>The character sheet looks amazing. Approved, render the theatrical master!</p>
                    <span className="absolute -bottom-2 -left-2 flex size-6 items-center justify-center rounded-full border border-[#27272a] bg-[#121215] text-xs">
                      👍
                    </span>
                  </div>
                </div>
              )}

              {/* Message 4: Agent Completion with Final 1080p Master Video Card */}
              {activeStep >= 3 && (
                <div className="flex justify-start transition-opacity duration-300">
                  <div className="max-w-[92%] space-y-2">
                    <div className="rounded-2xl rounded-tl-sm border border-emerald-500/30 bg-[#0c1a14] p-4 text-xs text-[#e4e4e7] shadow-xl">
                      <div className="space-y-1 font-mono text-[11px] text-emerald-400">
                        <p className="flex items-center gap-2">
                          <Check className="size-3.5" />
                          <span>
                            ByteDance 1080p temporal super-resolution conformed
                          </span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Check className="size-3.5" />
                          <span>
                            Continuous piano score &amp; authentic voiceover mixed
                          </span>
                        </p>
                      </div>

                      <p className="mt-2 text-xs font-black text-white">
                        Done. 72-second master film ready to watch &amp; download.
                      </p>

                      {/* Video Player Card */}
                      <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/40 bg-[#09090b] relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-poster.jpg"
                          alt="Finished master film"
                          className="h-32 sm:h-44 w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="flex size-11 items-center justify-center rounded-full border-2 border-white bg-white/20 backdrop-blur-md text-white">
                            <Play className="size-5 fill-white ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                          01:12 · 1080p Master
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fake Message Input Bar */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-[#27272a] bg-[#121215] px-4 py-3 text-xs text-[#71717a]">
              <div className="flex items-center gap-2">
                <span className="text-white font-black">+</span>
                <span>Message {activeClient.name}...</span>
              </div>
              <Mic className="size-4 text-[#71717a]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
