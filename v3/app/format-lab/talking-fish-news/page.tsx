import { readFileSync } from "node:fs";
import path from "node:path";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const packagePath = path.join(process.cwd(), "public", "format-repositories", "talking-fish-news-v1");
const readText = (relativePath: string) => readFileSync(path.join(packagePath, relativePath), "utf8");
const readJson = <T,>(relativePath: string) => JSON.parse(readText(relativePath)) as T;

type FormatManifest = {
  id: string;
  version: string;
  title: string;
  description: string;
  status: string;
};

type PipelineStage = {
  id: string;
  output: string;
  providerCall: boolean;
  approvalRequired: boolean;
};

type GoldenExample = {
  id: string;
  title: string;
  videoPath: string;
  sourceUrl: string;
  whyItWorks: string[];
};

const files = [
  ["SKILL.md", "Agent instructions"],
  ["requirements.json", "Tools and BYOK names"],
  ["inputs.json", "Inputs and defaults"],
  ["pipeline.json", "Six-step assembly line"],
  ["prompts/concepts.md", "Five-concept prompt"],
  ["prompts/script.md", "Four-beat script prompt"],
  ["quality.json", "Automatic and human gates"],
  ["assets.json", "Fixed assets and provenance"],
] as const;

export default function TalkingFishNewsFormatPage() {
  const format = readJson<FormatManifest>("format.json");
  const pipeline = readJson<{ progress: string; stages: PipelineStage[] }>("pipeline.json");
  const goldens = readJson<{ purpose: string; examples: GoldenExample[] }>("goldens.json");
  const proof = goldens.examples[0];

  return (
    <main className="min-h-screen bg-[#f6f8fa] text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-5">
          <p className="text-sm text-slate-400">Wiggly / Format Lab /</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{format.id}</h1>
            <Badge variant="secondary">{format.status}</Badge>
            <span className="text-sm text-slate-400">v{format.version}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <section className="flex flex-col justify-between gap-6 rounded-lg border border-slate-300 bg-white p-6 shadow-sm md:flex-row md:items-start">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Agent-ready Reels format</p>
            <h2 className="mt-2 text-3xl font-bold">{format.title}</h2>
            <p className="mt-3 text-lg text-slate-600">{format.description}</p>
            <p className="mt-4 text-sm font-semibold text-violet-700">One real story in. Five angles to choose from. One inspected vertical report out.</p>
          </div>
          <Button asChild data-testid="download-talking-fish-news-kit">
            <a href="https://github.com/smsheik1/wiggly-talking-fish-news/releases/download/v1.0.0/wiggly-talking-fish-news-format-kit.zip" download>
              Download runnable kit
            </a>
          </Button>
        </section>

        <section data-testid="talking-fish-news-proof">
          <h2 className="text-xl font-bold">Watch the proof</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{goldens.purpose}</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <video
              className="aspect-[9/16] w-full rounded-lg border border-slate-300 bg-black shadow-sm"
              controls
              playsInline
              preload="metadata"
              src={`/format-repositories/talking-fish-news-v1/${proof.videoPath}`}
            />
            <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-700">NASA source proof</p>
                  <h3 className="mt-1 text-2xl font-bold">{proof.title}</h3>
                </div>
                <Badge variant="outline">14-24 sec</Badge>
              </div>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
                {proof.whyItWorks.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <a className="mt-5 inline-block text-sm font-semibold text-violet-700 underline-offset-4 hover:underline" href={proof.sourceUrl} rel="noreferrer" target="_blank">
                Read the source story
              </a>
            </article>
          </div>
        </section>

        <section data-testid="talking-fish-news-pipeline">
          <h2 className="text-xl font-bold">The assembly line</h2>
          <p className="mt-1 text-sm text-slate-600">{pipeline.progress}. Only the voice step calls providers, and it waits for approval.</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pipeline.stages.map((stage, index) => (
              <li key={stage.id} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{index + 1}. {stage.id}</span>
                  <Badge variant={stage.providerCall ? "secondary" : "outline"}>{stage.providerCall ? "provider" : "local"}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{stage.output}</p>
                {stage.approvalRequired ? <p className="mt-2 text-xs font-bold text-violet-700">Waits for you</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What stays fixed</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>The 9:16 underwater studio, desk, fish sprites, evidence frame, captions, and theme.</li>
              <li>The mouth uses only open and closed sprites, driven by the approved narration.</li>
              <li>Every report uses four sourced evidence beats and ends with a deadpan payoff.</li>
              <li>No image model, video model, music model, or Replicate call is part of the workflow.</li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What the agent asks first</h2>
            <blockquote className="mt-4 rounded-md bg-slate-950 p-4 text-sm font-semibold leading-6 text-white">
              What should tonight&apos;s fish report cover? Send a topic or source link, or say pick for me.
            </blockquote>
          </article>
        </section>

        <section>
          <h2 className="text-xl font-bold">Repo files</h2>
          <p className="mt-1 text-sm text-slate-600">The package carries the creative rules, sources, runtime, tests, and proof with it.</p>
          <div className="mt-4 space-y-3">
            {files.map(([file, label]) => (
              <details key={file} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer font-semibold">{label} <code className="ml-2 text-xs font-normal text-slate-500">{file}</code></summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">{readText(file)}</pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
