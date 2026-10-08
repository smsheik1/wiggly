import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tool } from "langchain";
import { z } from "zod";
import { hash } from "./harness.js";

/** Producer-bound unresolved uploads. Identities are never inferred from appearance. */
export type ReferencePhoto = { id: string; path: string; sha256: string; width: number; height: number; mime: "image/jpeg" | "image/png" };
const person = z.object({ label: z.string().regex(/^[A-Z]$/), description: z.string().min(3).max(200),
  region: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }).strict(),
}).strict();
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));

export function referenceIntakeTools(photos: ReferencePhoto[], draftDirectory: string, onClarification?: (question: string, previewPath: string) => void) {
  const inspected = new Set<string>();
  const inventory = new Map(photos.map(p => [p.id, p]));
  if (inventory.size !== photos.length) throw new Error("DUPLICATE_REFERENCE_PHOTO_ID");
  const bytesFor = (id: string) => {
    const photo = inventory.get(id);
    if (!photo) throw new Error("REFERENCE_NOT_IN_ASSIGNMENT");
    const bytes = readFileSync(photo.path);
    if (hash(bytes) !== photo.sha256) throw new Error("REFERENCE_PHOTO_CHANGED");
    if (!Number.isInteger(photo.width) || !Number.isInteger(photo.height) || photo.width <= 0 || photo.height <= 0) throw new Error("REFERENCE_DIMENSIONS_REQUIRED");
    return {photo, bytes};
  };
  const inspect = tool(({ photo_id }) => {
    const {photo, bytes} = bytesFor(photo_id); inspected.add(photo_id);
    return [
      {type: "text", text: `Inspect this actual photo (${photo.id}, sha256 ${photo.sha256}, ${photo.width}x${photo.height}). Locate EVERY visible person. Do not guess names, relationships or ages. If identity is unresolved, call ask_reference_identities with letter labels and approximate source-pixel regions. That tool shows the operator a preview and ends this run. Inventory: ${JSON.stringify(photos.map(({id}) => id))}`},
      {type: "image_url", image_url: {url: `data:${photo.mime};base64,${bytes.toString("base64")}`}},
    ];
  }, {name: "inspect_reference_photo", description: `See actual image bytes to locate people, not filenames. Available photo IDs: ${JSON.stringify(photos.map(p => p.id))}`, schema: z.object({photo_id: z.string()}).strict()});
  const clarify = tool(({ photo_id, people }) => {
    if (!inspected.has(photo_id)) throw new Error("REFERENCE_INSPECTION_REQUIRED");
    const {photo, bytes} = bytesFor(photo_id);
    if (new Set(people.map(p => p.label)).size !== people.length) throw new Error("DUPLICATE_PERSON_LABEL");
    for (const {region: r} of people) if (r.x + r.width > photo.width || r.y + r.height > photo.height) throw new Error("PERSON_REGION_OUTSIDE_PHOTO");
    const boxes = people.map(({label, description, region:r}) => `<g><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#ffdd00" stroke-width="5"/><rect x="${r.x}" y="${r.y}" width="44" height="44" fill="#ffdd00"/><text x="${r.x+22}" y="${r.y+31}" text-anchor="middle" font-family="sans-serif" font-size="30" fill="black">${label}</text><title>${escape(description)}</title></g>`).join("");
    const preview = join(draftDirectory, `reference-${photo.sha256}.svg`);
    writeFileSync(preview, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${photo.width}" height="${photo.height}" viewBox="0 0 ${photo.width} ${photo.height}"><image width="${photo.width}" height="${photo.height}" xlink:href="data:${photo.mime};base64,${bytes.toString("base64")}"/>${boxes}</svg>`, {mode:0o600});
    const result = {status: "NEEDS_DIRECTOR_IDENTIFICATION", photo_id, source_sha256: photo.sha256, preview_path: preview, people,
      question: `Who is ${people.map(p => p.label).join(", ")}? Please identify each labelled person. Also tell us if this photo should guide a different age in the film.`,
      generation_allowed: false,
      display_markdown: `![Labelled people](${preview})\n\nWho is ${people.map(p => p.label).join(", ")}? Identify each person and any requested age adjustment.`};
    writeFileSync(join(draftDirectory, `reference-${photo.sha256}-question.json`), JSON.stringify(result,null,2), {mode:0o600});
    onClarification?.(result.question, preview);
    return result;
  }, {name: "ask_reference_identities", description: "After visually inspecting the photo, label ALL visible people with source-pixel regions. Save a visual preview and ask the director who each person is. Ends the run; this proposal grants no identity, crop or generation approval.", schema: z.object({photo_id:z.string(), people:z.array(person).min(1).max(26)}).strict(), returnDirect:true});
  return [inspect, clarify] as const;
}
