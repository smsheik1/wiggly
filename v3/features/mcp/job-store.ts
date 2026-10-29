import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SubmitFilmInput, FinalizeFilmInput } from './schema';
import type { FilmJob, JobStatus, JobStage, SubmitFilmResult, GetFilmResult, FinalizeFilmResult } from './types';

export const MAX_AUTO_REROLLS_PER_FILM = 3;
export const MAX_REROLLS_PER_SHOT = 1;
export const DEFAULT_RETRY_AFTER_SEC = 15;

export function studioStateFile(runsRoot: string, jobId: string) {
  return path.join(runsRoot, jobId, 'outputs', 'state.json');
}

function studioView(state: { status?: string; pendingApproval?: string[] }): { status: JobStatus; currentStage: JobStage; progressPercent: number } {
  if (state.status === 'failed') return { status: 'failed', currentStage: 'ready_for_review', progressPercent: 100 };
  if (state.status === 'done') return { status: 'succeeded', currentStage: 'completed', progressPercent: 100 };
  if (state.status === 'awaiting-approval' || state.status === 'awaiting-production') {
    return { status: 'awaiting_approval', currentStage: 'ready_for_review', progressPercent: 60 };
  }
  return { status: 'processing', currentStage: 'rendering_shots', progressPercent: 30 };
}

export class JobStore {
  private jobs = new Map<string, FilmJob>();
  private idempotencyMap = new Map<string, string>(); // idempotencyKey -> jobId

  constructor(private readonly runsRoot?: string) {}

  /**
   * Submits a new film creation job or returns an existing one if the idempotencyKey matches.
   */
  async submitFilm(input: SubmitFilmInput): Promise<SubmitFilmResult> {
    const existingJobId = this.idempotencyMap.get(input.idempotencyKey);
    if (existingJobId) {
      const existing = this.jobs.get(existingJobId);
      if (existing) {
        return {
          jobId: existing.jobId,
          status: 'queued',
          estimatedRuntimeSec: 60,
          statusUrl: `https://wiggly.com/api/v1/jobs/${existing.jobId}`,
        };
      }
    }

    const jobId = `film_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const job: FilmJob = {
      jobId,
      idempotencyKey: input.idempotencyKey,
      status: 'queued',
      progressPercent: 5,
      currentStage: 'lineup_generation',
      retryAfterSec: DEFAULT_RETRY_AFTER_SEC,
      createdAt: now,
      updatedAt: now,
      input,
      rerollBudgetRemaining: MAX_AUTO_REROLLS_PER_FILM,
      rerollHistory: [],
    };

    this.jobs.set(jobId, job);
    this.idempotencyMap.set(input.idempotencyKey, jobId);

    return {
      jobId,
      status: 'queued',
      estimatedRuntimeSec: 60,
      statusUrl: `https://wiggly.com/api/v1/jobs/${jobId}`,
    };
  }

  /**
   * Retrieves current job status, draft previews, and contact sheet.
   */
  private async readStudio(jobId: string, stateFile?: string): Promise<{ status?: string; pendingApproval?: string[] } | null> {
    const file = stateFile ?? (this.runsRoot ? studioStateFile(this.runsRoot, jobId) : undefined);
    if (!file) return null;
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return null;
    }
  }

  async getFilm(jobId: string): Promise<GetFilmResult> {
    const job = this.jobs.get(jobId);
    const studio = await this.readStudio(jobId, job?.stateFile);
    if (!job && !studio) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const view = studio ? studioView(studio) : null;
    return {
      jobId: job?.jobId ?? jobId,
      status: view?.status ?? job?.status ?? 'processing',
      progressPercent: view?.progressPercent ?? job?.progressPercent ?? 0,
      currentStage: view?.currentStage ?? job?.currentStage ?? 'rendering_shots',
      retryAfterSec: job?.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC,
      draftPreviewUrl: job?.draftPreviewUrl,
      contactSheetUrl: job?.contactSheetUrl,
      clips: job?.clips,
      masterVideoUrl: job?.masterVideoUrl,
      rerollBudgetRemaining: job?.rerollBudgetRemaining ?? MAX_AUTO_REROLLS_PER_FILM,
      error: job?.error,
      ...(studio?.status ? { studioStatus: studio.status } : {}),
      ...(studio?.pendingApproval ? { pendingApproval: studio.pendingApproval } : {}),
    };
  }

  /**
   * Finalizes the film: either triggers a shot reroll or commits to the 1080p master export.
   */
  async finalizeFilm(input: FinalizeFilmInput): Promise<FinalizeFilmResult> {
    const job = this.jobs.get(input.jobId);
    if (!job) {
      throw new Error(`Job not found: ${input.jobId}`);
    }

    const now = new Date().toISOString();

    if (input.action === 'reroll_shot') {
      if (!input.rerollShotId) {
        throw new Error('rerollShotId is required when action is reroll_shot');
      }

      const shotRerolls = job.rerollHistory.filter((r) => r.shotId === input.rerollShotId).length;
      if (shotRerolls >= MAX_REROLLS_PER_SHOT) {
        throw new Error(`Shot ${input.rerollShotId} has reached the maximum allowed free reroll limit (${MAX_REROLLS_PER_SHOT}). Additional revisions require credit purchase.`);
      }

      if (job.rerollBudgetRemaining <= 0) {
        throw new Error('Film has exhausted its total reroll allowance. Additional revisions require credit purchase.');
      }

      job.rerollBudgetRemaining -= 1;
      job.rerollHistory.push({
        shotId: input.rerollShotId,
        notes: input.rerollNotes,
        timestamp: now,
      });

      job.status = 'processing';
      job.currentStage = 'rendering_shots';
      job.updatedAt = now;
      job.progressPercent = 50;

      return {
        jobId: job.jobId,
        status: 'rerolling',
        currentStage: 'rendering_shots',
        estimatedCompletionSec: 25,
        message: `Rerolling shot ${input.rerollShotId}. Notes: ${input.rerollNotes ?? 'none'}.`,
      };
    }

    if (input.action === 'order_1080p_master') {
      job.status = 'processing';
      job.currentStage = 'upscaling_1080p';
      job.updatedAt = now;
      job.progressPercent = 80;

      return {
        jobId: job.jobId,
        status: 'master_ordered',
        currentStage: 'upscaling_1080p',
        estimatedCompletionSec: 35,
        message: 'Order confirmed for 1080p theatrical master. Running bytedance/video-upscaler on Replicate.',
      };
    }

    throw new Error(`Unsupported action: ${(input as any).action}`);
  }

  /**
   * Internal helper for testing or backend pipeline driver to update job state.
   */
  updateJobState(jobId: string, updates: Partial<FilmJob>): FilmJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const updated = { ...job, ...updates, updatedAt: new Date().toISOString() };
    this.jobs.set(jobId, updated);
    return updated;
  }

  /**
   * Resets the store (useful in test suites).
   */
  clear(): void {
    this.jobs.clear();
    this.idempotencyMap.clear();
  }
}

// Global default singleton
export const defaultJobStore = new JobStore();
