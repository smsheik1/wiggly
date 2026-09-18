"use client";

import { Bot, Check, Copy } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { buildDiscoveryHandoffPrompt } from "./handoff";
import type { DiscoveryFormatProfile } from "./types";

export function DiscoveryFormatHandoff({
  format,
  compact = false,
  tone = "lime",
}: {
  format: DiscoveryFormatProfile;
  compact?: boolean;
  tone?: "lime" | "dark";
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!format.handoff) return null;

  const prompt = () => buildDiscoveryHandoffPrompt(format, window.location.origin);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2400);
  };

  const copyPrompt = async () => {
    posthog.capture("format_handoff_started", {
      destination: "coding-agent",
      format_slug: format.slug,
    });
    try {
      await navigator.clipboard.writeText(prompt());
      showFeedback("Copied prompt!");
    } catch {
      showFeedback("Copy failed");
    }
  };

  return (
    <div className={compact ? "w-full" : "shrink-0"}>
      <button
        type="button"
        onClick={() => void copyPrompt()}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-[#080817] px-5 text-sm font-black shadow-[4px_4px_0_#080817] transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
          compact ? "w-full" : ""
        } ${tone === "dark" ? "bg-[#080817] text-white shadow-[5px_5px_0_#52d6ff]" : "bg-[#c9ff55] text-[#080817]"}`}
      >
        {feedback ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        <span>{feedback ?? "Copy Agent Prompt"}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {feedback}
      </span>
    </div>
  );
}
