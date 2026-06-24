"use server";

import { revalidatePath } from "next/cache";
import {
  writeReceivableCell,
  writeBookkeepingCell,
  RECEIVABLE_COLS,
  STATUS_AGENCY_REVIEW,
} from "@/lib/sheets";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function toError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/permission|403|forbidden/i.test(msg)) {
    return "Sheet write permission denied — share the sheet with the service account as Editor.";
  }
  return msg || "Write failed.";
}

// Client clicks Approve → status (col Q) becomes "AgenCFO Review".
export async function approveReceivable(rowNumber: number): Promise<ActionResult> {
  try {
    await writeReceivableCell(rowNumber, RECEIVABLE_COLS.status, STATUS_AGENCY_REVIEW);
    revalidatePath("/payments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// Client picks a status from the dropdown → written to col Q.
export async function setReceivableStatus(
  rowNumber: number,
  status: string,
): Promise<ActionResult> {
  try {
    await writeReceivableCell(rowNumber, RECEIVABLE_COLS.status, status);
    revalidatePath("/payments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// Client saves a note → written to col X (replace, not append).
export async function saveReceivableNote(
  rowNumber: number,
  text: string,
): Promise<ActionResult> {
  try {
    await writeReceivableCell(rowNumber, RECEIVABLE_COLS.notes, text);
    revalidatePath("/payments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Transactions clarification (Bookkeeping tab) ─────────────────────────────
// The category / comment write columns are resolved by header at read time and
// carried per-row, so the actions take the explicit 0-based column index.
export async function updateTransactionCategory(
  rowNumber: number,
  colIndex: number,
  value: string,
): Promise<ActionResult> {
  if (colIndex < 0) return { ok: false, error: "No category column found in the Bookkeeping tab." };
  try {
    await writeBookkeepingCell(rowNumber, colIndex, value);
    revalidatePath("/payments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateTransactionComment(
  rowNumber: number,
  colIndex: number,
  text: string,
): Promise<ActionResult> {
  if (colIndex < 0) return { ok: false, error: "No comment column found in the Bookkeeping tab." };
  try {
    await writeBookkeepingCell(rowNumber, colIndex, text);
    revalidatePath("/payments");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
