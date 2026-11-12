import { AgentUnavailableError } from "../../v3/lib/agent-bridge.ts";
import { ArticleFetchError } from "./article-fetch.mjs";
import { NewsMcpError } from "./newsmcp.mjs";
import { JevApiError, JevDirectorSkipError } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/director-jev.mjs";
import { SerperApiError } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/serper-search.mjs";
import { VoiceSynthesisError } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/voice.mjs";

/**
 * Fatal studio error that stops the current run (and alerts Telegram unless `canAlert` is false).
 */
export class RunStopError extends Error {
  constructor(
    message,
    {
      code = "RUN_STOP",
      stage = null,
      headline = null,
      canAlert = true,
      cause,
    } = {},
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "RunStopError";
    this.code = code;
    this.stage = stage;
    this.headline = headline;
    this.canAlert = canAlert;
  }
}

/**
 * Story/candidate-specific failure that skips only the current candidate and lets the batch continue.
 */
export class CandidateSkipError extends Error {
  constructor(message, { stage = "candidate", cause } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "CandidateSkipError";
    this.stage = stage;
  }
}

/**
 * Raised when script authoring fails validation across all retry attempts for one story.
 */
export class ScriptAuthorError extends CandidateSkipError {
  constructor(message, attempts = [], options) {
    super(message, { stage: "script-author", cause: options?.cause });
    this.name = "ScriptAuthorError";
    this.attempts = attempts;
  }
}

export function isJsCodeBug(err) {
  return (
    err instanceof TypeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError ||
    err instanceof RangeError
  );
}

export function isSerperAccountError(err) {
  if (err instanceof SerperApiError || err?.name === "SerperApiError") {
    return err.isAccountError !== false;
  }
  return false;
}

export function isVoiceAccountError(err) {
  return err instanceof VoiceSynthesisError || err?.name === "VoiceSynthesisError";
}

export function isJevAccountError(err) {
  const msg = String(err?.message || "");
  if (/\[JEV_CANDIDATE_SKIP\]|Jev gave no valid /i.test(msg)) {
    return false;
  }
  if (err instanceof JevApiError || err?.name === "JevApiError") {
    return err.isAccountError !== false;
  }
  return /TYPESAFE_API_KEY|JEV_API_KEY|TypeSafe.*billing|Jev Director API.*HTTP\s*(401|402|403|429)/i.test(msg);
}

export function isJevCandidateSkipError(err) {
  const msg = String(err?.message || "");
  return (
    err instanceof JevDirectorSkipError ||
    err?.name === "JevDirectorSkipError" ||
    /\[JEV_CANDIDATE_SKIP\]|Jev gave no valid /i.test(msg)
  );
}

/**
 * Classifies any error thrown inside a studio run into either:
 * - `{ kind: "skip", stage, error }` (candidate-scoped failure)
 * - `{ kind: "stop", headline, canAlert, error }` (run-level or unknown failure)
 */
export function classifyRunError(err) {
  if (err instanceof ScriptAuthorError || err?.name === "ScriptAuthorError") {
    return { kind: "skip", stage: "script-author", error: err };
  }
  if (err instanceof ArticleFetchError || err?.name === "ArticleFetchError") {
    return { kind: "skip", stage: "article-fetch", error: err };
  }
  if (isJevCandidateSkipError(err)) {
    const skipErr =
      err instanceof CandidateSkipError
        ? err
        : new CandidateSkipError(err.message, { stage: "jev-director", cause: err });
    return { kind: "skip", stage: "jev-director", error: skipErr };
  }
  if (err instanceof CandidateSkipError) {
    return { kind: "skip", stage: err.stage || "candidate", error: err };
  }

  if (err instanceof RunStopError) {
    return {
      kind: "stop",
      headline: err.headline || err.code || "Studio Run Stopped",
      canAlert: err.canAlert !== false,
      error: err,
    };
  }
  if (err instanceof AgentUnavailableError || err?.name === "AgentUnavailableError") {
    return { kind: "stop", headline: "Agent Unavailable", canAlert: true, error: err };
  }
  if (err instanceof NewsMcpError || err?.name === "NewsMcpError") {
    return { kind: "stop", headline: "NewsMCP Failure", canAlert: true, error: err };
  }
  if (isVoiceAccountError(err)) {
    return { kind: "stop", headline: "Voice Synthesis Failure (Cartesia)", canAlert: true, error: err };
  }
  if (isSerperAccountError(err)) {
    return { kind: "stop", headline: "Serper Image Search Failure", canAlert: true, error: err };
  }
  if (isJevAccountError(err)) {
    return { kind: "stop", headline: "Jev Director API Failure", canAlert: true, error: err };
  }
  if (err?.name === "BufferApiError" && err?.isAccountError) {
    return { kind: "stop", headline: "Buffer API Failure", canAlert: true, error: err };
  }

  return {
    kind: "stop",
    headline: "Unexpected Studio Failure",
    canAlert: true,
    error: err instanceof Error ? err : new Error(String(err)),
  };
}
