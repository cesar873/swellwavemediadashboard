import { Suspense } from "react";
import { Info } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { PeopleProfitTable } from "@/components/tables/PeopleProfitTable";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "People · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function PeopleProfitPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel } = boot;
  const rows = data.teamProfit;

  return (
    <>
      <Suspense fallback={null}>
        <GlobalFiltersBar
          monthsIso={monthsIso}
          latestActualIso={latestActualIso}
          fromIso={fromIso}
          toIso={toIso}
          monthsParam={monthsParam}
        />
      </Suspense>

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Team profitability"
          title="People"
          period={periodLabel}
          source="Team Profit"
        />

        {!rows.length ? <EmptyState /> : <Body rows={rows} periodLabel={periodLabel} />}

        <LiveFooter sources="Team Profit" />
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-[var(--blue)]" />
        <h2 className="text-base font-semibold text-foreground">People needs a Team Profit rollup</h2>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        This view tracks per-person profitability — utilization, revenue covered, vs target, and revenue gap. The
        connected sheet doesn&apos;t have a Team Profit rollup yet, so showing the page would be em-dashes.
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        To unlock it, add a tab with a header row containing at minimum{" "}
        <code className="rounded bg-white/5 px-1">Name</code> and{" "}
        <code className="rounded bg-white/5 px-1">Revenue Covered</code>. The parser also picks up{" "}
        <code className="rounded bg-white/5 px-1">Department</code>,{" "}
        <code className="rounded bg-white/5 px-1">Hours Available</code>,{" "}
        <code className="rounded bg-white/5 px-1">Utilization</code>,{" "}
        <code className="rounded bg-white/5 px-1">vs Target</code>, and{" "}
        <code className="rounded bg-white/5 px-1">Revenue Gap</code>.
      </p>
    </div>
  );
}

function Body({ rows, periodLabel }: { rows: import("@/lib/types").TeamProfitRow[]; periodLabel: string }) {
  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalRevCovered = rows.reduce((a, r) => a + r.revenueCovered, 0);
  const avgUtil = rows.length ? rows.reduce((a, r) => a + (isFinite(r.utilization) ? r.utilization : 0), 0) / rows.length : 0;
  const onTarget = rows.filter(r => r.vsTarget >= 0).length;
  const underTotalGap = rows.filter(r => r.revenueGap < 0).reduce((a, r) => a + Math.abs(r.revenueGap), 0);
  const totalHours = rows.reduce((a, r) => a + (r.hoursAvailable || 0), 0);

  const utilTone: Tone = avgUtil >= 0.75 ? "success" : avgUtil >= 0.5 ? "warning" : "danger";
  const gapTone:  Tone = underTotalGap === 0 ? "success" : "danger";

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  const under = [...rows].filter(r => r.revenueGap < 0).sort((a, b) => a.revenueGap - b.revenueGap).slice(0, 3);
  if (under.length) {
    insights.push({
      type: "alert",
      text: `Under-target: ${under.map(p => `${p.name} (${formatCurrency(p.revenueGap, { compact: true })})`).join(", ")}.`,
    });
  }
  const over = rows.filter(r => r.utilization > 1.1);
  if (over.length) {
    insights.push({
      type: "warn",
      text: `Over-utilised (${over.length}): ${over.slice(0, 3).map(p => `${p.name} at ${(p.utilization * 100).toFixed(0)}%`).join(", ")} — burnout risk.`,
    });
  }
  const surplus = [...rows].filter(r => r.revenueGap > 0).sort((a, b) => b.revenueGap - a.revenueGap).slice(0, 3);
  if (surplus.length) {
    insights.push({
      type: "win",
      text: `High performers: ${surplus.map(p => `${p.name} (+${formatCurrency(p.revenueGap, { compact: true })})`).join(", ")}.`,
    });
  }
  const bench = rows.filter(r => r.utilization > 0 && r.utilization < 0.2);
  if (bench.length) {
    insights.push({
      type: "info",
      text: `${bench.length} on the bench (< 20% util): ${bench.slice(0, 3).map(p => p.name).join(", ")} — placement opportunity.`,
    });
  }

  // ── Primary chart: revenue gap (diverging) ───────────────────────────────
  const gapData = [...rows]
    .map(r => ({ label: r.name, value: r.revenueGap }))
    .sort((a, b) => a.value - b.value); // most-negative first

  void periodLabel;
  return (
    <>
      <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat label="Revenue Covered" value={formatCurrency(totalRevCovered, { compact: true })} size="sm" />
        <KpiStat label="Avg Utilization" value={formatPercent(avgUtil)} tone={utilTone} size="sm" />
        <KpiStat label="People on Target" value={`${onTarget} / ${rows.length}`} size="sm" />
        <KpiStat
          label="Revenue Gap"
          value={formatCurrency(underTotalGap, { compact: true })}
          tone={gapTone}
          size="sm"
        />
        <KpiStat label="Hours Available" value={String(totalHours)} size="sm" />
      </section>

      <section className="mt-8">
        <CardShell title="Revenue gap by person" subtitle="Red = below target · green = surplus">
          <RankedBarChart
            data={gapData}
            color="#22c55e"
            negativeColor="#ef4444"
            format="currency"
            height={Math.max(280, Math.min(480, rows.length * 26))}
            maxItems={rows.length}
          />
        </CardShell>
      </section>

      <section className="mt-8">
        <CardShell title="People profit table" subtitle="Hours · revenue covered · utilization · vs target · gap">
          <PeopleProfitTable rows={rows} />
        </CardShell>
      </section>
    </>
  );
}
