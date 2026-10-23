/**
 * My Pixar Story — Format Package Entry
 */

import type { MyPixarStoryAdScene } from "../../scene/types";
import type { AdFormatModule } from "../types";
import { MyPixarStoryFormatRenderer } from "./render";
import { validateMyPixarStoryAdScene } from "./validate";

export * from "./types";
export * from "./prompt";
export * from "./validate";
export * from "./render";

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
