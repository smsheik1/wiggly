import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AdRenderSurface } from "../features/render/AdRenderSurface";
import { buildWigglyFontFaceCss } from "../features/render/fontStack";
import {
  RenderAssetProvider,
  type RenderImageComponent,
  type RenderVideoComponent,
} from "../features/render/RenderAssetContext";
import type { RenderableAdScene } from "../features/scene/types";

const remotionFontFaceCss = buildWigglyFontFaceCss((path) => staticFile(path.replace(/^\//, "")));
const resolveRenderAssetSrc = (src: string) => src.startsWith("/") ? staticFile(src.replace(/^\//, "")) : src;

const RemotionImageAsset: RenderImageComponent = ({ src, ...props }) => (
  <Img
    {...props}
    src={resolveRenderAssetSrc(src)}
  />
);

const RemotionVideoAsset: RenderVideoComponent = ({
  active: _active,
  clipEndSeconds,
  clipStartSeconds = 0,
  clipTimeSeconds: _clipTimeSeconds,
  onTimeUpdate: _onTimeUpdate,
  src,
  ...props
}) => {
  const { fps } = useVideoConfig();
  const durationInFrames = clipEndSeconds
    ? Math.max(1, Math.round((clipEndSeconds - clipStartSeconds) * fps))
    : undefined;
  return (
    <Sequence from={Math.round(clipStartSeconds * fps)} durationInFrames={durationInFrames}>
      <OffthreadVideo
        {...props}
        src={resolveRenderAssetSrc(src)}
      />
    </Sequence>
  );
};

export function getRenderMusicBed(scene: RenderableAdScene) {
  return scene.format === "motion-story" || scene.format === "talking-fish-news"
    ? scene.layout.musicBed
    : null;
}

export function RemotionAdScene({ scene }: { scene: RenderableAdScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audio = scene.audio.status === "generated" && scene.audio.url
    ? scene.audio
    : null;
  const musicBed = getRenderMusicBed(scene);
  const musicBedSrc = musicBed
    ? musicBed.src
    : "";

  return (
    <AbsoluteFill style={{ background: scene.style.backgroundColor }}>
      {audio ? <Audio src={resolveRenderAssetSrc(audio.url)} /> : null}
      {musicBedSrc ? (
        <Audio
          src={resolveRenderAssetSrc(musicBedSrc)}
          volume={musicBed?.volume ?? 0.18}
          loop={musicBed?.loop}
        />
      ) : null}
      <RenderAssetProvider Image={RemotionImageAsset} Video={RemotionVideoAsset}>
        <AdRenderSurface
          scene={scene}
          mode="video"
          timeSeconds={frame / fps}
          fontFaceCss={remotionFontFaceCss}
          style={{ width: "100%" }}
        />
      </RenderAssetProvider>
    </AbsoluteFill>
  );
}
