"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, NotebookPen, AlertCircle } from "lucide-react";
import type { Receivable } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { approveReceivable, saveReceivableNote } from "./actions";

const STATUS_CLIENT_REVIEW = "Client Review";
const STATUS_AGENCY_REVIEW = "Agency FO Review";

function statusPill(status: string): { cls: string; label: string } {
  const s = status.toLowerCase();
  if (s.includes("client review"))   return { cls: "bg-[var(--blue-soft)] text-[var(--blue)]",   label: status };
  if (s.includes("agency") || s.includes("fo review")) return { cls: "bg-[var(--amber-soft)] text-[var(--amber)]", label: status };
  if (s.includes("fully paid") || s === "paid") return { cls: "bg-[var(--green-soft)] text-[var(--green)]", label: status };
  if (s.includes("unpaid") || s.includes("partially") || s.includes("overdue")) return { cls: "bg-[var(--red-soft)] text-[var(--red)]", label: status };
  if (s.includes("ready") || s.includes("in progress")) return { cls: "bg-white/8 text-[color:var(--muted)]", label: status };
  return { cls: "bg-white/8 text-[color:var(--muted)]", label: status || "—" };
}

function StatusPill({ status }: { status: string }) {
  const { cls, label } = statusPill(status);
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]", cls)}>
      {label}
    </span>
  );
}

// ── Review card (one per "Client Review" receivable) ─────────────────────────
function ReviewCard({ r }: { r: Receivable }) {
  const router = useRouter();
  const [note, setNote] = useState(r.notes ?? "");
  const [savedNote, setSavedNote] = useState(r.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "note" | null>(null);

  const dirty = note.trim() !== savedNote.trim();

  const onApprove = () => {
    setError(null);
    setAction("approve");
    startTransition(async () => {
      // If the client typed a note but didn't save it, persist it on approve.
      if (dirty) {
        const noteRes = await saveReceivableNote(r.rowNumber, note.trim());
        if (!noteRes.ok) { setError(noteRes.error ?? "Failed to save note."); setAction(null); return; }
        setSavedNote(note.trim());
      }
      const res = await approveReceivable(r.rowNumber);
      if (!res.ok) { setError(res.error ?? "Failed to approve."); setAction(null); return; }
      router.refresh();
    });
  };

  const onSaveNote = () => {
    setError(null);
    setAction("note");
    startTransition(async () => {
      const res = await saveReceivableNote(r.rowNumber, note.trim());
      if (!res.ok) { setError(res.error ?? "Failed to save note."); setAction(null); return; }
      setSavedNote(note.trim());
      setAction(null);
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-strong)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-foreground">{r.client || "—"}</div>
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {r.service || "—"}
            {r.dueDate ? <span className="text-muted-foreground/70"> · due {r.dueDate}</span> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="anton text-[20px] leading-none">{formatCurrency(r.amount, { compact: true })}</div>
          <div className="mt-1"><StatusPill status={r.status} /></div>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <NotebookPen className="h-3 w-3" /> Notes
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note for the agency (optional)…"
          rows={2}
          className="w-full resize-y rounded-md border border-[var(--card-border)] bg-white/5 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--blue)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--red)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--blue)] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending && action === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve
        </button>
        <button
          onClick={onSaveNote}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-white/5 disabled:opacity-40"
        >
          {pending && action === "note" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save note
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Approve → <span className="text-[var(--amber)]">{STATUS_AGENCY_REVIEW}</span>
        </span>
      </div>
    </div>
  );
}

// ── Full AR table (all receivables) ──────────────────────────────────────────
function ArTable({ rows }: { rows: Receivable[] }) {
  const maxAmount = Math.max(1, ...rows.map(r => Math.abs(r.amount)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {["Client", "Service", "Amount", "Invoice date", "Due date", "Status", "Notes"].map((h, i) => (
              <th
                key={h}
                className={cn(
                  "border-b border-[var(--card-border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                  i === 2 ? "text-right" : "text-left",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.rowNumber}-${i}`} className="hover:bg-white/[0.02]">
              <td className="border-b border-white/[0.04] px-3 py-2 font-medium text-foreground">{r.client || "—"}</td>
              <td className="border-b border-white/[0.04] px-3 py-2 text-muted-foreground">{r.service || "—"}</td>
              <td className="border-b border-white/[0.04] px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="inline-block h-1.5 rounded-sm" style={{ width: Math.round((Math.abs(r.amount) / maxAmount) * 64), background: "var(--blue)" }} />
                  <span className="tabular-nums">{r.amount ? formatCurrency(r.amount) : "—"}</span>
                </div>
              </td>
              <td className="border-b border-white/[0.04] px-3 py-2 text-muted-foreground">{r.invoiceDate || "—"}</td>
              <td className="border-b border-white/[0.04] px-3 py-2 text-muted-foreground">{r.dueDate || "—"}</td>
              <td className="border-b border-white/[0.04] px-3 py-2"><StatusPill status={r.status} /></td>
              <td className="max-w-[220px] truncate border-b border-white/[0.04] px-3 py-2 text-muted-foreground" title={r.notes}>
                {r.notes || <span className="text-muted-foreground/40">—</span>}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No receivables in the sheet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ReceivablesWorkspace({ receivables }: { receivables: Receivable[] }) {
  const awaiting = receivables.filter(r => r.status.toLowerCase().includes("client review"));
  const rest = receivables;

  return (
    <>
      <section className="mt-8">
        <div className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Awaiting your review</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Receivables marked <span className="text-[var(--blue)]">{STATUS_CLIENT_REVIEW}</span> — approve to move them to{" "}
                <span className="text-[var(--amber)]">{STATUS_AGENCY_REVIEW}</span>
              </p>
            </div>
            {awaiting.length > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--blue)] px-2 text-[12px] font-semibold text-white">
                {awaiting.length}
              </span>
            )}
          </div>

          {awaiting.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-white/[0.02] px-4 py-6 text-[13px] text-muted-foreground">
              <Check className="h-4 w-4 text-[var(--green)]" />
              Nothing waiting on you right now — all receivables are clear of client review.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {awaiting.map((r, i) => <ReviewCard key={`${r.rowNumber}-${i}`} r={r} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-foreground">All receivables</h2>
          <p className="mt-0.5 mb-4 text-[11px] text-muted-foreground">Every line from the Receivables tab · status in column Q · notes in column X</p>
          <ArTable rows={rest} />
        </div>
      </section>
    </>
  );
}
