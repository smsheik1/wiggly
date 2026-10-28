export const mcpSetupAgents = [
  { name: "Claude Code", slug: "claude-code", src: "/agent-marks/claude-code.svg" },
  { name: "Claude", slug: "claude", src: "/agent-marks/claude.svg" },
  { name: "Cursor", slug: "cursor", src: "/agent-marks/cursor.svg" },
  { name: "Codex", slug: "codex", src: "/agent-marks/codex.svg" },
  { name: "VS Code", slug: "vscode", src: "/agent-marks/vscode.svg" },
  { name: "Windsurf", slug: "windsurf", src: "/agent-marks/windsurf.svg" },
  { name: "ChatGPT", slug: "chatgpt", src: "/agent-marks/chatgpt.svg" },
  { name: "Antigravity", slug: "antigravity", src: "/agent-marks/antigravity.svg" },
  { name: "Grokbot", slug: "grokbot", src: "/agent-marks/grok.svg" },
  { name: "Meta Muse", slug: "meta-muse", src: "/agent-marks/meta.svg" },
] as const;

export type McpSetupAgent = (typeof mcpSetupAgents)[number];

export function getMcpSetupAgent(slug: string) {
  return mcpSetupAgents.find((agent) => agent.slug === slug);
}
