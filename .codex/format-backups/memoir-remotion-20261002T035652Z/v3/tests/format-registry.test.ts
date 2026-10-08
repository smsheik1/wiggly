import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createFormatRegistry,
  formatRegistry,
  getFormatModule,
  getFormatModuleFromRegistry,
} from "../features/formats/registry";
import type { AdFormatModule } from "../features/formats/types";
import type { AdSceneBase, AdSceneStyleBase } from "../features/scene/types";

const entries = Object.entries(formatRegistry) as Array<[string, AdFormatModule]>;

assert.ok(entries.length >= 1, "At least one ad format must be registered.");

for (const [formatId, module] of entries) {
  assert.equal(module.id, formatId, `${formatId} module id must match its registry key.`);
  assert.ok(module.label.trim(), `${formatId} must expose a human label.`);
  assert.ok(module.defaultSlots.length > 0, `${formatId} must expose default flash roles.`);
  assert.ok(!("interaction" in module), `${formatId} must not expose /create mini-editor interaction metadata.`);
  assert.equal(typeof module.validate, "function", `${formatId} must expose a validator.`);
  assert.equal(typeof module.RenderComponent, "function", `${formatId} must expose a render component.`);
  assert.ok(Array.isArray(module.editorSchema.text), `${formatId} must expose text editor fields through its format module.`);
  assert.ok(Array.isArray(module.editorSchema.style), `${formatId} must expose style editor fields through its format module.`);
  assert.ok(Array.isArray(module.editorSchema.format), `${formatId} must expose format-specific editor fields through its format module.`);
  assert.equal(getFormatModule(module.id).id, module.id);
}

assert.equal(getFormatModule("meme").id, "meme");

type FakeComicScene = AdSceneBase<"comic", AdSceneStyleBase, { preset: "comic-card" }>;

const fakeComicFormatModule: AdFormatModule<"comic", FakeComicScene> = {
  id: "comic",
  label: "Comic image",
  defaultSlots: ["headline"],
  editorSchema: {
    text: [{ id: "headline", label: "Comic headline", kind: "textarea" }],
    style: [{ id: "backgroundColor", label: "Background", kind: "color" }],
    format: [{ id: "comicTemplate", label: "Comic template", kind: "preset", options: [{ label: "Classic", value: "classic" }] }],
  },
  RenderComponent: () => null,
  validate: (scene) => ({
    valid: scene.format === "comic" && Boolean(scene.creative.headline.trim()),
    errors: scene.format === "comic" && scene.creative.headline.trim() ? [] : ["Fake comic scene is invalid."],
  }),
};

const registryWithFakeFormat = createFormatRegistry({
  ...formatRegistry,
  comic: fakeComicFormatModule,
});

assert.equal(getFormatModuleFromRegistry(registryWithFakeFormat, "comic").id, "comic");
assert.deepEqual(getFormatModuleFromRegistry(registryWithFakeFormat, "comic").defaultSlots, ["headline"]);
assert.equal(getFormatModuleFromRegistry(registryWithFakeFormat, "comic").editorSchema.format[0]?.id, "comicTemplate");

for (const createFilePath of ["app/create/CreateResearchClient.tsx", "app/create/CreatePreviewChrome.tsx"]) {
  const source = readFileSync(createFilePath, "utf8");
  assert.ok(
    !source.includes('"comic"') && !source.includes("'comic'"),
    `${createFilePath} must not change when a fake comic format is added to the registry.`,
  );
}

const coreFilesThatMustStayFormatAgnostic = [
  "features/render/AdRenderSurface.tsx",
  "remotion-entry/RemotionAdScene.tsx",
  "scripts/render-worker.ts",
  "app/s/[slug]/ShareSceneClient.tsx",
  "convex/renderJobs.ts",
  "convex/sharePages.ts",
];

for (const filePath of coreFilesThatMustStayFormatAgnostic) {
  const source = readFileSync(filePath, "utf8");
  assert.ok(
    !source.includes("formats/visualizer") && !source.includes("formats\\visualizer"),
    `${filePath} must not import the visualizer format directly; use the registry/render surface.`,
  );
  assert.ok(
    !/from\s+["'][^"']*features\/formats\/visualizer/.test(source),
    `${filePath} must not import from features/formats/visualizer; use the registry/render surface.`,
  );
}

const renderSurfaceSource = readFileSync("features/render/AdRenderSurface.tsx", "utf8");
assert.ok(
  renderSurfaceSource.includes("getFormatModule(scene.format)"),
  "AdRenderSurface must delegate format selection through the registry.",
);
assert.ok(
  renderSurfaceSource.includes("FormatRenderer"),
  "AdRenderSurface must render the component returned by the selected format module.",
);

assert.throws(
  () => getFormatModule("not-a-format" as never),
  /Unknown ad format/,
);

console.log("format-registry tests passed");
