import { Suspense } from "react";
import { Info } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { SignedLostBars } from "@/components/charts/SignedLostBars";
import { MetricsTable } from "@/components/tables/MetricsTable";
import { CHART_PALETTE } from "@/components/charts/chart-shared";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, formatNumber, type Tone } from "@/lib/utils";
import { labelToIso, isoToLabel } from "@/lib/period";
import type { MetricRow } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const {
    data,
    monthsIso,
    latestActualIso,
    fromIso,
    toIso,
    monthsParam,
    periodLabel,
    selectedMonths,
    selectedMonthIso,
    selectedMonthIndex,
    priorMonthIndex,
    selectedMonthLabel,
  } = boot;

  const m = data.metrics;

  // ── Metric lookup by name (exact, then contains) ─────────────────────────
  function lookup(...names: string[]): MetricRow | null {
    if (!m.metricRows?.length) return null;
    for (const name of names) {
      const lower = name.toLowerCase();
      const exact = m.metricRows.find(r => r.name.toLowerCase() === lower);
      if (exact) return exact;
    }
    for (const name of names) {
      const lower = name.toLowerCase();
      const partial = m.metricRows.find(r => r.name.toLowerCase().includes(lower));
      if (partial) return partial;
    }
    return null;
  }

  // Re-align a metric row (keyed to the Metrics tab's months) to pl.months order.
  function alignedValues(row: MetricRow | null): number[] {
    if (!row || !m.metricMonthsIso?.length) return [];
    return data.pl.months.map(month => {
      const iso = labelToIso(month.label) ?? "";
      const idx = m.metricMonthsIso!.indexOf(iso);
      return idx >= 0 ? row.values[idx] ?? 0 : 0;
    });
  }

  const ltvR    = lookup("Unique Client LTV", "LTV", "Lifetime Value");
  const cacR    = lookup("Unique Client CAC", "CAC", "Customer Acquisition Cost");
  const churnR  = lookup("Unique Client Churn", "Client Churn", "Churn");
  const totalR  = lookup("Total Unique Clients", "Total Clients", "Active Clients");
  const signedR = lookup("Unique Clients Signed", "Clients Signed", "New Clients", "Signed");
  const lostR   = lookup("Unique Clients Lost", "Clients Lost", "Lost Clients", "Lost");
  const concentrationR = lookup("Client Concentration", "Concentration", "Top Client Share", "Top-1 Share");
  const burnR          = lookup("Burn Rate", "Net Burn", "Burn");
  const cashR          = lookup("Total for bank accounts", "Ending Cash", "Cash on hand", "Cash");

  const empty = !m.metricRows?.length;

  // ── Single-month KPI snapshot (independent of the range picker) ──────────
  const ltvAligned    = alignedValues(ltvR);
  const cacAligned    = alignedValues(cacR);
  const churnAligned  = alignedValues(churnR);
  const totalAligned  = alignedValues(totalR);
  const signedAligned = alignedValues(signedR);
  const lostAligned   = alignedValues(lostR);
  const concAligned   = alignedValues(concentrationR);
  const burnAligned   = alignedValues(burnR);
  const cashAligned   = alignedValues(cashR);

  const atSel   = (arr: number[]) => (selectedMonthIndex >= 0 ? arr[selectedMonthIndex] ?? 0 : 0);
  const atPrior = (arr: number[]) => (priorMonthIndex   >= 0 ? arr[priorMonthIndex]   ?? 0 : 0);

  const ltvNow    = atSel(ltvAligned);
  const ltvPrev   = atPrior(ltvAligned);
  const cacNow    = atSel(cacAligned);
  const cacPrev   = atPrior(cacAligned);
  const churnNow  = atSel(churnAligned);
  const churnPrev = atPrior(churnAligned);
  const totalNow  = atSel(totalAligned);
  const totalPrev = atPrior(totalAligned);
  const ratioNow  = cacNow > 0 ? ltvNow / cacNow : 0;
  const ratioPrev = cacPrev > 0 ? ltvPrev / cacPrev : 0;

  const concNowKpi  = atSel(concAligned);
  const concPrevKpi = atPrior(concAligned);
  const burnNow     = atSel(burnAligned);
  const burnPrev    = atPrior(burnAligned);
  const cashNow     = atSel(cashAligned);
  const cashPrev    = atPrior(cashAligned);

  const signedNow = atSel(signedAligned);
  const lostNow   = atSel(lostAligned);

  const moMDelta = (cur: number, prev: number): number | null => {
    if (!isFinite(cur) || !isFinite(prev) || prev === 0) return null;
    return (cur - prev) / Math.abs(prev);
  };
  const moMDeltaInverted = (cur: number, prev: number): number | null => {
    const d = moMDelta(cur, prev);
    return d == null ? null : -d;
  };

  const deltaLabel = priorMonthIndex >= 0
    ? `vs ${data.pl.months[priorMonthIndex]?.label ?? "prior month"}`
    : "no prior month";

  const ratioTone: Tone   = ratioNow >= 3 ? "success" : ratioNow >= 1 ? "warning" : "danger";
  const churnTone: Tone   = churnNow <= 0.05 ? "success" : churnNow <= 0.10 ? "warning" : "danger";
  const totalTone: Tone   = (moMDelta(totalNow, totalPrev) ?? 0) >= 0 ? "success" : "danger";
  // Concentration: lower = more diversified = better.
  const concTone: Tone    = concNowKpi <= 0.25 ? "success" : concNowKpi <= 0.4 ? "warning" : "danger";
  // Burn: falling burn (or net-positive) is good.
  const burnTone: Tone    = burnNow <= 0 ? "success" : (moMDelta(burnNow, burnPrev) ?? 0) <= 0 ? "success" : "warning";
  // Cash: rising cash is good.
  const cashTone: Tone    = (moMDelta(cashNow, cashPrev) ?? 0) >= 0 ? "success" : "warning";

  // ── Visible month window — clip every chart + table to the selected range ─
  // The Metrics tab carries its own months; we only render those that fall
  // inside [fromIso, toIso]. Picking Jan→Apr now hides May/June entirely.
  const selectedSet = new Set(selectedMonths);
  const metricMonthsIso = m.metricMonthsIso ?? [];
  const visibleIdx = metricMonthsIso
    .map((iso, i) => ({ iso, i }))
    .filter(x => selectedSet.has(x.iso))
    .map(x => x.i);

  const vLabels   = visibleIdx.map(i => m.metricMonths?.[i] ?? "");
  const vStatuses = visibleIdx.map(i => m.metricStatuses?.[i] ?? "Actuals");
  // First forecast position within the visible window. A month is forecast if
  // its ISO is past latestActualIso OR the Metrics Status row marks it — so the
  // dashed forecast styling shows even when the sheet has no Status row.
  const vForecastIdx = (() => {
    for (let k = 0; k < visibleIdx.length; k++) {
      const iso = metricMonthsIso[visibleIdx[k]] ?? "";
      if ((iso && latestActualIso && iso > latestActualIso) || vStatuses[k] === "Forecast") return k;
    }
    return -1;
  })();

  const vValues = (row: MetricRow | null): number[] =>
    visibleIdx.map(i => row?.values[i] ?? 0);

  // ── Insights (single-month, data-driven) ─────────────────────────────────
  const insights: Insight[] = [];
  if (signedR && lostR && (signedNow > 0 || lostNow > 0)) {
    const net = signedNow - lostNow;
    if (net < 0)       insights.push({ type: "alert", text: `Net client loss this month — ${signedNow} signed vs ${lostNow} lost (net ${net}). Pipeline needs pull.` });
    else if (net === 0) insights.push({ type: "warn",  text: `Flat client count this month — ${signedNow} signed vs ${lostNow} lost. Pipeline replaces churn but isn't growing it.` });
    else                insights.push({ type: "win",   text: `Net +${net} clients this month — ${signedNow} signed vs ${lostNow} lost.` });
  }
  if (churnR && churnNow > 0) {
    const pct = (churnNow * 100).toFixed(1);
    if (churnNow > 0.10)      insights.push({ type: churnNow > 0.15 ? "alert" : "warn", text: `Client churn at ${pct}% — high. Identify and address departures from this cohort.` });
    else if (churnNow > 0.05) insights.push({ type: "warn", text: `Client churn at ${pct}% — above the healthy 5% threshold.` });
    else                       insights.push({ type: "win",  text: `Client churn at ${pct}% — within the healthy band.` });
  }
  if (ratioNow > 0 && ltvR && cacR) {
    const r = ratioNow.toFixed(1);
    if (ratioNow >= 3)      insights.push({ type: "win",   text: `LTV/CAC at ${r}x — every $1 of acquisition returns $${r} in lifetime value. Above the 3x healthy threshold.` });
    else if (ratioNow >= 1) insights.push({ type: "warn",  text: `LTV/CAC at ${r}x — below the 3x healthy threshold.` });
    else                    insights.push({ type: "alert", text: `LTV/CAC at ${r}x — CAC exceeds LTV. Acquisition is unprofitable.` });
  }
  if (ltvR && ltvPrev !== 0) {
    const d = (ltvNow - ltvPrev) / Math.abs(ltvPrev);
    if (Math.abs(d) >= 0.05) {
      insights.push({
        type: d > 0 ? "info" : "warn",
        text: `LTV ${d > 0 ? "up" : "down"} ${Math.abs(d * 100).toFixed(0)}% MoM (${formatCurrency(ltvPrev, { compact: true })} → ${formatCurrency(ltvNow, { compact: true })}).`,
      });
    }
  }

  // ── Chart data (all clipped to the visible window) ───────────────────────
  const concentrationRow =
    lookup("Client Concentration", "Concentration", "Top Client Share", "Top-1 Share");
  const concentrationData = visibleIdx.map((i, k) => ({
    label: vLabels[k],
    concentration: concentrationRow?.values[i] ?? 0,
  }));

  const endingCashRow =
    lookup("Total for bank accounts", "Ending Cash", "Cash on hand", "Cash");
  const burnRateRow =
    lookup("Burn Rate", "Net Burn", "Burn");

  const opexVsCashData = visibleIdx.map((i, k) => {
    const iso = metricMonthsIso[i] ?? "";
    const plIdx = iso ? data.pl.months.findIndex(mo => (labelToIso(mo.label) ?? "") === iso) : -1;
    return {
      label: vLabels[k],
      opex: plIdx >= 0 ? data.pl.opex[plIdx] ?? 0 : 0,
      cash: endingCashRow?.values[i] ?? 0,
    };
  });

  const burnRateData = visibleIdx.map((i, k) => ({ label: vLabels[k], burn: burnRateRow?.values[i] ?? 0 }));

  const churnVals   = vValues(churnR);
  const signedVals  = vValues(signedR);
  const lostVals    = vValues(lostR);
  const totalVals   = vValues(totalR);

  const churnTrendData = vLabels.map((label, k) => ({ label, churn: churnVals[k] ?? 0 }));
  const signedLostData = vLabels.map((label, k) => ({
    label,
    signed: signedVals[k] ?? 0,
    lost:   lostVals[k] ?? 0,
    total:  totalVals[k] ?? 0,
  }));

  // Concentration insight
  const concNow = concentrationData[concentrationData.length - 1];
  if (concNow && concNow.concentration >= 0.4) {
    insights.push({
      type: concNow.concentration >= 0.6 ? "alert" : "warn",
      text: `Client concentration at ${(concNow.concentration * 100).toFixed(0)}% — diversifying would lower revenue risk.`,
    });
  }

  const insightsHeadline = (selectedMonthLabel || isoToLabel(latestActualIso)).toUpperCase();

  // Visible metric rows for the table — clip each row's values to the window.
  const visibleMetricRows: MetricRow[] = (m.metricRows ?? []).map(r => ({
    ...r,
    rawStrings: visibleIdx.map(i => r.rawStrings[i] ?? ""),
    values: visibleIdx.map(i => r.values[i] ?? 0),
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
          selectedMonthIso={selectedMonthIso}
        />
      </Suspense>

      <div className="mx-auto max-w-[1400px] px-6 pb-12 pt-8">
        <PageHero
          eyebrow="Unit economics"
          title="Analytics"
          period={periodLabel}
          source="Metrics"
        />

        {empty ? (
          <EmptyState />
        ) : (
          <>
            <WhatToDoNext periodLabel={insightsHeadline} insights={insights} />

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiStat label="Client Concentration" value={concentrationR ? formatPercent(concNowKpi) : "—"} tone={concTone} delta={moMDeltaInverted(concNowKpi, concPrevKpi)} deltaLabel={deltaLabel} size="sm" />
              <KpiStat label="Burn Rate"    value={burnR ? formatNumber(burnNow) : "—"} tone={burnTone} delta={moMDeltaInverted(burnNow, burnPrev)} deltaLabel={deltaLabel} size="sm" />
              <KpiStat label="Ending Cash"  value={cashR ? formatCurrency(cashNow, { compact: true }) : "—"} tone={cashTone} delta={moMDelta(cashNow, cashPrev)} deltaLabel={deltaLabel} size="sm" />
              <KpiStat label="Churn"        value={formatPercent(churnNow)} tone={churnTone} delta={moMDeltaInverted(churnNow, churnPrev)} deltaLabel={deltaLabel} size="sm" />
              <KpiStat label="Total Clients" value={String(Math.round(totalNow))} tone={totalTone} delta={moMDelta(totalNow, totalPrev)} deltaLabel={deltaLabel} size="sm" />
            </section>

            <section className="mt-8">
              <CardShell
                title="Client concentration per month"
                subtitle={
                  concentrationRow
                    ? `Pulled from the Metrics tab · "${concentrationRow.name}"`
                    : "Add a Client Concentration row to the Metrics tab to populate this chart"
                }
              >
                <MultiLineChart
                  data={concentrationData}
                  xKey="label"
                  series={[
                    { key: "concentration", label: "Client concentration", color: CHART_PALETTE.amber, format: "percent" },
                  ]}
                  leftFormat="percent"
                  height={320}
                  forecastStartIndex={vForecastIdx >= 0 ? vForecastIdx : undefined}
                />
              </CardShell>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CardShell
                title="OpEx vs Ending Cash"
                subtitle={
                  endingCashRow
                    ? `Monthly OpEx (P&L) against "${endingCashRow.name}" (Metrics tab)`
                    : "Add a Total for bank accounts row to the Metrics tab to populate this chart"
                }
              >
                <MultiLineChart
                  data={opexVsCashData}
                  xKey="label"
                  series={[
                    { key: "opex", label: "OpEx",        color: CHART_PALETTE.red,  format: "currency" },
                    { key: "cash", label: "Ending Cash", color: CHART_PALETTE.blue, format: "currency" },
                  ]}
                  leftFormat="currency"
                  height={300}
                  forecastStartIndex={vForecastIdx >= 0 ? vForecastIdx : undefined}
                />
              </CardShell>

              <CardShell
                title="Burn Rate"
                subtitle={
                  burnRateRow
                    ? `Pulled from the Metrics tab · "${burnRateRow.name}"`
                    : "Add a Burn Rate row to the Metrics tab to populate this chart"
                }
              >
                <MultiLineChart
                  data={burnRateData}
                  xKey="label"
                  series={[
                    { key: "burn", label: "Burn rate", color: CHART_PALETTE.amber, format: "number" },
                  ]}
                  leftFormat="number"
                  height={300}
                  forecastStartIndex={vForecastIdx >= 0 ? vForecastIdx : undefined}
                />
              </CardShell>
            </section>

            <section className="mt-6">
              <CardShell
                title="Churn"
                subtitle="Monthly client churn rate"
              >
                <MultiLineChart
                  data={churnTrendData}
                  xKey="label"
                  series={[
                    { key: "churn", label: "Churn", color: CHART_PALETTE.red, format: "percent" },
                  ]}
                  leftFormat="percent"
                  height={300}
                  forecastStartIndex={vForecastIdx >= 0 ? vForecastIdx : undefined}
                />
              </CardShell>
            </section>

            <section className="mt-6">
              <CardShell
                title="Signed & Lost clients"
                subtitle="Bars: monthly signs / losses · line: total clients on the books"
              >
                <SignedLostBars
                  data={signedLostData}
                  height={360}
                  forecastStartIndex={vForecastIdx >= 0 ? vForecastIdx : undefined}
                  totalLabel="Total clients"
                />
              </CardShell>
            </section>

            <section className="mt-8">
              <CardShell title="" subtitle="">
                <MetricsTable
                  rows={visibleMetricRows}
                  monthLabels={vLabels}
                  statuses={vStatuses}
                />
              </CardShell>
            </section>
          </>
        )}

        <LiveFooter sources="Metrics" />
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-[var(--blue)]" />
        <h2 className="text-base font-semibold text-foreground">Analytics needs a Metrics tab</h2>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        This view tracks <strong className="text-foreground">unit economics</strong> — LTV, CAC, churn, signed vs lost
        movement, concentration and burn. None of those rows were found in the connected sheet yet.
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        To unlock this tab, add a <strong className="text-foreground">Metrics</strong> tab to your sheet with one row
        per metric and one column per month (and a Status row marking Actuals/Forecast).
      </p>
    </div>
  );
}
