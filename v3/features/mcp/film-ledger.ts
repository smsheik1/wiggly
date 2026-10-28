import { CREDIT_PACK_GRANT, MONTHLY_CREDIT_GRANT, generationCredits } from "./credits";

export function checkoutUrl(kind: CheckoutKind, token: string) {
  const choice = kind === "subscription" ? "plan=monthly" : "pack=1900";
  return `https://wiggly.agentenamel.com/billing/credits?${choice}&checkout=${token}`;
}

function openCheckout(account: Account, kind: CheckoutKind) {
  if (account.checkoutStatus === "open" && account.checkoutKind === kind && account.checkoutToken) {
    return checkoutUrl(kind, account.checkoutToken);
  }
  account.checkoutToken = crypto.randomUUID();
  account.checkoutKind = kind;
  account.checkoutStatus = "open";
  return checkoutUrl(kind, account.checkoutToken);
}

export const DRAFT_STAGES = ["queued", "lineup", "beats", "assembly", "ready", "failed"] as const;
export type DraftStage = (typeof DRAFT_STAGES)[number];
const ACTIVE_STAGES: DraftStage[] = ["queued", "lineup", "beats", "assembly"];
const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;
const UPLOAD_TTL_MS = 60 * 60 * 1000;

export type Storyboard = {
  title: string;
  subject: string;
  beats: Array<{
    duration_sec: number;
    action: string;
    camera: string;
    narration_line?: string;
  }>;
  characters: Array<{ name: string }>;
  hero_props: Array<{ name: string }>;
};

export type DraftJob = {
  jobId: string;
  stage: DraftStage;
  creditsCharged: number;
  creditsRefunded: boolean;
  videoUrl?: string;
  error?: string;
  correlationId: string;
  storyboard?: Storyboard;
  beatUrls?: string[];
  stillUrls?: string[];
};

export type Quote = {
  quoteId: string;
  key: string;
  credits: number;
  expiresAt: number;
  jobId?: string;
};

export type CheckoutKind = "subscription" | "pack";

export type Account = {
  subscribed: boolean;
  paymentPending: boolean;
  monthlyCredits: number;
  purchasedCredits: number;
  labels: string[];
  quotes: Quote[];
  jobs: DraftJob[];
  checkoutToken?: string;
  checkoutKind?: CheckoutKind;
  checkoutStatus?: "open" | "paid";
  stripeCustomerId?: string;
  uploadId?: string;
  uploadExpiresAt?: number;
};

export type LedgerResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string };

function balance(account: Account) {
  return account.monthlyCredits + account.purchasedCredits;
}

function storyboardKey(storyboard: Storyboard, labels: string[]) {
  const canonical = {
    title: storyboard.title.trim(),
    subject: storyboard.subject.trim(),
    beats: storyboard.beats.map((beat) => ({
      duration_sec: beat.duration_sec,
      action: beat.action.trim(),
      camera: beat.camera.trim(),
      narration_line: beat.narration_line?.trim() ?? "",
    })),
    characters: storyboard.characters.map((character) => character.name.trim()),
    hero_props: storyboard.hero_props.map((prop) => prop.name.trim()),
    labels: labels.map((label) => label.trim()).sort(),
  };
  return JSON.stringify(canonical);
}

function quoteCost(storyboard: Storyboard) {
  const videoSeconds = storyboard.beats.reduce((sum, beat) => sum + beat.duration_sec, 0);
  const images = storyboard.characters.length + storyboard.hero_props.length + 1;
  const voiceCharacters = storyboard.beats.reduce(
    (sum, beat) => sum + (beat.narration_line?.trim().length ?? 0),
    0,
  );
  return generationCredits({ videoSeconds, images, voiceCharacters });
}

function problems(storyboard: Storyboard, labels: string[]) {
  const issues: string[] = [];
  if (!storyboard.title.trim()) issues.push("storyboard.title is empty");
  if (!storyboard.subject.trim()) issues.push("storyboard.subject is empty");
  if (storyboard.beats.length !== 7) {
    issues.push(`storyboard.beats has ${storyboard.beats.length} items and must have exactly 7`);
  }
  storyboard.beats.forEach((beat, index) => {
    if (!(beat.duration_sec > 0)) issues.push(`storyboard.beats[${index}].duration_sec must be greater than 0`);
    if (!beat.action.trim()) issues.push(`storyboard.beats[${index}].action is empty`);
    if (!beat.camera.trim()) issues.push(`storyboard.beats[${index}].camera is empty`);
  });
  const names = storyboard.characters.map((character) => character.name.trim()).filter(Boolean);
  if (names.length === 0) issues.push("storyboard.characters is empty");
  const labelSet = new Set(labels.map((label) => label.trim()));
  const nameSet = new Set(names);
  for (const name of names) {
    if (!labelSet.has(name)) {
      issues.push(`character ${name} does not match a photo label. Valid labels: ${[...labelSet].join(", ") || "(none)"}`);
    }
  }
  for (const label of labelSet) {
    if (!nameSet.has(label)) issues.push(`photo label ${label} has no matching character`);
  }
  return issues;
}

export class MemoryFilmLedger {
  private accounts = new Map<string, Account>();

  private account(accountId: string) {
    let account = this.accounts.get(accountId);
    if (!account) {
      account = {
        subscribed: false,
        paymentPending: false,
        monthlyCredits: 0,
        purchasedCredits: 0,
        labels: [],
        quotes: [],
        jobs: [],
      };
      this.accounts.set(accountId, account);
    }
    return account;
  }

  setAccount(accountId: string, patch: Partial<Pick<Account, "subscribed" | "paymentPending" | "monthlyCredits" | "purchasedCredits">>) {
    Object.assign(this.account(accountId), patch);
  }

  attachPhotos(accountId: string, labels: string[]) {
    this.account(accountId).labels = labels.map((label) => label.trim()).filter(Boolean);
  }

  openUpload(accountId: string): { uploadUrl: string; expiresAt: string } {
    const account = this.account(accountId);
    const uploadId = crypto.randomUUID();
    account.uploadId = uploadId;
    account.uploadExpiresAt = Date.now() + UPLOAD_TTL_MS;
    return {
      uploadUrl: `https://wiggly.agentenamel.com/upload/${uploadId}`,
      expiresAt: new Date(account.uploadExpiresAt).toISOString(),
    };
  }

  findUpload(uploadId: string) {
    for (const [accountId, account] of this.accounts) {
      if (account.uploadId !== uploadId || !account.uploadExpiresAt) continue;
      if (account.uploadExpiresAt <= Date.now()) return null;
      return { accountId, expiresAt: new Date(account.uploadExpiresAt).toISOString() };
    }
    return null;
  }

  private activeJob(account: Account) {
    return account.jobs.find((job) => ACTIVE_STAGES.includes(job.stage));
  }

  private jobPayload(job: DraftJob): Record<string, unknown> {
    return {
      job_id: job.jobId,
      stage: job.stage,
      retryAfterSec: 15,
      credits_charged: job.creditsCharged,
      ...(job.videoUrl ? { videoUrl: job.videoUrl } : {}),
      ...(job.error ? { error: job.error, correlationId: job.correlationId, creditsRefunded: job.creditsRefunded } : {}),
    };
  }

  submitDraft(accountId: string, input: { storyboard: Storyboard; confirm?: boolean; quoteId?: string }): LedgerResult {
    const account = this.account(accountId);
    if (account.labels.length === 0) {
      const upload = this.openUpload(accountId);
      return {
        ok: false,
        message: `No photos yet. Open ${upload.uploadUrl} and label each photo, then call wiggly_submit_draft again. It expires at ${upload.expiresAt}.`,
      };
    }

    const credits = balance(account);
    if (!account.subscribed && credits === 0 && !account.paymentPending) {
      return {
        ok: false,
        message: `No credits yet. Subscribe for $19, which grants 1900 credits, at ${openCheckout(account, "subscription")}. Then call wiggly_submit_draft again.`,
      };
    }
    if (account.paymentPending && credits === 0) {
      return { ok: false, message: "Payment pending, retry shortly. Call wiggly_submit_draft again. Do not open a second checkout." };
    }
    if (account.subscribed && credits === 0) {
      return {
        ok: false,
        message: `No credits left. Buy 1900 more for $19 at ${openCheckout(account, "pack")}. Then call wiggly_submit_draft again.`,
      };
    }

    if (input.confirm) {
      const running = this.activeJob(account);
      if (running) return { ok: true, data: this.jobPayload(running) };
    }

    const issues = problems(input.storyboard, account.labels);
    if (issues.length > 0) {
      return { ok: false, message: `${issues.join(" ")} Next tool: wiggly_submit_draft.` };
    }

    const cost = quoteCost(input.storyboard).total;
    if (credits < cost) {
      const url = openCheckout(account, account.subscribed ? "pack" : "subscription");
      return {
        ok: false,
        message: `This draft costs ${cost} credits and the balance is ${credits}. Buy more at ${url}, then call wiggly_submit_draft again. The film is not shortened to fit the balance.`,
      };
    }

    const key = storyboardKey(input.storyboard, account.labels);
    if (!input.confirm) {
      const quote: Quote = { quoteId: crypto.randomUUID(), key, credits: cost, expiresAt: Date.now() + QUOTE_TTL_MS };
      account.quotes.push(quote);
      return { ok: true, data: { quote_id: quote.quoteId, credits: cost, balance: credits } };
    }

    const quote = account.quotes.find((item) => item.quoteId === input.quoteId);
    if (!quote) return { ok: false, message: "quote_id was not found. Call wiggly_submit_draft without confirm to get a quote." };
    if (quote.expiresAt <= Date.now()) {
      return { ok: false, message: "quote_id expired. Call wiggly_submit_draft without confirm to get a new quote." };
    }
    if (quote.key !== key) {
      return { ok: false, message: "quote_id does not match this storyboard and these photo labels. Call wiggly_submit_draft without confirm." };
    }
    if (quote.jobId) {
      const existing = account.jobs.find((job) => job.jobId === quote.jobId);
      if (existing) return { ok: true, data: this.jobPayload(existing) };
    }
    if (balance(account) < quote.credits) {
      const url = openCheckout(account, account.subscribed ? "pack" : "subscription");
      return { ok: false, message: `The quote costs ${quote.credits} credits and the balance is ${balance(account)}. Buy more at ${url}.` };
    }

    let remaining = quote.credits;
    const fromMonthly = Math.min(account.monthlyCredits, remaining);
    account.monthlyCredits -= fromMonthly;
    remaining -= fromMonthly;
    account.purchasedCredits -= remaining;
    const job: DraftJob = {
      jobId: crypto.randomUUID(),
      stage: "queued",
      creditsCharged: quote.credits,
      creditsRefunded: false,
      correlationId: crypto.randomUUID(),
      storyboard: input.storyboard,
    };
    quote.jobId = job.jobId;
    account.jobs.push(job);
    return { ok: true, data: this.jobPayload(job) };
  }

  getDraft(accountId: string, jobId?: string): LedgerResult {
    const account = this.account(accountId);
    const job = jobId ? account.jobs.find((item) => item.jobId === jobId) : account.jobs.at(-1);
    if (!job) {
      return { ok: false, message: jobId ? "That job_id is not on this account. Call wiggly_get_draft without job_id to see the latest job." : "No draft job yet. Call wiggly_open_upload, then wiggly_submit_draft." };
    }
    return { ok: true, data: this.jobPayload(job) };
  }

  exportState(accountId: string): Account {
    return structuredClone(this.account(accountId));
  }

  importState(accountId: string, account: Account) {
    this.accounts.set(accountId, structuredClone(account));
  }

  applyPayment(accountId: string, kind: CheckoutKind, stripeCustomerId?: string) {
    const account = this.account(accountId);
    account.paymentPending = false;
    account.checkoutStatus = "paid";
    if (stripeCustomerId) account.stripeCustomerId = stripeCustomerId;
    if (kind === "subscription") {
      account.subscribed = true;
      account.monthlyCredits = MONTHLY_CREDIT_GRANT;
      return;
    }
    account.purchasedCredits += CREDIT_PACK_GRANT;
  }

  addStillUrl(accountId: string, jobId: string, url: string) {
    const job = this.account(accountId).jobs.find((item) => item.jobId === jobId);
    if (!job || job.stage === "failed" || job.stage === "ready") return;
    job.stillUrls = [...(job.stillUrls ?? []), url];
  }

  addBeatUrl(accountId: string, jobId: string, url: string) {
    const job = this.account(accountId).jobs.find((item) => item.jobId === jobId);
    if (!job || job.stage === "failed" || job.stage === "ready") return;
    job.beatUrls = [...(job.beatUrls ?? []), url];
  }

  setStage(accountId: string, jobId: string, stage: DraftStage, videoUrl?: string) {
    const job = this.account(accountId).jobs.find((item) => item.jobId === jobId);
    if (!job || job.stage === "failed" || job.stage === "ready") return;
    job.stage = stage;
    if (videoUrl) job.videoUrl = videoUrl;
  }

  failJob(accountId: string, jobId: string, error: string) {
    const account = this.account(accountId);
    const job = account.jobs.find((item) => item.jobId === jobId);
    if (!job || job.stage === "ready" || job.creditsRefunded) return;
    job.stage = "failed";
    job.error = error;
    job.creditsRefunded = true;
    account.purchasedCredits += job.creditsCharged;
  }
}
