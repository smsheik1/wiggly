import {createRoot} from "react-dom/client";
import {Player} from "@remotion/player";
import {RemotionAdScene} from "./RemotionAdScene";
import {validateMemoirFilmScene} from "../features/formats/memoir-film";
import type {MemoirFilmAdScene} from "../features/scene/types";
async function start() {
  if (!document.getElementById("preview")) return;
  const scene: MemoirFilmAdScene = await fetch("./scene.json").then(r => {if (!r.ok) throw new Error("Preview scene unavailable."); return r.json();});
  const validation = validateMemoirFilmScene(scene);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  createRoot(document.getElementById("preview")!).render(<Player component={RemotionAdScene} inputProps={{scene}}
    durationInFrames={1800} fps={30} compositionWidth={1920} compositionHeight={1080} controls style={{width:"100%",aspectRatio:"16/9"}} />);
}
start().catch(e => {document.getElementById("preview")!.textContent = `Preview failed: ${e.message}`;});
