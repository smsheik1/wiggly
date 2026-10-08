import type { RenderableAdFormatId } from "../scene/types";
import type { AdFormatModule } from "./types";
import { memeFormatModule } from "./meme";
import { jingleFormatModule } from "./jingle";
import { videoMemeFormatModule } from "./video-meme";
import { textMessageFormatModule } from "./text-message";
import { brainrotFormatModule } from "./brainrot";
import { reviewsFormatModule } from "./reviews";
import { motionStoryFormatModule } from "./motion-story";
import { threeDBreakdownFormatModule } from "./three-d-breakdown";
import { visualizerFormatModule } from "./visualizer";
import { wereSorryFormatModule } from "./were-sorry";
import { staticPackageFormatModule } from "./static-package";
import { talkingFishNewsFormatModule } from "./talking-fish-news";
import { legoMusicVideoFormatModule } from "./lego-music-video";
import { myPixarStoryFormatModule } from "./my-pixar-story";

export type AnyAdFormatModule = AdFormatModule<string, any>;

export const createFormatRegistry = <TModules extends Record<string, AnyAdFormatModule>>(modules: TModules) => modules;

export const formatRegistry = createFormatRegistry({
  visualizer: visualizerFormatModule,
  meme: memeFormatModule,
  "were-sorry": wereSorryFormatModule,
  "video-meme": videoMemeFormatModule,
  jingle: jingleFormatModule,
  "text-message": textMessageFormatModule,
  brainrot: brainrotFormatModule,
  reviews: reviewsFormatModule,
  "motion-story": motionStoryFormatModule,
  "three-d-breakdown": threeDBreakdownFormatModule,
  "static-package": staticPackageFormatModule,
  "talking-fish-news": talkingFishNewsFormatModule,
  "lego-music-video": legoMusicVideoFormatModule,
  "my-pixar-story": myPixarStoryFormatModule,
} satisfies Record<RenderableAdFormatId, AnyAdFormatModule>);

export const getFormatModuleFromRegistry = <
  TModules extends Record<string, AnyAdFormatModule>,
  TFormat extends keyof TModules & string,
>(
  registry: TModules,
  format: TFormat,
): TModules[TFormat] => {
  const module = registry[format];
  if (!module) throw new Error(`Unknown ad format: ${format}`);
  return module;
};

export const getFormatModule = (format: RenderableAdFormatId): AdFormatModule => {
  return getFormatModuleFromRegistry(formatRegistry, format) as AdFormatModule;
};
