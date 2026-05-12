"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { isoToLabel } from "@/lib/period";
import { formatLong } from "../charts/chart-shared";
import { cn } from "@/lib/utils";

export interface PnlGroup {
  label: string;
  total: number[];                                // per month
  isCost?: boolean;                               // colour negative
  children?: { name: string; values: number[] }[];
}

export interface PnlTotalsRow {
  label: string;
  values: number[];
  emphasis?: "grand" | "subtotal" | "muted";
  isCost?: boolean;
  isMargin?: boolean;
}

export interface PnlTableProps {
  monthsIso: string[];
  groups: PnlGroup[];
  totalsRows: PnlTotalsRow[];
}

export function PnlTable({ monthsIso, groups, totalsRows }: PnlTableProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  const ytd = (vals: number[]) => vals.reduce((a, b) => a + (b || 0), 0);

  const fmtVal = (v: number, isCost: boolean, isMargin: boolean) => {
    if (isMargin) return `${(v * 100).toFixed(1)}%`;
    if (!v) return <span className="text-muted-foreground/40">—</span>;
    const text = formatLong(Math.abs(v), "currency");
    return isCost ? `-${text}` : text;
  };

  return (
    <div className="relative max-h-[520px] overflow-auto rounded-lg">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ minWidth: 220 }}>
              Line item
            </th>
            {monthsIso.map(iso => (
              <th key={iso} className="sticky top-0 z-10 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {isoToLabel(iso)}
              </th>
            ))}
            <th className="sticky top-0 z-10 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--blue)" }}>
              YTD
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const isOpen = open[g.label];
            const hasChildren = !!g.children?.length;
            return (
              <>
                <tr key={g.label} className="hover:bg-white/[0.02]">
                  <td className="sticky left-0 sticky-bg border-b border-white/[0.04] px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => hasChildren && toggle(g.label)}
                      className="inline-flex items-center gap-1 font-semibold text-foreground disabled:cursor-default"
                      disabled={!hasChildren}
                    >
                      {hasChildren && (
                        <ChevronRight
                          className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")}
                          style={{ color: "var(--blue)" }}
                        />
                      )}
                      <span>{g.label}</span>
                    </button>
                  </td>
                  {g.total.map((v, i) => (
                    <td
                      key={i}
                      className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums"
                      style={{ color: g.isCost ? "var(--red)" : undefined }}
                    >
                      <strong>{fmtVal(v, !!g.isCost, false)}</strong>
                    </td>
                  ))}
                  <td className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums" style={{ color: g.isCost ? "var(--red)" : "var(--blue)" }}>
                    <strong>{fmtVal(ytd(g.total), !!g.isCost, false)}</strong>
                  </td>
                </tr>
                {isOpen &&
                  g.children?.map(c => (
                    <tr key={`${g.label}-${c.name}`} className="hover:bg-white/[0.01]">
                      <td className="sticky left-0 sticky-bg border-b border-white/[0.04] px-3 py-1.5 pl-8 text-left text-[12px] text-muted-foreground">
                        ↳ {c.name}
                      </td>
                      {c.values.map((v, i) => (
                        <td key={i} className="border-b border-white/[0.04] px-3 py-1.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
                          {fmtVal(v, !!g.isCost, false)}
                        </td>
                      ))}
                      <td className="border-b border-white/[0.04] px-3 py-1.5 text-right text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {fmtVal(ytd(c.values), !!g.isCost, false)}
                      </td>
                    </tr>
                  ))}
              </>
            );
          })}

          {totalsRows.map(t => {
            const grand = t.emphasis === "grand";
            const muted = t.emphasis === "muted";
            const sub = t.emphasis === "subtotal";
            const total = ytd(t.values);
            return (
              <tr
                key={t.label}
                className={cn(
                  grand && "border-t border-[var(--blue)] bg-[var(--blue-soft)]/40",
                  sub && "bg-white/[0.03]",
                )}
              >
                <td className="sticky left-0 sticky-bg border-b border-white/[0.04] px-3 py-2 text-left">
                  <strong className={cn(muted && "text-muted-foreground text-[11px] font-normal")}>
                    {t.label}
                  </strong>
                </td>
                {t.values.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "border-b border-white/[0.04] px-3 py-2 text-right tabular-nums",
                      muted && "text-[11px] text-muted-foreground",
                    )}
                    style={{
                      color: muted
                        ? undefined
                        : t.isMargin
                        ? "var(--muted-foreground)"
                        : v >= 0
                        ? "var(--green)"
                        : "var(--red)",
                    }}
                  >
                    <strong>{fmtVal(v, !!t.isCost, !!t.isMargin)}</strong>
                  </td>
                ))}
                <td
                  className={cn(
                    "border-b border-white/[0.04] px-3 py-2 text-right tabular-nums",
                    muted && "text-[11px] text-muted-foreground",
                  )}
                  style={{
                    color: muted
                      ? undefined
                      : t.isMargin
                      ? "var(--muted-foreground)"
                      : total >= 0
                      ? "var(--green)"
                      : "var(--red)",
                  }}
                >
                  <strong>
                    {t.isMargin
                      ? `${(total / t.values.length).toFixed(1)}% avg`
                      : fmtVal(total, !!t.isCost, false)}
                  </strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
