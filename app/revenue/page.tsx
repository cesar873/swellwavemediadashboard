import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { MoverCard } from "@/components/insights/MoverCard";
import { MonthOverMonthTable, type MoMRow } from "@/components/tables/MonthOverMonthTable";
import { bootstrapPage, sumAt, type PageSearchParams } from "@/lib/page-bootstrap";
import { labelToIso } from "@/lib/period";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revenue · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function RevenuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, selectedIndices, priorIndices, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, selectedMonths, forecastStartInSelection, selectedMonthIso, selectedMonthIndex, priorMonthIndex, selectedMonthLabel, selectedMonthIsForecast } = boot;
  const hasForecast = forecastStartInSelection >= 0;

  // ── Build clients × month grid in monthIso shape ─────────────────────────
  // sheets.ts gives us monthlyRevenue keyed by position in clientGrid. We need
  // to align to data.pl.months indices.
  const monthIndexLen = data.pl.months.length;
  const clientRows = data.clients.filter(c => c.client);

  // Compute total per client in the range
  const totalRev = (c: typeof clientRows[number]) =>
    selectedIndices.reduce((a, i) => a + (c.monthlyRevenue[i] ?? 0), 0);
  const priorRev = (c: typeof clientRows[number]) =>
    priorIndices.reduce((a, i) => a + (c.monthlyRevenue[i] ?? 0), 0);

  // ── KPI aggregations ─────────────────────────────────────────────────────
  // Total Revenue reads from the P&L "Total Revenue" row (the same source the
  // Financials tab uses) so the headline number matches across tabs. The
  // per-client sums may differ if some revenue on the P&L isn't allocated to
  // a client row in the Clients tab — the breakdown views below still show
  // composition from client data, but the KPI is sourced from P&L.
  const total = sumAt(data.pl.revenue, selectedIndices);
  const totalPrior = sumAt(data.pl.revenue, priorIndices);
  const clientSumTotal = clientRows.reduce((a, c) => a + totalRev(c), 0);
  const allocationGap = total - clientSumTotal;
  const allocationGapPct = total > 0 ? allocationGap / total : 0;
  const active = clientRows.filter(c => totalRev(c) > 0);
  const avgPerClient = active.length ? total / active.length : 0;

  // New clients: first revenue in the selected window
  const firstNonZero = (c: typeof clientRows[number]) =>
    c.monthlyRevenue.findIndex(v => (v ?? 0) > 0);
  const newClients = active.filter(c => {
    const first = firstNonZero(c);
    return first >= 0 && selectedIndices.includes(first);
  });

  // Top-3 share
  const byClientTotal = new Map<string, number>();
  for (const c of clientRows) {
    byClientTotal.set(c.client, (byClientTotal.get(c.client) ?? 0) + totalRev(c));
  }
  const sortedClients = [...byClientTotal.entries()].sort((a, b) => b[1] - a[1]);
  const top3Share = total > 0 ? sortedClients.slice(0, 3).reduce((a, [, v]) => a + v, 0) / total : 0;

  const hasPrior = priorIndices.length > 0;
  const deltaTotal = hasPrior && totalPrior > 0 ? (total - totalPrior) / totalPrior : null;
  const deltaLabel = hasPrior
    ? boot.priorMonths.length === 1
      ? `vs prior month`
      : `vs prior ${boot.priorMonths.length}mo`
    : "no prior period";

  const concentrationTone: Tone = top3Share <= 0.4 ? "success" : top3Share <= 0.6 ? "warning" : "danger";

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  // Allocation gap (P&L total vs per-client sum). > 1% = worth flagging because
  // the breakdown charts below won't sum to the headline KPI.
  if (Math.abs(allocationGapPct) > 0.01 && total > 0) {
    insights.push({
      type: "info",
      text: `${allocationGap >= 0 ? "+" : "-"}${formatCurrency(Math.abs(allocationGap), { compact: true })} of revenue (${(allocationGapPct * 100).toFixed(1)}%) is in the P&L but not allocated to a client in the Clients tab — breakdown charts will sum slightly lower than the KPI.`,
    });
  }
  if (deltaTotal != null) {
    if (deltaTotal >= 0.05) insights.push({ type: "win",  text: `Revenue grew +${(deltaTotal*100).toFixed(1)}% vs prior — document what drove it.` });
    else if (deltaTotal <= -0.05) insights.push({ type: "warn", text: `Revenue down ${(deltaTotal*100).toFixed(1)}% vs prior — investigate.` });
  }
  if (top3Share > 0.5) insights.push({ type: "warn", text: `Top-3 clients book ${(top3Share*100).toFixed(0)}% of revenue. Concentration risk.` });
  if (newClients.length) {
    insights.push({ type: "win", text: `${newClients.length} new client${newClients.length > 1 ? "s" : ""} in this period — momentum signal.` });
  }
  // Biggest decliner
  let worstDecliner: { name: string; pct: number } | null = null;
  for (const c of active) {
    const cur = totalRev(c);
    const pr  = priorRev(c);
    if (pr > 0 && cur < pr) {
      const pct = (cur - pr) / pr;
      if (!worstDecliner || pct < worstDecliner.pct) worstDecliner = { name: c.client, pct };
    }
  }
  if (worstDecliner && worstDecliner.pct <= -0.2) {
    const sev = worstDecliner.pct <= -0.5 ? "alert" : "warn";
    insights.push({ type: sev as Insight["type"], text: `${worstDecliner.name} revenue down ${Math.abs(worstDecliner.pct*100).toFixed(0)}% vs prior period.` });
  }

  // Phase 2: forecast trajectory — avg monthly revenue forecast vs actuals in selection
  if (hasForecast) {
    const actIdx = selectedIndices.slice(0, forecastStartInSelection);
    const fcIdx  = selectedIndices.slice(forecastStartInSelection);
    if (actIdx.length && fcIdx.length) {
      const actAvg = actIdx.reduce((a, i) => a + clientRows.reduce((s, c) => s + (c.monthlyRevenue[i] ?? 0), 0), 0) / actIdx.length;
      const fcAvg  = fcIdx.reduce((a, i) => a + clientRows.reduce((s, c) => s + (c.monthlyRevenue[i] ?? 0), 0), 0) / fcIdx.length;
      if (actAvg > 0) {
        const t = (fcAvg - actAvg) / actAvg;
        if (t <= -0.05)     insights.push({ type: "warn", text: `Forecast revenue trends ${(t*100).toFixed(0)}% below recent actuals — pull on pipeline now.` });
        else if (t >= 0.05) insights.push({ type: "info", text: `Forecast revenue trends +${(t*100).toFixed(0)}% vs recent actuals — confirm bookings are committed.` });
      }
    }
  }

  // ── Single-month snapshot ────────────────────────────────────────────────
  // Headline mTotal also sourced from the P&L for cross-tab consistency.
  const mIdx = selectedMonthIndex;
  const pmIdx = priorMonthIndex;
  const monthRev = (c: typeof clientRows[number], i: number) => (i >= 0 ? c.monthlyRevenue[i] ?? 0 : 0);
  const mTotal      = mIdx >= 0 ? (data.pl.revenue[mIdx] ?? 0) : 0;
  const mTotalPrior = pmIdx >= 0 ? (data.pl.revenue[pmIdx] ?? 0) : 0;
  const mActive     = clientRows.filter(c => monthRev(c, mIdx) > 0);
  const mAvg        = mActive.length ? mTotal / mActive.length : 0;
  // New clients in selected month: first non-zero month is exactly mIdx
  const mNewClients = clientRows.filter(c => c.monthlyRevenue.findIndex(v => (v ?? 0) > 0) === mIdx).length;
  // Single-month top-3 share — denominator stays P&L total
  const mSortedByMonth = [...clientRows].map(c => monthRev(c, mIdx)).sort((a, b) => b - a);
  const mTop3 = mSortedByMonth.slice(0, 3).reduce((a, v) => a + v, 0);
  const mTop3Share = mTotal > 0 ? mTop3 / mTotal : 0;

  const hasMonthPrior = pmIdx >= 0;
  const monthDeltaLabel = hasMonthPrior
    ? `vs ${(data.pl.months[pmIdx]?.label) ?? "prior month"}`
    : "no prior month";
  const monthConcentrationTone: Tone =
    mTop3Share <= 0.4 ? "success" : mTop3Share <= 0.6 ? "warning" : "danger";

  // ── Primary chart: revenue by service line stacked ──────────────────────
  const byService: Record<string, number[]> = {};
  for (const c of clientRows) {
    const svc = c.service?.trim() || "Unspecified";
    if (!byService[svc]) byService[svc] = Array(monthIndexLen).fill(0);
    for (let i = 0; i < monthIndexLen; i++) {
      byService[svc][i] += c.monthlyRevenue[i] ?? 0;
    }
  }
  const stackedData = selectedIndices.map(i => {
    const row: Record<string, number | string> = { label: data.pl.months[i]?.label ?? "" };
    for (const [svc, arr] of Object.entries(byService)) row[svc] = arr[i] ?? 0;
    return row;
  });
  const stackedSeries = Object.keys(byService).map(svc => ({ key: svc, label: svc }));

  // ── Secondary: breakdown for the single-month picker (so the snapshot
  //    cards and the breakdown cards both reflect the same month).
  const breakdownIdx = selectedMonthIndex >= 0
    ? selectedMonthIndex
    : selectedIndices[selectedIndices.length - 1];
  const byIndustry = aggForMonth(clientRows, breakdownIdx, c => c.pod || "Unspecified");
  const bySource   = aggForMonth(clientRows, breakdownIdx, c => c.source || "Unspecified");
  const byPod      = aggForMonth(clientRows, breakdownIdx, c => c.pod || "Unspecified");
  void byIndustry;
  void byPod;

  // ── Main table: client × service MoM ─────────────────────────────────────
  const tableRows: MoMRow[] = clientRows.map((c, idx) => {
    const monthly: Record<string, number> = {};
    for (let i = 0; i < monthIndexLen; i++) {
      const iso = labelToIso(data.pl.months[i]?.label ?? "");
      if (iso && selectedMonths.includes(iso)) monthly[iso] = c.monthlyRevenue[i] ?? 0;
    }
    return {
      id: `${c.client}-${idx}`,
      primary: c.client,
      secondary: c.service,
      tertiary: c.pod || undefined,
      monthly,
      total: totalRev(c),
    };
  }).filter(r => r.total > 0);

  // ── Top movers (growers / decliners) ─────────────────────────────────────
  const moverItems = clientRows
    .map(c => ({ name: c.client, current: totalRev(c), prior: priorRev(c) }))
    .filter(m => m.current > 0 || m.prior > 0)
    .map(m => ({ ...m, delta: m.current - m.prior }));
  const growers = [...moverItems]
    .filter(m => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);
  const decliners = [...moverItems]
    .filter(m => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);
  const moverMaxAbs = Math.max(1, ...moverItems.map(m => Math.abs(m.delta)));
  const moverSubtitle =
    hasPrior && boot.priorMonths.length
      ? `Comparing current vs prior ${boot.priorMonths.length}-month window`
      : "No prior period available";

  void selectedMonthLabel;
  return (
    <>
      <Suspense fallback={null}>
        <GlobalFiltersBar
          monthsIso={monthsIso}
          latestActualIso={latestActualIso}
          fromIso={fromIso}
          toIso={toIso}
          monthsParam={monthsParam}
          selectedMonthIso={selectedMonthIso}
        />
      </Suspense>

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Service revenue"
          title="Revenue"
          period={periodLabel}
          source="Services + Clients"
        />

        <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

        <SectionTitle label={`Month snapshot · ${selectedMonthLabel}`} hint={selectedMonthIsForecast ? "forecast month" : undefined} />
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Revenue"
            value={formatCurrency(mTotal, { compact: true })}
            delta={hasMonthPrior && mTotalPrior > 0 ? (mTotal - mTotalPrior) / mTotalPrior : null}
            deltaLabel={monthDeltaLabel}
            size="sm"
          />
          <KpiStat label="Active Clients" value={String(mActive.length)} size="sm" />
          <KpiStat label="Avg Rev / Client" value={formatCurrency(mAvg, { compact: true })} size="sm" />
          <KpiStat
            label="New Clients"
            value={String(mNewClients)}
            tone={mNewClients > 0 ? "success" : "neutral"}
            size="sm"
          />
          <KpiStat
            label="Top-3 Share"
            value={formatPercent(mTop3Share)}
            tone={monthConcentrationTone}
            size="sm"
          />
        </section>

        <SectionTitle label={`Range · ${periodLabel}`} className="mt-6" />
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Revenue"
            value={formatCurrency(total, { compact: true })}
            delta={deltaTotal}
            deltaLabel={deltaLabel}
            size="sm"
          />
          <KpiStat
            label="Active Clients"
            value={String(active.length)}
            size="sm"
          />
          <KpiStat
            label="Avg Revenue / Client"
            value={formatCurrency(avgPerClient, { compact: true })}
            size="sm"
          />
          <KpiStat
            label="New Clients"
            value={String(newClients.length)}
            tone={newClients.length > 0 ? "success" : "neutral"}
            size="sm"
          />
          <KpiStat
            label="Top-3 Share"
            value={formatPercent(top3Share)}
            tone={concentrationTone}
            size="sm"
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Revenue by service line"
            subtitle={`Stacked monthly · biggest service at the base${hasForecast ? " · shaded region is forecast" : ""}`}
          >
            <StackedBarChart
              data={stackedData}
              xKey="label"
              series={stackedSeries}
              paletteSort="blue"
              format="currency"
              height={320}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardShell title="By source" subtitle={`Snapshot · ${selectedMonthLabel}`}>
            <RankedBarChart
              data={bySource}
              color="#22c55e"
              format="currency"
              height={280}
              maxItems={10}
            />
          </CardShell>
          <CardShell title="By pod" subtitle={`Snapshot · ${selectedMonthLabel}`}>
            <RankedBarChart
              data={byPod}
              color="#c084fc"
              format="currency"
              height={280}
              maxItems={10}
            />
          </CardShell>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MoverCard
            title="Top growers"
            subtitle={moverSubtitle}
            items={growers}
            variant="grower"
            max={moverMaxAbs}
          />
          <MoverCard
            title="Top decliners"
            subtitle={moverSubtitle}
            items={decliners}
            variant="decliner"
            max={moverMaxAbs}
          />
        </section>

        <section className="mt-8">
          <CardShell title="Client × service revenue" subtitle="Filterable · sortable · scroll horizontally to see all months">
            <MonthOverMonthTable
              rows={tableRows}
              monthsIso={selectedMonths}
              primaryHeader="Client · Service"
              tertiaryHeader="Pod"
              barColor="rgba(34,211,238,0.45)"
              searchPlaceholder="Search client or service…"
              latestActualIso={latestActualIso}
            />
          </CardShell>
        </section>

        <LiveFooter sources="Services + Clients" />
      </div>
    </>
  );
}

function aggForMonth(
  clients: Array<{ monthlyRevenue: number[]; service?: string; source?: string; pod?: string }>,
  monthIdx: number,
  pick: (c: { service?: string; source?: string; pod?: string }) => string,
): Array<{ label: string; value: number }> {
  const agg = new Map<string, number>();
  for (const c of clients) {
    const k = pick(c) || "Unspecified";
    agg.set(k, (agg.get(k) ?? 0) + (c.monthlyRevenue[monthIdx] ?? 0));
  }
  return [...agg.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);
}
