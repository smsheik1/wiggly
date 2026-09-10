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

  if (format.githubRepo) {
    return `CODING AGENT REQUIRED: If you cannot access this computer's terminal, filesystem, and media files, do not analyze or simulate. Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI."

Let's create this with the latest published Wiggly Format: ${format.name}.

Format page: ${formatUrl}
GitHub Repo: ${format.githubRepo}

Clone the format into a new workspace:
git clone --depth 1 ${format.githubRepo}.git
(Fallback if git throttles: curl -sL ${format.githubRepo}/archive/main.tar.gz | tar -xz)

Enter the repository directory, follow the root agent instructions, SKILL.md, and contracts. Use the packaged runtime; do not rebuild it. Never use a paid provider without my explicit approval. Continue until the Format's validation and quality checks pass, then return its defined deliverables.`;
  }

  const repositoryLine = format.repositoryHref
    ? `Runnable Repo: ${absoluteUrl(origin, format.repositoryHref)}\n`
    : "";
  const sourceOfTruth = format.repositoryHref
    ? "Download and extract into a new workspace. Follow the root agent instructions, SKILL.md, and contracts. Report the exact published Format version from KIT-MANIFEST.json or format.json before intake."
    : "Open the Format page and follow its published files and technical instructions as the source of truth. Report the exact published Format version before beginning its intake flow.";

  return `CODING AGENT REQUIRED: If you cannot access this computer's terminal, filesystem, and media files, do not analyze or simulate. Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI."

Let's create this with the latest published Wiggly Format: ${format.name}.

Format page: ${formatUrl}
${repositoryLine}
${sourceOfTruth}

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
