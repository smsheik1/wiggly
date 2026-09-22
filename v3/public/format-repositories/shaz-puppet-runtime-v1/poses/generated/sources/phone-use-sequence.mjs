#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { writePoseRecipe } from "../../../runtime/pose-authoring.mjs";
import { loadManifest } from "../../../runtime/rig-v2-renderer.mjs";

const PHONE_PATH = fileURLToPath(new URL("../look-at-phone.json", import.meta.url));
const PHONE_SHA256 = "863ecff5a785cbe82792e3083ef63c1cc55a3276bb681dc3f5a0d98e7a3edf3d";

async function loadLockedPhone() {
  const bytes = await fs.readFile(PHONE_PATH);
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== PHONE_SHA256) {
    throw new Error(`locked recipe changed: look-at-phone.json ${actual}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

async function buildPhoneUseSequence(manifest) {
  const phone = await loadLockedPhone();
  if (phone.sourceXstageSha256 !== manifest.source.sha256) {
    throw new Error("look-at-phone recipe targets a different Shaz rig");
  }

  const controls = structuredClone(phone.controls);

  // Normalize Shaz_Master-P: invert the 0.86 scale and +0.12 Y offset originally used for phone prop framing
  controls["Shaz_Master-P"] = controls["Shaz_Master-P"].map((key) => ({
    ...key,
    scale: [
      key.scale[0] / 0.86,
      key.scale[1] / 0.86,
    ],
    position: [
      key.position[0],
      key.position[1] - 0.12,
      key.position[2],
    ],
  }));

  // Smooth arm entrance so relaxed right hand clears canvas bottom during standalone inspection
  for (const key of controls["Right_Arm_Pivot-P"] || []) {
    if (key.frame <= 6) {
      const blend = (7 - key.frame) / 6;
      key.rotation = (key.rotation ?? 0) + 15 * blend;
    }
  }

  return {
    ...phone,
    id: "phone-use-sequence",
    props: [],
    authorship: {
      ...phone.authorship,
      learnedFrom: [
        ...phone.authorship.learnedFrom,
        "removed the detached screen-space tap hand; the phone action keeps the authored overlay hand and its native sleeve registration",
        "removed the literal phone from this reusable gesture after visual review; the native body-language action remains intact",
        "normalized Shaz_Master-P to scale 1.0 and zero Y offset to conform to universal puppet rig contract",
      ],
    },
    quality: {
      ...phone.quality,
      armCompositeMode: "native-rig",
    },
    controls,
  };
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: phone-use-sequence.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildPhoneUseSequence(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildPhoneUseSequence };
