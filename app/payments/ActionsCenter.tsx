"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Eye, EyeOff, Loader2, StickyNote } from "lucide-react";
import type { Receivable } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  STATUS_ENUM,
  statusKind,
  statusPillStyle,
} from "./shared";
import { approveReceivable, setReceivableStatus, saveReceivableNote } from "./actions";

function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const { bg, fg } = statusPillStyle(status);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]"
      style={{ background: bg, color: fg }}
    >
      {status || "—"}
    </span>
  );
}

function StatusDropdown({ row, current, disabled }: { row: number; current: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onPick = (status: string) => {
    if (status === current) return;
    start(async () => {
      await setReceivableStatus(row, status);
      router.refresh();
    });
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled || pending}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--card-border)] px-2 py-1.5 text-[11px] text-foreground transition hover:bg-white/5 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Status <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[160px] rounded-lg border border-[var(--card-border)] bg-[#0b1f33] p-1 shadow-xl"
        >
          {STATUS_ENUM.map(s => (
            <DropdownMenu.Item
              key={s}
              onSelect={() => onPick(s)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground outline-none data-[highlighted]:bg-white/10"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusPillStyle(s).fg }} />
              {s}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function NoteButton({ row, initial }: { row: number; initial: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const has = (initial ?? "").trim().length > 0;
  const save = () => {
    start(async () => {
      await saveReceivableNote(row, note.trim());
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] transition hover:bg-white/5",
            has ? "border-[var(--amber)]/40 text-[var(--amber)]" : "border-[var(--card-border)] text-foreground",
          )}
        >
          <StickyNote className="h-3 w-3" /> Note
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          className="z-50 w-72 rounded-lg border border-[var(--card-border)] bg-[#0b1f33] p-3 shadow-xl"
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Note</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note for AgenCFO…"
            className="w-full resize-y rounded-md border border-[var(--card-border)] bg-white/5 px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--blue)] focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={save} disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-[var(--blue)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ApproveButton({ row }: { row: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onClick = () =>
    start(async () => {
      await approveReceivable(row);
      router.refresh();
    });
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md bg-[var(--blue)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
    </button>
  );
}

function num(n: number): string {
  return n ? formatCurrency(n, { compact: true }) : "—";
}

export function ActionsCenter({ receivables }: { receivables: Receivable[] }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const awaiting = receivables.filter(r => statusKind(r.status) === "review-client");
  const scheduled = receivables.filter(r => {
    const k = statusKind(r.status);
    return k === "pipeline" || k === "review-agency";
  });

  const awaitingTotal = awaiting.reduce((a, r) => a + (r.amount || 0), 0);

  const headCell = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap";
  const cell = "px-2 py-2 align-middle whitespace-nowrap";

  const Row = ({ r, showApprove }: { r: Receivable; showApprove: boolean }) => (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.02]">
      <td className={cn(cell, "text-[11px] text-muted-foreground")} style={{ width: 56 }}>{fmtDate(r.invoiceDate)}</td>
      <td className={cn(cell, "font-medium text-foreground")} style={{ maxWidth: 130 }}><span className="block truncate">{r.client || "—"}</span></td>
      <td className={cn(cell, "text-muted-foreground")} style={{ maxWidth: 110 }}><span className="block truncate">{r.service || "—"}</span></td>
      {showBreakdown && (
        <>
          <td className={cn(cell, "text-[12px] text-muted-foreground")}>{r.payType || "—"}</td>
          <td className={cn(cell, "text-[12px] text-muted-foreground")}>{r.paymentRule || "—"}</td>
          <td className={cn(cell, "text-right text-[12px] tabular-nums text-muted-foreground")}>{num(r.adSpend)}</td>
          <td className={cn(cell, "text-right text-[12px] tabular-nums text-muted-foreground")}>{r.discounts ? num(r.discounts) : "—"}</td>
          <td className={cn(cell, "text-right text-[12px] tabular-nums text-muted-foreground")}>{r.otherChange ? num(r.otherChange) : "—"}</td>
        </>
      )}
      <td className={cn(cell, "text-right tabular-nums font-semibold text-foreground")} style={{ width: 72 }}>{num(r.amount)}</td>
      <td className={cn(cell)} style={{ width: 96 }}><StatusPill status={r.status} /></td>
      <td className={cn(cell)} style={{ width: 200 }}>
        <div className="flex items-center gap-1.5">
          {showApprove && <ApproveButton row={r.rowNumber} />}
          <StatusDropdown row={r.rowNumber} current={r.status} disabled={false} />
          <NoteButton row={r.rowNumber} initial={r.notes} />
        </div>
      </td>
    </tr>
  );

  const colCount = showBreakdown ? 11 : 6;

  const SectionHead = ({ title, count, total, sub }: { title: string; count: number; total?: number; sub: string }) => (
    <>
      <tr>
        <td colSpan={colCount} className="px-2 pb-1 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--blue)]">
              {title} <span className="text-muted-foreground">· {count}</span>
            </span>
            {total != null && <span className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(total, { compact: true })}</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </td>
      </tr>
    </>
  );

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pipeline</div>
          <h2 className="anton text-[20px] tracking-[0.04em]">Upcoming invoices</h2>
        </div>
        <button
          onClick={() => setShowBreakdown(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-[12px] text-foreground transition hover:bg-white/5"
        >
          {showBreakdown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showBreakdown ? "Hide breakdown" : "Show breakdown"}
        </button>
      </div>

      <div className={cn("overflow-x-auto", showBreakdown && "pb-1")}>
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className={headCell}>Date</th>
              <th className={headCell}>Client</th>
              <th className={headCell}>Service</th>
              {showBreakdown && (
                <>
                  <th className={headCell}>Pay type</th>
                  <th className={headCell}>Rule</th>
                  <th className={cn(headCell, "text-right")}>Ad spend</th>
                  <th className={cn(headCell, "text-right")}>Discount</th>
                  <th className={cn(headCell, "text-right")}>Other</th>
                </>
              )}
              <th className={cn(headCell, "text-right")}>Amount</th>
              <th className={headCell}>Status</th>
              <th className={cn(headCell, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <SectionHead title="Awaiting your review" count={awaiting.length} total={awaitingTotal} sub="Approve to release for sending · edit notes if anything needs changing" />
            {awaiting.length === 0 ? (
              <tr><td colSpan={colCount} className="px-2 py-3 text-[12px] text-muted-foreground">Nothing waiting on you — all clear of client review.</td></tr>
            ) : awaiting.map((r, i) => <Row key={`a-${r.rowNumber}-${i}`} r={r} showApprove />)}

            <SectionHead title="Scheduled" count={scheduled.length} sub="Drafts + ready + in AgenCFO review" />
            {scheduled.length === 0 ? (
              <tr><td colSpan={colCount} className="px-2 py-3 text-[12px] text-muted-foreground">Nothing scheduled.</td></tr>
            ) : scheduled.map((r, i) => <Row key={`s-${r.rowNumber}-${i}`} r={r} showApprove={false} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
