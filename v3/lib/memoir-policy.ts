export function assetKey(kind: string, selectors: Record<string, string>): string {
  if (kind === "character" || kind === "sheetPrompt" || kind === "sheet" || kind === "candidates") return `${kind}:${selectors.characterId}`;
  if (kind === "backgroundAngleBrief" || kind === "backgroundAngle") return `${kind}:${selectors.angleId}`;
  if (kind === "backgroundBrief" || kind === "backgroundCandidates") return `${kind}:${selectors.locationId}`;
  if (kind === "keyframePrompt" || kind === "keyframe") return `${kind}:${selectors.shotId}`;
  if (kind === "videoPrompt" || kind === "video") return `${kind}:${selectors.clipId}`;
  if (kind === "effect") return `${kind}:${selectors.effectId}`;
  return kind;
}

export function assertAllowed(projection: any, kind: string): void {
  // Pure stub for Phase 2 decoupling. Real auth is enforced by the StudioProduction SQLite policies.
  if (projection.step !== kind && kind !== "film") throw new Error("MEMOIR_POLICY_VIOLATION: Step mismatch");
}

export function validateArtifactContent(format: any, projection: any, content: any, workerId: string): void {
  // In the legacy orchestrator, this pushed to `p.artifacts`.
  // In the new SQLite Studio, we just validate using Zod (already done in candidateValidator)
  // and we do NOT need to push to a fake LangGraph state.
  return;
}

export function assemblyManifest(p: any, rendererIdentityDigest: string) {
  const current = (key: string) => p.artifacts.find((a: any) => a.key === key);
  return {
    renderer: 'wiggly-remotion-memoir-v1',
    rendererDigest: rendererIdentityDigest,
    formatVersion: p.formatVersion,
    projectId: p.id,
    shots: current('shots').content,
    videoPlan: current('videoPlan').content,
    edit: current('editPlan').content,
    narration: current('narration').content.files,
    music: current('soundPlan').content.music ? current('music').content.files[0] : null,
    effects: current('soundPlan').content.effects.map((e: any) => ({ ...e, file: current(`effect:${e.id}`).content.files[0] })),
    clips: current('videoPlan').content.clips.map((c: any) => ({ ...c, file: current(`video:${c.id}`).content.files[0] }))
  };
}

export function requestDescriptor(planning: any, plan: any) {
  if (plan.operation === "backgroundAngle" || plan.operation === "backgroundCandidates") {
    const briefKey = plan.operation === "backgroundAngle" ? "backgroundAngleBrief" : "backgroundBrief";
    const brief = planning.artifacts.find((a: any) => a.key === `${briefKey}:${planning.locationId}`);
    return {
      n: plan.operation === "backgroundAngle" ? 1 : 3,
      model: "muse-image-1.0",
      endpoint: "https://api.meta.ai/v1/models/muse-image-1.0:generate",
      prompt: plan.parameters.prompt,
      images: brief ? brief.content.references : []
    };
  }
  throw new Error("Unsupported plan operation");
}

export function remediation(provider: string, secretsPath: string) {
  return `Please check ${provider} API Key in ${secretsPath}`;
}
