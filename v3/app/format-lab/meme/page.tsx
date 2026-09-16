import { readFileSync } from "node:fs";
import path from "node:path";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const packagePath = path.join(process.cwd(), "public", "format-repositories", "meme-v1");
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
  qaAttestationRequired?: boolean;
};

type GoldenExample = {
  id: string;
  brand: string;
  title: string;
  imagePath: string;
  whyItWorks: string[];
};

const files = [
  ["SKILL.md", "Agent instructions"],
  ["requirements.json", "No-key requirements"],
  ["inputs.json", "Inputs and defaults"],
  ["pipeline.json", "Four-step assembly line"],
  ["prompts/research.md", "Evidence research rules"],
  ["prompts/meme.md", "Caption rules"],
  ["quality.json", "Acceptance checks"],
] as const;

export default function MemeFormatPage() {
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
              <p className="mt-4 text-sm font-semibold text-violet-700">
                One website in. Twelve 1080 x 1350 PNGs out.
              </p>
            </div>
            <Button asChild data-testid="download-meme-kit">
              <a href="https://github.com/smsheik1/wiggly-meme/releases/download/v1.0.0/wiggly-meme-format-kit.zip" download>
                Download runnable kit
              </a>
            </Button>
          </div>
        </section>

        <section data-testid="meme-golden">
          <h2 className="text-xl font-bold">See the finished format</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{goldens.purpose}</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
            {goldens.examples.map((example) => (
              <article key={example.id} className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                <img
                  className="aspect-[4/5] w-full bg-white object-contain"
                  src={`/format-repositories/meme-v1/${example.imagePath}`}
                  alt={`${example.brand}: ${example.title}`}
                />
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{example.brand}</p>
                  <h3 className="mt-1 font-bold">{example.title}</h3>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {example.whyItWorks.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              </article>
            ))}
            <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
              <h2 className="font-bold">Fast by default</h2>
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                <li>The agent asks for one website and handles the rest.</li>
                <li>Four fixed templates prevent random visual drift.</li>
                <li>Three angles per template create twelve useful options.</li>
                <li>Website evidence keeps the jokes specific.</li>
                <li>Every PNG is rendered locally through Wiggly&apos;s shared renderer.</li>
                <li>The full pack costs $0 in Wiggly provider calls.</li>
              </ul>
            </article>
          </div>
        </section>

        <section data-testid="meme-pipeline">
          <h2 className="text-xl font-bold">The assembly line</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{pipeline.progress}</p>
          <ol className="mt-4 grid gap-3 md:grid-cols-4">
            {pipeline.stages.map((stage, index) => (
              <li key={stage.id} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{index + 1}. {stage.id}</span>
                  <Badge variant="outline">{stage.paid ? "paid" : "free"}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-700">{stage.output}</p>
                {stage.qaAttestationRequired ? (
                  <p className="mt-2 text-xs font-bold text-violet-700">Agent inspects every PNG</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What the agent runs</h2>
            <div className="mt-4 overflow-auto rounded-md bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              npm run format:meme -- init --run=&lt;id&gt; --url=&lt;url&gt;<br />
              npm run format:meme -- prompt --run=&lt;id&gt;<br />
              npm run format:meme -- validate --run=&lt;id&gt;<br />
              npm run format:meme -- render --run=&lt;id&gt;<br />
              npm run format:meme -- inspect --run=&lt;id&gt;
            </div>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What stops a bad run</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>Page instructions cannot control the agent.</li>
              <li>Unsupported proof cannot enter a caption.</li>
              <li>Duplicate angles fail validation.</li>
              <li>Missing or overlong template text fails validation.</li>
              <li>Every output is inspected before final delivery.</li>
            </ul>
          </article>
        </section>

        <section>
          <h2 className="text-xl font-bold">Repo files</h2>
          <p className="mt-1 text-sm text-slate-600">The package carries its recipe, templates, tests, and renderer.</p>
          <div className="mt-4 space-y-3">
            {files.map(([file, label]) => (
              <details key={file} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer font-semibold">
                  {label} <code className="ml-2 text-xs font-normal text-slate-500">{file}</code>
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {readText(file)}
                </pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
