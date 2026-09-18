import { readFileSync } from "node:fs";
import path from "node:path";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const packagePath = path.join(process.cwd(), "public", "format-repositories", "brand-jingle-v1");
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
  paid: boolean;
  approvalRequired: boolean;
};

type GoldenExample = {
  id: string;
  brand: string;
  title: string;
  audioPath: string;
  whyItWorks: string[];
};

const files = [
  ["SKILL.md", "Agent instructions"],
  ["requirements.json", "BYOK requirements"],
  ["inputs.json", "User inputs and defaults"],
  ["pipeline.json", "Five-step assembly line"],
  ["song-contract.json", "Research and song contract"],
  ["prompts/research.md", "Research rules"],
  ["prompts/angle.md", "Angle selection"],
  ["prompts/jingle.md", "Jingle writing"],
  ["quality.json", "Acceptance checks"],
] as const;

export default function BrandJingleFormatPage() {
  const format = readJson<FormatManifest>("format.json");
  const pipeline = readJson<{ progress: string; stages: PipelineStage[] }>("pipeline.json");
  const goldens = readJson<{ purpose: string; examples: GoldenExample[] }>("goldens.json");

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

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7">
        <section className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold">{format.title}</h2>
              <p className="mt-2 text-slate-600">{format.description}</p>
              <p className="mt-4 text-sm font-semibold text-violet-700">Website or one sentence in. MP3 and cover art out.</p>
            </div>
            <Button asChild data-testid="download-brand-jingle-kit">
              <a href="https://github.com/smsheik1/wiggly-brand-jingle/releases/download/v1.0.0/wiggly-brand-jingle-format-kit.zip" download>
                Download runnable kit
              </a>
            </Button>
          </div>
        </section>

        <section data-testid="brand-jingle-goldens">
          <h2 className="text-xl font-bold">Hear what good sounds like</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{goldens.purpose}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {goldens.examples.map((example) => (
              <article key={example.id} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{example.brand}</p>
                    <h3 className="mt-1 font-bold">{example.title}</h3>
                  </div>
                  <Badge variant="outline">20 sec</Badge>
                </div>
                <audio
                  className="mt-4 w-full"
                  controls
                  data-testid={`golden-audio-${example.id}`}
                  preload="metadata"
                  src={`/format-repositories/brand-jingle-v1/${example.audioPath}`}
                />
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {example.whyItWorks.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section data-testid="brand-jingle-pipeline">
          <h2 className="text-xl font-bold">The assembly line</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{pipeline.progress}</p>
          <ol className="mt-4 grid gap-3 md:grid-cols-5">
            {pipeline.stages.map((stage, index) => (
              <li key={stage.id} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{index + 1}. {stage.id}</span>
                  <Badge variant={stage.paid ? "secondary" : "outline"}>{stage.paid ? "paid" : "free"}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{stage.output}</p>
                {stage.approvalRequired ? <p className="mt-2 text-xs font-bold text-violet-700">Waits for you</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Fast by default</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>20 seconds and the proven music lane are picked automatically.</li>
              <li>The agent researches, chooses one angle, and writes one song.</li>
              <li>You see the lyrics, cover, and cost before music generation.</li>
              <li>One approval buys one song attempt. Nothing retries itself.</li>
              <li>30 seconds, 60 seconds, and custom lengths stay optional.</li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What the agent runs</h2>
            <div className="mt-4 rounded-md bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              npm run format:jingle -- init --run=&lt;id&gt; --url=&lt;url&gt;<br />
              npm run format:jingle -- validate --run=&lt;id&gt;<br />
              npm run format:jingle -- estimate --run=&lt;id&gt;<br />
              npm run format:jingle -- generate --run=&lt;id&gt; --approve-music<br />
              npm run format:jingle -- inspect --run=&lt;id&gt;
            </div>
          </article>
        </section>

        <section>
          <h2 className="text-xl font-bold">Repo files</h2>
          <p className="mt-1 text-sm text-slate-600">The package carries its judgment, examples, constraints, and tests with it.</p>
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
