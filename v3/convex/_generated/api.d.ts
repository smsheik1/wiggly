/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adSceneStorage from "../adSceneStorage.js";
import type * as adScenes from "../adScenes.js";
import type * as audioAssets from "../audioAssets.js";
import type * as dialogueScripts from "../dialogueScripts.js";
import type * as discoveryModeration from "../discoveryModeration.js";
import type * as discoverySubmissions from "../discoverySubmissions.js";
import type * as jingleStoryboards from "../jingleStoryboards.js";
import type * as makerFormats from "../makerFormats.js";
import type * as mcpFilm from "../mcpFilm.js";
import type * as productPhotoshoots from "../productPhotoshoots.js";
import type * as renderJobs from "../renderJobs.js";
import type * as researchRuns from "../researchRuns.js";
import type * as researchStorage from "../researchStorage.js";
import type * as savedDesigns from "../savedDesigns.js";
import type * as sceneUrlRefresh from "../sceneUrlRefresh.js";
import type * as sessions from "../sessions.js";
import type * as sharePages from "../sharePages.js";
import type * as storageMaintenance from "../storageMaintenance.js";
import type * as threeDImages from "../threeDImages.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adSceneStorage: typeof adSceneStorage;
  adScenes: typeof adScenes;
  audioAssets: typeof audioAssets;
  dialogueScripts: typeof dialogueScripts;
  discoveryModeration: typeof discoveryModeration;
  discoverySubmissions: typeof discoverySubmissions;
  jingleStoryboards: typeof jingleStoryboards;
  makerFormats: typeof makerFormats;
  mcpFilm: typeof mcpFilm;
  productPhotoshoots: typeof productPhotoshoots;
  renderJobs: typeof renderJobs;
  researchRuns: typeof researchRuns;
  researchStorage: typeof researchStorage;
  savedDesigns: typeof savedDesigns;
  sceneUrlRefresh: typeof sceneUrlRefresh;
  sessions: typeof sessions;
  sharePages: typeof sharePages;
  storageMaintenance: typeof storageMaintenance;
  threeDImages: typeof threeDImages;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
