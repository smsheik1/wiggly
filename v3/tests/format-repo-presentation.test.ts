import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  discoveryFormatSlugs,
  getDiscoveryFormatProfile,
} from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import type { FormatRepoPackageData } from "../features/discovery/formatRepoPackage.server";
import {
  FormatRepoPackageAssets,
  FormatRepoPackageConnections,
  FormatRepoPackageEvidence,
} from "../features/discovery/FormatRepoPackageSections";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const referenceOnly: string[] = [];
let packaged = 0;
for (const slug of discoveryFormatSlugs) {
  const format = getDiscoveryFormatProfile(slug)!;
  const presentation = await getFormatRepoPagePresentation(slug);
  assert.ok(
    presentation,
    `${slug}: cannot silently fall back to the old page.`,
  );
  if (format.packagePath) {
    packaged++;
    assert.ok(
      format.repositoryHref && existsSync(`public${format.repositoryHref}`),
      `${slug}: visible download must exist.`,
    );
    const handoff = buildDiscoveryHandoffPrompt(
      format,
      "https://wiggly.agentenamel.com",
    );
    assert.ok(handoff.includes(format.repositoryHref));
    assert.match(
      handoff,
      /KIT-MANIFEST\.json or format\.json/,
      "Old kits must not be forced to read a nonexistent modern manifest.",
    );
  } else {
    referenceOnly.push(slug);
    assert.equal(format.handoff, undefined);
    assert.equal(format.repositoryHref, undefined);
  }
  if (presentation.kind !== "shared") {
    assert.ok(
      presentation.trust.files.length &&
        presentation.trust.assembly.steps.length,
    );
    continue;
  }
  const data = presentation.package;
  const props = { format, data };
  const html = [
    FormatRepoPackageConnections,
    FormatRepoPackageAssets,
    FormatRepoPackageEvidence,
  ]
    .map((component) => renderToStaticMarkup(createElement(component, props)))
    .join("");
  for (const id of [
    "accounts-youll-connect",
    "included-assets",
    "workflow",
    "proof-quality",
    "repo-files",
  ]) {
    if (slug === "squilliam-news" && id === "included-assets") {
      assert.doesNotMatch(html, /id="included-assets"|The ingredients behind the format/);
      assert.ok(format.characterOptions?.length === 4);
      continue;
    }
    assert.ok(
      html.includes(`id="${id}"`),
      `${slug}: missing rendered ${id} section.`,
    );
  }
  if (!data) {
    assert.match(html, /No downloadable Repo/);
    assert.match(html, /not an agent-ready download/);
    continue;
  }
  assert.ok(data.workflow.length >= 3 && data.quality.length > 0);
  for (const name of [
    "README.md",
    "SKILL.md",
    "requirements.json",
    "quality.json",
  ]) {
    const file: FormatRepoPackageData["files"][number] | undefined =
      data.files.find((candidate) => candidate.name === name);
    assert.ok(file, `${slug}: missing readable ${name}`);
    assert.equal(file.content, readFileSync(`public${file.href}`, "utf8"));
    assert.ok(
      html.includes(
        `<summary class="cursor-pointer break-words px-5 py-4 text-sm font-black">${name}</summary>`,
      ),
    );
  }
  for (const asset of data.assets)
    assert.ok(
      existsSync(`public${asset.href}`),
      `${slug}: broken included asset ${asset.href}`,
    );
  for (const service of data.services)
    assert.ok(
      html.includes(service.name),
      `${slug}: missing ${service.name} service.`,
    );
  if (slug === "three-d-breakdown") {
    assert.deepEqual(
      data.services.map((service) => service.name),
      ["Replicate", "Fish Audio"],
    );
    assert.equal(data.workflow.length, 6);
    assert.ok(
      data.proof.contactSheet?.endsWith("finalstraw-contact-sheet.jpg"),
    );
    assert.match(html, /Style B master reference/);
    assert.match(html, /identity-locked full-quality/);
    assert.match(html, /Known limitations/);
  }
  if (
    ["fortnite-filter", "passport-click", "cinematic-portrait-pack"].includes(
      slug,
    )
  ) {
    assert.ok(
      data.assets.length > 0,
      `${slug}: older asset schema must not disappear.`,
    );
    assert.match(html, /Supplied creator reference/);
  }
}
assert.equal(
  packaged,
  51,
  "Count real downloadable packages, not Discovery cards.",
);
assert.deepEqual(referenceOnly, ["product-photoshoot", "hybrid-news"]);
const route = readFileSync("app/formats/[slug]/page.tsx", "utf8");
for (const component of [
  "FormatRepoPackageConnections",
  "FormatRepoPackageAssets",
  "FormatRepoPackageEvidence",
]) {
  assert.ok(
    route.includes(`<${component}`),
    `Route must render—not just import—${component}.`,
  );
}
assert.doesNotMatch(
  route,
  /What the Repo keeps/,
  "Remove the incomplete two-box fallback.",
);
console.log(
  "all 53 Repo presentations checked: 51 packages, 2 explicitly reference-only collections",
);
