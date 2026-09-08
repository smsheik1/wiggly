import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FormatRepoTrustData } from "./formatRepoTrust.types";

type PackageManifest = {
  scripts: Record<string, string>;
};

type FormatManifest = {
  version: string;
  renderer: string;
};

type RequirementsContract = {
  localTools: string[];
  optionalAssetRebuildTools: string[];
  providers: unknown[];
  environmentVariables: string[];
};

type AssetsManifest = {
  backgrounds: Array<{ id: string; path: string; role: string }>;
  characters: Array<{
    id: string;
    poses: Array<{ id: string; path: string }>;
  }>;
};

type QualityContract = {
  rubricVersion: string;
  automatic: { width: number; height: number; fps: number };
  technicalGates: Array<{ id: string }>;
  requiredTechnicalGates: string[];
  blindReview: { criteria: string[] };
};

type SampleInput = {
  timeline: Array<{
    start: number;
    end: number;
    speaker: string;
    camera: string;
  }>;
};

export type AnimalConversationsTrustData = FormatRepoTrustData & {
  stats: {
    backgrounds: number;
    cameras: number;
    characters: number;
  };
  includedAssets: {
    characters: Array<{
      id: string;
      label: string;
      poseCount: number;
      posterSrc: string;
    }>;
    backgrounds: Array<{
      id: string;
      label: string;
      description: string;
      src: string;
    }>;
    defaultBackgroundId: string;
  };
  requirements: RequirementsContract;
};

const repoRoot = path.join(
  process.cwd(),
  "public/format-repositories/animal-conversations-v1",
);
const publicRoot = "/format-repositories/animal-conversations-v1";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function timestamp(seconds: number) {
  const rounded = Math.round(seconds);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

export async function getAnimalConversationsTrustData(): Promise<AnimalConversationsTrustData> {
  const [format, quality, assets, packageManifest, requirements, sampleInput] =
    await Promise.all([
      readJson<FormatManifest>(path.join(repoRoot, "format.json")),
      readJson<QualityContract>(path.join(repoRoot, "quality.json")),
      readJson<AssetsManifest>(path.join(repoRoot, "assets.json")),
      readJson<PackageManifest>(path.join(repoRoot, "package.json")),
      readJson<RequirementsContract>(path.join(repoRoot, "requirements.json")),
      readJson<SampleInput>(path.join(repoRoot, "fixtures/sample/input.json")),
    ]);

  const durationSeconds = sampleInput.timeline.at(-1)?.end ?? 0;
  const commands = [
    "test",
    "check",
    "smoke",
    "validate",
    "render",
    "inspect",
    "finalize",
  ]
    .filter((script) => packageManifest.scripts[script])
    .map((script) =>
      ["validate", "render", "inspect", "finalize"].includes(script)
        ? `npm run ${script} -- --run=episode-01`
        : `npm run ${script}`,
    );

  const files = await Promise.all(
    [
      { label: "Agent instructions", path: "SKILL.md" },
      { label: "Human setup", path: "README.md" },
      { label: "Required inputs", path: "input-contract.json" },
      { label: "Final deliverables", path: "output-contract.json" },
      { label: "Services and tools", path: "requirements.json" },
      { label: "Composition rules", path: "composition-contract.json" },
      { label: "Fixed vs customizable", path: "content-boundary.json" },
      { label: "Asset manifest", path: "assets.json" },
      { label: "Quality rubric", path: "quality.json" },
      {
        label: "Overlap regression",
        path: "fixtures/regression/overlapping-reassurance/input.json",
      },
      { label: "Published proof", path: "PROOF-REPORT.md" },
      { label: "Contract tests", path: "runtime/tests/runtime.test.mjs" },
      { label: "Main runner", path: "runner.mjs" },
      { label: "Video renderer", path: "runtime/render.mjs" },
      { label: "Output inspection", path: "runtime/inspect.mjs" },
      { label: "Speaker review", path: "runtime/speaker-review.mjs" },
      { label: "Audio intake", path: "runtime/intake.mjs" },
      { label: "Guided workflow", path: "runtime/workflow.mjs" },
      { label: "Verified export", path: "runtime/export.mjs" },
      { label: "Social distribution", path: "runtime/publish.mjs" },
    ].map(async (file) => ({
      ...file,
      content: await readFile(path.join(repoRoot, file.path), "utf8"),
    })),
  );

  return {
    idPrefix: "animal-conversations",
    version: format.version,
    assembly: {
      title: "The assembly line",
      path: "Clip → Dialogue draft → Your approval → Render → Review & export",
      ariaLabel:
        "Five steps from a source clip to a reviewed, verified video",
      commandsLabel: "What the coding agent runs",
      commandsAriaLabel: "Exact Animal Conversations runtime commands",
      steps: [
        {
          title: "Send a clip",
          cost: "Free",
          description:
            "Send a supported link or local file. The agent extracts the full soundtrack locally; blocked links need a local file instead.",
        },
        {
          title: "Agent drafts",
          cost: "Free",
          description:
            "The agent writes the dialogue, works out the timing, and proposes who says each line. Uncertain words and reactions stay visible.",
        },
        {
          title: "You approve",
          cost: "Free",
          description:
            "Check the words, Dog/Bunny assignments, and background. Tell the agent what to change, then approve the complete plan.",
          waiting: "Waits for your approval",
        },
        {
          title: "Render",
          cost: "Free",
          description:
            "Builds one 1080 × 1920 conversation with the supplied audio.",
        },
        {
          title: "Review & export",
          cost: "Free",
          description:
            "Required technical and playback checks must pass before the agent exports the video, review summary, and checksums.",
          waiting: "Waits for your review",
        },
      ],
      commands: [
        "node runner.mjs doctor",
        "npm ci",
        "npm test",
        "node runner.mjs smoke --run=<fresh-smoke-id>",
        "node runner.mjs setup-intake  # one-time, with your permission",
        "node runner.mjs intake --run=<id> --source=<link-or-local-file>",
        "node runner.mjs status --run=<id> --json",
        "# The agent follows SKILL.md for drafting, your approval, and playback review.",
        "node runner.mjs run --run=<id>",
      ],
    },
    proof: {
      durationTimeLabel: timestamp(durationSeconds),
    },
    proofCopy: {
      eyebrow: "02 · Finished example · v0.15.1",
      title: "Watch the final conversation.",
    },
    annotations: [
      {
        seconds: 0,
        timeLabel: "00:00",
        title: "The two-shot starts separated and inward-facing.",
        description:
          "Both complete colored characters share the frame without touching or facing away.",
        color: "cyan",
      },
      {
        seconds: 6.85,
        timeLabel: "00:07",
        title: "The bunny close-up faces into the scene.",
        description:
          "The bunny-only camera uses the reference-matched right-facing orientation.",
        color: "pink",
      },
      {
        seconds: 10.15,
        timeLabel: "00:10",
        title: "Captions advance in short cards.",
        description:
          "Complete lines become readable one-to-three-word phrases below the characters' faces.",
        color: "lime",
      },
      {
        seconds: 27.9,
        timeLabel: "00:28",
        title: "Silence keeps the reaction neutral.",
        description:
          "The cat holds the close-up with a closed mouth; uncued dialogue does not make either body hop.",
        color: "yellow",
      },
    ],
    quality: {
      eyebrow: "03 · Final evaluation",
      title: "How your finished video is checked.",
      summary: [
        {
          value: `${quality.requiredTechnicalGates.length}`,
          label: "Required technical checks",
        },
        { value: "0", label: "Provider calls at runtime" },
        { value: "3", label: "Approved camera angles" },
      ],
      noteTitle: "Evidence stays explicit.",
      note: "The agent proposes the words and characters; you approve them. Transcription never approves casting, and this Repo never claims automatic diarization. The examples are earlier-version proof, not a new v0.17.0 review.",
      criteriaTitle: `The playback review checks ${quality.blindReview.criteria.length} things`,
      criteriaSubtitle:
        "Character, speaker, caption, camera, motion, and audio evidence",
      criteria: quality.blindReview.criteria.map((label, index) => ({
        id: `criterion-${index + 1}`,
        label,
      })),
      rule: "Required technical and visual playback checks must pass before export. Unavailable sound judgments may be left unscored only where the policy permits, with a reason. Missing required checks still block completion.",
    },
    receipt: {
      rows: [
        { label: "Renderer", value: format.renderer },
        { label: "Examples", value: "Published v0.15.1 proof" },
        { label: "Download", value: `v${format.version}` },
        {
          label: "Technical",
          value: `${quality.requiredTechnicalGates.length} required checks before export`,
        },
        { label: "Speakers", value: "Explicit confirmation per beat" },
        {
          label: "Output",
          value: `${quality.automatic.width} × ${quality.automatic.height} · ${durationSeconds.toFixed(3)}s MP4`,
        },
      ],
      note: "The example MP4s retain their approved soundtracks. Raw audio and review clips from new runs remain user-supplied, local, and excluded from the download. Version 0.17.0 passed automated and platform checks; full fresh-agent acceptance of this exact release remains incomplete.",
    },
    commands,
    files,
    stats: {
      backgrounds: assets.backgrounds.length,
      cameras: 3,
      characters: assets.characters.length,
    },
    includedAssets: {
      characters: assets.characters.map((character) => {
        const idlePose = character.poses.find((pose) => pose.id === "idle");
        if (!idlePose)
          throw new Error(`Missing idle pose for ${character.id}.`);
        return {
          id: character.id,
          label: titleCase(character.id),
          poseCount: character.poses.length,
          posterSrc: `${publicRoot}/${idlePose.path}`,
        };
      }),
      backgrounds: assets.backgrounds.map((background) => ({
        id: background.id,
        label: titleCase(background.id),
        description: background.role,
        src: `${publicRoot}/${background.path}`,
      })),
      defaultBackgroundId: assets.backgrounds[0]?.id ?? "living-room",
    },
    requirements,
  };
}
