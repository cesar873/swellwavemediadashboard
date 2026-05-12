import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { ClientProfitTable } from "@/components/tables/ClientProfitTable";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clients · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function ClientProfitPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel } = boot;

  // ── Client profit rows are sheet-wide totals (one row per client) ───────
  const rows = data.clientProfits.filter(c => c.client && c.client !== "Client");

  // ── KPI aggregations ────────────────────────────────────────────────────
  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const profitable = rows.filter(r => r.profit > 0);
  const unprofitable = rows.filter(r => r.profit < 0);
  const avgMargin = rows.length
    ? rows.reduce((a, r) => a + (isFinite(r.margin) ? r.margin : 0), 0) / rows.length / 100
    : 0;
  const topClient = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const topShare = totalProfit > 0 && topClient ? topClient.profit / totalProfit : 0;

  const profitTone: Tone = totalProfit > 0 ? "success" : totalProfit < 0 ? "danger" : "neutral";
  const marginTone: Tone = avgMargin >= 0.5 ? "success" : avgMargin >= 0.3 ? "warning" : "danger";
  const unprofitableTone: Tone = unprofitable.length === 0 ? "success" : "danger";
  const concTone: Tone = topShare <= 0.25 ? "success" : topShare <= 0.4 ? "warning" : "danger";

  // ── Insights ────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (unprofitable.length) {
    const worst = [...unprofitable].sort((a, b) => a.profit - b.profit).slice(0, 3);
    const names = worst.map(w => `${w.client} (${formatCurrency(w.profit, { compact: true })})`).join(", ");
    insights.push({
      type: "alert",
      text: `${unprofitable.length} unprofitable client${unprofitable.length > 1 ? "s" : ""} — worst: ${names}.`,
    });
  }
  const topThree = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 3).filter(r => r.profit > 0);
  if (topThree.length) {
    insights.push({
      type: "win",
      text: `Top profit drivers: ${topThree.map(r => `${r.client} (${formatCurrency(r.profit, { compact: true })})`).join(", ")}.`,
    });
  }
  if (topShare > 0.25) {
    insights.push({
      type: "warn",
      text: `${topClient?.client} alone delivers ${(topShare * 100).toFixed(0)}% of total profit — concentration risk.`,
    });
  }
  const lossLeaders = rows
    .filter(r => r.revenue > 0 && r.margin < 30 && r.margin > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 2);
  if (lossLeaders.length) {
    insights.push({
      type: "info",
      text: `Loss-leader pattern: ${lossLeaders.map(r => `${r.client} at ${r.margin.toFixed(0)}% margin on ${formatCurrency(r.revenue, { compact: true })}`).join("; ")}.`,
    });
  }

  // ── Primary chart: profit by client (ranked) ────────────────────────────
  const profitByClient = rows.map(r => ({ label: r.client, value: r.profit }));

  // ── Secondary chart: margin distribution ────────────────────────────────
  const marginByClient = rows
    .filter(r => isFinite(r.margin) && r.revenue > 0)
    .map(r => ({ label: r.client, value: r.margin / 100 }));

  // ── Table rows ──────────────────────────────────────────────────────────
  const tableRows = rows.map(r => ({
    client: r.client,
    service: r.service,
    pod: r.pod,
    revenue: r.revenue,
    peopleCost: r.peopleCost,
    profit: r.profit,
    margin: r.margin,
  }));

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
          eyebrow="Client profitability"
          title="Clients"
          period={periodLabel}
          source="Client Profit"
        />

        <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Client Profit"
            value={formatCurrency(totalProfit, { compact: true })}
            tone={profitTone}
            size="sm"
          />
          <KpiStat
            label="Avg Margin"
            value={formatPercent(avgMargin)}
            tone={marginTone}
            size="sm"
          />
          <KpiStat
            label="Profitable Clients"
            value={String(profitable.length)}
            size="sm"
          />
          <KpiStat
            label="Unprofitable Clients"
            value={String(unprofitable.length)}
            tone={unprofitableTone}
            size="sm"
          />
          <KpiStat
            label="Top Client % of Profit"
            value={formatPercent(topShare)}
            tone={concTone}
            size="sm"
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Client profit"
            subtitle="Top contributors first · red bars are unprofitable"
          >
            <RankedBarChart
              data={profitByClient}
              color="#1390eb"
              negativeColor="#ef4444"
              format="currency"
              height={420}
              maxItems={20}
            />
          </CardShell>
        </section>

        <section className="mt-6">
          <CardShell
            title="Margin by client"
            subtitle="Red bars are unprofitable · sorted by margin"
          >
            <RankedBarChart
              data={marginByClient}
              color="#22c55e"
              negativeColor="#ef4444"
              format="percent"
              height={420}
              maxItems={20}
            />
          </CardShell>
        </section>

        <section className="mt-8">
          <CardShell
            title="Client profit table"
            subtitle="Revenue, people cost, profit, margin · sortable"
          >
            <ClientProfitTable rows={tableRows} />
          </CardShell>
        </section>

        <LiveFooter sources="Client Profit" />
      </div>
    </>
  );
}
