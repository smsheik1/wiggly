import { readFileSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const packagePath = path.join(
  process.cwd(),
  "public",
  "format-repositories",
  "mugsy-explains-v1",
);
const readText = (relativePath: string) => readFileSync(path.join(packagePath, relativePath), "utf8");
const readJson = <T,>(relativePath: string) => JSON.parse(readText(relativePath)) as T;

type FormatManifest = {
  id: string;
  title: string;
  description: string;
  version: string;
  status: string;
};

type GoldenExample = {
  id: string;
  brand: string;
  title: string;
  videoPath: string;
  contactSheetPath: string;
  whyItWorks: string[];
};

const files = [
  ["SKILL.md", "Agent instructions"],
  ["inputs.json", "Inputs and defaults"],
  ["pipeline.json", "Assembly line"],
  ["prompts/story.md", "Story prompt"],
  ["quality.json", "Quality checks"],
  ["requirements.json", "Tools and BYOK requirements"],
] as const;

const originalReferences = [
  {
    title: "Heat vs. Collateral",
    videoPath: "references/original/mugsyclips_Da5cRx2sKhl.mp4",
    sourceUrl: "https://www.instagram.com/mugsyclips/reel/Da5cRx2sKhl/",
  },
  {
    title: "Memento vs. Shutter Island",
    videoPath: "references/original/mugsyclips_DavoEJ4RAhM.mp4",
    sourceUrl: "https://www.instagram.com/mugsyclips/reel/DavoEJ4RAhM/",
  },
  {
    title: "Detective vs. Investigator",
    videoPath: "references/original/mugsyclips_DaqkxFkxXI1.mp4",
    sourceUrl: "https://www.instagram.com/mugsyclips/reel/DaqkxFkxXI1/",
  },
] as const;

export default function MugsyExplainsFormatPage() {
  const format = readJson<FormatManifest>("format.json");
  const pipeline = readJson<{ steps: string[] }>("pipeline.json");
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Agent-ready video format</p>
            <h2 className="mt-2 text-3xl font-bold">{format.title}</h2>
            <p className="mt-3 text-lg text-slate-600">{format.description}</p>
            <p className="mt-4 text-sm font-semibold text-violet-700">Three comparisons in. One inspected 25-35 second vertical MP4 out.</p>
          </div>
          <Button asChild data-testid="download-mugsy-explains-kit">
            <a href="https://github.com/smsheik1/wiggly-mugsy-explains/releases/download/v0.1.1-proof/wiggly-mugsy-explains-format-kit.zip" download>
              Download runnable kit
            </a>
          </Button>
        </section>

        <section data-testid="mugsy-explains-proof">
          <h2 className="text-xl font-bold">Watch the proof</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{goldens.purpose}</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <video
              className="aspect-[9/16] w-full rounded-lg border border-slate-300 bg-black shadow-sm"
              controls
              playsInline
              preload="metadata"
              src={`/format-repositories/mugsy-explains-v1/${proof.videoPath}`}
            />
            <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{proof.brand}</p>
                  <h3 className="mt-1 text-2xl font-bold">{proof.title}</h3>
                </div>
                <Badge variant="outline">Proof 1 of 2</Badge>
              </div>
              <Image
                alt="Mugsy Explains proof contact sheet"
                className="mt-5 h-auto w-full rounded-md border border-slate-200"
                height={1920}
                src={`/format-repositories/mugsy-explains-v1/${proof.contactSheetPath}`}
                width={1080}
              />
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
                {proof.whyItWorks.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </article>
          </div>
        </section>

        <section data-testid="mugsy-explains-original-references">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Original format references</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Three examples from @mugsyclips that define the source format. These are references, not Wiggly-generated proofs.
              </p>
            </div>
            <Badge variant="outline">Source: @mugsyclips</Badge>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {originalReferences.map((reference) => (
              <article key={reference.videoPath} className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                <video
                  aria-label={`${reference.title} original format reference`}
                  className="aspect-[9/16] w-full bg-black object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  src={`/format-repositories/mugsy-explains-v1/${reference.videoPath}`}
                />
                <div className="p-4">
                  <p className="font-bold">{reference.title}</p>
                  <a className="mt-2 inline-block text-sm font-semibold text-violet-700 underline-offset-4 hover:underline" href={reference.sourceUrl} rel="noreferrer" target="_blank">
                    Watch the original on Instagram
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section data-testid="mugsy-explains-pipeline">
          <h2 className="text-xl font-bold">The assembly line</h2>
          <p className="mt-1 text-sm text-slate-600">Planning and local checks are free. New narration waits for explicit approval.</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pipeline.steps.map((step, index) => (
              <li key={step} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <span className="text-xs font-bold text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-sm font-bold capitalize">{step.replaceAll("-", " ")}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What stays fixed</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>One plain white vertical canvas.</li>
              <li>One bundled recurring host and five locked poses.</li>
              <li>Three A-versus-B lessons with five narration lines each.</li>
              <li>Proof images at the top and handwritten captions below.</li>
              <li>Hard cuts and one off-screen narrator.</li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="font-bold">What the agent runs</h2>
            <div className="mt-4 rounded-md bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              python3 runner.py smoke<br />
              python3 runner.py validate<br />
              python3 runner.py render<br />
              python3 runner.py inspect<br />
              python3 runner.py finalize --human-review pass
            </div>
            <p className="mt-4 text-sm text-slate-600">The included proof renders with zero provider calls. New narration uses Fish S2.1 Pro Free only after approval.</p>
          </article>
        </section>

        <section>
          <h2 className="text-xl font-bold">Repo files</h2>
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
