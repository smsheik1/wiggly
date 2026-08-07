import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { OtakuFormatRepositoryClient } from "./OtakuFormatRepositoryClient";

const packagePath = path.join(process.cwd(), "public", "format-repositories", "otaku-explainer-v1");
const readText = (relativePath: string) => readFileSync(path.join(packagePath, relativePath), "utf8");
const readJson = <T,>(relativePath: string) => JSON.parse(readText(relativePath)) as T;

export const dynamic = "force-dynamic";

type AssetManifest = {
  characters: Array<{ id: string; label: string; localPath: string }>;
  backgrounds: Array<{ id: string; label: string; localPath: string }>;
};

type RunRecord = {
  id: string;
  title: string;
  input: { topic: string; storyWorld: string; cast: string[] };
  provider: string;
  model: string;
  voiceAssignments: Record<string, string>;
  output: string;
  scenes: unknown[];
};

type AgentRunState = {
  id: string;
  status: string;
  attempts: Array<{
    number: number;
    status: string;
    output: string;
    contactSheet: string;
    report: string;
  }>;
  finalAttempt?: number;
};

type FormatManifest = {
  id: string;
  version: string;
  title: string;
  description: string;
  status: string;
};

const coreTextFiles = [
  { id: "instructions", label: "Format instructions", path: "README.md", description: "What this Format does and how to run it." },
  { id: "agent-skill", label: "Agent skill", path: "SKILL.md", description: "The complete loop an agent follows without the user explaining the Format." },
  { id: "requirements", label: "Requirements", path: "requirements.json", description: "The key names and local tools needed, without any secret values." },
  { id: "pipeline", label: "Assembly line", path: "pipeline.json", description: "Every step, deliverable, provider call, estimate, and approval point." },
  { id: "layouts", label: "Approved layouts", path: "layouts.json", description: "Reusable two- and three-character positions. Scene writers do not invent coordinates." },
  { id: "inputs", label: "User inputs", path: "inputs.json", description: "The topic and story world the Format needs. The world pack supplies the cast." },
  { id: "assets", label: "Fixed assets", path: "assets.json", description: "Character cutouts, backgrounds, source links, and local files." },
  { id: "script-prompt", label: "Script prompt", path: "prompts/script-system.md", description: "How the lesson becomes dialogue that fits the story world." },
  { id: "image-prompt", label: "Image search rules", path: "prompts/image-search.md", description: "How to find grounded backgrounds and clean character art." },
  { id: "renderer", label: "Renderer", path: "renderer/OtakuFormatRenderer.tsx", description: "The visual rules: moving background, characters, bubble, props, and active speaker." },
  { id: "audio", label: "Audio setup", path: "audio.json", description: "Shared Fish model, speaking speed, and default music. World packs own their voices." },
  { id: "quality", label: "Quality checks", path: "quality.json", description: "The checks every rerun should pass." },
];

function readRepositoryFiles() {
  const worlds = readdirSync(path.join(packagePath, "worlds"))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const world = readJson<{ id: string; label: string }>(`worlds/${name}`);
      return {
        id: `world-${world.id}`,
        label: `${world.label} world pack`,
        path: `worlds/${name}`,
        description: "Lesson roles mapped to characters, voices, backgrounds, lore, and music.",
      };
    });
  const scenes = readdirSync(path.join(packagePath, "scenes"))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const scenePlan = readJson<{ id: string; title: string }>(`scenes/${name}`);
      return {
        id: `scene-${scenePlan.id}`,
        label: scenePlan.title,
        path: `scenes/${name}`,
        description: "A validated scene-by-scene lesson plan.",
      };
    });
  return [...coreTextFiles, ...worlds, ...scenes].map((file) => ({ ...file, value: readText(file.path) }));
}

function readOutputRuns() {
  return readdirSync(path.join(packagePath, "outputs"))
    .filter((name) => name.endsWith(".run.json"))
    .sort()
    .map((name) => readJson<RunRecord>(`outputs/${name}`));
}

function readAgentRuns() {
  const root = path.join(packagePath, "agent-runs");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "state.json")))
    .map((entry) => {
      const state = JSON.parse(readFileSync(path.join(root, entry.name, "state.json"), "utf8")) as AgentRunState;
      const latest = state.attempts.at(-1);
      const reportPath = latest ? path.join(packagePath, latest.report) : "";
      return {
        id: state.id,
        status: state.status,
        attemptCount: state.attempts.length,
        finalAttempt: state.finalAttempt,
        latest: latest ? {
          videoSrc: existsSync(path.join(packagePath, latest.output)) ? `/format-repositories/otaku-explainer-v1/${latest.output}` : undefined,
          contactSheetSrc: existsSync(path.join(packagePath, latest.contactSheet)) ? `/format-repositories/otaku-explainer-v1/${latest.contactSheet}` : undefined,
          report: existsSync(reportPath) ? readFileSync(reportPath, "utf8") : undefined,
        } : undefined,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default function OtakuExplainerFormatPage() {
  const format = readJson<FormatManifest>("format.json");
  const assets = readJson<AssetManifest>("assets.json");
  const files = readRepositoryFiles();
  const runs = readOutputRuns();
  const agentRuns = readAgentRuns();

  return (
    <OtakuFormatRepositoryClient
      assets={[...assets.characters, ...assets.backgrounds].map((asset) => ({
        ...asset,
        src: `/format-repositories/otaku-explainer-v1/${asset.localPath}`,
      }))}
      files={files}
      format={format}
      agentRuns={agentRuns}
      downloadUrl="/format-repositories/otaku-explainer-v1/downloads/wiggly-cartoon-explainer-format-kit.zip"
      referenceVideo="/format-repositories/otaku-explainer-v1/assets/reference/reference.mp4"
      runs={runs.map((run) => ({
        ...run,
        videoSrc: `/${run.output}`,
      }))}
    />
  );
}
