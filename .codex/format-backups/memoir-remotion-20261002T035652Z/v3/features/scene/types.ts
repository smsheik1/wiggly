import type { BrandAdAngle, BrandSnapshot, ResearchReceipts } from "../research/types";
import type { ThreeDBreakdownStorySubject } from "../formats/three-d-breakdown/storySubject";
import type { MyPixarStoryStoryboard } from "../formats/my-pixar-story/types";

export const AD_SCENE_VERSION = 1 as const;

export type AdFormatId = "visualizer" | "meme" | "were-sorry" | "video-meme" | "jingle" | "text-message" | "brainrot" | "reviews" | "motion-story" | "three-d-breakdown";
export type RenderableAdFormatId = AdFormatId | "static-package" | "talking-fish-news" | "lego-music-video" | "my-pixar-story";

export type HeadlineType =
  | "painful_moment"
  | "receipt_drop"
  | "callout"
  | "contrast"
  | "transformation";

export type AdSceneCandidate = {
  angleId: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  headlineType: HeadlineType;
  selectedPain: string;
  selectedProof: string;
};

export type AdSceneCaption = {
  text: string;
  startMs: number;
  endMs: number;
  speaker?: 1 | 2;
};

export type AdSceneAudioAnalysis = {
  fps: number;
  levels: number[];
  bands: number[][];
};

export type AdSceneAudio =
  | {
    status: "none";
    transcript: "";
    captions: [];
  }
  | {
    status: "generated";
    storageId: string;
    url: string;
    mimeType: string;
    durationMs: number;
    durationSeconds: number;
    transcript: string;
    captions: AdSceneCaption[];
    analysis?: AdSceneAudioAnalysis;
    provider: "gemini" | "upload" | "elevenlabs" | "fish-studio";
    model: string;
    generatedAt: number;
  };

export type AdSceneBackgroundMusic = {
  status: "uploaded";
  storageId: string;
  url: string;
  mimeType: string;
  durationMs: number;
  fileName: string;
  volume: number;
  loop: true;
  addedAt: number;
};

export type AdSceneVisualizerStyle = {
  type: "bars-bottom" | "bars-center" | "waveform-strip";
  barCount: number;
  sensitivity: number;
  heightScale: number;
  baseline: number;
  gain: number;
  compression: number;
  floor: number;
  ceiling: number;
  curve: "default" | "linear" | "sqrt" | "log";
  bandFocus: "full" | "voice" | "low" | "high";
  mirror: boolean;
  splitSpeakers: boolean;
};

export type AdSceneStyleBase = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFeel: BrandSnapshot["fonts"]["feel"];
};

export type AdSceneBase<
  TFormat extends string,
  TStyle extends AdSceneStyleBase,
  TLayout extends { preset: string },
> = {
  version: typeof AD_SCENE_VERSION;
  format: TFormat;
  brand: BrandSnapshot & {
    receipts: ResearchReceipts;
  };
  creative: {
    angleId: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    headlineType: HeadlineType;
    selectedPain: string;
    selectedProof: string;
  };
  style: TStyle;
  audio: AdSceneAudio;
  backgroundMusic?: AdSceneBackgroundMusic;
  layout: TLayout;
  metadata: {
    candidateIndex: number;
    generationBatchId: string;
    researchRunId: string;
    brandSnapshotId: string;
    model: string;
    provider: "gemini" | "nvidia-nim" | "openrouter" | "deterministic";
    generatedAt: number;
    adAngles?: BrandAdAngle[];
    selectedProductHandles?: string[];
  };
};

export type VisualizerAdSceneStyle = AdSceneStyleBase & {
  visualizerColor: string;
  visualizer?: AdSceneVisualizerStyle;
};

export type VisualizerAdScene = AdSceneBase<
  "visualizer",
  VisualizerAdSceneStyle,
  { preset: "centered-hero" }
>;

export type MemeAdScene = AdSceneBase<
  "meme",
  AdSceneStyleBase,
  {
    preset: "meme-template";
    templateId: string;
    slots: Record<string, string>;
  }
>;

export type WereSorryAdScene = AdSceneBase<
  "were-sorry",
  AdSceneStyleBase,
  {
    preset: "were-sorry-poster";
    apologyHeader: string;
    legalOpener: string;
    confessions: string[];
    signoff: string;
  }
>;

export type VideoMemeAdScene = AdSceneBase<
  "video-meme",
  AdSceneStyleBase,
  {
    preset: "video-meme-template";
    templateId: "bear-sniff" | "pingu-noot-noot" | "darwin-journey";
    videoSrc: string;
    durationSeconds: number;
    captionPosition: "top";
    slots: {
      caption?: string;
      setupText?: string;
      dreadText?: string;
    };
  }
>;

export type JingleCompositionChunk = {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
  context_adherence: "high";
};

export type JingleMusicVideoClip = {
  shotIndex: number;
  storageId: string;
  url: string | null;
  startMs: number;
  endMs: number;
};

export type JingleMusicVideoStitchedVideo = {
  storageId: string;
  url: string | null;
  mimeType: string;
  durationMs: number;
  builtAt: number;
};

export type JingleAdScene = AdSceneBase<
  "jingle",
  AdSceneStyleBase,
  {
    preset: "jingle-lyrics";
    brandPhonetic: string;
    angle: string;
    lyrics: string[];
    musicLengthMs: number;
    compositionPlan: {
      chunks: JingleCompositionChunk[];
    };
    musicVideo?: {
      sourceStoryboardId: string;
      clips: JingleMusicVideoClip[];
      stitchedVideo?: JingleMusicVideoStitchedVideo;
      builtAt: number;
    };
    selfCheckPassed: string;
  }
>;

// Separate Repo identity, shared music-video composition. This does not add a
// new /create choice or duplicate the existing lyric/video renderer.
export type LegoMusicVideoAdScene = Omit<JingleAdScene, "format" | "layout"> & {
  format: "lego-music-video";
  layout: Omit<JingleAdScene["layout"], "preset"> & { preset: "lego-music-video" };
};

export type TextMessageAdScene = AdSceneBase<
  "text-message",
  AdSceneStyleBase,
  {
    preset: "text-message-screenshot";
    contactName: string;
    timestampLabel: string;
    messages: Array<{
      side: "left" | "right";
      text: string;
    }>;
  }
>;

export type BrainrotBeat = {
  speaker: "left" | "right";
  text: string;
  startMs?: number;
  durationMs?: number;
};

export type BrainrotAdScene = AdSceneBase<
  "brainrot",
  AdSceneStyleBase,
  {
    preset: "brainrot-dialogue";
    backgroundVideoSrc: string;
    characters: {
      leftSpriteSrc: string;
      rightSpriteSrc: string;
    };
    beats: BrainrotBeat[];
    beatGapMs: number;
    ctaText?: string;
    angle: string;
    selfCheckPassed: string;
  }
>;

export type ReviewsProofItem = {
  type: "review";
  text: string;
  rating?: number;
  sourceName?: string;
  sourceUrl?: string;
  provider: "website";
};

export type ReviewsProductAnchor = {
  title: string;
  handle: string;
  url: string;
  imageUrl: string | null;
  imageAlt: string | null;
  isBestSeller: boolean;
};

export type ReviewsTemplate = "proof-card" | "minimal-quote";

export type ReviewsAdScene = AdSceneBase<
  "reviews",
  AdSceneStyleBase,
  {
    preset: "reviews-proof-card";
    template?: ReviewsTemplate;
    proof: ReviewsProofItem;
    proofIndex: number;
    proofTotal: number;
    proofText: string;
    headline: string;
    ctaText: string;
    productAnchor?: ReviewsProductAnchor;
    backgroundImages: string[];
  }
>;

export type MotionStoryMusicBedId = "polished-upbeat" | "warm-premium" | "playful-retail" | "bold-retail";
export type MotionStoryBeatRole = "hook" | "product" | "proof" | "cta";
export type MotionStoryBeatMotion = "kinetic-reveal" | "image-expand" | "proof-card" | "cta-slam";

export type MotionStoryBeat = {
  role: MotionStoryBeatRole;
  motion: MotionStoryBeatMotion;
  headline: string;
  supportingText?: string;
  startMs: number;
  endMs: number;
};

export type MotionStoryProduct = {
  title: string;
  handle: string;
  imageUrl: string;
  cutoutUrl: string;
  url?: string;
  isBestSeller: boolean;
};

export type MotionStoryProof = {
  originalText: string;
  displayText: string;
  sourceName?: string;
  rating?: number;
  aggregateText?: string;
  proofIndex: number;
  strengthReason: string;
};

export type MotionStoryAdScene = AdSceneBase<
  "motion-story",
  AdSceneStyleBase,
  {
    preset: "motion-story-product";
    durationMs: 20000;
    product: MotionStoryProduct;
    proof: MotionStoryProof;
    beats: [
      MotionStoryBeat & { role: "hook"; motion: "kinetic-reveal"; startMs: 0; endMs: 3000 },
      MotionStoryBeat & { role: "product"; motion: "image-expand"; startMs: 3000; endMs: 8000 },
      MotionStoryBeat & { role: "proof"; motion: "proof-card"; startMs: 8000; endMs: 16000 },
      MotionStoryBeat & { role: "cta"; motion: "cta-slam"; startMs: 16000; endMs: 20000 },
    ];
    brandLockup: {
      logoUrl?: string;
      fallbackText: string;
    };
    musicBed: {
      id: MotionStoryMusicBedId;
      src: string;
      volume: 0.18;
      loop: true;
    };
    shareCopy: string;
  }
>;

export type ThreeDBreakdownScriptBeatRole = "consequence" | "context" | "mechanism" | "revelation" | "punchline";
export type ThreeDBreakdownShotRole = "consequence" | "mechanism" | "revelation";
export type ThreeDBreakdownMediaStatus = "idle" | "generating" | "ready" | "failed";
export type ThreeDBreakdownEvidenceUseType = "feature" | "mechanism" | "offer" | "review" | "material" | "process" | "guarantee" | "shipping" | "proof" | "category" | "claim";
export type ThreeDBreakdownRevealPattern = "exploded-product" | "xray-cutaway" | "chaos-to-order" | "physicalized-ui" | "invisible-problem" | "miniature-world" | "process-pipeline" | "before-after-reconstruction" | "impact-chain";
export type ThreeDBreakdownPrimarySiteType = "ecommerce" | "saas" | "local-service" | "restaurant-food" | "nonprofit" | "portfolio" | "unclear";
export type ThreeDBreakdownRiskFlag = "health" | "medical" | "legal" | "financial" | "beauty" | "regulated";
export type ThreeDBreakdownClaimRisk = "low" | "medium" | "high";
export type ThreeDBreakdownVisualStyle = "toy-character-vsl" | "presenter-teardown-vsl";
export type ThreeDBreakdownClipIndex = 1 | 2 | 3 | 4;
export type ThreeDBreakdownStoryboardFrameIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type ThreeDBreakdownScriptBeat = {
  role: ThreeDBreakdownScriptBeatRole;
  narration: string;
  startMs: number;
  endMs: number;
};

export type ThreeDBreakdownMediaRef = {
  status: ThreeDBreakdownMediaStatus;
  providerJobId?: string;
  url?: string;
  storageId?: string;
  mimeType?: string;
  error?: string;
};

export type ThreeDBreakdownShot = {
  shotIndex: 1 | 2 | 3;
  role: ThreeDBreakdownShotRole;
  captionText: string;
  sceneDescription: string;
  explainerDevice: string;
  physicalAction: string;
  imagePrompt: string;
  animationPrompt: string;
  image?: ThreeDBreakdownMediaRef;
  video?: ThreeDBreakdownMediaRef;
};

export type ThreeDBreakdownStoryboardBoard = {
  frameCount: 6;
  imagePrompt: string;
  creativePrompt?: string;
  image?: ThreeDBreakdownMediaRef;
  frames?: Array<{
    frameIndex: 1 | 2 | 3 | 4 | 5 | 6;
    role: "problem" | "escalation" | "mechanism-setup" | "wow-reveal" | "payoff" | "final-state";
    label: string;
    visual?: string;
    camera?: string;
    motion?: string;
    anchorPrompt?: string;
    overlayText?: string;
    editingNote?: string;
    image?: ThreeDBreakdownMediaRef;
  }>;
};

export type ThreeDBreakdownClipPlan = {
  clipIndex: ThreeDBreakdownClipIndex;
  label: string;
  startMs: number;
  endMs: number;
  durationSeconds: number;
  frameIndexes: ThreeDBreakdownStoryboardFrameIndex[];
  prompt: string;
  endFrameImage?: ThreeDBreakdownMediaRef;
  video?: ThreeDBreakdownMediaRef;
};

export type ThreeDBreakdownFinalVideo = ThreeDBreakdownMediaRef & {
  durationMs?: number;
};

export type ThreeDBreakdownProductAnchor = {
  title: string;
  url: string;
  imageUrl: string;
  imageAlt: string | null;
};

export type ThreeDBreakdownAdScene = AdSceneBase<
  "three-d-breakdown",
  AdSceneStyleBase,
  {
    preset: "three-d-breakdown";
    durationMs: number;
    scriptBeats: [
      ThreeDBreakdownScriptBeat & { role: "consequence" },
      ThreeDBreakdownScriptBeat & { role: "context" },
      ThreeDBreakdownScriptBeat & { role: "mechanism" },
      ThreeDBreakdownScriptBeat & { role: "revelation" },
      ThreeDBreakdownScriptBeat & { role: "punchline" },
    ];
    shots: [
      ThreeDBreakdownShot & { shotIndex: 1; role: "consequence" },
      ThreeDBreakdownShot & { shotIndex: 2; role: "mechanism" },
      ThreeDBreakdownShot & { shotIndex: 3; role: "revelation" },
    ];
    musicBed?: {
      id: "polished-upbeat" | "warm-premium" | "playful-retail";
      src: string;
      volume: 0.12;
      loop: true;
    };
    storyboardBoard?: ThreeDBreakdownStoryboardBoard;
    clipPlans?: ThreeDBreakdownClipPlan[];
    referenceImages?: {
      productImageUrls: string[];
      brandImageUrls: string[];
    };
    productAnchor?: ThreeDBreakdownProductAnchor;
    finalVideo?: ThreeDBreakdownFinalVideo;
    storyContract: {
      storySubject?: ThreeDBreakdownStorySubject;
      visualStyle: ThreeDBreakdownVisualStyle;
      primarySiteType: ThreeDBreakdownPrimarySiteType;
      riskFlags: ThreeDBreakdownRiskFlag[];
      visualWorld: string;
      lighting: string;
      cameraStyle: string;
      recurringObjects: string[];
      variantAngle: string;
      customerProblem: string;
      mechanismSummary: string;
      visualMetaphor: string;
      referenceScript?: string;
      ctaLine?: string;
      evidenceIndex: number;
      evidenceUseType: ThreeDBreakdownEvidenceUseType;
      wowMomentType: ThreeDBreakdownRevealPattern;
      wowMoment: string;
      viewerLearns: string;
      claimRisk: ThreeDBreakdownClaimRisk;
      claimRiskReason: string;
    };
    groundedEvidence: {
      evidenceIndex: number;
      type: "review" | "product" | "claim" | "guarantee" | "result" | "shipping" | "site-language";
      evidenceUseType: ThreeDBreakdownEvidenceUseType;
      text: string;
      sourceUrl: string;
      scrapedAt: number;
      sourceName?: string;
      visualPotentialScore?: number;
      whyVisual?: string;
      possibleRevealPatterns?: ThreeDBreakdownRevealPattern[];
    };
  }
>;

export type StaticLayerBinding = "fixed" | "brand" | "campaign" | "proof" | "locked";

export type StaticLayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  binding: StaticLayerBinding;
  semanticRole: string;
};

export type StaticTextLayer = StaticLayerBase & {
  type: "text";
  text: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
};

export type StaticImageLayer = StaticLayerBase & {
  type: "image";
  src: string;
  alt: string;
  objectFit: "contain" | "cover" | "fill";
  borderRadius: number;
  fixedFrame?: boolean;
};

export type StaticShapeLayer = StaticLayerBase & {
  type: "shape";
  shape: "rectangle" | "ellipse";
  fill: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
};

export type StaticGroupLayer = StaticLayerBase & {
  type: "group";
  children: StaticAdLayer[];
};

export type StaticAdLayer = StaticTextLayer | StaticImageLayer | StaticShapeLayer | StaticGroupLayer;

export type StaticPackageAdScene = AdSceneBase<
  "static-package",
  AdSceneStyleBase,
  {
    preset: "static-package";
    canvas: {
      width: number;
      height: number;
      backgroundColor: string;
    };
    layers: StaticAdLayer[];
  }
>;

export type TalkingFishNewsBeat = {
  line: string;
  proofSrc: string;
  startMs: number;
  endMs: number;
};

export type TalkingFishNewsProofScene = AdSceneBase<
  "talking-fish-news",
  AdSceneStyleBase,
  {
    preset: "talking-fish-news-report";
    durationMs: number;
    stationName: string;
    anchorOpenImageSrc: string;
    anchorClosedImageSrc: string;
    speechSegments: Array<{ startMs: number; endMs: number }>;
    musicBed: {
      src: string;
      volume: 0.11;
      loop: true;
    };
    linkText: string;
    beats: [
      TalkingFishNewsBeat,
      TalkingFishNewsBeat,
      TalkingFishNewsBeat,
      TalkingFishNewsBeat,
    ];
  }
>;

export type MyPixarStoryAdSceneLayout = {
  preset: "my-pixar-story-memoir";
  storyboard: MyPixarStoryStoryboard;
  activeClipUrls?: string[];
  activeKeyframeUrls?: string[];
  musicAudioUrl?: string;
  voiceoverAudioUrl?: string;
};

export type MyPixarStoryAdScene = AdSceneBase<
  "my-pixar-story",
  AdSceneStyleBase,
  MyPixarStoryAdSceneLayout
>;

export type AdScene =
  | VisualizerAdScene
  | MemeAdScene
  | WereSorryAdScene
  | VideoMemeAdScene
  | JingleAdScene
  | TextMessageAdScene
  | BrainrotAdScene
  | ReviewsAdScene
  | MotionStoryAdScene
  | ThreeDBreakdownAdScene;

export type RenderableAdScene =
  | AdScene
  | StaticPackageAdScene
  | TalkingFishNewsProofScene
  | LegoMusicVideoAdScene
  | MyPixarStoryAdScene;
