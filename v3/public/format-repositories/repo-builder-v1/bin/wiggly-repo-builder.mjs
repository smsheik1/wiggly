#!/usr/bin/env node
import path from "node:path";
import { doctor, intake, inspectMedia } from "../runtime/intake.mjs";
import { approveBlueprint, checkRepo, initBlueprint, loadValidatedRun, scaffoldRepo } from "../runtime/contracts.mjs";
import { packageRepo } from "../runtime/package.mjs";
import { smoke } from "../runtime/smoke.mjs";
import { transcribe } from "../runtime/transcribe.mjs";
import { analyzeReferenceVideo } from "../runtime/analyze.mjs";
import { harvestAllAssets } from "../runtime/harvest-assets.mjs";
import { generateFullRuntime } from "../runtime/generate-runtime.mjs";
import { scaffoldChildKit } from "../runtime/scaffold-skill.mjs";
import { proveChildRepo } from "../runtime/prove-repo.mjs";

const definitions = {
  doctor: [], intake: ["source", "run", "allow-download", "max-seconds"],
  transcribe: ["run", "whisper-bin", "model"], init: ["run", "slug", "title"], validate: ["run"],
  approve: ["run", "reviewer", "note", "scope"], scaffold: ["run", "output"],
  inspect: ["media", "output"], "check-repo": ["repo"],
  "package-repo": ["repo", "output"], smoke: [],
  build: ["source", "output", "slug", "title", "allow-download", "voice-id", "skip-prove"]
};
const help = `Wiggly Repo Builder 0.2.0 (Gold Standard Format Factory)
Usage: node bin/wiggly-repo-builder.mjs <command> [options]
  build --source <video|URL> --output <new directory> [--slug <slug>] [--title <title>] [--voice-id <id>] [--skip-prove]
  doctor
  intake --source <file|YouTube URL> --run <new directory> [--allow-download] [--max-seconds 180]
  transcribe --run <directory> --whisper-bin <installed whisper.cpp CLI> --model <existing model>
  init --run <directory> --slug <slug> --title <title>
  validate --run <directory>
  approve --run <directory> --reviewer <name> --note <decision> [--scope user|benchmark]
  scaffold --run <directory> --output <new directory>
  inspect --media <file> --output <new report.json>
  check-repo --repo <directory>
  package-repo --repo <directory> --output <new archive.zip>
  smoke
Read SKILL.md. Modernize raw videos into self-contained, validated Remotion format repositories.`;

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    console.log(help);
  } else {
    if (!Object.hasOwn(definitions, command)) throw new Error(`Unknown command: ${command}`);
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const key = args[i].slice(2);
      if (!args[i].startsWith("--") || !definitions[command].includes(key) || Object.hasOwn(options, key)) throw new Error(`Unknown or duplicate option: ${args[i]}`);
      if (key === "allow-download" || key === "skip-prove") options[key] = true;
      else {
        if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value for --${key}`);
        options[key] = args[++i];
      }
    }
    const required = (key) => {
      if (!options[key]) throw new Error(`Missing --${key}`);
      return options[key];
    };
    const directory = (key) => path.resolve(required(key));
    let result;
    switch (command) {
      case "build": {
        const source = required("source");
        const output = directory("output");
        const slug = options.slug;
        const title = options.title;
        const voiceId = options["voice-id"];
        const skipProve = options["skip-prove"] === true;

        console.log(`[wiggly-repo-builder] Modernizing reference video into Gold Standard Format Kit...`);
        const recipe = await analyzeReferenceVideo(source, { slug, title });
        const assets = await harvestAllAssets(source, output, recipe, { voiceId });
        await generateFullRuntime(recipe, assets, output);
        await scaffoldChildKit(recipe, output);

        let proof = null;
        if (!skipProve) {
          proof = await proveChildRepo(output);
        }

        result = {
          status: "built",
          formatSlug: recipe.slug,
          formatTitle: recipe.title,
          outputDirectory: output,
          assetsHarvested: {
            voice: !!assets.voice,
            font: !!assets.font,
            posesCount: assets.poses?.length || 0
          },
          proved: !skipProve,
          proof
        };
        break;
      }
      case "doctor": result = await doctor(); if (!result.ok) process.exitCode = 1; break;
      case "intake": result = await intake({ source: required("source"), runDirectory: directory("run"), allowDownload: options["allow-download"] === true, maxSeconds: options["max-seconds"] === undefined ? 180 : Number(options["max-seconds"]) }); break;
      case "transcribe": result = await transcribe({ runDirectory: directory("run"), whisperBinary: directory("whisper-bin"), modelFile: directory("model") }); break;
      case "init": result = await initBlueprint({ runDirectory: directory("run"), slug: required("slug"), title: required("title") }); break;
      case "validate": {
        const run = await loadValidatedRun(directory("run"));
        result = { status: "valid-blueprint", slug: run.blueprint.slug, blueprintSha256: run.blueprintSha256, evidenceSha256: run.evidenceSha256, review: run.blueprint.review };
        break;
      }
      case "approve": result = await approveBlueprint({ runDirectory: directory("run"), reviewer: required("reviewer"), note: required("note"), scope: options.scope || "user" }); break;
      case "scaffold": result = await scaffoldRepo({ runDirectory: directory("run"), outputDirectory: directory("output") }); break;
      case "inspect": result = await inspectMedia({ media: directory("media"), output: directory("output") }); break;
      case "check-repo": result = await checkRepo(directory("repo")); break;
      case "package-repo": result = await packageRepo({ repoDirectory: directory("repo"), output: directory("output") }); break;
      case "smoke": result = await smoke(); break;
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: "stopped", message: error.message }));
  process.exitCode = 1;
}
