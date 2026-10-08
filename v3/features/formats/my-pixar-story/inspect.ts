/**
 * My Pixar Story — Media Quality Inspection & Production Receipts
 *
 * Implements:
 * 1. 5-frame contact sheet inspection & character DNA continuity verification.
 * 2. Audio narration continuity & pacing validation (preventing dead-air or clipping).
 * 3. Formal production audit receipt generation with SHA-256 checksums.
 */

import crypto from "node:crypto";
import type { MyPixarStoryAdScene } from "../../scene/types";
import type { StoryBeatNumber } from "./types";

export interface QualityIssue {
  severity: "error" | "warning";
  beatNumber?: StoryBeatNumber;
  message: string;
}

export interface MediaInspectionResult {
  passed: boolean;
  contactSheetVerified: boolean;
  audioContinuityPassed: boolean;
  characterDnaConsistent: boolean;
  issues: QualityIssue[];
}

export interface ProductionReceiptBeat {
  beatNumber: StoryBeatNumber;
  title: string;
  ageLabel: string;
  narrationWordCount: number;
  hasVisualAsset: boolean;
  hasNarration: boolean;
  qualityStatus: "passed" | "warning";
}

export interface MyPixarStoryProductionReceipt {
  receiptVersion: "1.0.0";
  format: "my-pixar-story";
  productionId: string;
  timestamp: string;
  subjectName: string;
  recipientName: string;
  tone: string;
  totalDurationSeconds: number;
  sceneCount: 5;
  tier: "draft_building_480p" | "checkout_final_1080p";
  models: {
    audio: "cartesia-sonic";
    video: "seadance-2.0-mini" | "seadance-2.5";
    image: string;
    resolution: "480p" | "1080p";
  };
  beats: [
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat
  ];
  mediaVerification: {
    contactSheetReady: boolean;
    audioContinuityPassed: boolean;
    characterDnaConsistent: boolean;
  };
  checksum: string;
}

/**
 * Inspects a MyPixarStoryAdScene for visual continuity, contact sheet completeness,
 * and narration pacing.
 */
export function inspectMediaQuality(scene: MyPixarStoryAdScene): MediaInspectionResult {
  const issues: QualityIssue[] = [];
  const storyboard = scene.layout.storyboard;

  if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length !== 5) {
    issues.push({
      severity: "error",
      message: `Invalid storyboard structure: expected 5 scenes, found ${storyboard?.scenes?.length ?? 0}.`,
    });
    return {
      passed: false,
      contactSheetVerified: false,
      audioContinuityPassed: false,
      characterDnaConsistent: false,
      issues,
    };
  }

  // 1. Character DNA Continuity Verification
  let characterDnaConsistent = true;
  const compiledDna = storyboard.compiledCharacterDna.toLowerCase();

  storyboard.scenes.forEach((s, idx) => {
    const beat = (idx + 1) as StoryBeatNumber;
    const prompt = s.characterDnaAgePrompt.toLowerCase();
    
    // Check that Pixar style signature is present
    if (!s.seaDanceVideoPrompt.includes("feature-quality 3D animated film") && !s.seaDanceVideoPrompt.includes("Pixar 3D animated film")) {
      characterDnaConsistent = false;
      issues.push({
        severity: "error",
        beatNumber: beat,
        message: `Scene ${beat} video prompt is missing the mandatory Pixar 3D animated aesthetic tag.`,
      });
    }

    // Check that core subject reference is preserved
    if (!prompt.includes(storyboard.subjectName.toLowerCase()) && !s.seaDanceVideoPrompt.toLowerCase().includes(storyboard.subjectName.toLowerCase())) {
      characterDnaConsistent = false;
      issues.push({
        severity: "warning",
        beatNumber: beat,
        message: `Scene ${beat} does not explicitly reference subject name '${storyboard.subjectName}'.`,
      });
    }
  });

  // 2. Audio Continuity & Pacing Verification
  let audioContinuityPassed = true;
  storyboard.scenes.forEach((s, idx) => {
    const beat = (idx + 1) as StoryBeatNumber;
    const words = s.narrationScript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Normal speech rate is ~2.5 words per second.
    // In a 13-second scene, ideal range is 20 to 45 words.
    if (wordCount < 10) {
      audioContinuityPassed = false;
      issues.push({
        severity: "warning",
        beatNumber: beat,
        message: `Scene ${beat} narration is very short (${wordCount} words), risking >5s of dead air silence.`,
      });
    } else if (wordCount > 55) {
      audioContinuityPassed = false;
      issues.push({
        severity: "warning",
        beatNumber: beat,
        message: `Scene ${beat} narration is unusually long (${wordCount} words), which may cause audio clipping.`,
      });
    }
  });

  // 3. Contact Sheet / Visual Asset Verification
  const clips = scene.layout.activeClipUrls;
  const keyframes = scene.layout.activeKeyframeUrls;
  let contactSheetVerified = false;

  if (clips && clips.length === 5 && clips.every((c) => Boolean(c?.trim()))) {
    contactSheetVerified = true;
  } else if (keyframes && keyframes.length === 5 && keyframes.every((k) => Boolean(k?.trim()))) {
    contactSheetVerified = true;
  } else {
    // If not all 5 are present, note as warning (draft stage before full render)
    issues.push({
      severity: "warning",
      message: "Contact sheet incomplete: activeClipUrls or activeKeyframeUrls does not have all 5 items.",
    });
  }

  const hasFatalErrors = issues.some((i) => i.severity === "error");

  return {
    passed: !hasFatalErrors,
    contactSheetVerified,
    audioContinuityPassed,
    characterDnaConsistent,
    issues,
  };
}

/**
 * Generates an official SHA-256 audited production receipt for the Pixar Story cut.
 */
export function generateProductionReceipt(options: {
  scene: MyPixarStoryAdScene;
  isCheckoutExport?: boolean;
  imageModel?: string;
}): MyPixarStoryProductionReceipt {
  const { scene, isCheckoutExport = false, imageModel } = options;
  const storyboard = scene.layout.storyboard;
  const inspection = inspectMediaQuality(scene);

  const tier: MyPixarStoryProductionReceipt["tier"] = isCheckoutExport
    ? "checkout_final_1080p"
    : "draft_building_480p";

  const videoModel = isCheckoutExport ? "seadance-2.5" : "seadance-2.0-mini";
  const resolution = isCheckoutExport ? "1080p" : "480p";
  const resolvedImageModel = imageModel ?? storyboard.imageModel ?? "meta/muse-image-1.0";

  const beats = storyboard.scenes.map((s, idx) => {
    const beatNumber = (idx + 1) as StoryBeatNumber;
    const wordCount = s.narrationScript.trim().split(/\s+/).filter(Boolean).length;
    const hasVisual = Boolean(
      scene.layout.activeClipUrls?.[idx] || scene.layout.activeKeyframeUrls?.[idx]
    );
    const hasWarning = inspection.issues.some(
      (issue) => issue.beatNumber === beatNumber && issue.severity === "warning"
    );

    return {
      beatNumber,
      title: s.beatTitle,
      ageLabel: s.ageLabel,
      narrationWordCount: wordCount,
      hasVisualAsset: hasVisual,
      hasNarration: Boolean(s.narrationScript.trim()),
      qualityStatus: hasWarning ? ("warning" as const) : ("passed" as const),
    };
  }) as [
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat,
    ProductionReceiptBeat
  ];

  const productionId = `pixar-prod-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
  const timestamp = new Date().toISOString();

  // Create deterministic SHA-256 fingerprint of the storyboard, script, and config
  const receiptPayloadForChecksum = {
    productionId,
    subject: storyboard.subjectName,
    recipient: storyboard.recipientName,
    tone: storyboard.tone,
    duration: storyboard.totalDurationSeconds,
    tier,
    imageModel: resolvedImageModel,
    scripts: storyboard.scenes.map((s) => s.narrationScript),
    prompts: storyboard.scenes.map((s) => s.seaDanceVideoPrompt),
  };

  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(receiptPayloadForChecksum))
    .digest("hex");

  return {
    receiptVersion: "1.0.0",
    format: "my-pixar-story",
    productionId,
    timestamp,
    subjectName: storyboard.subjectName,
    recipientName: storyboard.recipientName,
    tone: storyboard.tone,
    totalDurationSeconds: storyboard.totalDurationSeconds,
    sceneCount: 5,
    tier,
    models: {
      audio: "cartesia-sonic",
      video: videoModel,
      image: resolvedImageModel,
      resolution,
    },
    beats,
    mediaVerification: {
      contactSheetReady: inspection.contactSheetVerified,
      audioContinuityPassed: inspection.audioContinuityPassed,
      characterDnaConsistent: inspection.characterDnaConsistent,
    },
    checksum,
  };
}
