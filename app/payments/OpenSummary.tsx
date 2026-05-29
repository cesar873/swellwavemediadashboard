"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Receivable } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { statusKind } from "./shared";

export function OpenSummary({ receivables }: { receivables: Receivable[] }) {
  const open = receivables.filter(r => {
    const k = statusKind(r.status);
    return k === "unpaid"; // Unpaid + Partially Paid both classify as "unpaid"
  });
  const openAmt = (r: Receivable) => (r.openAmount || r.amount || 0);

  const unpaid = open.filter(r => !r.status.toLowerCase().includes("partial"));
  const partial = open.filter(r => r.status.toLowerCase().includes("partial"));

  const unpaidTotal = unpaid.reduce((a, r) => a + openAmt(r), 0);
  const partialTotal = partial.reduce((a, r) => a + openAmt(r), 0);
  const total = unpaidTotal + partialTotal;
  const overdueTotal = open.filter(r => r.daysOverdue > 0).reduce((a, r) => a + openAmt(r), 0);

  const donut = [
    { name: "Unpaid", value: unpaidTotal, color: "var(--amber)" },
    { name: "Partially Paid", value: partialTotal, color: "var(--yellow)" },
  ].filter(d => d.value > 0);

  const sorted = [...open].sort((a, b) => b.daysOverdue - a.daysOverdue);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Outstanding invoices</div>
      <div className="anton text-[28px] leading-none">{formatCurrency(total, { compact: true })}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">
        {open.length} sent, not yet collected
        {overdueTotal > 0 && <span className="text-[var(--red)]"> · {formatCurrency(overdueTotal, { compact: true })} overdue</span>}
      </div>

      {donut.length > 0 && (
        <div className="relative mx-auto my-4 h-[180px] w-full max-w-[260px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={84} startAngle={90} endAngle={-270} stroke="none" paddingAngle={1.5}>
                {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Open</span>
            <span className="anton text-[20px] leading-none">{formatCurrency(total, { compact: true })}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-1.5">
        {donut.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
              <span className="text-foreground/80">{d.name}</span>
              <span className="text-muted-foreground">({d.name === "Unpaid" ? unpaid.length : partial.length})</span>
              <span className="ml-auto tabular-nums font-semibold text-foreground">{formatCurrency(d.value, { compact: true })}</span>
              <span className="w-8 text-right tabular-nums text-muted-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sent &amp; unpaid</div>
      <div className="mt-2 max-h-[300px] overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="px-1 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Client</th>
              <th className="px-1 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Service</th>
              <th className="px-1 py-1 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              <th className="px-1 py-1 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Due</th>
              <th className="px-1 py-1 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Days</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.rowNumber}-${i}`} className="border-t border-white/[0.04]">
                <td className="max-w-[110px] truncate px-1 py-1.5 font-medium text-foreground" title={r.client}>{r.client || "—"}</td>
                <td className="max-w-[110px] truncate px-1 py-1.5 text-muted-foreground" title={r.service}>{r.service || "—"}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{formatCurrency(openAmt(r), { compact: true })}</td>
                <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{r.dueDate || "—"}</td>
                <td className={cn("px-1 py-1.5 text-right tabular-nums", r.daysOverdue > 0 ? "text-[var(--red)]" : "text-muted-foreground")}>
                  {r.daysOverdue > 0 ? `${r.daysOverdue}d` : r.daysOverdue < 0 ? `${Math.abs(r.daysOverdue)}d` : "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={5} className="px-1 py-4 text-center text-muted-foreground">Nothing outstanding.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
