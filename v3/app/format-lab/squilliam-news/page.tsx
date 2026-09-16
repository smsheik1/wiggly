import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const repositoryPath = path.join(process.cwd(), "public", "format-repositories", "squilliam-news-v1");
const publicRepositoryPath = "/format-repositories/squilliam-news-v1";
const readJson = <T,>(relativePath: string) => (
  JSON.parse(readFileSync(path.join(repositoryPath, relativePath), "utf8")) as T
);

type FormatManifest = {
  id: string;
  version: string;
  title: string;
  description: string;
  status: string;
};

type Finalization = {
  status: string;
  automaticReview: string;
  humanReview: string;
  videoHash: string;
  finalVideo: string;
};

type QualityReport = {
  probe: {
    streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string }>;
    format: { duration: string };
  };
  checks: Record<string, boolean>;
};

type BlindHandoff = {
  attempt: number;
  providerCalls: number;
  rendererEdited: boolean;
  videoSha256: string;
  visualReview: {
    yellowEyeFieldsVisible: boolean;
    redPupilsVisible: boolean;
    opaqueFaceCutout: boolean;
    oneSecondEyeSheetSamples: number;
  };
};

type ContentPack = {
  headline: string;
  characterId: string;
  tickerItems: string[];
};

type AssetSources = {
  promotionSource: string;
};

type CharacterPackCatalog = {
  defaultCharacterId: string;
  packs: Array<{
    id: string;
    label: string;
    status: "presenter-ready";
  }>;
};

type VoicePresetCatalog = {
  presets: Array<{
    characterId: string;
    label: string;
    referenceId: string | null;
    voiceStatus: "operator-supplied" | "preset-ready";
    characterStatus: "presenter-ready" | "model-qa-pending" | "material-adapter-needed";
    note?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Squilliam News — Wiggly Format Lab",
  description: "Watch the approved Squilliam News artistic-emergency bulletin and inspect its reusable Wiggly Repo proof.",
};

export default function SquilliamNewsFormatPage() {
  const format = readJson<FormatManifest>("format.json");
  const content = readJson<ContentPack>("examples/we-the-artists/content.json");
  const finalization = readJson<Finalization>("examples/we-the-artists/evidence/finalization.json");
  const quality = readJson<QualityReport>("examples/we-the-artists/evidence/quality-report.json");
  const blind = readJson<BlindHandoff>("evidence/blind-handoff/v0.2.1/handoff-receipt.json");
  const sources = readJson<AssetSources>("examples/we-the-artists/asset-sources.json");
  const characterPacks = readJson<CharacterPackCatalog>("assets/character-packs.json");
  const voicePresets = readJson<VoicePresetCatalog>("assets/voice-presets.json");
  const videoStream = quality.probe.streams.find((stream) => stream.codec_type === "video");
  const passedChecks = Object.values(quality.checks).filter(Boolean).length;
  const finalVideo = `${publicRepositoryPath}/examples/we-the-artists/evidence/${finalization.finalVideo}`;
  const voiceByCharacter = new Map(voicePresets.presets.map((preset) => [preset.characterId, preset]));
  const pendingCharacters = voicePresets.presets.filter((preset) => preset.characterStatus !== "presenter-ready");

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-cyan-300/20 bg-[#0b1728]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Wiggly / Format Lab</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-black tracking-tight">{format.title}</h1>
              <Badge className="bg-emerald-400 text-emerald-950 hover:bg-emerald-400">Approved final</Badge>
              <span className="text-sm text-slate-400">v{format.version}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-cyan-300/40 bg-transparent text-cyan-100 hover:bg-cyan-300/10 hover:text-white" data-testid="download-squilliam-kit">
              <a href="https://github.com/smsheik1/wiggly-squilliam-news/releases/download/v0.2.1-proof/wiggly-squilliam-news-format-kit.zip" download>Download runnable kit</a>
            </Button>
            <Button asChild variant="secondary" data-testid="download-squilliam-final">
              <a href={finalVideo} download>Download final MP4</a>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8 md:py-12">
        <section className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
          <div className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-black shadow-2xl shadow-cyan-950/40">
            <video
              className="aspect-video w-full bg-black"
              controls
              playsInline
              preload="metadata"
              poster={`${publicRepositoryPath}/examples/we-the-artists/evidence/poster.png`}
              src={finalVideo}
              data-testid="squilliam-final-video"
            >
              Your browser does not support HTML video.
            </video>
          </div>

          <aside className="rounded-2xl border border-slate-700 bg-[#101d30] p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-400">Special bulletin</p>
            <h2 className="mt-3 text-3xl font-black leading-tight">{content.headline}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">{format.description}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <dt className="text-slate-400">Runtime</dt>
                <dd className="mt-1 font-bold">{Number(quality.probe.format.duration)} seconds</dd>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <dt className="text-slate-400">Frame</dt>
                <dd className="mt-1 font-bold">{videoStream?.width} × {videoStream?.height}</dd>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <dt className="text-slate-400">Presenter</dt>
                <dd className="mt-1 font-bold capitalize">{content.characterId}</dd>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <dt className="text-slate-400">Quality gates</dt>
                <dd className="mt-1 font-bold">{passedChecks}/{Object.keys(quality.checks).length} passed</dd>
              </div>
            </dl>

            <Button asChild className="mt-6 w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <a href={sources.promotionSource} target="_blank" rel="noreferrer">View the promoted event</a>
            </Button>
          </aside>
        </section>

        <section className="rounded-2xl border border-cyan-300/20 bg-[#0b1728] p-6 md:p-8" data-testid="squilliam-character-roster">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Choose your anchor</p>
              <h2 className="mt-2 text-3xl font-black">Four characters are presenter-ready now.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Every selectable model has its own calibrated rig, lip sync, desk-safe gestures, and immutable visual smoke proof. Three alternate anchors also ship with a ready-to-use Fish voice preset.</p>
            </div>
            <div className="flex gap-2 text-center">
              <div className="rounded-xl border border-cyan-300/20 bg-slate-950/50 px-4 py-3">
                <p className="text-2xl font-black text-cyan-200">{characterPacks.packs.length}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Models ready</p>
              </div>
              <div className="rounded-xl border border-violet-300/20 bg-slate-950/50 px-4 py-3">
                <p className="text-2xl font-black text-violet-200">{voicePresets.presets.filter((preset) => preset.referenceId).length}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fish presets</p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {characterPacks.packs.map((pack) => {
              const voice = voiceByCharacter.get(pack.id);
              return (
                <article key={pack.id} className="overflow-hidden rounded-xl border border-slate-700 bg-[#101d30]">
                  <img
                    className="aspect-video w-full bg-black object-cover"
                    src={`${publicRepositoryPath}/evidence/character-packs/${pack.id}-contact-sheet.png`}
                    alt={`${pack.label} presenter model render proof`}
                  />
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-400 text-emerald-950 hover:bg-emerald-400">Presenter-ready</Badge>
                      {pack.id === characterPacks.defaultCharacterId ? (
                        <Badge variant="outline" className="border-amber-300/60 text-amber-200">Default</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black">{pack.label}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {voice?.referenceId ? "Fish voice preset ready" : "Approved private voice clone required"}
                    </p>
                    <p className="mt-3 font-mono text-xs text-slate-500">characterId: {pack.id}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-violet-300/30 bg-violet-950/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Next at the desk</p>
                <h3 className="mt-1 text-lg font-black">Voices registered; model QA still in progress</h3>
              </div>
              <Badge variant="outline" className="border-violet-300/50 text-violet-200">Not selectable yet</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pendingCharacters.map((character) => (
                <div key={character.characterId} className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{character.label}</p>
                    <span className="text-xs font-bold text-violet-200">Fish voice ready</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{character.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3" data-testid="squilliam-proof-summary">
          <article className="rounded-xl border border-slate-700 bg-[#101d30] p-5">
            <Badge variant="outline" className="border-emerald-400/60 text-emerald-300">Human approved</Badge>
            <h2 className="mt-4 font-bold">Final means final</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Automatic review: {finalization.automaticReview}. Human review: {finalization.humanReview}. Both are bound to the same video hash.</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-[#101d30] p-5">
            <Badge variant="outline" className="border-cyan-300/60 text-cyan-200">Blind reproduced</Badge>
            <h2 className="mt-4 font-bold">Fresh-agent proof</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Attempt {blind.attempt} reproduced the approved video with {blind.providerCalls} provider calls and no renderer edits.</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-[#101d30] p-5">
            <Badge variant="outline" className="border-amber-300/60 text-amber-200">Eye-safe</Badge>
            <h2 className="mt-4 font-bold">The face survived QA</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Both yellow eyes and red pupils remained visible across {blind.visualReview.oneSecondEyeSheetSamples} samples, with no opaque facial cutout.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-[#101d30] p-6 md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">The reusable format</p>
            <h2 className="mt-2 text-2xl font-black">Real promotion in. Nostalgic news bulletin out.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">The story, images, character, voice, pronunciation, ticker, and CTA live in replaceable content packs. Studio mechanics, gestures, timing, monitor layouts, inspection, and finalization stay in one official runtime.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {content.tickerItems.map((item) => (
              <Badge key={item} variant="secondary" className="bg-slate-800 text-slate-200">{item}</Badge>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Visual proof</p>
              <h2 className="mt-2 text-2xl font-black">The full 30-second sequence</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">{finalization.videoHash.slice(0, 16)}…</span>
          </div>
          <img
            className="mt-5 w-full rounded-xl border border-slate-700 bg-black"
            src={`${publicRepositoryPath}/examples/we-the-artists/evidence/contact-sheet.png`}
            alt="Contact sheet showing Squilliam presenting the complete We The Artists bulletin"
          />
        </section>
      </div>
    </main>
  );
}
