import path from "node:path";

import { inspectPose } from "./inspect-pose.mjs";
import { PERFORMANCE_STAGE_VIEW } from "./render-sequence.mjs";
import { execute, exists, readJson, sha256, validateRun, writeJson } from "./run-common.mjs";

function probeVideo(file) {
  const data = JSON.parse(execute("ffprobe", [
    "-v", "error", "-count_frames",
    "-show_entries", "stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration",
    "-of", "json", file,
  ]));
  const video = data.streams?.find((stream) => stream.codec_type === "video") ?? {};
  const audio = data.streams?.find((stream) => stream.codec_type === "audio") ?? null;
  return {
    ...video,
    duration: Number(data.format?.duration),
    audioCodec: audio?.codec_name ?? null,
  };
}

async function inspectRun({ root, runDirectory }) {
  const validated = await validateRun({ root, runDirectory });
  const isAudiovisual = validated.mode === "performance" || validated.mode === "audio-sequence" || validated.mode === "multi-shot";
  const finalVideo = path.join(runDirectory, "final.mp4");
  const renderReportPath = path.join(runDirectory, "render-report.json");
  if (!(await exists(finalVideo)) || !(await exists(renderReportPath))) {
    throw new Error("render the run before inspection");
  }
  const renderReport = await readJson(renderReportPath);
  const outputSha256 = await sha256(finalVideo);
  const failures = [];
  const expectedFrames = validated.mode === "performance"
    ? validated.timeline.durationFrames
    : validated.timeline.totalFrames;
  if (renderReport.inputSha256 !== validated.receipt.inputSha256) failures.push("render report input checksum is stale");
  if (renderReport.outputSha256 !== outputSha256) failures.push("render report output checksum is stale");
  if (renderReport.totalFrames !== expectedFrames) failures.push("render report frame count does not match validation");
  if (renderReport.artistRenderedFramesUsed !== false) failures.push("render report lost artist-frame exclusion provenance");
  if ((renderReport.sequencePreset ?? null) !== (validated.timeline.sequencePreset ?? null)) {
    failures.push("render report sequence preset provenance is stale");
  }

  const probe = probeVideo(finalVideo);
  if (probe.codec_name !== "h264") failures.push(`video codec is ${probe.codec_name}, expected h264`);
  if (probe.width !== 1280 || probe.height !== 720) failures.push(`video is ${probe.width}x${probe.height}, expected 1280x720`);
  if (probe.pix_fmt !== "yuv420p") failures.push(`video pixel format is ${probe.pix_fmt}, expected yuv420p`);
  if (probe.r_frame_rate !== "24/1") failures.push(`video frame rate is ${probe.r_frame_rate}, expected 24/1`);
  if (Number(probe.nb_read_frames) !== expectedFrames) {
    failures.push(`decoded ${probe.nb_read_frames} frames, expected ${expectedFrames}`);
  }
  const expectedDuration = isAudiovisual
    ? validated.receipt.audio.durationSeconds
    : validated.timeline.durationSeconds;
  const durationTolerance = isAudiovisual ? (1 / 24) + 0.01 : 0.01;
  if (Math.abs(probe.duration - expectedDuration) > durationTolerance) {
    failures.push(`video duration is ${probe.duration}, expected ${expectedDuration}`);
  }
  let meanVolumeDb = null;
  if (isAudiovisual) {
    if (probe.audioCodec !== "aac") failures.push(`audio codec is ${probe.audioCodec}, expected aac`);
    const loudness = execute("ffmpeg", [
      "-hide_banner", "-i", finalVideo,
      "-vn", "-af", "volumedetect", "-f", "null", "-",
    ], { includeStderr: true });
    meanVolumeDb = Number(loudness.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1] ?? -Infinity);
    if (!Number.isFinite(meanVolumeDb) || meanVolumeDb <= -55) {
      failures.push(`audio mean volume is ${meanVolumeDb} dB, expected an audible track above -55 dB`);
    }
    if (renderReport.audioSha256 !== validated.receipt.audio.sha256) {
      failures.push("render report audio checksum is stale");
    }
    if (renderReport.background && renderReport.background?.sha256 !== validated.receipt.background?.sha256) {
      failures.push("render report background checksum is stale");
    }
    if (validated.receipt.transcript
      && JSON.stringify(renderReport.transcript) !== JSON.stringify(validated.receipt.transcript)) {
      failures.push("render report transcription receipt is stale");
    }
    if (renderReport.cameraMotion !== false) failures.push("audiovisual render introduced camera motion");
    if (JSON.stringify(renderReport.stageView) !== JSON.stringify(PERFORMANCE_STAGE_VIEW)) {
      failures.push("performance render did not use the fixed canonical stage view");
    }
    if (validated.lipSync && renderReport.mouthMode !== undefined) {
      if (renderReport.mouthMode !== "cherry-tsv-shaz-five-mouth-v1") {
        failures.push("render report did not record the validated lip-sync mode");
      }
      if (JSON.stringify(renderReport.lipSync) !== JSON.stringify(validated.receipt.lipSync)) {
        failures.push("render report lip-sync receipt or engine provenance is stale");
      }
    }
  }

  const poseReports = [];
  let uniquePoseIds = [];
  if (validated.mode === "performance") {
    uniquePoseIds = validated.receipt.poses.map(({ poseId }) => poseId);
  } else if (validated.mode === "multi-shot") {
    const hasTalk = validated.timeline.shots.some((s) => s.shotType === "talk-to-camera");
    uniquePoseIds = hasTalk ? ["neutral-listening"] : [];
  } else {
    uniquePoseIds = [...new Set(validated.timeline.entries.map((entry) => entry.poseId))];
  }
  for (const poseId of uniquePoseIds) {
    const pose = validated.registry.byId.get(poseId);
    const report = await inspectPose({
      manifest: validated.manifest,
      assetRoot: path.join(root, "rig-v2", "assets"),
      propRoot: path.join(root, "assets", "props"),
      recipe: pose.recipe,
    });
    poseReports.push({
      poseId,
      status: report.status,
      poseRecipeSha256: report.poseRecipeSha256,
      framesInspected: report.frames.length,
      maximumIdenticalFrames: report.maximumIdenticalFrames,
      failures: report.failures,
    });
    if (report.status !== "pass") failures.push(`pose inspection failed for ${poseId}`);
  }

  const contactSheet = path.join(runDirectory, "contact-sheet.jpg");
  let sampleFrames;
  if (validated.mode === "performance") {
    const candidates = [
      0,
      ...renderReport.events.flatMap((event) => [
        event.outputStartFrame - 1,
        event.apexFrame - 1,
        event.outputEndFrame - 1,
      ]),
      validated.timeline.durationFrames - 1,
    ];
    const unique = [...new Set(candidates)].sort((left, right) => left - right);
    sampleFrames = unique.length <= 12
      ? unique
      : Array.from({ length: 12 }, (_, index) => unique[Math.round(index * (unique.length - 1) / 11)]);
  } else if (validated.mode === "multi-shot") {
    const candidates = [
      0,
      ...renderReport.shots.flatMap((shot) => [
        shot.outputStartFrame - 1,
        Math.floor((shot.outputStartFrame + shot.outputEndFrame) / 2) - 1,
        shot.outputEndFrame - 1,
      ]),
      validated.timeline.totalFrames - 1,
    ];
    const unique = [...new Set(candidates)].sort((left, right) => left - right);
    sampleFrames = unique.length <= 12
      ? unique
      : Array.from({ length: 12 }, (_, index) => unique[Math.round(index * (unique.length - 1) / 11)]);
  } else if (validated.timeline.sequencePreset === "talk-to-camera" && validated.lipSync) {
    const mouthDrawings = validated.lipSync.frameDrawings;
    const candidates = [
      0,
      ...mouthDrawings.flatMap((drawing, index) => (
        index > 0 && drawing !== mouthDrawings[index - 1] ? [index] : []
      )),
      validated.timeline.totalFrames - 1,
    ];
    const unique = [...new Set(candidates)].sort((left, right) => left - right);
    sampleFrames = unique.length <= 12
      ? unique
      : Array.from({ length: 12 }, (_, index) => unique[Math.round(index * (unique.length - 1) / 11)]);
  } else {
    const sampledSegments = renderReport.segments.length <= 12
      ? renderReport.segments
      : Array.from({ length: 12 }, (_, index) => (
        renderReport.segments[Math.round(index * (renderReport.segments.length - 1) / 11)]
      ));
    sampleFrames = sampledSegments.map((segment) => Math.floor(
      (segment.outputStartFrame + segment.outputEndFrame) / 2,
    ) - 1);
  }
  const select = sampleFrames.map((frame) => `eq(n\\,${frame})`).join("+");
  execute("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", finalVideo,
    "-vf", `select='${select}',scale=320:-1,tile=4x3:nb_frames=12:padding=4:margin=4:color=white`,
    "-frames:v", "1", contactSheet,
  ]);
  if (isAudiovisual) {
    execute("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", finalVideo,
      "-filter_complex", "[0:v]setpts=2*PTS[v];[0:a]atempo=0.5[a]",
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-movflags", "+faststart",
      path.join(runDirectory, "review-slow.mp4"),
    ]);
  }
  const humanReviewPath = path.join(runDirectory, "human-review.json");
  const existingHumanReview = await exists(humanReviewPath)
    ? await readJson(humanReviewPath)
    : null;
  if (!existingHumanReview
    || (existingHumanReview.status === "pending"
      && existingHumanReview.reviewedOutputSha256 !== outputSha256)) {
    await writeJson(humanReviewPath, {
      schemaVersion: 1,
      status: "pending",
      reviewedOutputSha256: outputSha256,
      reviewer: null,
      directVideoPerception: false,
      directAudioPerception: false,
      completePasses: 0,
      notes: "Watch and hear final.mp4 completely at normal speed, then inspect review-slow.mp4 when present. Set status to approved or rejected without changing reviewedOutputSha256.",
    });
  }
  const report = {
    schemaVersion: 1,
    status: failures.length === 0 ? "pass" : "fail",
    inspectedAt: new Date().toISOString(),
    inputSha256: validated.receipt.inputSha256,
    outputSha256,
    artistRenderedFramesUsed: false,
    measured: {
      width: probe.width,
      height: probe.height,
      codec: probe.codec_name,
      pixelFormat: probe.pix_fmt,
      fps: probe.r_frame_rate,
      frames: Number(probe.nb_read_frames),
      durationSeconds: probe.duration,
      audioCodec: probe.audioCodec,
      meanVolumeDb,
    },
    poseReports,
    failures,
    ...(validated.timeline.sequencePreset
      ? { sequencePreset: validated.timeline.sequencePreset }
      : {}),
    ...(validated.receipt.transcript ? { transcript: validated.receipt.transcript } : {}),
    contactSheet: "contact-sheet.jpg",
    contactSheetSampleFrames: sampleFrames,
    humanReview: "human-review.json",
    ...(isAudiovisual ? { slowReview: "review-slow.mp4" } : {}),
  };
  await writeJson(path.join(runDirectory, "quality-report.json"), report);
  return report;
}

export { inspectRun, probeVideo };
