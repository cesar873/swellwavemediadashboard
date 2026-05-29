"use client";

import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Search, X } from "lucide-react";
import type { Receivable } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { isoToLabel } from "@/lib/period";
import {
  STATUS_ENUM,
  statusKind,
  statusPillStyle,
  isPaid,
  amountBreakdown,
  hasAdjustments,
} from "./shared";

function cellTint(statuses: string[], isForecast: boolean): { background: string; borderColor: string } {
  if (isForecast) return { background: "rgba(124,108,252,0.10)", borderColor: "rgba(124,108,252,0.30)" };
  const kinds = statuses.map(statusKind);
  if (kinds.includes("unpaid"))        return { background: "rgba(239,68,68,0.13)",  borderColor: "rgba(239,68,68,0.35)" };
  if (kinds.includes("review-agency")) return { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.32)" };
  if (kinds.includes("review-client")) return { background: "rgba(19,144,235,0.12)", borderColor: "rgba(19,144,235,0.32)" };
  if (kinds.includes("paid"))          return { background: "rgba(34,197,94,0.12)",  borderColor: "rgba(34,197,94,0.30)" };
  return { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" };
}

interface CellData { rows: Receivable[]; total: number; }

export function ArGrid({ receivables, latestActualIso }: { receivables: Receivable[]; latestActualIso: string }) {
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<{ client: string; monthIso: string } | null>(null);

  const filtered = useMemo(() => {
    return receivables.filter(r => {
      if (search && !r.client.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      return true;
    });
  }, [receivables, search, statusFilter]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of filtered) if (r.monthIso) set.add(r.monthIso);
    return [...set].sort();
  }, [filtered]);

  const { clients, matrix, rowTotals, rowOpen, rowMeta } = useMemo(() => {
    const map = new Map<string, Map<string, CellData>>();
    const meta = new Map<string, { platform: string; currency: string }>();
    for (const r of filtered) {
      if (!r.client || !r.monthIso) continue;
      if (!map.has(r.client)) map.set(r.client, new Map());
      if (!meta.has(r.client)) meta.set(r.client, { platform: r.payPlatform, currency: r.currency });
      const row = map.get(r.client)!;
      const cell = row.get(r.monthIso) ?? { rows: [], total: 0 };
      cell.rows.push(r);
      cell.total += r.amount || 0;
      row.set(r.monthIso, cell);
    }
    const totals = new Map<string, number>();
    const open = new Map<string, number>();
    for (const [client, row] of map) {
      let t = 0, o = 0;
      for (const cell of row.values()) {
        t += cell.total;
        for (const r of cell.rows) if (!isPaid(r.status)) o += (r.openAmount || r.amount || 0);
      }
      totals.set(client, t);
      open.set(client, o);
    }
    const clientList = [...map.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    return { clients: clientList, matrix: map, rowTotals: totals, rowOpen: open, rowMeta: meta };
  }, [filtered]);

  const selRows: Receivable[] = sel ? (matrix.get(sel.client)?.get(sel.monthIso)?.rows ?? []) : [];
  const selTotal = selRows.reduce((a, r) => a + (r.amount || 0), 0);

  const stickyL = "sticky left-0 z-10";
  const stickyR = "sticky right-0 z-10";

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">AR by client × month</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Click any cell to see the invoices behind it · color = worst status in cell · Δ marks discounts, ad-spend, or other adjustments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-1.5 text-[12px] text-foreground transition hover:bg-white/5">
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</span>
                {statusFilter.size === 0 ? "All statuses" : `${statusFilter.size} selected`}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[180px] rounded-lg border border-[var(--card-border)] bg-[#0b1f33] p-1 shadow-xl">
                <DropdownMenu.Item onSelect={e => { e.preventDefault(); setStatusFilter(new Set()); }} className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-muted-foreground outline-none data-[highlighted]:bg-white/10">
                  All statuses
                </DropdownMenu.Item>
                {STATUS_ENUM.map(s => {
                  const on = statusFilter.has(s);
                  return (
                    <DropdownMenu.CheckboxItem
                      key={s}
                      checked={on}
                      onSelect={e => e.preventDefault()}
                      onCheckedChange={(c) => {
                        setStatusFilter(prev => {
                          const next = new Set(prev);
                          if (c) next.add(s); else next.delete(s);
                          return next;
                        });
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground outline-none data-[highlighted]:bg-white/10"
                    >
                      <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-sm border", on ? "border-[var(--blue)] bg-[var(--blue)]" : "border-[var(--card-border)]")}>
                        {on && <span className="text-[9px] leading-none text-white">✓</span>}
                      </span>
                      {s}
                    </DropdownMenu.CheckboxItem>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find client"
              className="h-8 w-44 rounded-md border border-[var(--card-border)] bg-white/5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className={cn(stickyL, "sticky-bg-strong px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground")} style={{ minWidth: 200 }}>Client</th>
              {months.map(iso => {
                const fc = !!latestActualIso && iso > latestActualIso;
                return (
                  <th key={iso} className={cn("px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide", fc ? "italic text-[var(--blue)]/70" : "text-muted-foreground")} style={{ minWidth: 110 }}>
                    {isoToLabel(iso).toUpperCase()}
                  </th>
                );
              })}
              <th className={cn(stickyR, "sticky-bg-strong px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground")} style={{ minWidth: 110 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => {
              const row = matrix.get(client)!;
              const meta = rowMeta.get(client);
              const open = rowOpen.get(client) ?? 0;
              return (
                <tr key={client}>
                  <td className={cn(stickyL, "sticky-bg border-t border-white/[0.04] px-3 py-2")}>
                    <div className="font-medium text-foreground">{client}</div>
                    {(meta?.platform || meta?.currency) && (
                      <div className="text-[10px] text-muted-foreground">{[meta?.platform, meta?.currency].filter(Boolean).join(" · ")}</div>
                    )}
                  </td>
                  {months.map(iso => {
                    const cell = row.get(iso);
                    const fc = !!latestActualIso && iso > latestActualIso;
                    if (!cell) return <td key={iso} className="border-t border-white/[0.04] px-2 py-2" />;
                    const tint = cellTint(cell.rows.map(r => r.status), fc);
                    const adj = cell.rows.some(hasAdjustments);
                    const multi = cell.rows.length > 1;
                    return (
                      <td key={iso} className="border-t border-white/[0.04] px-1.5 py-1.5">
                        <button
                          onClick={() => setSel({ client, monthIso: iso })}
                          className="relative flex h-9 w-full items-center justify-end rounded-md border px-2 text-right tabular-nums text-foreground transition hover:brightness-125"
                          style={{ background: tint.background, borderColor: tint.borderColor }}
                        >
                          {adj && <span className="absolute left-1.5 top-1 text-[9px] text-muted-foreground">Δ</span>}
                          {multi && <span className="absolute left-1 bottom-0.5 rounded-full bg-black/40 px-1 text-[8px] text-muted-foreground">×{cell.rows.length}</span>}
                          <span className={cn("text-[12px]", fc && "italic")}>{formatCurrency(cell.total, { compact: true })}</span>
                        </button>
                      </td>
                    );
                  })}
                  <td className={cn(stickyR, "sticky-bg border-t border-white/[0.04] px-3 py-2 text-right")}>
                    <div className="font-semibold tabular-nums text-foreground">{formatCurrency(rowTotals.get(client) ?? 0, { compact: true })}</div>
                    {open > 0 && <div className="text-[10px] text-[var(--amber)]">{formatCurrency(open, { compact: true })} open</div>}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={months.length + 2} className="px-3 py-8 text-center text-muted-foreground">No receivables match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cell detail drawer */}
      {sel && (
        <div className="fixed inset-0 z-50" onClick={() => setSel(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto border-l border-[var(--card-border)] bg-[#06182b] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{isoToLabel(sel.monthIso).toUpperCase()}</div>
                <h3 className="anton text-[26px] leading-none">{sel.client}</h3>
                <div className="mt-1 text-[12px] text-muted-foreground">{selRows.length} invoice{selRows.length === 1 ? "" : "s"} · total {formatCurrency(selTotal)}</div>
              </div>
              <button onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground">
                Close <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {selRows.map((r, i) => {
                const { bg, fg } = statusPillStyle(r.status);
                const lines = amountBreakdown(r);
                const lineTotal = lines.reduce((a, l) => a + l.value, 0);
                return (
                  <div key={i} className="rounded-xl border border-[var(--card-border)] bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]" style={{ background: bg, color: fg }}>{r.status || "—"}</span>
                        <div className="anton mt-2 text-[24px] leading-none">{formatCurrency(r.amount)}</div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        {r.payPlatform && <div className="uppercase tracking-[0.08em] text-foreground">{r.payPlatform}</div>}
                        {r.payType && <div>{r.payType}</div>}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1 text-[12px]">
                      {[["Invoice date", r.invoiceDate], ["Sent", r.sentDate], ["Due", r.dueDate], ["Paid", r.paidDate]].map(([label, val]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="tabular-nums text-foreground">{val || "—"}</span>
                        </div>
                      ))}
                    </div>

                    {lines.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">How this amount was calculated</div>
                        <div className="flex flex-col gap-1 text-[12px]">
                          {lines.map((l, k) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-foreground/80">{l.label}</span>
                              <span className="tabular-nums text-foreground">{formatCurrency(l.value)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex justify-between border-t border-white/10 pt-1.5 font-semibold">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {r.notes && (
                      <div className="mt-3 rounded-md border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-2.5 py-1.5 text-[12px] text-foreground">
                        <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--amber)]">Note</span><br />{r.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
