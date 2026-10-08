import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute, dirname, basename, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { StudioProduction } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
import { hash } from "./harness.js";
import { loadMemoirFormat } from "./memoir-format.js";

export const rehearsalProject = "shaz-memoir-rehearsal";
export const capabilityQuote = {
  id: "perception-capability-v1", provider: "gemini", model: "gemini-3.8-flash",
  allowance_micros: 200000, max_calls: 3, estimate_micros_per_call: 60000,
  rate_source: "https://ai.google.dev/gemini-api/docs/pricing", verified_at: "2026-10-07",
  input_usd_per_million: .75, output_usd_per_million: 3.75,
  basis: "Conservative 32768 input + 8192 output tokens per small fixture call; three calls reserve $0.18 within a $0.20 allowance. Free-tier eligibility, current quota and invoice charges are unknown.",
  deliverables: ["Image: observe a held-out spatial/color pattern", "Video: observe a held-out temporal change", "Audio: hear a held-out spoken phrase"],
  scope: "Explicit locally synthesized capability fixtures only. No private photos, voice cloning, new production media or fallback/retry requests.",
  authorized: false,
};
export function directoryHashes(root: string): Record<string, string> {
  const found: Record<string, string> = {};
  const visit = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error("SOURCE_SYMLINK_NOT_SUPPORTED");
    if (entry.isDirectory()) visit(path); else if (entry.isFile()) found[relative(root, path)] = hash(readFileSync(path));
  } }; visit(root); return found;
}
export function assertPreserved(root: string, expected: Record<string, string>) {
  if (JSON.stringify(Object.entries(directoryHashes(root)).sort()) !== JSON.stringify(Object.entries(expected).sort())) throw new Error("SAVED_PRODUCTION_CHANGED");
}
function canonicalDestination(value: string) {
  let ancestor = resolve(value); const suffix: string[] = [];
  while (!existsSync(ancestor)) { suffix.unshift(basename(ancestor)); ancestor = dirname(ancestor); }
  return join(realpathSync(ancestor), ...suffix);
}
export async function prepareRehearsal(options: { root: string; kit: string; source: string; preferredScript: string; authoredScript: string }) {
  const root = canonicalDestination(options.root), source = realpathSync(resolve(options.source));
  const contains = (base: string, target: string) => { const distance = relative(base, target); return !distance || (!isAbsolute(distance) && distance !== ".." && !distance.startsWith(".." + sep)); };
  if (contains(source, root) || contains(root, source)) throw new Error("ISOLATED_REHEARSAL_REQUIRED");
  if (existsSync(join(root, "manifest.json")) || existsSync(join(root, "preparation-started.json"))) throw new Error("REHEARSAL_ALREADY_PREPARED_NO_RESET");
  const format = await loadMemoirFormat(resolve(options.kit));
  const inputs = format.contracts.Inputs.parse(JSON.parse(readFileSync(join(source, "inputs.json"), "utf8")));
  const preferred = JSON.parse(readFileSync(options.preferredScript, "utf8"));
  const script = format.contracts.Content.script.parse(JSON.parse(readFileSync(options.authoredScript, "utf8")));
  if (JSON.stringify(script.beats.map((b: any) => b.narration)) !== JSON.stringify(preferred.beats.map((b: any) => b.narration))) throw new Error("PREFERRED_NARRATION_CHANGED");
  // Pure content checks; no fake SQL approvals or inspection receipts are constructed.
  format.workflow.validateArtifactContent({ step: "script", inputs, studio: { config: format.config }, artifacts: [] }, script, "active-operating-codex");
  const baseline = directoryHashes(source);
  const evidenceNames = ["inputs.json", "answers-approval.json", "script-approval.json", "voice-consent-note.json", "photo-rights-note.json", "photo-inventory.json", "late-teen-creative-direction.json", "existing-voice-lookup.json"];
  const evidence = Object.fromEntries(evidenceNames.map(name => [name, readFileSync(join(source, name))]));
  const voice = JSON.parse(evidence["existing-voice-lookup.json"].toString());
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "preparation-started.json"), JSON.stringify({ started_at: new Date().toISOString(), source }), { flag: "wx", mode: 0o600 });
  mkdirSync(join(root, "references"), { recursive: true }); mkdirSync(join(root, "drafts"), { recursive: true });
  for (const [name, bytes] of Object.entries(evidence)) writeFileSync(join(root, "references", name), bytes, { flag: "wx", mode: 0o400 });
  writeFileSync(join(root, "references/preferred-script.json"), readFileSync(options.preferredScript), { flag: "wx", mode: 0o400 });
  writeFileSync(join(root, "drafts/script.json"), JSON.stringify(script, null, 2), { flag: "wx", mode: 0o600 });
  const store = new StudioProduction(root), principal = provisionLocalOperator(root);
  try {
    store.createProject(rehearsalProject, 0);
    store.activateMemoirPolicy(signLocalOperator(root, { id: "rehearsal-policy", principal, project_id: rehearsalProject, action: "activate_memoir_policy" as const, source_inputs: inputs }));
    store.configureConcurrency(rehearsalProject, 2, { openrouter: 2, gemini: 1, cartesia: 1, "meta-muse": 1, replicate: 1 });
    const manifest = { project_id: rehearsalProject, status: "PREPARED_AWAITING_CAPABILITY_ALLOWANCE", started_at: new Date().toISOString(), source, saved_production_hashes: baseline,
      preferred_script_hash: hash(readFileSync(options.preferredScript)), authored_script_hash: hash(Buffer.from(JSON.stringify(script))), format_source_digest: format.source_digest,
      author: "active operating Codex; metadata/cast repair; narration unchanged", independent_review: "PENDING", director_approval: "PENDING", paid_calls: 0, voice_selection: voice,
      provenance: Object.fromEntries(Object.entries(evidence).map(([name, bytes]) => [name, { path: join(source, name), sha256: hash(bytes) }])),
      models: { writer: "moonshotai/kimi-k3", execution: "deepseek/deepseek-v4.1-flash", route: "decart/fp4", perception: "gemini-3.8-flash" },
      defaults: { author_turns: 12, reviewer_turns: 12, generation_attempts: 3, music: false, effects: false, lip_sync: false },
      targets: { provider_usd: 15, director_active_seconds: 10800, elapsed_seconds: 259200, proud_to_share: true },
      boundaries: { legacy_resume: false, approvals_migrated: false, public_share_uploaded: false } };
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
    writeFileSync(join(root, "capability-batch.json"), JSON.stringify(capabilityQuote, null, 2), { flag: "wx", mode: 0o600 });
    writeFileSync(join(root, "revision-expectation.json"), JSON.stringify({ status: "DECLARED_BEFORE_EXECUTION", request: { beat: 2, from: "no AC", to: "no air-conditioning" }, expected_changed: ["beat-2 script/transcript", "beat-2 narration", "audio mix", "scene/export"], expected_preserved: ["narration beats 1,3,4", "character sheets", "backgrounds", "keyframes", "generated footage"], baseline_hashes: "Capture exact accepted hashes before revision; baseline film not yet produced", timing: "Measure delivery; 200ms is diagnostic, not an automatic footage regeneration trigger" }, null, 2), { flag: "wx", mode: 0o600 });
    writeFileSync(join(root, "director-time.jsonl"), "", { flag: "wx", mode: 0o600 });
    writeFileSync(join(root, "scorecard.json"), JSON.stringify({ status: "NOT_YET_EVALUATED", provider_spend_usd: null, verified_cash_charges_usd: null, allowance_consumed_micros: 0, director_active_seconds: null, proud_to_share: null, note: "Missing measurements are unknown, not zero. No new paid scope authorized." }, null, 2), { flag: "wx", mode: 0o600 });
    assertPreserved(source, baseline);
    return { root, project_id: rehearsalProject, paused: store.project(rehearsalProject).paused, allowance: store.allowance(rehearsalProject), script_contract: "PASS", saved_files_unchanged: Object.keys(baseline).length, new_paid_calls: 0 };
  } finally { store.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { root: { type: "string" }, kit: { type: "string" }, source: { type: "string" }, preferred: { type: "string" }, authored: { type: "string" } } });
  if (positionals[0] !== "prepare" || !values.root || !values.kit || !values.source || !values.preferred || !values.authored) throw new Error("Use rehearsal.ts prepare --root --kit --source --preferred --authored. This command has no provider calls.");
  console.log(JSON.stringify(await prepareRehearsal({ root: values.root, kit: values.kit, source: values.source, preferredScript: values.preferred, authoredScript: values.authored }), null, 2));
}
