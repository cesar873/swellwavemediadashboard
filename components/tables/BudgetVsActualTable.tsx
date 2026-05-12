"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { formatLong } from "../charts/chart-shared";
import { cn } from "@/lib/utils";

export interface BvaDetail {
  category: string;
  budget: number;
  actual: number;
}

export interface BvaGroup {
  name: string;            // "Revenue" | "Cost of Sales" | "Operating Expenses"
  positiveIsGood: boolean;
  rows: BvaDetail[];
  subTotal?: { budget: number; actual: number };
}

export interface BudgetVsActualTableProps {
  groups: BvaGroup[];
  netRow?: { label: string; budget: number; actual: number };
  rangeLabel: string;
}

function BarViz({ b, a, positiveIsGood }: { b: number; a: number; positiveIsGood: boolean }) {
  if (b <= 0 && a <= 0) return <span className="text-muted-foreground/60 text-[11px]">—</span>;
  const max = Math.max(b, a, 1);
  const bPct = (b / max) * 100;
  const aPct = (a / max) * 100;
  const isGood = positiveIsGood ? a >= b : a <= b;
  const fillColor = isGood ? "var(--green)" : "var(--red)";
  return (
    <div className="relative inline-block h-2 w-32 overflow-hidden rounded-full bg-white/5">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${aPct}%`, background: fillColor, opacity: 0.85 }}
      />
      {b > 0 && (
        <div className="absolute -top-0.5 -bottom-0.5 w-px bg-white/50" style={{ left: `${bPct}%` }} />
      )}
    </div>
  );
}

function ScorecardTile({
  label,
  actual,
  budget,
  positiveIsGood,
  emphasis,
}: {
  label: string;
  actual: number;
  budget: number;
  positiveIsGood: boolean;
  emphasis?: "primary";
}) {
  const v = actual - budget;
  const pct = budget !== 0 ? (v / Math.abs(budget)) * 100 : 0;
  const direction = v >= 0 ? "up" : "down";
  const isGood = budget === 0 ? null : positiveIsGood ? v >= 0 : v <= 0;
  const accent = isGood == null ? "var(--muted)" : isGood ? "var(--green)" : "var(--red)";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 backdrop-blur",
        emphasis === "primary" && "border-[var(--blue)]/40",
      )}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent }} />
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">{label}</div>
      <div className="anton mt-1.5 text-[26px] leading-[1.1]" style={emphasis === "primary" ? { color: "var(--blue)" } : undefined}>
        {formatLong(actual, "currency")}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-[color:var(--muted)] tabular-nums">
        {budget !== 0 && (
          <>
            {direction === "up" ? (
              <ArrowUp className="h-3 w-3" style={{ color: accent }} />
            ) : (
              <ArrowDown className="h-3 w-3" style={{ color: accent }} />
            )}
            <span style={{ color: accent }}>
              {(pct >= 0 ? "+" : "") + pct.toFixed(1)}%
            </span>
          </>
        )}
        <span className="text-[color:var(--muted)]">vs budget {formatLong(budget, "currency")}</span>
      </div>
    </div>
  );
}

export function BudgetVsActualTable({ groups, netRow, rangeLabel }: BudgetVsActualTableProps) {
  void rangeLabel;
  // Roll up each group for the scorecards.
  const scorecards = groups.map(g => {
    const budget = g.subTotal?.budget ?? g.rows.reduce((a, r) => a + r.budget, 0);
    const actual = g.subTotal?.actual ?? g.rows.reduce((a, r) => a + r.actual, 0);
    return { name: g.name, budget, actual, positiveIsGood: g.positiveIsGood };
  });
  return (
    <div>
      {(scorecards.length > 0 || netRow) && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {scorecards.map(sc => (
            <ScorecardTile
              key={sc.name}
              label={sc.name}
              actual={sc.actual}
              budget={sc.budget}
              positiveIsGood={sc.positiveIsGood}
            />
          ))}
          {netRow && (
            <ScorecardTile
              label={netRow.label}
              actual={netRow.actual}
              budget={netRow.budget}
              positiveIsGood
              emphasis="primary"
            />
          )}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ minWidth: 220 }}>
              Category
            </th>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Budget</th>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Actual</th>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Variance $</th>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Variance %</th>
            <th className="border-b border-[var(--card-border)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Progress</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const subB = g.subTotal?.budget ?? g.rows.reduce((a, r) => a + r.budget, 0);
            const subA = g.subTotal?.actual ?? g.rows.reduce((a, r) => a + r.actual, 0);
            const subV = subA - subB;
            const subPct = subB !== 0 ? (subV / Math.abs(subB)) * 100 : 0;
            const subGood = g.positiveIsGood ? subV >= 0 : subV <= 0;
            const subColor = subB === 0 ? "var(--muted)" : subGood ? "var(--green)" : "var(--red)";
            return (
              <>
                <tr key={g.name}>
                  <td colSpan={6} className="anton border-b border-[var(--blue)]/20 px-3 pb-2 pt-4 text-[11px] tracking-[0.1em]" style={{ color: "var(--blue)" }}>
                    {g.name}
                  </td>
                </tr>
                {g.rows.map((r, i) => {
                  const v = r.actual - r.budget;
                  const pct = r.budget !== 0 ? (v / Math.abs(r.budget)) * 100 : 0;
                  const isGood = g.positiveIsGood ? v >= 0 : v <= 0;
                  const color = r.budget === 0 ? "var(--muted)" : isGood ? "var(--green)" : "var(--red)";
                  return (
                    <tr key={`${g.name}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="border-b border-white/[0.04] px-3 py-2 pl-6">{r.category}</td>
                      <td className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums">{r.budget > 0 ? formatLong(r.budget, "currency") : <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums font-semibold">{formatLong(r.actual, "currency")}</td>
                      <td className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums" style={{ color }}>
                        {r.budget === 0 ? "—" : (v >= 0 ? "+" : "") + formatLong(v, "currency")}
                      </td>
                      <td className="border-b border-white/[0.04] px-3 py-2 text-right tabular-nums" style={{ color }}>
                        {r.budget === 0 ? "—" : (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"}
                      </td>
                      <td className="border-b border-white/[0.04] px-3 py-2"><BarViz b={r.budget} a={r.actual} positiveIsGood={g.positiveIsGood} /></td>
                    </tr>
                  );
                })}
                <tr className="bg-white/[0.03]">
                  <td className="border-b border-[var(--card-border)] px-3 py-2 font-semibold">Total {g.name}</td>
                  <td className="border-b border-[var(--card-border)] px-3 py-2 text-right tabular-nums font-semibold">{formatLong(subB, "currency")}</td>
                  <td className="border-b border-[var(--card-border)] px-3 py-2 text-right tabular-nums font-semibold">{formatLong(subA, "currency")}</td>
                  <td className="border-b border-[var(--card-border)] px-3 py-2 text-right tabular-nums font-semibold" style={{ color: subColor }}>{(subV >= 0 ? "+" : "") + formatLong(subV, "currency")}</td>
                  <td className="border-b border-[var(--card-border)] px-3 py-2 text-right tabular-nums font-semibold" style={{ color: subColor }}>{subB === 0 ? "—" : (subPct >= 0 ? "+" : "") + subPct.toFixed(1) + "%"}</td>
                  <td className="border-b border-[var(--card-border)] px-3 py-2"><BarViz b={subB} a={subA} positiveIsGood={g.positiveIsGood} /></td>
                </tr>
              </>
            );
          })}
          {netRow && (
            <tr className={cn("border-t-2", "bg-[var(--blue-soft)]/20")} style={{ borderTopColor: "var(--blue)" }}>
              <td className="px-3 py-2 font-semibold">{netRow.label}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatLong(netRow.budget, "currency")}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatLong(netRow.actual, "currency")}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: netRow.actual - netRow.budget >= 0 ? "var(--green)" : "var(--red)" }}>
                {(netRow.actual - netRow.budget >= 0 ? "+" : "") + formatLong(netRow.actual - netRow.budget, "currency")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: netRow.actual - netRow.budget >= 0 ? "var(--green)" : "var(--red)" }}>
                {netRow.budget === 0 ? "—" : (((netRow.actual - netRow.budget) / Math.abs(netRow.budget)) * 100).toFixed(1) + "%"}
              </td>
              <td className="px-3 py-2"><BarViz b={netRow.budget} a={netRow.actual} positiveIsGood /></td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
