import { Composition } from "remotion";
import { brainrotCtaDurationMs } from "../features/formats/brainrot/render";
import type { RenderableAdScene } from "../features/scene/types";
import { defaultRenderScene } from "./fixture";
import { RemotionAdScene } from "./RemotionAdScene";

export const adSceneCompositionId = "AdSceneMp4";
export const adSceneFps = 60;
export const adSceneDurationInFrames = adSceneFps * 5;

export const getAdSceneDimensions = (scene: RenderableAdScene) => (
  scene.format === "memoir-film" ? { width: 1920, height: 1080 } : scene.format === "three-d-breakdown" || scene.format === "talking-fish-news" || scene.format === "lego-music-video"
    ? { width: 1080, height: 1920 }
    : scene.format === "static-package"
      ? { width: scene.layout.canvas.width, height: scene.layout.canvas.height }
    : { width: 1080, height: 1350 }
);

export const getAdSceneDurationInFrames = (
  scene: RenderableAdScene,
  fps = adSceneFps,
) => {
  const audioDurationSeconds = scene.audio.status === "generated"
    ? scene.audio.durationSeconds
    : 0;
  if (scene.format === "memoir-film") return Math.round(scene.layout.durationMs / 1000 * fps);
  if (scene.format === "lego-music-video") {
    return Math.ceil((scene.layout.musicLengthMs / 1000) * fps);
  }
  if (scene.format === "video-meme") {
    return Math.ceil(Math.max(1, scene.layout.durationSeconds, audioDurationSeconds + 0.35) * fps);
  }
  if (scene.format === "motion-story" || scene.format === "three-d-breakdown" || scene.format === "talking-fish-news") {
    return Math.ceil((scene.layout.durationMs / 1000) * fps);
  }
  const extraSeconds = scene.format === "brainrot" ? brainrotCtaDurationMs / 1000 : 0.35;
  const durationSeconds = Math.max(5, audioDurationSeconds + extraSeconds);
  return Math.ceil(durationSeconds * fps);
};

export function RemotionRoot() {
  return (
    <Composition
      id={adSceneCompositionId}
      component={RemotionAdScene}
      width={1080}
      height={1350}
      fps={adSceneFps}
      durationInFrames={adSceneDurationInFrames}
      calculateMetadata={({ props }) => ({
        fps: props.scene.format === "memoir-film" ? 30 : adSceneFps,
        durationInFrames: getAdSceneDurationInFrames(props.scene, props.scene.format === "memoir-film" ? 30 : adSceneFps),
        ...getAdSceneDimensions(props.scene),
      })}
      defaultProps={{
        scene: defaultRenderScene,
      }}
    />
  );
}
