import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_CREDITS, VIDEO_CREDITS_PER_SECOND } from "./credits";
import type { MemoryFilmLedger } from "./film-ledger";

export const CREW_FEE_ITEM = "crew-fee";

export function chargesPath(runDir: string) {
  return path.join(runDir, "outputs", "charges.json");
}

export function paidItemsPath(runDir: string) {
  return path.join(runDir, "outputs", "paid-items.json");
}

export class AwaitingCredits extends Error {
  readonly code = "AWAITING_CREDITS";
  readonly itemId: string;
  readonly credits: number;

  constructor(itemId: string, credits: number, message: string) {
    super(message);
    this.name = "AwaitingCredits";
    this.itemId = itemId;
    this.credits = credits;
  }
}

async function readMap(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, number | string>;
  } catch {
    return {};
  }
}

async function writeMap(file: string, value: Record<string, number | string>) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

export async function chargeItem(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  runDir: string;
  itemId: string;
  credits: number;
}) {
  const file = chargesPath(input.runDir);
  const charges = await readMap(file);
  if (charges[input.itemId]) return;
  const spent = input.ledger.spendCredits(input.accountId, input.jobId, input.credits);
  if (!spent.ok) throw new AwaitingCredits(input.itemId, input.credits, spent.message);
  charges[input.itemId] = input.credits;
  await writeMap(file, charges);
}

export async function refundItem(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  runDir: string;
  itemId: string;
}) {
  const file = chargesPath(input.runDir);
  const charges = await readMap(file);
  const credits = Number(charges[input.itemId] ?? 0);
  if (!(credits > 0)) return;
  input.ledger.refundCharge(input.accountId, input.jobId, credits);
  delete charges[input.itemId];
  await writeMap(file, charges);
}

export async function dropChargeKey(runDir: string, itemId: string) {
  const file = chargesPath(runDir);
  const charges = await readMap(file);
  if (charges[itemId] == null) return;
  delete charges[itemId];
  await writeMap(file, charges);
}

export async function markPaid(runDir: string, itemId: string, dest: string) {
  const file = paidItemsPath(runDir);
  const paid = await readMap(file);
  paid[itemId] = dest;
  await writeMap(file, paid);
}

export async function chargeThenRender<T extends { dest?: string; videoPath?: string }>(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  runDir: string;
  itemId: string;
  credits: number;
  render: () => Promise<T>;
}) {
  const already = await readMap(paidItemsPath(input.runDir));
  const paidDest = already[input.itemId];
  if (typeof paidDest === "string") {
    try {
      await access(paidDest);
      return { dest: paidDest } as T;
    } catch {
      delete already[input.itemId];
      await writeMap(paidItemsPath(input.runDir), already);
      await dropChargeKey(input.runDir, input.itemId);
    }
  }
  await chargeItem(input);
  try {
    const saved = await input.render();
    const dest = saved.dest ?? saved.videoPath;
    if (!dest) throw new Error(`The render for ${input.itemId} returned no file.`);
    try {
      await access(dest);
    } catch {
      throw new Error(`The render for ${input.itemId} did not write ${dest}.`);
    }
    await markPaid(input.runDir, input.itemId, dest);
    return saved;
  } catch (error) {
    if (error instanceof AwaitingCredits) throw error;
    await refundItem(input);
    throw error;
  }
}

export function stillCredits() {
  return IMAGE_CREDITS;
}

export function clipCredits(durationSec: number) {
  return Math.max(1, Math.ceil(durationSec)) * VIDEO_CREDITS_PER_SECOND;
}
