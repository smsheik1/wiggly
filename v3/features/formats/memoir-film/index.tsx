import { useRenderAssetComponents } from "../../render/RenderAssetContext";
import type { MemoirFilmAdScene } from "../../scene/types";
import type { AdFormatModule, FormatRenderProps } from "../types";

export function validateMemoirFilmScene(scene: MemoirFilmAdScene) {
  const errors: string[] = [];
  if (scene.format !== "memoir-film" || scene.layout.preset !== "memoir-film" || scene.layout.durationMs !== 60000 || scene.layout.fps !== 30) errors.push("Memoir requires a 60-second 30fps timeline.");
  let end = 0;
  const ids = new Set<string>();
  for (const clip of scene.layout.clips) {
    if (!clip.id || ids.has(clip.id) || !clip.src || clip.startFrame !== end || !Number.isInteger(clip.durationFrames) || clip.durationFrames <= 0 || !Number.isFinite(clip.sourceOffsetSeconds) || clip.sourceOffsetSeconds < 0 || !Number.isInteger(clip.startFrame)) errors.push("Clips require unique IDs, frame-aligned contiguous timing and nonnegative source trims.");
    ids.add(clip.id); end += clip.durationFrames;
  }
  if (end !== 1800 || !/^[a-f0-9]{64}$/.test(scene.layout.manifestDigest)) errors.push("Timeline must cover 60 seconds and bind its manifest.");
  if (scene.audio.status !== "generated" || !scene.audio.url || scene.audio.durationMs !== 60000) errors.push("Memoir requires its current mixed 60-second audio track.");
  return {valid: errors.length === 0, errors};
}

export function MemoirFilmRenderer({scene, timeSeconds = 0}: FormatRenderProps<MemoirFilmAdScene>) {
  const {Video} = useRenderAssetComponents();
  return <div data-format="memoir-film" style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",background:"black"}}>
    {scene.layout.clips.filter(c => Math.round(timeSeconds * 30) >= c.startFrame && Math.round(timeSeconds * 30) < c.startFrame + c.durationFrames).map(c => <Video key={c.id} src={c.src} muted playsInline
      clipStartSeconds={c.startFrame / 30} clipEndSeconds={(c.startFrame + c.durationFrames) / 30}
      clipTimeSeconds={timeSeconds - c.startFrame / 30 + c.sourceOffsetSeconds} sourceOffsetSeconds={c.sourceOffsetSeconds}
      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}} />)}
  </div>;
}

export const memoirFilmFormatModule: AdFormatModule<"memoir-film", MemoirFilmAdScene> = {
  id:"memoir-film", label:"Memoir Film", defaultSlots:[], editorSchema:{text:[],style:[],format:[]},
  RenderComponent: MemoirFilmRenderer, validate:validateMemoirFilmScene,
};
