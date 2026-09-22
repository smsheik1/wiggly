import Image from "next/image";
import type { ShazPuppetRuntimeTrustData } from "./shazPuppetRuntimeTrust.server";

const kindLabels: Record<string, string> = {
  "authored-neutral-anchor": "Artist-reviewed",
  "authored-replay": "Artist-reviewed",
  "authored-body-replay": "Artist-reviewed",
  "heldout-authored-replay": "Artist-reviewed",
  generated: "Needs creative review",
};

const mouthShapes = [
  {
    asset: "mouth-01.png",
    cues: "A · X",
    height: 165,
    label: "Rest / closed",
    sounds: "silence + closed-lip consonants",
    width: 283,
  },
  {
    asset: "mouth-04.png",
    cues: "B · G · I · J",
    height: 217,
    label: "Teeth / EE",
    sounds: "teeth, EE, F/V + CH/J/SH",
    width: 354,
  },
  {
    asset: "mouth-05.png",
    cues: "C · H",
    height: 230,
    label: "Small open",
    sounds: "EH + tongue-forward L",
    width: 296,
  },
  {
    asset: "mouth-02.png",
    cues: "D",
    height: 258,
    label: "Wide open",
    sounds: "wide AH",
    width: 390,
  },
  {
    asset: "mouth-03.png",
    cues: "E · F · K",
    height: 166,
    label: "Rounded O",
    sounds: "OH, OO/W + R",
    width: 134,
  },
] as const;

const rigAssetRoot =
  "/format-repositories/shaz-puppet-runtime-v1/rig-v2/assets";
const formatAssetRoot = "/format-repositories/shaz-puppet-runtime-v1";

export function ShazPuppetRuntimeIncludedAssets({
  data,
}: {
  data: ShazPuppetRuntimeTrustData;
}) {
  const needsReviewActionCount =
    data.includedAssets.poses.length -
    data.includedAssets.showcasePoses.length -
    1;
  const cherry = data.includedAssets.bundledEngines.find(
    (engine) => engine.name === "cherry-lip-sync",
  );
  const whisper = data.includedAssets.bundledEngines.find(
    (engine) => engine.name === "whisper.cpp",
  );

  return (
    <section
      id="included-assets"
      aria-labelledby="included-assets-title"
      className="border-y-2 border-[#080817] bg-[#fffdf8] px-4 py-[58px] text-[#080817] sm:px-7"
      data-testid="shaz-puppet-runtime-included-assets"
    >
      <div className="mx-auto max-w-[980px]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#667087]">
          Included assets
        </p>
        <h2
          id="included-assets-title"
          className="mt-3 max-w-[720px] text-[clamp(34px,5vw,54px)] font-black leading-[0.96] tracking-[-0.04em]"
        >
          Five reviewed gestures. Local transcription and lip-sync. Four rooms.
        </h2>
        <p className="mt-5 max-w-[760px] text-base font-bold leading-7 text-[#596176]">
          The five gestures shown below were recreated from artist animation and
          reviewed as ready to use. The kit contains{" "}
          {data.includedAssets.poses.length} runnable actions in all. One is the
          calm body behind Talk to Camera; the remaining{" "}
          {needsReviewActionCount} are engineering reference material and need a
          fresh creative review before a finished video uses them. The kit
          reads the spoken words locally, then Cherry maps the audio to five
          hand-drawn mouth shapes.
        </p>
        <div className="mt-7 grid gap-4 min-[700px]:grid-cols-2">
          <article className="border-2 border-[#080817] bg-[#dff8ff] p-4 shadow-[3px_3px_0_#080817]">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
              Understands the dialogue
            </p>
            <h3 className="mt-2 text-xl font-black">
              Local English transcript
            </h3>
            <p className="mt-2 text-sm font-bold leading-6 text-[#596176]">
              Whisper {whisper?.version ?? "1.9.2"} writes the words and their
              timing on your Mac, so gestures can land on what Shaz is actually
              saying. No upload or API key.
            </p>
          </article>
          <article className="border-2 border-[#080817] bg-[#dff8ff] p-4 shadow-[3px_3px_0_#080817]">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
              Lip-sync included
            </p>
            <h3 className="mt-2 text-xl font-black">
              Cherry Lip Sync {cherry?.version ?? "0.1.0"}
            </h3>
            <p className="mt-2 text-sm font-bold leading-6 text-[#596176]">
              Cherry listens to the audio and chooses the matching mouth shape
              on your Mac. It works without a subscription, network call, or
              second animation system.
            </p>
          </article>
        </div>
        <div className="mt-10" data-testid="shaz-background-library">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
            Four built-in backgrounds
          </p>
          <h3 className="mt-2 text-[clamp(28px,4vw,42px)] font-black leading-none tracking-[-0.035em]">
            Pick the room. Keep the camera fixed.
          </h3>
          <p className="mt-3 max-w-[760px] text-sm font-bold leading-6 text-[#596176]">
            Sisters Room remains the main default. Living Room adds a warmer
            home setting, Photo Zone removes the old map artwork cleanly, and
            Pure White gives Shaz a neutral stage. The camera stays fixed in
            every room.
          </p>
          <div className="mt-5 grid gap-4 min-[640px]:grid-cols-2">
            {data.includedAssets.backgrounds.map((background) => (
              <article
                key={background.id}
                className="overflow-hidden border-2 border-[#080817] bg-white shadow-[4px_4px_0_#080817]"
              >
                <div className="relative aspect-video border-b-2 border-[#080817] bg-white">
                  <Image
                    src={`${formatAssetRoot}/${background.path}`}
                    alt={`${background.label} built-in Shaz background`}
                    width={3840}
                    height={2160}
                    sizes="(min-width: 640px) 480px, calc(100vw - 32px)"
                    className="block h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-black">{background.label}</h4>
                    {background.id ===
                    data.includedAssets.defaultBackgroundId ? (
                      <span className="border-2 border-[#080817] bg-[#c9ff55] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em]">
                        Default
                      </span>
                    ) : null}
                    {background.supportingMediaZone?.status ===
                    "reserved-not-active" ? (
                      <span className="border-2 border-[#080817] bg-[#fff0f7] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#9a315f]">
                        Future media zone reserved
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#596176]">
                    {background.usage}
                  </p>
                  {background.supportingMediaZone ? (
                    <p className="mt-3 text-xs font-black leading-5 text-[#9a315f]">
                      Not active yet:{" "}
                      {background.supportingMediaZone.runtimeBehavior}.
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div
          className="mt-8 overflow-hidden border-2 border-[#080817] bg-[#dff8ff] shadow-[5px_5px_0_#080817]"
          data-testid="shaz-talk-to-camera-option"
        >
          <div className="grid min-[760px]:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="p-5 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
                {data.includedAssets.defaultDialogue.subtitle} option
              </p>
              <h3 className="mt-2 text-[clamp(30px,5vw,48px)] font-black leading-none tracking-[-0.04em]">
                {data.includedAssets.defaultDialogue.label}
              </h3>
              <p className="mt-4 max-w-[620px] text-base font-bold leading-7 text-[#445168]">
                {data.includedAssets.defaultDialogue.description} Use it for
                ordinary speech, then add Present, Think, Ah-ha, Point, or
                Confident only when the line earns a gesture.
              </p>
              <div className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 border-2 border-[#080817] bg-white px-3 py-2 font-mono text-xs font-bold shadow-[2px_2px_0_#080817]">
                <span className="uppercase tracking-[0.11em] text-[#667087]">
                  Input
                </span>
                <code>{`sequencePreset: "${data.includedAssets.defaultDialogue.id}"`}</code>
              </div>
            </div>
            <div className="border-t-2 border-[#080817] bg-[#c9ff55] p-5 min-[760px]:border-l-2 min-[760px]:border-t-0 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
                Keeps the body steady
              </p>
              <p className="mt-2 font-mono text-lg font-black">
                {data.includedAssets.defaultDialogue.internalPoseId}
              </p>
              <ul className="mt-5 space-y-3 text-sm font-black leading-6 text-[#263446]">
                {data.includedAssets.defaultDialogue.rules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span aria-hidden="true">✓</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div
          className="mt-8 overflow-hidden border-2 border-[#080817] bg-white shadow-[5px_5px_0_#080817]"
          data-testid="shaz-ots-safe-zone"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#080817] bg-[#fffdf8] p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
                Composition & Staging Science
              </p>
              <h3 className="mt-1 text-[clamp(24px,3.5vw,36px)] font-black leading-none tracking-[-0.03em]">
                Over-The-Shoulder (OTS) Graphic Safe Zone
              </h3>
            </div>
            <span className="border-2 border-[#080817] bg-[#c9ff55] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em]">
              440 × 440px target
            </span>
          </div>

          <div className="grid min-[860px]:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.85fr)]">
            <div className="relative aspect-video border-b-2 border-[#080817] bg-[#080817] min-[860px]:border-b-0 min-[860px]:border-r-2">
              <Image
                src={`${formatAssetRoot}/assets/composition/ots-graphic-safe-zone.png`}
                alt="Over-The-Shoulder (OTS) Graphic Safe Zone boundary and staging guides on Talk-to-Camera Shaz"
                width={1280}
                height={720}
                sizes="(min-width: 860px) 620px, 100vw"
                className="block h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-between bg-[#fffdf8] p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#667087]">
                  Spatial Architecture
                </p>
                <h4 className="mt-2 text-xl font-black leading-tight text-[#080817]">
                  The Science of Negative Space
                </h4>
                <p className="mt-3 text-xs font-bold leading-5 text-[#596176]">
                  Shaz is staged off-center (scale 1.33, offset [0.12, 0.142]), reserving the entire left half of the 1280×720 canvas as open graphic real estate. News cards and screenshots pop up over his shoulder without crowding the host.
                </p>

                <ul className="mt-4 space-y-2.5 font-mono text-xs font-bold text-[#263446]">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#06b6d4]" />
                    <span><strong>90% Action Safe:</strong> 64px X-margin, 36px Y-margin</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#eab308]" />
                    <span><strong>OTS Zone Box:</strong> 440×440px at (x: 80, y: 90)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
                    <span><strong>Comfort Margin:</strong> ~120px to Shaz core body</span>
                  </li>
                </ul>
              </div>

              <div className="mt-5 border-t-2 border-[#080817]/10 pt-3 text-[11px] font-bold text-[#667087]">
                <strong className="text-[#080817]">3-Layer Z-Index Depth:</strong> Background → OTS Graphic (drop shadow) → Shaz Puppet Rig in foreground for natural arm overlap.
              </div>
            </div>
          </div>
        </div>
        <div
          className="mt-8 border-2 border-[#080817] bg-[#fffdf8] p-5 shadow-[5px_5px_0_#080817]"
          data-testid="shaz-multi-shot-palette"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#31566e]">
              Multi-shot timeline engine
            </p>
            <span className="border-2 border-[#080817] bg-[#c9ff55] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]">
              4 shot types
            </span>
          </div>
          <h3 className="mt-2 text-[clamp(26px,3.8vw,38px)] font-black leading-none tracking-[-0.03em]">
            The 4-Shot Studio Palette
          </h3>
          <p className="mt-3 max-w-[760px] text-sm font-bold leading-6 text-[#596176]">
            Every episode moves between four visual modes directed by the LLM
            timeline planner. Shot cuts assemble deterministically at 24fps with
            cross-dissolve and cut transitions.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="flex flex-col justify-between border-2 border-[#080817] bg-white p-4 shadow-[3px_3px_0_#080817]">
              <div>
                <div className="inline-flex items-center gap-1.5 border-2 border-[#080817] bg-[#52d6ff] px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                  <span>01</span>
                  <span>talk-to-camera</span>
                </div>
                <h4 className="mt-3 text-base font-black leading-tight">
                  Direct Presentation
                </h4>
                <p className="mt-2 text-xs font-bold leading-5 text-[#596176]">
                  A-roll host delivery with Cherry phoneme lip-sync against
                  curated studio backgrounds.
                </p>
              </div>
              <div className="mt-4 border-t border-[#080817]/20 pt-2 font-mono text-[10px] font-bold text-[#31566e]">
                Primary narration
              </div>
            </article>

            <article className="flex flex-col justify-between border-2 border-[#080817] bg-white p-4 shadow-[3px_3px_0_#080817]">
              <div>
                <div className="inline-flex items-center gap-1.5 border-2 border-[#080817] bg-[#ffd9e9] px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                  <span>02</span>
                  <span>text-card</span>
                </div>
                <h4 className="mt-3 text-base font-black leading-tight">
                  Kinetic Typography
                </h4>
                <p className="mt-2 text-xs font-bold leading-5 text-[#596176]">
                  Full-screen headline card with high-contrast accent pill
                  highlights for core takeaways.
                </p>
              </div>
              <div className="mt-4 border-t border-[#080817]/20 pt-2 font-mono text-[10px] font-bold text-[#9a315f]">
                Big ideas & hooks
              </div>
            </article>

            <article className="flex flex-col justify-between border-2 border-[#080817] bg-white p-4 shadow-[3px_3px_0_#080817]">
              <div>
                <div className="inline-flex items-center gap-1.5 border-2 border-[#080817] bg-[#c9ff55] px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                  <span>03</span>
                  <span>chibi-commentary</span>
                </div>
                <h4 className="mt-3 text-base font-black leading-tight">
                  Chibi Commentary
                </h4>
                <p className="mt-2 text-xs font-bold leading-5 text-[#596176]">
                  Animated mini puppet with floating vector topic cards,
                  bounce entrances, and expressive holds.
                </p>
              </div>
              <div className="mt-4 border-t border-[#080817]/20 pt-2 font-mono text-[10px] font-bold text-[#263446]">
                Sidebars & reactions
              </div>
            </article>

            <article className="flex flex-col justify-between border-2 border-[#080817] bg-white p-4 shadow-[3px_3px_0_#080817]">
              <div>
                <div className="inline-flex items-center gap-1.5 border-2 border-[#080817] bg-[#f5f1e8] px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                  <span>04</span>
                  <span>b-roll</span>
                </div>
                <h4 className="mt-3 text-base font-black leading-tight">
                  Cinematic B-Roll
                </h4>
                <p className="mt-2 text-xs font-bold leading-5 text-[#596176]">
                  Curated story illustrations brought to life with 6
                  cinematic Ken Burns camera pan and zoom motions.
                </p>
              </div>
              <div className="mt-4 border-t border-[#080817]/20 pt-2 font-mono text-[10px] font-bold text-[#667087]">
                Visual storytelling
              </div>
            </article>
          </div>
        </div>
        <div
          className="mt-8 border-2 border-[#080817] bg-[#fff0f7] p-5 shadow-[5px_5px_0_#080817]"
          data-testid="shaz-chibi-acting-physics"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9a315f]">
              Chibi choreography & classical animation
            </p>
            <span className="border-2 border-[#080817] bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#9a315f]">
              Squash · Stretch · Anticipation
            </span>
          </div>
          <h3 className="mt-2 text-[clamp(26px,3.8vw,38px)] font-black leading-none tracking-[-0.03em]">
            Chibi Acting: The 5 Core Physical Holds
          </h3>
          <p className="mt-3 max-w-[780px] text-sm font-bold leading-6 text-[#596176]">
            Instead of raw frame flipping, Chibi Shaz delivers on five physical
            acting holds. The runtime&apos;s classical animation physics engine
            dynamically inserts squash, stretch, anticipation, and settle
            cushions (1–2 frames each) so transitions feel organic, elastic, and
            weighty at 24fps.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <article className="border-2 border-[#080817] bg-white p-3 shadow-[3px_3px_0_#080817]">
              <div className="relative aspect-square overflow-hidden border-2 border-[#080817] bg-[#ffd9e9]">
                <Image
                  src={`${formatAssetRoot}/assets/chibi-showcase/talk-gesture.png`}
                  alt="Chibi Shaz talk-gesture acting pose"
                  fill
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-2.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#9a315f]">
                  01 · Hold
                </span>
                <h4 className="text-sm font-black leading-tight">talk-gesture</h4>
                <p className="mt-1 text-[11px] font-bold leading-4 text-[#667087]">
                  Natural conversational speaking pose with open hands and lively tilt.
                </p>
              </div>
            </article>

            <article className="border-2 border-[#080817] bg-white p-3 shadow-[3px_3px_0_#080817]">
              <div className="relative aspect-square overflow-hidden border-2 border-[#080817] bg-[#ffd9e9]">
                <Image
                  src={`${formatAssetRoot}/assets/chibi-showcase/present-card.png`}
                  alt="Chibi Shaz present-card acting pose"
                  fill
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-2.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#9a315f]">
                  02 · Hold
                </span>
                <h4 className="text-sm font-black leading-tight">present-card</h4>
                <p className="mt-1 text-[11px] font-bold leading-4 text-[#667087]">
                  Two-handed forward presentation directing viewer attention to topic cards.
                </p>
              </div>
            </article>

            <article className="border-2 border-[#080817] bg-white p-3 shadow-[3px_3px_0_#080817]">
              <div className="relative aspect-square overflow-hidden border-2 border-[#080817] bg-[#ffd9e9]">
                <Image
                  src={`${formatAssetRoot}/assets/chibi-showcase/think-chin.png`}
                  alt="Chibi Shaz think-chin acting pose"
                  fill
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-2.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#9a315f]">
                  03 · Hold
                </span>
                <h4 className="text-sm font-black leading-tight">think-chin</h4>
                <p className="mt-1 text-[11px] font-bold leading-4 text-[#667087]">
                  Pensive contemplation with chin touch, head tilt, and thoughtful gaze.
                </p>
              </div>
            </article>

            <article className="border-2 border-[#080817] bg-white p-3 shadow-[3px_3px_0_#080817]">
              <div className="relative aspect-square overflow-hidden border-2 border-[#080817] bg-[#ffd9e9]">
                <Image
                  src={`${formatAssetRoot}/assets/chibi-showcase/shrug-open.png`}
                  alt="Chibi Shaz shrug-open acting pose"
                  fill
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-2.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#9a315f]">
                  04 · Hold
                </span>
                <h4 className="text-sm font-black leading-tight">shrug-open</h4>
                <p className="mt-1 text-[11px] font-bold leading-4 text-[#667087]">
                  Expressive palms-up shrug for humorous commentary, honest admissions, or questions.
                </p>
              </div>
            </article>

            <article className="border-2 border-[#080817] bg-white p-3 shadow-[3px_3px_0_#080817]">
              <div className="relative aspect-square overflow-hidden border-2 border-[#080817] bg-[#ffd9e9]">
                <Image
                  src={`${formatAssetRoot}/assets/chibi-showcase/point-emphasis.png`}
                  alt="Chibi Shaz point-emphasis acting pose"
                  fill
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-2.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#9a315f]">
                  05 · Hold
                </span>
                <h4 className="text-sm font-black leading-tight">point-emphasis</h4>
                <p className="mt-1 text-[11px] font-bold leading-4 text-[#667087]">
                  Direct index finger point delivering punchlines, warnings, or strong emphasis.
                </p>
              </div>
            </article>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-[#080817] bg-white p-3 text-xs font-bold text-[#596176]">
            <div>
              <strong className="text-[#080817]">Classical Animation Pipeline:</strong>{" "}
              Every hold transition dynamically runs squash (0.92x scale), anticipation (-10px dip), and elastic overshoot settle cushions.
            </div>
            <div className="font-mono text-[11px] text-[#9a315f]">
              Zero keyword fallbacks · LLM director planned
            </div>
          </div>
        </div>
        <div
          className="mt-8 border-2 border-[#080817] bg-[#fff0f7] p-4 shadow-[5px_5px_0_#080817] sm:p-5"
          data-testid="shaz-mouth-shape-kit"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9a315f]">
            The talking kit
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.025em]">
            Five hand-drawn mouths. Every sound has somewhere to go.
          </h3>
          <p className="mt-2 max-w-[760px] text-sm font-bold leading-6 text-[#596176]">
            Cherry listens to the audio; Shaz swaps between five mouth drawings
            while the body, hands, timing, and room stay untouched.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 min-[760px]:grid-cols-5">
            {mouthShapes.map((mouth, index) => (
              <article
                key={mouth.asset}
                className="border-2 border-[#080817] bg-white p-3"
              >
                <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-[#ffd9e9] p-3">
                  <Image
                    src={`${rigAssetRoot}/${mouth.asset}`}
                    alt={`${mouth.label} hand-drawn Shaz mouth shape`}
                    width={mouth.width}
                    height={mouth.height}
                    className="block max-h-full w-full object-contain"
                  />
                </div>
                <p className="mt-3 text-[9px] font-black uppercase tracking-[0.13em] text-[#9a315f]">
                  {String(index + 1).padStart(2, "0")} · Cherry {mouth.cues}
                </p>
                <h4 className="mt-1 text-base font-black leading-tight">
                  {mouth.label}
                </h4>
                <p className="mt-1 text-xs font-bold leading-5 text-[#667087]">
                  {mouth.sounds}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.11em] text-[#9a315f]">
            Only the mouth changes · the body stays put
          </p>
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.15em] text-[#667087]">
          Five artist-reviewed gestures
        </p>
        <div className="mt-8 overflow-hidden border-2 border-[#080817] bg-white shadow-[5px_5px_0_#080817]">
          <Image
            src={data.includedAssets.showcasePosterSrc}
            alt="Shaz performing the reviewed Present, Think, Ah-ha, Point, and Confident gestures"
            width={1300}
            height={556}
            className="block h-auto w-full"
          />
        </div>
        <div className="mt-7 grid gap-3 min-[520px]:grid-cols-2 min-[821px]:grid-cols-3">
          {data.includedAssets.showcasePoses.map((pose, index) => (
            <article
              key={pose.id}
              className="border-2 border-[#080817] bg-white p-4 shadow-[3px_3px_0_#080817]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#667087]">
                {String(index + 1).padStart(2, "0")} ·{" "}
                {kindLabels[pose.kind] ?? pose.kind}
              </p>
              <h3 className="mt-2 text-lg font-black leading-tight">
                {pose.id.replaceAll("-", " ")}
              </h3>
            </article>
          ))}
        </div>
        <div className="mt-6 border-2 border-[#080817] bg-[#c9ff55] p-4">
          <h3 className="text-lg font-black">Small supporting drawings</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-[#334155]">
            {data.includedAssets.props
              .map((prop) => `${prop.id}: ${prop.usage}`)
              .join(" · ")}
          </p>
        </div>
      </div>
    </section>
  );
}
