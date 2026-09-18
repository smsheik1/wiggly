import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { execute, sha256, writeJson } from "./run-common.mjs";
import { renderRigFrame } from "./rig-v2-renderer.mjs";
import { renderTextCardFrame, wordsVisibleAtFrame } from "./text-card-renderer.mjs";
import { renderTopicCard } from "./topic-card-renderer.mjs";
import { renderKenBurnsFrame } from "./broll-renderer.mjs";
import { PERFORMANCE_STAGE_VIEW } from "./render-sequence.mjs";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export async function renderMultiShot({ root, runDirectory, validated }) {
  const output = path.join(runDirectory, "final.mp4");
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-multi-shot-"));

  const assetCache = new Map();
  const propCache = new Map();
  const frameCache = new Map();
  const bgCache = new Map();

  const neutralPose = validated.registry.byId.get("neutral-listening");
  if (!neutralPose) throw new Error("neutral-listening pose is required for talk-to-camera shots");

  const neutralFrame = neutralPose.recipe.durationFrames; // Hold frame

  // Pre-load background buffers
  for (const bg of validated.assets.backgrounds ?? []) {
    const bgPath = path.resolve(root, bg.path);
    const buffer = await sharp(bgPath).resize(1280, 720, { fit: "fill" }).png().toBuffer();
    bgCache.set(bg.id, buffer);
  }

  let outputFrame = 0;
  const shotReports = [];

  try {
    for (const shot of validated.timeline.shots) {
      const bgBuffer = bgCache.get(shot.backgroundId);
      if (!bgBuffer) throw new Error(`background ${shot.backgroundId} not loaded`);

      if (shot.shotType === "text-card") {
        // Count words in text
        const wordsInText = (shot.text.match(/\S+/g) || []).length;
        const textFrameCache = new Map();

        // Check if transcript has matching words for this time window to get exact frame pop-ins
        let wordFrames = null;
        if (validated.transcription?.transcript?.words) {
          const shotStartMs = (shot.startFrame / 24) * 1000;
          const shotEndMs = (shot.endFrameExclusive / 24) * 1000;
          const matchedWords = validated.transcription.transcript.words.filter(
            (w) => w.startMs >= shotStartMs - 100 && w.startMs < shotEndMs + 100,
          );
          if (matchedWords.length === wordsInText) {
            wordFrames = matchedWords.map((w) => Math.max(0, Math.round((w.startMs - shotStartMs) * 24 / 1000)));
          }
        }

        for (let f = 0; f < shot.durationFrames; f += 1) {
          const wordsVisible = wordsVisibleAtFrame({
            totalWords: wordsInText,
            localFrame: f,
            durationFrames: shot.durationFrames,
            wordFrames,
          });

          let textBuffer = textFrameCache.get(wordsVisible);
          if (!textBuffer) {
            textBuffer = await renderTextCardFrame({
              backgroundBuffer: bgBuffer,
              text: shot.text,
              highlights: shot.highlights,
              wordLimit: wordsVisible,
              width: 1280,
              height: 720,
            });
            textFrameCache.set(wordsVisible, textBuffer);
          }

          outputFrame += 1;
          await fs.writeFile(
            path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`),
            textBuffer,
          );
        }

        shotReports.push({
          id: shot.id,
          shotType: shot.shotType,
          outputStartFrame: shot.startFrame + 1,
          outputEndFrame: shot.endFrameExclusive,
          durationFrames: shot.durationFrames,
          text: shot.text,
          highlights: shot.highlights,
          backgroundId: shot.backgroundId,
        });

      } else if (shot.shotType === "talk-to-camera") {
        const poseId = shot.poseId ?? "neutral-listening";
        const pose = validated.registry.byId.get(poseId) ?? neutralPose;
        const holdFrame = pose.recipe.durationFrames; // Apex / hold frame of the pose

        // Render chosen pose with Cherry mouth sync for each frame in this range
        for (let f = 0; f < shot.durationFrames; f += 1) {
          const globalFrame = shot.startFrame + f;
          const mouthDrawing = validated.lipSync?.frameDrawings[globalFrame] ?? null;
          const cacheKey = `${poseId}:${mouthDrawing ?? "source"}`;

          let composedBuffer;
          if (frameCache.has(cacheKey)) {
            composedBuffer = frameCache.get(cacheKey);
          } else {
            const rendered = await renderRigFrame({
              manifest: validated.manifest,
              frame: holdFrame,
              assetRoot: path.join(root, "rig-v2", "assets"),
              propRoot: path.join(root, "assets", "props"),
              assetCache,
              propCache,
              poseRuntime: pose.poseRuntime,
              background: TRANSPARENT,
              stageView: PERFORMANCE_STAGE_VIEW,
              mouthDrawing,
            });

            composedBuffer = await sharp(bgBuffer)
              .composite([{ input: rendered.buffer }])
              .png()
              .toBuffer();

            frameCache.set(cacheKey, composedBuffer);
          }

          outputFrame += 1;
          await fs.writeFile(
            path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`),
            composedBuffer,
          );
        }

        shotReports.push({
          id: shot.id,
          shotType: shot.shotType,
          outputStartFrame: shot.startFrame + 1,
          outputEndFrame: shot.endFrameExclusive,
          durationFrames: shot.durationFrames,
          poseId,
          backgroundId: shot.backgroundId,
        });

      } else if (shot.shotType === "chibi-commentary") {
        // Resolve topic media background
        let topicBgBuffer = bgBuffer;
        if (shot.card && typeof shot.card === "object") {
          // On-the-fly vector topic card generation
          let innerImageBuffer = null;
          if (shot.card.image) {
            const innerImagePath = path.resolve(runDirectory, shot.card.image);
            if (await fs.access(innerImagePath).then(() => true).catch(() => false)) {
              innerImageBuffer = await fs.readFile(innerImagePath);
            }
          }
          topicBgBuffer = await renderTopicCard({
            badge: shot.card.badge ?? "TOPIC",
            headline: shot.card.headline ?? "",
            quote: shot.card.quote ?? "",
            theme: shot.card.theme ?? "warm-red",
            icon: shot.card.icon ?? "trophy",
            innerImageBuffer,
            width: 1280,
            height: 720,
          });
        } else if (shot.topicMedia) {
          const topicMediaPath = path.resolve(runDirectory, shot.topicMedia);
          if (await fs.access(topicMediaPath).then(() => true).catch(() => false)) {
            topicBgBuffer = await sharp(topicMediaPath)
              .resize(1280, 720, { fit: "contain", background: { r: 24, g: 24, b: 27, alpha: 255 } })
              .png()
              .toBuffer();
          }
        }

        // Resolve chibi pose image paths
        // Classical Animation Timeline: Anticipation, Squash, Stretch, and Bouncy Pose Hopping
        // Extracted directly from the human animator's reference:
        // Transition frames (1-2 frames) provide squash & anticipation; hold frames deliver acting presence.
        const artistTimeline = [
          { file: "Timeline 1_0000In.png", frames: 2 }, // enter smear
          { file: "Timeline 1_0001.png", frames: 2 },   // squash / anticipation
          { file: "Timeline 1_0002.png", frames: 1 },   // settle
          { file: "Timeline 1_0003x.png", weight: 35 }, // hold 1: talk gesture
          { file: "Timeline 1_0004x.png", frames: 2 },  // anticipation windup
          { file: "Timeline 1_0005.png", weight: 30 },  // hold 2: talk smile (presenting)
          { file: "Timeline 1_0006.png", frames: 2 },   // breakdown / head turn
          { file: "Timeline 1_0007x.png", frames: 2 },  // arm raise anticipation
          { file: "Timeline 1_0008.png", weight: 25 },  // hold 3: think chin
          { file: "Timeline 1_0009.png", frames: 2 },   // transition step
          { file: "Timeline 1_0010.png", frames: 2 },   // shrug step
          { file: "Timeline 1_0011.png", weight: 25 },  // hold 4: listen / smile side
          { file: "Timeline 1_0012.png", frames: 2 },   // point anticipation
          { file: "Timeline 1_0013.png", weight: 20 },  // hold 5: point side
          { file: "Timeline 1_0014.png", frames: 1 },   // exit windup
          { file: "Timeline 1_0015.png", frames: 2 },   // celebrate apex leap
          { file: "Timeline 1_0016.png", frames: 2 },   // exit smear
        ];

        // Cache all 17 raw chibi buffers composited over the topic background
        const chibiBufferMap = new Map();
        for (const item of artistTimeline) {
          if (!chibiBufferMap.has(item.file)) {
            const itemPath = path.resolve(root, "assets/chibi", item.file);
            const buf = await sharp(topicBgBuffer).composite([{ input: itemPath }]).png().toBuffer();
            chibiBufferMap.set(item.file, buf);
          }
        }

        // Build exact frame schedule scaled dynamically to shot.durationFrames
        const fixedFrames = artistTimeline.filter((k) => k.frames).reduce((acc, k) => acc + k.frames, 0);
        const holdWeightTotal = artistTimeline.filter((k) => k.weight).reduce((acc, k) => acc + k.weight, 0);
        const framesForHolds = Math.max(0, shot.durationFrames - fixedFrames);

        const schedule = [];
        let allocatedHolds = 0;
        const holdEntries = artistTimeline.filter((k) => k.weight);

        for (const item of artistTimeline) {
          if (item.frames) {
            for (let i = 0; i < item.frames; i += 1) schedule.push(item.file);
          } else if (item.weight) {
            const isLastHold = item === holdEntries.at(-1);
            let duration = Math.max(1, Math.round((item.weight / holdWeightTotal) * framesForHolds));
            if (isLastHold) {
              duration = Math.max(1, framesForHolds - allocatedHolds);
            } else {
              allocatedHolds += duration;
            }
            for (let i = 0; i < duration; i += 1) schedule.push(item.file);
          }
        }

        // Pad or trim if duration differs slightly due to rounding
        while (schedule.length < shot.durationFrames) {
          // Pad inside the middle hold
          schedule.splice(Math.floor(schedule.length / 2), 0, "Timeline 1_0005.png");
        }
        if (schedule.length > shot.durationFrames) {
          schedule.length = shot.durationFrames;
        }

        for (let f = 0; f < shot.durationFrames; f += 1) {
          outputFrame += 1;
          const chosenFile = schedule[f] ?? "Timeline 1_0005.png";
          const frameToUse = chibiBufferMap.get(chosenFile) ?? topicBgBuffer;

          await fs.writeFile(
            path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`),
            frameToUse,
          );
        }

        shotReports.push({
          id: shot.id,
          shotType: shot.shotType,
          outputStartFrame: shot.startFrame + 1,
          outputEndFrame: shot.endFrameExclusive,
          durationFrames: shot.durationFrames,
          chibiPose: shot.chibiPose,
          topicMedia: shot.topicMedia,
          backgroundId: shot.backgroundId,
        });

      } else if (shot.shotType === "b-roll") {
        // Resolve source broll media image buffer
        let sourceBrollBuffer = bgBuffer;
        if (shot.brollMedia) {
          const brollPath = path.resolve(runDirectory, shot.brollMedia);
          if (await fs.access(brollPath).then(() => true).catch(() => false)) {
            sourceBrollBuffer = await sharp(brollPath)
              .resize(1280, 720, { fit: "cover" })
              .png()
              .toBuffer();
          }
        }

        const motion = shot.motion ?? "zoom-in";
        for (let f = 0; f < shot.durationFrames; f += 1) {
          outputFrame += 1;
          const frameBuffer = await renderKenBurnsFrame({
            sourceBuffer: sourceBrollBuffer,
            sourceWidth: 1280,
            sourceHeight: 720,
            targetWidth: 1280,
            targetHeight: 720,
            motion,
            localFrame: f,
            durationFrames: shot.durationFrames,
          });

          await fs.writeFile(
            path.join(scratch, `frame-${String(outputFrame).padStart(6, "0")}.png`),
            frameBuffer,
          );
        }

        shotReports.push({
          id: shot.id,
          shotType: shot.shotType,
          outputStartFrame: shot.startFrame + 1,
          outputEndFrame: shot.endFrameExclusive,
          durationFrames: shot.durationFrames,
          brollMedia: shot.brollMedia,
          motion,
          backgroundId: shot.backgroundId,
        });
      }
    }

    // Collect SFX events across shot transitions
    const sfxPath = path.join(root, "assets", "audio", "sfx", "pop.wav");
    let hasSfxAsset = false;
    try {
      await fs.access(sfxPath);
      hasSfxAsset = true;
    } catch {
      hasSfxAsset = false;
    }

    const sfxTriggers = [];
    if (hasSfxAsset) {
      for (let i = 0; i < validated.timeline.shots.length; i += 1) {
        const shot = validated.timeline.shots[i];
        // Trigger pop at the start of every chibi-commentary or topic-card shot
        if (shot.shotType === "chibi-commentary" || shot.shotType === "text-card" || shot.card) {
          const timeMs = Math.round((shot.startFrame / 24) * 1000);
          if (timeMs >= 0) {
            sfxTriggers.push({ timeMs, shotId: shot.id, type: shot.shotType });
          }
        }
      }
    }

    // Encode to mp4 with ffmpeg and mix audio + SFX
    if (sfxTriggers.length > 0) {
      let filter = `[2:a]asplit=${sfxTriggers.length}`;
      filter += sfxTriggers.map((_, i) => `[p${i}]`).join("") + ";";
      sfxTriggers.forEach((trig, i) => {
        filter += `[p${i}]adelay=${trig.timeMs}|${trig.timeMs},volume=0.8[s${i}];`;
      });
      filter += "[1:a]" + sfxTriggers.map((_, i) => `[s${i}]`).join("") + `amix=inputs=${sfxTriggers.length + 1}:duration=first:dropout_transition=0:normalize=0[aout]`;

      execute("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", "24",
        "-i", path.join(scratch, "frame-%06d.png"),
        "-i", validated.audioPath,
        "-i", sfxPath,
        "-filter_complex", filter,
        "-map", "0:v:0",
        "-map", "[aout]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", "24",
        "-c:a", "aac", "-b:a", "192k",
        "-t", validated.timeline.audioDurationSeconds.toFixed(6),
        "-movflags", "+faststart",
        output,
      ]);
    } else {
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
    }

    const report = {
      schemaVersion: 2,
      status: "rendered",
      mode: "multi-shot-timeline",
      renderedAt: new Date().toISOString(),
      inputSha256: validated.receipt.inputSha256,
      audioSha256: validated.receipt.audio.sha256,
      sourceXstageSha256: validated.receipt.sourceXstageSha256,
      artistRenderedFramesUsed: false,
      renderer: "runtime/render-multi-shot.mjs#renderMultiShot",
      cameraMotion: false,
      stageView: PERFORMANCE_STAGE_VIEW,
      finalVideo: "final.mp4",
      outputSha256: await sha256(output),
      totalFrames: validated.timeline.totalFrames,
      durationSeconds: validated.timeline.durationSeconds,
      audioDurationSeconds: validated.timeline.audioDurationSeconds,
      shots: shotReports,
      ...(validated.receipt.transcript ? { transcript: validated.receipt.transcript } : {}),
      providerCalls: 0,
      cost: "$0",
    };

    await writeJson(path.join(runDirectory, "render-report.json"), report);
    return { output, report };

  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
