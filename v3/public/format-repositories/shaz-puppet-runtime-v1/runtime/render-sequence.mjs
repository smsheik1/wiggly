import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { execute, sha256, validateRun, writeJson } from "./run-common.mjs";
import { renderRigFrame } from "./rig-v2-renderer.mjs";
import { renderMultiShot } from "./render-multi-shot.mjs";
import { createPoseRuntime } from "./pose-recipe.mjs";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const PERFORMANCE_STAGE_VIEW = Object.freeze({ scale: 1.33, offset: [0.12, 0.142] });

function performancePoseRuntime(manifest, pose) {
  if (pose.id === "phone-use-sequence") {
    if (!pose._performanceRuntime) {
      const normalizedRecipe = {
        ...pose.recipe,
        controls: {
          ...pose.recipe.controls,
          "Shaz_Master-P": pose.recipe.controls["Shaz_Master-P"].map((key) => ({
            ...key,
            scale: [key.scale[0] / 0.86, key.scale[1] / 0.86],
            position: [key.position[0], key.position[1] - 0.12, key.position[2]],
          })),
        },
      };
      pose._performanceRuntime = createPoseRuntime(manifest, normalizedRecipe);
    }
    return pose._performanceRuntime;
  }
  return pose.poseRuntime;
}

function stepForPerformanceFrame(timeline, outputFrame) {
  const event = timeline.events.find(({ startFrame, endFrameExclusive }) => (
    outputFrame >= startFrame && outputFrame < endFrameExclusive
  ));
  if (!event) {
    return {
      event: null,
      step: timeline.packetRegistry?.neutralPacket?.path?.hold,
    };
  }
  const localFrame = outputFrame - event.startFrame;
  if (localFrame < event.packet.path.entry.length) {
    return { event, step: event.packet.path.entry[localFrame], phase: "entry" };
  }
  const holdOffset = localFrame - event.packet.path.entry.length;
  if (holdOffset < event.holdFrames) {
    return { event, step: event.packet.path.hold, phase: "hold" };
  }
  return {
    event,
    step: event.packet.path.release[holdOffset - event.holdFrames],
    phase: "release",
  };
}

async function renderPerformance({ root, runDirectory, validated }) {
  const output = path.join(runDirectory, "final.mp4");
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-performance-"));
  const assetCache = new Map();
  const propCache = new Map();
  const frameCache = new Map();
  const receiptCache = new Map();
  const background = await sharp(validated.backgroundPath)
    .resize(1280, 720, { fit: "fill" })
    .png()
    .toBuffer();
  try {
    for (let outputFrame = 0; outputFrame < validated.timeline.durationFrames; outputFrame += 1) {
      const selected = stepForPerformanceFrame({
        ...validated.timeline,
        packetRegistry: validated.packetRegistry,
      }, outputFrame);
      if (!selected.step) throw new Error(`performance frame ${outputFrame} has no neutral or event step`);
      const cacheKey = `${selected.step.poseId}:${selected.step.poseFrame}`;
      let composed = frameCache.get(cacheKey);
      if (!composed) {
        const pose = validated.registry.byId.get(selected.step.poseId);
        if (!pose) throw new Error(`performance frame references unknown pose ${selected.step.poseId}`);
        const rendered = await renderRigFrame({
          manifest: validated.manifest,
          frame: selected.step.poseFrame,
          assetRoot: path.join(root, "rig-v2", "assets"),
          propRoot: path.join(root, "assets", "props"),
          assetCache,
          propCache,
          poseRuntime: performancePoseRuntime(validated.manifest, pose),
          background: TRANSPARENT,
          stageView: PERFORMANCE_STAGE_VIEW,
        });
        composed = await sharp(background)
          .composite([{ input: rendered.buffer }])
          .png()
          .toBuffer();
        frameCache.set(cacheKey, composed);
        receiptCache.set(cacheKey, {
          sourceXstageSha256: rendered.receipt.sourceXstageSha256,
          artistRenderedFramesUsed: rendered.receipt.artistRenderedFramesUsed,
          layerCount: rendered.receipt.layers.length,
          propCount: rendered.receipt.props.length,
        });
      }
      await fs.writeFile(
        path.join(scratch, `frame-${String(outputFrame + 1).padStart(6, "0")}.png`),
        composed,
      );
    }
    execute("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-framerate", "24",
      "-i", path.join(scratch, "frame-%06d.png"),
      "-i", validated.audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
      "-pix_fmt", "yuv420p", "-r", "24",
      "-c:a", "aac", "-b:a", "192k",
      "-t", validated.timeline.audioDurationSeconds.toFixed(6),
      "-movflags", "+faststart",
      output,
    ]);
    const report = {
      schemaVersion: 2,
      status: "rendered",
      mode: "body-language-performance",
      renderedAt: new Date().toISOString(),
      inputSha256: validated.receipt.inputSha256,
      audioSha256: validated.receipt.audio.sha256,
      background: validated.receipt.background,
      ...(validated.receipt.transcript ? { transcript: validated.receipt.transcript } : {}),
      sourceXstageSha256: validated.receipt.sourceXstageSha256,
      artistRenderedFramesUsed: false,
      renderer: "runtime/rig-v2-renderer.mjs#renderRigFrame",
      compositor: "runtime/render-sequence.mjs#renderPerformance",
      cameraMotion: false,
      stageView: PERFORMANCE_STAGE_VIEW,
      finalVideo: "final.mp4",
      outputSha256: await sha256(output),
      totalFrames: validated.timeline.durationFrames,
      durationSeconds: validated.timeline.durationSeconds,
      audioDurationSeconds: validated.timeline.audioDurationSeconds,
      uniqueRigStates: frameCache.size,
      usedRigStates: [...receiptCache].map(([key, receipt]) => ({ key, ...receipt })),
      events: validated.timeline.events.map((event) => ({
        index: event.index,
        packetId: event.packetId,
        outputStartFrame: event.startFrame + 1,
        apexFrame: event.holdStartFrame + 1,
        outputEndFrame: event.endFrameExclusive,
        entryFrames: event.packet.path.entry.length,
        holdFrames: event.holdFrames,
        releaseFrames: event.packet.path.release.length,
        anchor: event.anchor,
        intent: event.intent,
        rationale: event.rationale,
      })),
      providerCalls: 0,
      cost: "$0",
    };
    await writeJson(path.join(runDirectory, "render-report.json"), report);
    return { output, report };
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

async function renderSequence({ root, runDirectory }) {
  const validated = await validateRun({ root, runDirectory });
  if (validated.mode === "performance") {
    return renderPerformance({ root, runDirectory, validated });
  }
  if (validated.mode === "multi-shot") {
    return renderMultiShot({ root, runDirectory, validated });
  }
  const isAudioSequence = validated.mode === "audio-sequence";
  const output = path.join(runDirectory, "final.mp4");
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-sequence-"));
  const assetCache = new Map();
  const propCache = new Map();
  const frameCache = new Map();
  const segments = [];
  const canvasFrame = isAudioSequence
    ? await sharp(validated.backgroundPath).resize(1280, 720, { fit: "fill" }).png().toBuffer()
    : await sharp({
      create: { width: 1280, height: 720, channels: 4, background: "#ffffff" },
    }).png().toBuffer();
  let outputFrame = 0;
  try {
    async function renderAudioBodyFrame(entry, recipeFrame, globalFrame) {
      const mouthDrawing = validated.lipSync?.frameDrawings[globalFrame] ?? null;
      const cacheKey = `${entry.poseId}:${recipeFrame}:mouth-${mouthDrawing ?? "source"}`;
      if (!frameCache.has(cacheKey)) {
        const rendered = await renderRigFrame({
          manifest: validated.manifest,
          frame: recipeFrame,
          assetRoot: path.join(root, "rig-v2", "assets"),
          propRoot: path.join(root, "assets", "props"),
          assetCache,
          propCache,
          poseRuntime: entry.pose.poseRuntime,
          background: TRANSPARENT,
          stageView: PERFORMANCE_STAGE_VIEW,
          mouthDrawing,
        });
        const buffer = await sharp(canvasFrame)
          .composite([{ input: rendered.buffer }])
          .png()
          .toBuffer();
        frameCache.set(cacheKey, { buffer, receipt: rendered.receipt });
      }
      return frameCache.get(cacheKey);
    }

    for (const entry of validated.timeline.entries) {
      const startFrame = outputFrame + 1;
      let lastBuffer = null;
      let firstReceipt = null;
      let lastReceipt = null;
      for (let recipeFrame = 1; recipeFrame <= entry.pose.recipe.durationFrames; recipeFrame += 1) {
        const rendered = isAudioSequence
          ? await renderAudioBodyFrame(entry, recipeFrame, outputFrame)
          : await renderRigFrame({
            manifest: validated.manifest,
            frame: recipeFrame,
            assetRoot: path.join(root, "rig-v2", "assets"),
            propRoot: path.join(root, "assets", "props"),
            assetCache,
            propCache,
            poseRuntime: entry.pose.poseRuntime,
          });
        outputFrame += 1;
        lastBuffer = rendered.buffer;
        firstReceipt ??= rendered.receipt;
        lastReceipt = rendered.receipt;
        await fs.writeFile(path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`), lastBuffer);
      }
      for (let frame = 0; frame < entry.holdFrames; frame += 1) {
        if (isAudioSequence && validated.lipSync) {
          const rendered = await renderAudioBodyFrame(
            entry,
            entry.pose.recipe.durationFrames,
            outputFrame,
          );
          lastBuffer = rendered.buffer;
          lastReceipt = rendered.receipt;
        }
        outputFrame += 1;
        await fs.writeFile(path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`), lastBuffer);
      }
      for (let frame = 0; frame < entry.gapFrames; frame += 1) {
        outputFrame += 1;
        await fs.writeFile(path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`), canvasFrame);
      }
      segments.push({
        index: entry.index,
        poseId: entry.poseId,
        recipeFrames: entry.pose.recipe.durationFrames,
        holdFrames: entry.holdFrames,
        gapFrames: entry.gapFrames,
        outputStartFrame: startFrame,
        outputEndFrame: outputFrame,
        poseRecipeSha256: entry.pose.poseRuntime.recipeSha256,
        firstFrameReceipt: {
          sourceXstageSha256: firstReceipt.sourceXstageSha256,
          artistRenderedFramesUsed: firstReceipt.artistRenderedFramesUsed,
          layerCount: firstReceipt.layers.length,
          propCount: firstReceipt.props.length,
          ...(firstReceipt.mouthDrawingOverride
            ? { mouthDrawingOverride: firstReceipt.mouthDrawingOverride }
            : {}),
        },
        lastFrameReceipt: {
          sourceXstageSha256: lastReceipt.sourceXstageSha256,
          artistRenderedFramesUsed: lastReceipt.artistRenderedFramesUsed,
          layerCount: lastReceipt.layers.length,
          propCount: lastReceipt.props.length,
          ...(lastReceipt.mouthDrawingOverride
            ? { mouthDrawingOverride: lastReceipt.mouthDrawingOverride }
            : {}),
        },
      });
    }
    if (outputFrame !== validated.timeline.totalFrames) {
      throw new Error(`renderer wrote ${outputFrame} frames, expected ${validated.timeline.totalFrames}`);
    }
    const ffmpegArgs = [
      "-hide_banner", "-loglevel", "error", "-y",
      "-framerate", "24",
      "-i", path.join(scratch, "frame-%06d.png"),
    ];
    if (isAudioSequence) {
      ffmpegArgs.push(
        "-i", validated.audioPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", "24",
        "-c:a", "aac", "-b:a", "192k",
        "-t", validated.receipt.audio.durationSeconds.toFixed(6),
        "-movflags", "+faststart",
      );
    } else {
      ffmpegArgs.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
    }
    ffmpegArgs.push(output);
    execute("ffmpeg", ffmpegArgs);
    const report = {
      schemaVersion: isAudioSequence ? 2 : 1,
      status: "rendered",
      ...(isAudioSequence ? { mode: "audio-backed-sequence" } : {}),
      renderedAt: new Date().toISOString(),
      inputSha256: validated.receipt.inputSha256,
      sourceXstageSha256: validated.receipt.sourceXstageSha256,
      artistRenderedFramesUsed: false,
      renderer: "runtime/rig-v2-renderer.mjs#renderRigFrame",
      finalVideo: "final.mp4",
      outputSha256: await sha256(output),
      totalFrames: outputFrame,
      durationSeconds: outputFrame / 24,
      ...(validated.timeline.sequencePreset
        ? { sequencePreset: validated.timeline.sequencePreset }
        : {}),
      segments,
      ...(isAudioSequence ? {
        audioSha256: validated.receipt.audio.sha256,
        background: validated.receipt.background,
        ...(validated.receipt.transcript ? { transcript: validated.receipt.transcript } : {}),
        cameraMotion: false,
        stageView: PERFORMANCE_STAGE_VIEW,
        mouthMode: "source-pose-drawings; lip-sync not attempted",
        ...(validated.lipSync ? {
          mouthMode: "cherry-tsv-shaz-five-mouth-v1",
          lipSync: validated.receipt.lipSync,
        } : {}),
      } : {}),
      providerCalls: 0,
      cost: "$0",
    };
    await writeJson(path.join(runDirectory, "render-report.json"), report);
    return { output, report };
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

export { PERFORMANCE_STAGE_VIEW, performancePoseRuntime, renderSequence };
