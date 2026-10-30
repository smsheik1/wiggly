import type { SubmitFilmInput, FinalizeFilmInput } from './schema';

export type JobStatus = 'queued' | 'processing' | 'awaiting_approval' | 'succeeded' | 'failed';

export type JobStage =
  | 'lineup_generation'
  | 'rendering_shots'
  | 'vision_qc'
  | 'audio_assembly'
  | 'ready_for_review'
  | 'upscaling_1080p'
  | 'completed';

export interface RenderedClip {
  beatId: number;
  previewUrl: string;
  durationSec: number;
  retries: number;
  qcStatus: 'passed' | 'retrying' | 'failed';
}

export interface FilmJob {
  jobId: string;
  idempotencyKey: string;
  status: JobStatus;
  progressPercent: number;
  currentStage: JobStage;
  retryAfterSec: number;
  createdAt: string;
  updatedAt: string;
  input: SubmitFilmInput;
  stateFile?: string;
  rerollBudgetRemaining: number;
  rerollHistory: Array<{
    shotId: number;
    notes?: string;
    timestamp: string;
  }>;
  draftPreviewUrl?: string;
  contactSheetUrl?: string;
  clips?: RenderedClip[];
  masterVideoUrl?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface SubmitFilmResult {
  jobId: string;
  status: 'queued';
  estimatedRuntimeSec: number;
  statusUrl: string;
}

export interface GetFilmResult {
  jobId: string;
  status: JobStatus;
  progressPercent: number;
  currentStage: JobStage;
  retryAfterSec: number;
  draftPreviewUrl?: string;
  contactSheetUrl?: string;
  clips?: RenderedClip[];
  masterVideoUrl?: string;
  rerollBudgetRemaining: number;
  error?: {
    code: string;
    message: string;
  };
  studioStatus?: string;
  pendingApproval?: string[];
}

export interface FinalizeFilmResult {
  jobId: string;
  status: 'rerolling' | 'master_ordered';
  currentStage: JobStage;
  estimatedCompletionSec: number;
  message: string;
}
