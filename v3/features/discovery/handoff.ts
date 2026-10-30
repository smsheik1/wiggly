import type { DiscoveryFormatProfile } from "./types";

export type DiscoveryCliAgent =
  | "antigravity-cli"
  | "claude-code"
  | "cursor"
  | "github-copilot";

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

export function buildDiscoveryHandoffPrompt(
  format: DiscoveryFormatProfile,
  origin: string,
): string {
  if (!format.handoff) {
    throw new Error(`Agent handoff is not available for ${format.name}.`);
  }

  const formatUrl = absoluteUrl(origin, `/formats/${format.slug}`);

  if (format.handoff.handoffMode === "director") {
    const firstQuestion =
      format.handoff.firstQuestion ||
      "Who is this story for, and what is the one moment or lesson you want them to always remember?";
    return `CODING AGENT REQUIRED: If you cannot access this computer's terminal, filesystem, and media files, do not analyze or simulate. Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI."

Let's create a 3D animated family memoir with Wiggly Format: ${format.name}.

Format Page: ${formatUrl}
MCP Server: ${absoluteUrl(origin, "/mcp")} (HTTP / WorkOS OAuth)
Skill: npx skills add wiggly-app/skills -s ${format.slug}

Role: Creative Director. Work directly in this workspace. Do not clone developer repos, download zip archives, or run build/test suites.

Photos: If the user has family reference photos, they can drop them into chat or put them in \`./photos\`. Photos are optional reference for character styling.

TURN 1 INSTRUCTION:
1. Run \`npx skills add wiggly-app/skills -s ${format.slug}\` to install the creative director skill.
2. In the same response, greet me warmly and ask:
"${firstQuestion}"

Note: Wiggly MCP (\`claude mcp add --transport http wiggly ${absoluteUrl(origin, "/mcp")}\` or add via native MCP settings) handles 4K character sheet generation and Seedance video rendering after the screenplay is approved.`;
  }

  const mcpLine = format.slug === "my-pixar-story"
    ? `MCP Server: ${absoluteUrl(origin, "/mcp")}\nInstall Skill: npx skills add wiggly-app/skills -s my-pixar-story\n`
    : "";
  const githubRepoLine = format.githubRepo ? `GitHub Repo: ${format.githubRepo}\n` : "";
  const repositoryLine = format.repositoryHref
    ? `Runnable Repo: ${absoluteUrl(origin, format.repositoryHref)}\n`
    : "";
  const sourceOfTruth = format.repositoryHref
    ? "Download and extract into a new workspace. Follow SKILL.md and root agent instructions. Report published Format version from KIT-MANIFEST.json or format.json."
    : "Open the Format page and follow SKILL.md as the sole source of truth. Report published Format version from KIT-MANIFEST.json or format.json.";

  return `CODING AGENT REQUIRED: If you cannot access this computer's terminal, filesystem, and media files, do not analyze or simulate. Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI."

Let's create this with the latest published Wiggly Format: ${format.name}.

Format page: ${formatUrl}
${mcpLine}${githubRepoLine}${repositoryLine}${sourceOfTruth}

Use the packaged runtime; do not rebuild it. Never use a paid provider without my explicit approval. Continue until the Format's validation and quality checks pass, then return its defined deliverables.`;
}

function quoteForPosixShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildCodexHandoffUrl(prompt: string): string {
  return `codex://new?prompt=${encodeURIComponent(prompt)}`;
}

export function buildAntigravityAppUrl(): string {
  return "antigravity://";
}

export function buildDiscoveryCliCommand(agent: DiscoveryCliAgent, prompt: string): string {
  const quotedPrompt = quoteForPosixShell(prompt);

  switch (agent) {
    case "antigravity-cli":
      return `agy -p ${quotedPrompt}`;
    case "claude-code":
      return `claude ${quotedPrompt}`;
    case "cursor":
      return `cursor-agent ${quotedPrompt}`;
    case "github-copilot":
      return `copilot -p ${quotedPrompt}`;
  }
}
