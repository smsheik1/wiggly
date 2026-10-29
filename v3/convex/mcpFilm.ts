import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { MemoryFilmLedger, type Account, type Storyboard } from "../features/mcp/film-ledger";

const storyboardValidator = v.object({
  title: v.string(),
  subject: v.string(),
  beats: v.array(v.object({
    duration_sec: v.number(),
    action: v.string(),
    camera: v.string(),
    narration_line: v.optional(v.string()),
  })),
  characters: v.array(v.object({ name: v.string() })),
  hero_props: v.array(v.object({ name: v.string() })),
});

async function readAccount(ctx: QueryCtx | MutationCtx, workosUserId: string): Promise<Account> {
  const row = await ctx.db.query("mcpAccounts").withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId)).unique();
  if (!row) {
    return {
      subscribed: false,
      paymentPending: false,
      monthlyCredits: 0,
      purchasedCredits: 0,
      labels: [],
      quotes: [],
      jobs: [],
    };
  }
  const balance = await ctx.db.query("mcpCreditBalances").withIndex("by_accountId", (q) => q.eq("accountId", row._id)).unique();
  const quotes = await ctx.db.query("mcpQuotes").withIndex("by_accountId", (q) => q.eq("accountId", row._id)).collect();
  const jobs = await ctx.db.query("mcpJobs").withIndex("by_accountId", (q) => q.eq("accountId", row._id)).collect();
  jobs.sort((left, right) => left.createdAt - right.createdAt);
  return {
    subscribed: row.subscribed,
    paymentPending: row.paymentPending,
    monthlyCredits: balance?.monthlyCredits ?? 0,
    purchasedCredits: balance?.purchasedCredits ?? 0,
    labels: row.labels,
    ...(row.checkoutToken ? { checkoutToken: row.checkoutToken } : {}),
    ...(row.checkoutKind ? { checkoutKind: row.checkoutKind } : {}),
    ...(row.checkoutStatus ? { checkoutStatus: row.checkoutStatus } : {}),
    ...(row.stripeCustomerId ? { stripeCustomerId: row.stripeCustomerId } : {}),
    ...(row.uploadId ? { uploadId: row.uploadId } : {}),
    ...(row.uploadExpiresAt ? { uploadExpiresAt: row.uploadExpiresAt } : {}),
    quotes: quotes.map((quote) => ({
      quoteId: quote.quoteId,
      key: quote.key,
      credits: quote.credits,
      expiresAt: quote.expiresAt,
      ...(quote.jobId ? { jobId: quote.jobId } : {}),
    })),
    jobs: jobs.map((job) => ({
      jobId: job.jobId,
      stage: job.stage,
      creditsCharged: job.creditsCharged,
      creditsRefunded: job.creditsRefunded,
      correlationId: job.correlationId,
      ...(job.videoUrl ? { videoUrl: job.videoUrl } : {}),
      ...(job.error ? { error: job.error } : {}),
      ...(job.storyboardJson ? { storyboard: JSON.parse(job.storyboardJson) as Storyboard } : {}),
      ...(job.beatUrls ? { beatUrls: job.beatUrls } : {}),
      ...(job.stillUrls ? { stillUrls: job.stillUrls } : {}),
      ...(job.runId ? { runId: job.runId } : {}),
      ...(job.stateFile ? { stateFile: job.stateFile } : {}),
    })),
  };
}

async function writeAccount(ctx: MutationCtx, workosUserId: string, account: Account) {
  const now = Date.now();
  const existing = await ctx.db.query("mcpAccounts").withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId)).unique();
  const accountId = existing
    ? existing._id
    : await ctx.db.insert("mcpAccounts", {
      workosUserId,
      subscribed: account.subscribed,
      paymentPending: account.paymentPending,
      labels: account.labels,
      ...(account.checkoutToken ? { checkoutToken: account.checkoutToken } : {}),
      ...(account.checkoutKind ? { checkoutKind: account.checkoutKind } : {}),
      ...(account.checkoutStatus ? { checkoutStatus: account.checkoutStatus } : {}),
      ...(account.stripeCustomerId ? { stripeCustomerId: account.stripeCustomerId } : {}),
      ...(account.uploadId ? { uploadId: account.uploadId } : {}),
      ...(account.uploadExpiresAt ? { uploadExpiresAt: account.uploadExpiresAt } : {}),
      updatedAt: now,
    });
  if (existing) {
    await ctx.db.patch(accountId, {
      subscribed: account.subscribed,
      paymentPending: account.paymentPending,
      labels: account.labels,
      ...(account.checkoutToken ? { checkoutToken: account.checkoutToken } : {}),
      ...(account.checkoutKind ? { checkoutKind: account.checkoutKind } : {}),
      ...(account.checkoutStatus ? { checkoutStatus: account.checkoutStatus } : {}),
      ...(account.stripeCustomerId ? { stripeCustomerId: account.stripeCustomerId } : {}),
      ...(account.uploadId ? { uploadId: account.uploadId } : {}),
      ...(account.uploadExpiresAt ? { uploadExpiresAt: account.uploadExpiresAt } : {}),
      updatedAt: now,
    });
  }
  const balance = await ctx.db.query("mcpCreditBalances").withIndex("by_accountId", (q) => q.eq("accountId", accountId)).unique();
  if (balance) {
    await ctx.db.patch(balance._id, {
      monthlyCredits: account.monthlyCredits,
      purchasedCredits: account.purchasedCredits,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("mcpCreditBalances", {
      accountId,
      monthlyCredits: account.monthlyCredits,
      purchasedCredits: account.purchasedCredits,
      updatedAt: now,
    });
  }
  for (const quote of await ctx.db.query("mcpQuotes").withIndex("by_accountId", (q) => q.eq("accountId", accountId)).collect()) {
    await ctx.db.delete(quote._id);
  }
  for (const quote of account.quotes) {
    await ctx.db.insert("mcpQuotes", {
      accountId,
      quoteId: quote.quoteId,
      key: quote.key,
      credits: quote.credits,
      expiresAt: quote.expiresAt,
      ...(quote.jobId ? { jobId: quote.jobId } : {}),
    });
  }
  for (const job of await ctx.db.query("mcpJobs").withIndex("by_accountId", (q) => q.eq("accountId", accountId)).collect()) {
    await ctx.db.delete(job._id);
  }
  for (const [index, job] of account.jobs.entries()) {
    await ctx.db.insert("mcpJobs", {
      accountId,
      jobId: job.jobId,
      stage: job.stage,
      creditsCharged: job.creditsCharged,
      creditsRefunded: job.creditsRefunded,
      correlationId: job.correlationId,
      createdAt: index,
      ...(job.videoUrl ? { videoUrl: job.videoUrl } : {}),
      ...(job.error ? { error: job.error } : {}),
      ...(job.storyboard ? { storyboardJson: JSON.stringify(job.storyboard) } : {}),
      ...(job.beatUrls ? { beatUrls: job.beatUrls } : {}),
      ...(job.stillUrls ? { stillUrls: job.stillUrls } : {}),
      ...(job.runId ? { runId: job.runId } : {}),
      ...(job.stateFile ? { stateFile: job.stateFile } : {}),
    });
  }
}

function apply(account: Account, workosUserId: string, run: (ledger: MemoryFilmLedger) => unknown) {
  const ledger = new MemoryFilmLedger();
  ledger.importState(workosUserId, account);
  const result = run(ledger);
  return { result, next: ledger.exportState(workosUserId) };
}

export const openUpload = internalMutation({
  args: { workosUserId: v.string() },
  returns: v.object({ uploadUrl: v.string(), expiresAt: v.string() }),
  handler: async (ctx, args) => {
    const account = await readAccount(ctx, args.workosUserId);
    const { result, next } = apply(account, args.workosUserId, (ledger) => ledger.openUpload(args.workosUserId));
    await writeAccount(ctx, args.workosUserId, next);
    return result as { uploadUrl: string; expiresAt: string };
  },
});

export const submitDraft = internalMutation({
  args: {
    workosUserId: v.string(),
    storyboard: storyboardValidator,
    confirm: v.optional(v.boolean()),
    quoteId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await readAccount(ctx, args.workosUserId);
    const { result, next } = apply(account, args.workosUserId, (ledger) => ledger.submitDraft(args.workosUserId, {
      storyboard: args.storyboard as Storyboard,
      confirm: args.confirm,
      quoteId: args.quoteId,
    }));
    await writeAccount(ctx, args.workosUserId, next);
    return result;
  },
});

export const listActiveJobs = internalQuery({
  args: {},
  returns: v.array(v.object({
    workosUserId: v.string(),
    jobId: v.string(),
    stage: v.string(),
  })),
  handler: async (ctx) => {
    const stages = ["queued", "running", "awaiting-approval", "lineup", "beats", "assembly"] as const;
    const rows: { workosUserId: string; jobId: string; stage: string }[] = [];
    for (const stage of stages) {
      const jobs = await ctx.db.query("mcpJobs").withIndex("by_stage", (q) => q.eq("stage", stage)).collect();
      for (const job of jobs) {
        const account = await ctx.db.get(job.accountId);
        if (!account) continue;
        rows.push({ workosUserId: account.workosUserId, jobId: job.jobId, stage: job.stage });
      }
    }
    return rows;
  },
});

export const exportAccount = internalQuery({
  args: { workosUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => readAccount(ctx, args.workosUserId),
});

export const importAccount = internalMutation({
  args: { workosUserId: v.string(), account: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeAccount(ctx, args.workosUserId, args.account as Account);
    return null;
  },
});

export const getDraft = internalQuery({
  args: { workosUserId: v.string(), jobId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const account = await readAccount(ctx, args.workosUserId);
    const ledger = new MemoryFilmLedger();
    ledger.importState(args.workosUserId, account);
    return ledger.getDraft(args.workosUserId, args.jobId);
  },
});

export const grantPayment = internalMutation({
  args: {
    eventId: v.string(),
    checkoutToken: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    kind: v.union(v.literal("subscription"), v.literal("pack"), v.literal("renewal")),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const seen = await ctx.db.query("mcpStripeEvents").withIndex("by_eventId", (q) => q.eq("eventId", args.eventId)).unique();
    if (seen) return { applied: false };
    const row = args.checkoutToken
      ? await ctx.db.query("mcpAccounts").withIndex("by_checkoutToken", (q) => q.eq("checkoutToken", args.checkoutToken)).unique()
      : args.stripeCustomerId
        ? await ctx.db.query("mcpAccounts").withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId)).unique()
        : null;
    if (!row) throw new Error("No Wiggly account matches this Stripe payment.");
    const account = await readAccount(ctx, row.workosUserId);
    const kind = args.kind === "renewal" ? "subscription" : args.kind;
    const { next } = apply(account, row.workosUserId, (ledger) => {
      ledger.applyPayment(row.workosUserId, kind, args.stripeCustomerId);
    });
    await writeAccount(ctx, row.workosUserId, next);
    await ctx.db.insert("mcpStripeEvents", { eventId: args.eventId, createdAt: Date.now() });
    return { applied: true };
  },
});

export const getUpload = internalQuery({
  args: { uploadId: v.string() },
  returns: v.union(v.null(), v.object({ accountId: v.string(), expiresAt: v.string() })),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("mcpAccounts").withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId)).unique();
    if (!row?.uploadExpiresAt || row.uploadExpiresAt <= Date.now()) return null;
    return { accountId: row.workosUserId, expiresAt: new Date(row.uploadExpiresAt).toISOString() };
  },
});

export const setPhotoLabels = internalMutation({
  args: { uploadId: v.string(), labels: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("mcpAccounts").withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId)).unique();
    if (!row?.uploadExpiresAt || row.uploadExpiresAt <= Date.now()) {
      throw new Error("This upload link has expired. Call wiggly_open_upload again.");
    }
    const account = await readAccount(ctx, row.workosUserId);
    const { next } = apply(account, row.workosUserId, (ledger) => {
      ledger.attachPhotos(row.workosUserId, args.labels);
    });
    await writeAccount(ctx, row.workosUserId, next);
    return null;
  },
});

export const failJob = internalMutation({
  args: { workosUserId: v.string(), jobId: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await readAccount(ctx, args.workosUserId);
    const { next } = apply(account, args.workosUserId, (ledger) => {
      ledger.failJob(args.workosUserId, args.jobId, args.error);
    });
    await writeAccount(ctx, args.workosUserId, next);
    return null;
  },
});
