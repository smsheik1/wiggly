import type { MyPixarStoryStoryboard } from "../formats/my-pixar-story/types";
import { AD_SCENE_VERSION, type MyPixarStoryAdScene } from "./types";

export interface CreateMyPixarStorySceneOptions {
  storyboard: MyPixarStoryStoryboard;
  activeClipUrls?: string[];
  activeKeyframeUrls?: string[];
  musicAudioUrl?: string;
  voiceoverAudioUrl?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Creates a canonical MyPixarStoryAdScene for the shared ad render pipeline.
 * Satisfies the single-renderer invariant (Rule 1).
 */
export function createMyPixarStoryScene(
  options: CreateMyPixarStorySceneOptions
): MyPixarStoryAdScene {
  const {
    storyboard,
    activeClipUrls,
    activeKeyframeUrls,
    musicAudioUrl = storyboard.musicTrackId
      ? `https://assets.wiggly.internal/music/${storyboard.musicTrackId}.mp3`
      : undefined,
    voiceoverAudioUrl = storyboard.narrationAudioUrl,
    accentColor = "#FFB238",
    backgroundColor = "#0D1117",
    textColor = "#FFFFFF",
  } = options;

  const totalDuration = storyboard.totalDurationSeconds || 65;
  const sceneCount = storyboard.scenes.length || 5;
  const sceneDurationMs = Math.round((totalDuration / sceneCount) * 1000);

  return {
    version: AD_SCENE_VERSION,
    format: "my-pixar-story",
    brand: {
      name: `${storyboard.subjectName}'s Story`,
      url: "",
      host: "wiggly.internal",
      title: `${storyboard.subjectName}'s Life Memoir`,
      description: `A 5-chapter animated Pixar-style memoir from ${storyboard.subjectName} to ${storyboard.recipientName}.`,
      logoUrl: null,
      faviconUrl: null,
      ogImageUrl: null,
      screenshotUrl: null,
      colors: [accentColor, backgroundColor],
      fonts: { feel: "sans" },
      vibeTags: ["pixar", "memoir", "family", "nostalgia", storyboard.tone],
      receipts: {
        specificClaims: [],
        buyerMoments: [],
        exactSiteLanguage: [],
        namedProof: [],
      },
    },
    creative: {
      angleId: "my-pixar-story-memoir",
      headline: `${storyboard.subjectName}’s Story`,
      subheadline: `A Pixar-style journey for ${storyboard.recipientName}`,
      ctaText: "Watch the Journey",
      headlineType: "transformation",
      selectedPain: "Cherishing family memories before they fade",
      selectedProof: "5 story beats animated in Pixar 3D aesthetic",
    },
    style: {
      backgroundColor,
      textColor,
      accentColor,
      fontFeel: "sans",
    },
    audio: voiceoverAudioUrl
      ? {
          status: "generated" as const,
          storageId: `pixar-voice-${Date.now()}`,
          url: voiceoverAudioUrl,
          mimeType: "audio/mpeg",
          durationMs: totalDuration * 1000,
          durationSeconds: totalDuration,
          transcript: storyboard.scenes.map((s) => s.narrationScript).join(" "),
          captions: storyboard.scenes.map((scene, idx) => ({
            text: scene.narrationScript,
            startMs: idx * sceneDurationMs,
            endMs: (idx + 1) * sceneDurationMs,
          })),
          provider: "upload" as const,
          model: "cartesia-sonic",
          generatedAt: Date.now(),
        }
      : {
          status: "none" as const,
          transcript: "" as const,
          captions: [],
        },

    layout: {
      preset: "my-pixar-story-memoir",
      storyboard,
      activeClipUrls,
      activeKeyframeUrls,
      musicAudioUrl,
      voiceoverAudioUrl,
    },
    metadata: {
      candidateIndex: 0,
      generationBatchId: `pixar-${Date.now()}`,
      researchRunId: "my-pixar-story-local",
      brandSnapshotId: "pixar-profile",
      model: "seadance-2.0-mini",
      provider: "deterministic",
      generatedAt: Date.now(),
    },
  };
}
