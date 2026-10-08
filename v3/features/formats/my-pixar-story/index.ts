/**
 * My Pixar Story — Format Package Entry
 */

import type { MyPixarStoryAdScene } from "../../scene/types";
import type { AdFormatModule } from "../types";
import { MyPixarStoryFormatRenderer } from "./render";
import { validateMyPixarStoryAdScene } from "./validate";

export * from "./types";
export * from "./prompt";
export * from "./screenplay";
export * from "./validate";
export * from "./stateMachine";
export * from "./render";
export * from "./providers";
export * from "./inspect";
export * from "./ui/PixarCharacterMirrorCard";
export * from "./ui/PixarAudioRecorderGate";
export * from "./ui/PixarGolden5Stepper";
export * from "./ui/CreatePixarStorySheet";

export const myPixarStoryFormatModule: AdFormatModule<"my-pixar-story", MyPixarStoryAdScene> = {
  id: "my-pixar-story",
  label: "My Pixar Story",
  defaultSlots: ["headline"],
  editorSchema: {
    text: [],
    style: [],
    format: [],
  },
  RenderComponent: MyPixarStoryFormatRenderer,
  validate: validateMyPixarStoryAdScene,
};
