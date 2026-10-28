"use client";

import Link from "next/link";
import { useState } from "react";
import { mcpSetupAgents, type McpSetupAgent } from "./mcpSetupAgents";

const MCP_URL = "https://wiggly.agentenamel.com/mcp";

const tileShadow = "shadow-[0_2px_6px_rgba(17,17,17,0.06),0_20px_44px_-16px_rgba(17,17,17,0.34)]";

type StepVisual =
  | { kind: "terminal"; comment: string; command: string }
  | { kind: "connectors"; title: string; row: string }
  | { kind: "code"; code: string }
  | { kind: "file"; filename: string }
  | { kind: "oauth"; agentName: string };

type SetupStep = {
  n: string;
  title: string;
  body: string;
  visual: StepVisual;
};

function oauthStep(agentName: string, n = "03"): SetupStep {
  return {
    n,
    title: "Sign in with Wiggly.",
    body: "Authorize once in your browser. Wiggly is live and ready to generate on-brand.",
    visual: { kind: "oauth", agentName },
  };
}

function stepsFor(agent: McpSetupAgent | null): SetupStep[] {
  const name = agent?.name ?? "Claude";
  const slug = agent?.slug ?? "claude";

  if (slug === "claude-code") {
    return [
      {
        n: "01",
        title: "Open your terminal.",
        body: "Add Wiggly with a single command.",
        visual: { kind: "terminal", comment: "# register the Wiggly MCP server", command: "claude mcp add" },
      },
      {
        n: "02",
        title: "Add Wiggly.",
        body: "Run the connect command. Wiggly registers as an MCP server.",
        visual: { kind: "code", code: `claude mcp add --transport http wiggly ${MCP_URL}` },
      },
      oauthStep("Claude Code"),
    ];
  }

  if (slug === "cursor") {
    return [
      {
        n: "01",
        title: "Open Cursor.",
        body: "Add Wiggly to .cursor/mcp.json, or ~/.cursor/mcp.json to enable it across every project.",
        visual: { kind: "file", filename: ".cursor/mcp.json" },
      },
      {
        n: "02",
        title: "Add Wiggly.",
        body: "Add the Wiggly server to .cursor/mcp.json.",
        visual: {
          kind: "code",
          code: `{\n  "mcpServers": {\n    "wiggly": {\n      "url": "${MCP_URL}"\n    }\n  }\n}`,
        },
      },
      oauthStep("Cursor"),
    ];
  }

  if (slug === "vscode") {
    return [
      {
        n: "01",
        title: "Open VS Code.",
        body: 'Run "MCP: Add Server" from the Command Palette, or edit .vscode/mcp.json.',
        visual: { kind: "file", filename: ".vscode/mcp.json" },
      },
      {
        n: "02",
        title: "Add Wiggly.",
        body: "Add the Wiggly server to .vscode/mcp.json.",
        visual: {
          kind: "code",
          code: `{\n  "servers": {\n    "wiggly": {\n      "type": "http",\n      "url": "${MCP_URL}"\n    }\n  }\n}`,
        },
      },
      oauthStep("VS Code"),
    ];
  }

  if (slug === "codex") {
    return [
      {
        n: "01",
        title: "Open your terminal.",
        body: "Edit ~/.codex/config.toml, or .codex/config.toml per project.",
        visual: { kind: "file", filename: "~/.codex/config.toml" },
      },
      {
        n: "02",
        title: "Add Wiggly.",
        body: "Add the Wiggly server to ~/.codex/config.toml.",
        visual: { kind: "code", code: `[mcp_servers.wiggly]\nurl = "${MCP_URL}"` },
      },
      {
        n: "03",
        title: "Log in to Wiggly.",
        body: "Run this command to open the OAuth approval screen in your browser.",
        visual: { kind: "code", code: "codex mcp login wiggly" },
      },
      oauthStep("Codex", "04"),
    ];
  }

  if (slug === "chatgpt") {
    return [
      {
        n: "01",
        title: "Enable Developer Mode.",
        body: 'Open Settings → Apps → Advanced settings and turn on Developer Mode, then click "Create app".',
        visual: { kind: "connectors", title: "Apps", row: "Create app" },
      },
      {
        n: "02",
        title: "Add the Wiggly URL.",
        body: "Paste the connector URL. Most clients sign you in automatically.",
        visual: { kind: "code", code: MCP_URL },
      },
      oauthStep("ChatGPT"),
    ];
  }

  if (slug === "windsurf") {
    return [
      {
        n: "01",
        title: "Open Windsurf.",
        body: "Add Wiggly to ~/.codeium/windsurf/mcp_config.json.",
        visual: { kind: "file", filename: "mcp_config.json" },
      },
      {
        n: "02",
        title: "Add Wiggly.",
        body: "Add the Wiggly server to mcp_config.json.",
        visual: {
          kind: "code",
          code: `{\n  "mcpServers": {\n    "wiggly": {\n      "serverUrl": "${MCP_URL}"\n    }\n  }\n}`,
        },
      },
      oauthStep("Windsurf"),
    ];
  }

  const firstTitle = slug === "claude" ? "Open Claude." : `Open ${name}.`;
  const firstBody =
    slug === "claude"
      ? 'Go to Settings → Connectors and choose "Add custom connector".'
      : `Go to Settings → Connectors and choose "Add custom connector".`;

  return [
    {
      n: "01",
      title: firstTitle,
      body: firstBody,
      visual: { kind: "connectors", title: "Connectors", row: "Add custom connector" },
    },
    {
      n: "02",
      title: "Add the Wiggly URL.",
      body: "Paste the connector URL. Most clients sign you in automatically.",
      visual: { kind: "code", code: MCP_URL },
    },
    oauthStep(name),
  ];
}

const tools = [
  ["wiggly_generate_image", "Generate on-brand images with gpt-image-2 - aspect ratio, resolution, and up to 4 variants."],
  ["wiggly_generate_video", "Generate short video ads with Seedance 2.0 - image-to-video, fast or pro."],
  ["wiggly_view_brandkit", "Render the brand style-guide sheet - logo, palette, fonts, tone - right in chat."],
  ["wiggly_update_brand", "Tune a brand's identity: colors, fonts, slogan, aesthetic, and tone."],
  ["wiggly_get_brand", "Read a brand's full profile by id."],
  ["wiggly_list_brands", "List every brand on the connected account."],
  ["wiggly_get_generation", "Fetch any generation by id - image, video or carousel - once ready."],
  ["wiggly_list_generations", "Browse past images, videos and carousels in a scrollable gallery."],
  ["wiggly_check_credits", "Check the account's current credit balance."],
  ["wiggly_buy_credits", "List credit packs with ready-to-use checkout links."],
] as const;

const faqs = [
  [
    "What is the Wiggly MCP server?",
    "It's a Model Context Protocol (MCP) server that lets AI tools call Wiggly directly. Connect it once and your agent can generate on-brand creative assets across images, social posts, videos, carousels, and campaigns, edit images, manage brands, and check credits - all from inside the chat.",
  ],
  [
    "Which AI tools and MCP clients does it work with?",
    "Any MCP-compatible client - Claude, ChatGPT, Cursor, Claude Code, VS Code, Codex, and more. Pick your client in the setup section above for exact, copy-paste steps.",
  ],
  [
    "Do I need an API key?",
    "No. Wiggly MCP uses OAuth - you authorize once in your browser and the client stays connected. There are no keys to copy, paste, or rotate.",
  ],
  [
    "What can I generate through MCP?",
    "Wiggly gives your MCP agents access to a broad creative model stack for image ads, social posts, UGC videos, talking head videos, editorial videos, Instagram carousels, TikTok slideshows, and more. You can also edit images, generate from reference images, and run many generations in parallel for a whole campaign.",
  ],
  [
    "Does it stay on-brand?",
    "Yes. Tie any generation to a brand and Wiggly applies your brand kit - colors, fonts, and tone - so every output is recognizably yours.",
  ],
  [
    "How much does it cost?",
    "MCP is free to use. Your agent uses your existing Wiggly credits at no additional MCP cost. Check your balance with wiggly_check_credits and top up with wiggly_buy_credits, or from your dashboard.",
  ],
] as const;

const footerColumns = [
  {
    title: "Product",
    links: ["AI video ads", "AI image ads", "AI carousels", "Social scheduler", "Brand kit", "Brand intelligence", "MCP setup"],
  },
  {
    title: "Resources",
    links: ["Docs", "Guides & playbooks", "Templates", "Agent skills", "Free tools", "Ad library", "Solutions"],
  },
  {
    title: "AI models",
    links: ["All AI models", "All video models", "All image models"],
  },
  {
    title: "Compare",
    links: [
      "Wiggly vs Higgsfield",
      "Wiggly vs Arcads",
      "Wiggly vs MakeUGC",
      "Wiggly vs Creatify",
      "Wiggly vs JoggAI",
      "Wiggly vs Topview",
      "Wiggly vs Pletor",
      "Wiggly vs Bloom",
      "All alternatives",
    ],
  },
  {
    title: "Company",
    links: ["About", "Pricing", "FAQ", "Support", "Email us"],
  },
  {
    title: "Legal",
    links: ["Legal", "Terms of Service", "Privacy Policy"],
  },
] as const;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
    >
      <svg viewBox="0 0 256 256" className="size-3.5" fill="currentColor" aria-hidden="true">
        <path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z" />
      </svg>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StepVisualView({ visual }: { visual: StepVisual }) {
  if (visual.kind === "terminal") {
    return (
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-black/10 bg-[#f4f1ea] p-4">
        <div className="flex size-full flex-col overflow-hidden rounded-lg bg-[#1a1a1a]">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 font-mono text-xs text-gray-400">Terminal</span>
          </div>
          <div className="flex-1 p-3 font-mono text-[12.5px] leading-relaxed">
            <div className="text-gray-500">{visual.comment}</div>
            <div className="text-gray-100">
              <span className="text-green-400">$</span> {visual.command}
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (visual.kind === "connectors") {
    return (
      <div className="relative mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#f4f1ea] p-5">
        <div className="w-full max-w-[260px] rounded-2xl border border-black/10 bg-white p-4 shadow-md">
          <p className="text-xs font-medium text-neutral-500">{visual.title}</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-black/10 px-3 py-2.5 text-sm">
            <span>{visual.row}</span>
            <span className="text-xs text-neutral-400">Web</span>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Not connected</p>
        </div>
      </div>
    );
  }

  if (visual.kind === "file") {
    return (
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-black/10 bg-[#f4f1ea] p-4">
        <div className="flex size-full overflow-hidden rounded-lg bg-[#1e1e1e] font-mono text-[12px] text-neutral-300">
          <div className="w-8 shrink-0 border-r border-white/10 py-3 text-center text-neutral-500">
            {[1, 2, 3, 4, 5].map((line) => (
              <div key={line} className="leading-6">
                {line}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 truncate text-[11px] text-neutral-500">{visual.filename}</div>
            <div className="text-neutral-200">{visual.filename}</div>
          </div>
        </div>
      </div>
    );
  }

  if (visual.kind === "code") {
    return (
      <div className="relative mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#f4f1ea] p-5">
        <div className="relative w-full overflow-hidden rounded-lg border border-black/10 bg-white">
          <pre className="overflow-x-auto p-3 pr-3 pb-10 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#12110f]">{visual.code}</pre>
          <CopyButton value={visual.code} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#f4f1ea] p-5">
      <div className="flex w-full max-w-[240px] flex-col items-center gap-3.5 rounded-2xl border border-black/10 bg-white p-5 text-center shadow-md">
        <div className="flex items-center">
          <span className="flex size-9 items-center justify-center rounded-[10px] border border-black/10 bg-white ring-2 ring-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wiggly-app-icon-v1-512.png" alt="" className="size-5 rounded-sm" />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mcpSetupAgents.find((item) => item.name === visual.agentName)?.src ?? "/agent-marks/claude.svg"}
            alt=""
            className="-ml-2.5 size-9 shrink-0 rounded-[10px] border border-black/10 bg-white object-contain p-1 ring-2 ring-white"
          />
        </div>
        <p className="text-sm">
          Connect <span className="font-semibold">Wiggly</span> to {visual.agentName}
        </p>
        <div className="w-full rounded-lg bg-[#12110f] py-2 text-xs font-semibold text-white">Approve & connect</div>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "agent" | "user"; children: React.ReactNode }) {
  const mine = side === "user";
  return (
    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${mine ? "ml-auto rounded-br-md bg-[#12110f] text-white" : "mr-auto rounded-bl-md bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200/70"}`}>
      {children}
    </div>
  );
}

function ToolLine({ name }: { name: string }) {
  return (
    <div className="mr-auto flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px] text-neutral-500">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      {name}
      <span className="ml-1 flex items-center gap-1 text-emerald-600">
        <svg viewBox="0 0 256 256" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
        </svg>
        done
      </span>
    </div>
  );
}

const galleryShots = [
  "/assets/pixar-story/steve-jobs/images/scene-1.jpg",
  "/assets/pixar-story/steve-jobs/images/scene-2.jpg",
  "/assets/pixar-story/steve-jobs/images/scene-3.jpg",
  "/assets/pixar-story/steve-jobs/images/scene-4.jpg",
  "/assets/pixar-story/steve-jobs/images/scene-5.jpg",
  "/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-poster.jpg",
  "/format-repositories/my-pixar-story-v1/examples/story-grid.png",
  "/format-repositories/my-pixar-story-v1/examples/character-lineup.png",
  "/format-repositories/shaz-puppet-runtime-v1/goldens/pose-catalog-showcase/poster.jpg",
];

function ShotGrid({ count, aspect }: { count: number; aspect: string }) {
  return (
    <div className="mr-auto grid w-full max-w-[88%] grid-cols-3 gap-2">
      {galleryShots.slice(0, count).map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className={`${aspect} rounded-lg object-cover ring-1 ring-black/[0.06]`} />
      ))}
    </div>
  );
}

function ChatShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 ${tileShadow}`}>
      <div className="flex items-center gap-2 border-b border-neutral-200/70 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wiggly-app-icon-v1-512.png" alt="" className="size-5 rounded-sm" />
        <span className="font-heading text-sm font-semibold tracking-tight">Wiggly</span>
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </div>
  );
}

function Swatch() {
  const colors = ["#1C1C1C", "#EFE7D8", "#E4572E", "#2A9D8F"];
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {colors.map((color) => (
        <span key={color} className="size-4 rounded ring-1 ring-black/10" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

export function McpSetupPage({ agent }: { agent: McpSetupAgent | null }) {
  const steps = stepsFor(agent);
  const heroItalic = agent ? `${agent.name}.` : "callable from anywhere.";
  const heroLead = agent ? "Set up Wiggly MCP in" : "On-brand ad generation,";

  return (
    <div className="min-h-screen bg-[#f7f5ee] text-[#12110f]">
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between rounded-full bg-white px-3 py-1.5 shadow-[0_8px_30px_rgba(17,17,17,0.06)] ring-1 ring-black/[0.06]">
          <Link href="/discover" aria-label="Wiggly home" className="flex items-center gap-2 pl-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wiggly-app-icon-v1-512.png" alt="" className="size-7 rounded-lg" />
            <span className="font-heading text-sm font-bold tracking-tight">Wiggly</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-neutral-600 md:flex">
            <Link href="/mcp-setup">MCP</Link>
            <Link href="/discover">Skills</Link>
            <Link href="/submit">Publish</Link>
            <a href="#faq">Blog</a>
            <a href="#faq">Pricing</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <a href="#setup" className="hidden h-8 items-center rounded-full px-3 text-sm font-medium sm:inline-flex">
              Log in
            </a>
            <a href="#setup" className="inline-flex h-8 items-center rounded-full bg-[#12110f] px-4 text-sm font-medium text-white">
              Start creating
            </a>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[100svh] overflow-hidden bg-gradient-to-b from-[#efeeeb] via-[#f4f3f1] to-[#f7f5ee] pt-24">
        <div className="mx-auto grid w-full max-w-[1320px] items-center gap-10 px-[clamp(20px,4vw,56px)] pb-16 lg:min-h-[640px] lg:grid-cols-2 lg:pb-8">
          <div className="max-w-[584px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Wiggly MCP</p>
            <h1 className="font-heading mt-4 text-[clamp(2.7rem,4.2vw,3.9rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
              {heroLead} <span className="font-editorial text-[1.06em] font-normal italic tracking-[-0.01em]">{heroItalic}</span>
            </h1>
            <p className="mt-5 max-w-[448px] text-[18px] leading-relaxed text-neutral-600">
              {agent
                ? `Connect ${agent.name} to Wiggly's on-brand creative engine. Use the ready-to-copy setup below to generate image ads, video ads, edits, and campaign assets from your agent.`
                : "Connect Wiggly to Claude, ChatGPT, Cursor, and any MCP client. Generate on-brand image and video ads, edit them in chat, and launch whole campaigns - without leaving your tools."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#setup" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#12110f] px-5 text-sm font-semibold text-white">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
                </svg>
                Set up Wiggly MCP
              </a>
              <a href="#features" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium ring-1 ring-black/10">
                <span className="font-mono text-xs">&lt;/&gt;</span>
                See what it can do
              </a>
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {agent ? `Dedicated setup for ${agent.name} · OAuth sign-in · No API keys` : "Works with Claude · ChatGPT · Cursor · VS Code · Codex"}
            </p>
          </div>
          <div className="relative mx-auto h-[460px] w-full max-w-[560px]">
            <div className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/[0.06] opacity-70 blur-2xl" />
            <FloatMark src="/agent-marks/claude.svg" className="left-[42%] top-[0%] -rotate-6" />
            <FloatMark src="/agent-marks/vscode.svg" className="left-[8%] top-[34%] -rotate-6" />
            <FloatMark src="/agent-marks/chatgpt.svg" className="right-[2%] top-[28%] rotate-6" />
            <FloatMark src="/agent-marks/claude-code.svg" className="left-[6%] bottom-[8%] rotate-3" />
            <FloatMark src="/agent-marks/cursor.svg" className="right-[4%] bottom-[6%] -rotate-3" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wiggly-app-icon-v1-512.png" alt="Wiggly" className={`absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-3xl md:size-28 ${tileShadow}`} />
          </div>
        </div>
      </section>

      <section id="setup" className="scroll-mt-[92px] bg-[#f0ede4] py-[clamp(64px,8vw,120px)]">
        <div className="mx-auto w-full max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Setup</span>
            <h2 className="font-heading mx-auto mt-4 max-w-2xl text-[clamp(2.1rem,3.1vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              {agent ? (
                <>
                  Connect <span className="font-editorial text-[1.06em] font-normal italic tracking-[-0.01em]">{agent.name}.</span>
                </>
              ) : (
                <>
                  Connect in <span className="font-editorial text-[1.06em] font-normal italic tracking-[-0.01em]">a few steps.</span>
                </>
              )}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600">
              {agent
                ? `Copy the exact Wiggly MCP setup for ${agent.name}. The live connector details stay in one place.`
                : "Pick your tool and copy the connector. Wiggly signs you in with a single click - no API keys."}
            </p>
          </div>
          <div className="mt-12 flex justify-center">
            <div role="group" aria-label="Choose your client" className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-black/10 bg-white/70 p-1.5 sm:flex-wrap sm:justify-center">
              {mcpSetupAgents.map((item) => {
                const current = item.slug === agent?.slug;
                return (
                  <Link
                    key={item.slug}
                    href={`/mcp-setup/${item.slug}`}
                    aria-current={current ? "page" : undefined}
                    aria-label={`Set up the Wiggly MCP in ${item.name}`}
                    className="relative flex shrink-0 items-center rounded-xl p-2"
                  >
                    {current ? <span className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-black/10" /> : null}
                    <span className="relative z-10 flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt="" className="size-6 shrink-0 rounded-md object-contain" />
                      {current ? <span className="block pr-1 pl-2 text-sm font-medium whitespace-nowrap">{item.name}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <ol className={`mt-10 grid list-none grid-cols-1 gap-8 md:mt-12 md:gap-6 ${steps.length > 3 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
            {steps.map((step) => (
              <li key={step.n} className="flex flex-col">
                <StepVisualView visual={step.visual} />
                <span className="mt-5 text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase tabular-nums">{step.n}</span>
                <h3 className="font-editorial mt-2 text-[1.4rem] leading-tight italic md:text-[1.55rem]">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-[92px] bg-[#f7f5ee] py-[clamp(64px,8vw,120px)]">
        <div className="mx-auto w-full max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Features</span>
            <h2 className="font-heading mx-auto mt-4 text-[clamp(2.1rem,3.1vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              The power of Wiggly,
              <br />
              <span className="font-editorial text-[1.06em] font-normal italic">in your agent.</span>
            </h2>
          </div>
          <div className="mt-16 grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h3 className="font-heading text-[clamp(1.6rem,2.6vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
                Every ad, <span className="font-editorial text-[1.06em] font-normal italic">on-brand by default.</span>
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Tie any generation to a brand and Wiggly pulls your colors, fonts, and tone straight from your brand kit. Even a one-line prompt comes back looking unmistakably like you.
              </p>
            </div>
            <ChatShell>
              <Bubble side="agent">
                Coffeeverse&apos;s brand kit is loaded - colors, fonts, and tone are set.
                <Swatch />
              </Bubble>
              <Bubble side="user">Generate 3 hero images for the Funk Series launch.</Bubble>
              <Bubble side="agent">Generating 3 on-brand variants for the launch.</Bubble>
              <ShotGrid count={3} aspect="aspect-[3/4]" />
              <ToolLine name="wiggly_generate_image" />
            </ChatShell>
          </div>
          <div className="mt-20 grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <ChatShell>
              <Bubble side="agent">Here&apos;s the first pass.</Bubble>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={galleryShots[3]} alt="" className="mr-auto aspect-[4/3] w-full max-w-[88%] rounded-2xl object-cover ring-1 ring-black/[0.06]" />
              <Bubble side="user">Make it more editorial - cleaner type, more whitespace, keep our palette.</Bubble>
              <Bubble side="agent">Editing - refining the layout and type.</Bubble>
              <ToolLine name="wiggly_generate_image" />
            </ChatShell>
            <div>
              <h3 className="font-heading text-[clamp(1.6rem,2.6vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
                Edit images and <span className="font-editorial text-[1.06em] font-normal italic">perfect every detail.</span>
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Generate, then revise. Brighten the background, swap the scene, tweak the composition - every edit happens right in the chat and stays on-brand.
              </p>
            </div>
          </div>
          <div className="mt-20 grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h3 className="font-heading text-[clamp(1.6rem,2.6vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
                Generate <span className="font-editorial text-[1.06em] font-normal italic">video ads,</span> not just images.
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Go beyond stills. Turn a product shot into a short, scroll-stopping video ad with Seedance 2.0 - image-to-video, fast or pro, in your brand style.
              </p>
            </div>
            <ChatShell>
              <Bubble side="user">Turn our hero shot into a 10-second UGC video ad.</Bubble>
              <Bubble side="agent">Rendering a 10s UGC video ad in your brand style.</Bubble>
              <div className="relative mr-auto aspect-video w-full max-w-[88%] overflow-hidden rounded-2xl bg-[#1C1C1C]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={galleryShots[5]} alt="" className="size-full object-cover" />
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold tracking-wide">UGC · 10S</span>
              </div>
              <ToolLine name="wiggly_generate_video" />
            </ChatShell>
          </div>
          <div className="mt-20 grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <ChatShell>
              <Bubble side="agent">Brand and references are set for PlotBook.</Bubble>
              <Bubble side="user">Generate our launch kit: 9 hero shots, lifestyle, and promos.</Bubble>
              <Bubble side="agent">Firing 9 generations in parallel for your launch kit.</Bubble>
              <ShotGrid count={9} aspect="aspect-square" />
              <ToolLine name="wiggly_generate_image" />
            </ChatShell>
            <div>
              <h3 className="font-heading text-[clamp(1.6rem,2.6vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
                Run a whole campaign <span className="font-editorial text-[1.06em] font-normal italic">in one message.</span>
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">
                Fire dozens of generations from a single prompt. Wiggly runs them in parallel and streams the gallery inline as each one finishes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-[92px] bg-[#f0ede4] py-[clamp(64px,8vw,120px)]">
        <div className="mx-auto w-full max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">The toolbox</span>
            <h2 className="font-heading mt-4 text-[clamp(2.1rem,3.1vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              Everything your agent can <span className="font-editorial text-[1.06em] font-normal italic">call.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600">
              Twelve tools cover the whole loop - from reading your brand to generating, editing, and shipping image and video ads.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map(([toolName, blurb]) => (
              <div key={toolName} className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_3px_rgba(17,17,17,0.05)]">
                <code className="font-mono text-xs font-bold">{toolName}</code>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-[92px] bg-[#f7f5ee] py-[clamp(64px,8vw,120px)]">
        <div className="mx-auto w-full max-w-[760px] px-[clamp(20px,4vw,56px)]">
          <div className="text-center">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">FAQ</span>
            <h2 className="font-heading mt-4 text-[clamp(2.1rem,3.1vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">Questions, answered.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600">Everything you need to know before you connect Wiggly to your tools.</p>
          </div>
          <div className="mt-10 flex flex-col divide-y divide-black/[0.07]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-semibold sm:text-lg [&::-webkit-details-marker]:hidden">
                  {question}
                  <svg viewBox="0 0 256 256" className="size-5 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-45" fill="currentColor" aria-hidden="true">
                    <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
                  </svg>
                </summary>
                <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-neutral-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f5ee] px-[clamp(20px,4vw,56px)] py-[clamp(48px,6vw,88px)]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Get started</span>
          <h2 className="font-heading mt-4 text-[clamp(2.1rem,3.1vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            Plug Wiggly into <span className="font-editorial text-[1.06em] font-normal italic">your stack.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600">
            Set up the MCP connection in under a minute and start generating on-brand ads from the tools you already use.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#setup" className="inline-flex h-12 items-center rounded-full bg-[#12110f] px-5 text-sm font-semibold text-white">
              Set up Wiggly MCP
            </a>
            <a href="#setup" className="inline-flex h-12 items-center rounded-full bg-white px-5 text-sm font-medium ring-1 ring-black/10">
              Get started free
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-[#f7f5ee] px-[clamp(20px,4vw,56px)] py-14">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wiggly-app-icon-v1-512.png" alt="" className="size-8 rounded-lg" />
            <span className="font-heading text-lg font-bold">Wiggly</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-600">Any creative you imagine, produced with your AI agent.</p>
          <a href="mailto:support@wiggly.agentenamel.com" className="mt-3 inline-block text-sm text-neutral-700">
            support@wiggly.agentenamel.com
          </a>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="text-[11px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((label) => (
                    <li key={label}>
                      <Link href={label === "MCP setup" ? "/mcp-setup" : label === "Agent skills" ? "/discover" : "#faq"} className="text-sm text-neutral-700">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <p className="mt-12 text-sm text-neutral-500">© 2026 Wiggly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FloatMark({ src, className }: { src: string; className: string }) {
  return (
    <div className={`absolute flex size-16 items-center justify-center rounded-2xl bg-white ring-1 ring-black/[0.06] md:size-20 ${tileShadow} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-9 object-contain md:size-11" />
    </div>
  );
}
