import { Suspense } from "react";
import { Info } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { CountingToggle, type CountingMode } from "@/components/layout/CountingToggle";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { SignedLostBars } from "@/components/charts/SignedLostBars";
import { MetricsTable } from "@/components/tables/MetricsTable";
import { CHART_PALETTE } from "@/components/charts/chart-shared";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import { labelToIso, isoToLabel } from "@/lib/period";
import type { MetricRow } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface AnalyticsSearchParams extends PageSearchParams {
  counting?: string;
}

interface Props {
  searchParams: Promise<AnalyticsSearchParams>;
}

// ── Metric-name registry ─────────────────────────────────────────────────────
// The Metrics tab supplies two parallel sets of rows: one counted "By
// engagement" (each contract counts) and one counted "By unique client"
// (deduped). The toggle just swaps which row each KPI / chart reads.
const METRIC_NAMES = {
  unique: {
    ltv:    "Unique Client LTV",
    cac:    "Unique Client CAC",
    churn:  "Unique Client Churn",
    total:  "Total Unique Clients",
    signed: "Unique Clients Signed",
    lost:   "Unique Clients Lost",
  },
  engagement: {
    ltv:    "LTV",
    cac:    "CAC",
    churn:  "Churn",
    total:  "Total Clients",
    signed: "Clients Signed",
    lost:   "Clients Lost",
  },
} as const;

const KPI_PREFIX: Record<CountingMode, string> = {
  unique: "Unique client",
  engagement: "",
};

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
    selectedMonthIso,
    selectedMonthIndex,
    priorMonthIndex,
    selectedMonthLabel,
  } = boot;

  const m = data.metrics;
  const counting: CountingMode =
    sp.counting === "engagement" ? "engagement" : "unique";

  // ── Helper: look up a metric row by name and re-align to pl.months order ─
  function lookup(name: string): MetricRow | null {
    if (!m.metricRows?.length) return null;
    const lower = name.toLowerCase();
    return (
      m.metricRows.find(r => r.name.toLowerCase() === lower) ??
      m.metricRows.find(r => r.name.toLowerCase().includes(lower)) ??
      null
    );
  }

  function alignedValues(row: MetricRow | null): number[] {
    if (!row || !m.metricMonthsIso?.length) return [];
    return data.pl.months.map(month => {
      const iso = labelToIso(month.label) ?? "";
      const idx = m.metricMonthsIso!.indexOf(iso);
      return idx >= 0 ? row.values[idx] ?? 0 : 0;
    });
  }

  // Resolve the active metric set, falling back to unique-client variants if
  // the engagement variant is missing in the sheet.
  function resolveMetric(key: keyof typeof METRIC_NAMES.unique): { row: MetricRow | null; resolvedName: string } {
    const primary = METRIC_NAMES[counting][key];
    const primaryRow = lookup(primary);
    if (primaryRow) return { row: primaryRow, resolvedName: primaryRow.name };
    const fallback = METRIC_NAMES[counting === "unique" ? "engagement" : "unique"][key];
    const fbRow = lookup(fallback);
    return { row: fbRow, resolvedName: fbRow?.name ?? primary };
  }

  const ltvR    = resolveMetric("ltv");
  const cacR    = resolveMetric("cac");
  const churnR  = resolveMetric("churn");
  const totalR  = resolveMetric("total");
  const signedR = resolveMetric("signed");
  const lostR   = resolveMetric("lost");

  const ltvAligned    = alignedValues(ltvR.row);
  const cacAligned    = alignedValues(cacR.row);
  const churnAligned  = alignedValues(churnR.row);
  const totalAligned  = alignedValues(totalR.row);
  const signedAligned = alignedValues(signedR.row);
  const lostAligned   = alignedValues(lostR.row);

  const empty = !m.metricRows?.length;

  // ── Snapshot values for KPIs (single-month, defaults to latestActualIso) ─
  const atSel  = (arr: number[]) => (selectedMonthIndex >= 0 ? arr[selectedMonthIndex] ?? 0 : 0);
  const atPrior = (arr: number[]) => (priorMonthIndex >= 0 ? arr[priorMonthIndex] ?? 0 : 0);

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

  const signedNow = atSel(signedAligned);
  const lostNow   = atSel(lostAligned);

  const moMDelta = (cur: number, prev: number): number | null => {
    if (!isFinite(cur) || !isFinite(prev) || prev === 0) return null;
    return (cur - prev) / Math.abs(prev);
  };
  // For churn — lower is better, so the visual arrow direction is inverted.
  const moMDeltaInverted = (cur: number, prev: number): number | null => {
    const d = moMDelta(cur, prev);
    return d == null ? null : -d;
  };

  const deltaLabel = priorMonthIndex >= 0
    ? `vs ${data.pl.months[priorMonthIndex]?.label ?? "prior month"}`
    : "no prior month";

  // Tones
  const ratioTone: Tone  = ratioNow >= 3 ? "success" : ratioNow >= 1 ? "warning" : "danger";
  const churnTone: Tone  = churnNow <= 0.05 ? "success" : churnNow <= 0.10 ? "warning" : "danger";
  const ltvDeltaForTone  = moMDelta(ltvNow, ltvPrev);
  const cacDeltaForTone  = moMDelta(cacNow, cacPrev);
  const totalDeltaForTone = moMDelta(totalNow, totalPrev);
  const ltvTone: Tone    = (ltvDeltaForTone ?? 0) >= 0 ? "success" : "danger";
  const cacTone: Tone    = (cacDeltaForTone ?? 0) <= 0 ? "success" : "warning";
  const totalTone: Tone  = (totalDeltaForTone ?? 0) >= 0 ? "success" : "danger";

  // ── Insights — driven entirely by data ───────────────────────────────────
  const insights: Insight[] = [];
  if (signedR.row && lostR.row && (signedNow > 0 || lostNow > 0)) {
    const net = signedNow - lostNow;
    if (net < 0) {
      insights.push({
        type: "alert",
        text: `Net client loss this month — ${signedNow} signed vs ${lostNow} lost (net ${net}). Pipeline needs pull.`,
      });
    } else if (net === 0) {
      insights.push({
        type: "warn",
        text: `Flat client count this month — ${signedNow} signed vs ${lostNow} lost. Pipeline replaces churn but isn't growing it.`,
      });
    } else {
      insights.push({
        type: "win",
        text: `Net +${net} clients this month — ${signedNow} signed vs ${lostNow} lost.`,
      });
    }
  }

  if (churnR.row && churnNow > 0) {
    const pct = (churnNow * 100).toFixed(1);
    if (churnNow > 0.10) {
      insights.push({
        type: churnNow > 0.15 ? "alert" : "warn",
        text: `Client churn at ${pct}% — high. Identify and address departures from this cohort.`,
      });
    } else if (churnNow > 0.05) {
      insights.push({
        type: "warn",
        text: `Client churn at ${pct}% — above the healthy 5% threshold.`,
      });
    } else {
      insights.push({
        type: "win",
        text: `Client churn at ${pct}% — within the healthy band.`,
      });
    }
  }

  if (ratioNow > 0 && ltvR.row && cacR.row) {
    const r = ratioNow.toFixed(1);
    const dollarReturn = (ratioNow).toFixed(2);
    if (ratioNow >= 3) {
      insights.push({
        type: "win",
        text: `LTV/CAC at ${r}x — every $1 of acquisition returns $${dollarReturn} in lifetime value. Above the 3x healthy threshold.`,
      });
    } else if (ratioNow >= 1) {
      insights.push({
        type: "warn",
        text: `LTV/CAC at ${r}x — every $1 of acquisition returns $${dollarReturn}. Below the 3x healthy threshold.`,
      });
    } else {
      insights.push({
        type: "alert",
        text: `LTV/CAC at ${r}x — CAC exceeds LTV. Acquisition is unprofitable.`,
      });
    }
  }

  if (ltvR.row && ltvPrev !== 0) {
    const d = (ltvNow - ltvPrev) / Math.abs(ltvPrev);
    if (Math.abs(d) >= 0.05) {
      const dir = d > 0 ? "up" : "down";
      const t: Insight["type"] = d > 0 ? "info" : "warn";
      insights.push({
        type: t,
        text: `LTV ${dir} ${Math.abs(d * 100).toFixed(0)}% MoM (${formatCurrency(ltvPrev, { compact: true })} → ${formatCurrency(ltvNow, { compact: true })}).`,
      });
    }
  }

  // ── Build chart data using the metrics tab's own month columns ──────────
  // (so the charts show ALL months, not just the global filter range).
  const metricMonthLabels = m.metricMonths ?? [];
  const metricStatuses    = m.metricStatuses ?? [];
  const metricForecastIdx = metricStatuses.findIndex(s => s === "Forecast");

  const getMetricMonthValues = (row: MetricRow | null) => row?.values ?? [];

  const ltvVals    = getMetricMonthValues(ltvR.row);
  const cacVals    = getMetricMonthValues(cacR.row);
  const churnVals  = getMetricMonthValues(churnR.row);
  const totalVals  = getMetricMonthValues(totalR.row);
  const signedVals = getMetricMonthValues(signedR.row);
  const lostVals   = getMetricMonthValues(lostR.row);

  // ── Client concentration per month ──────────────────────────────────────
  // Pulled directly from the Metrics tab's "Client Concentration" column (the
  // operator computes this server-side and stores it as a metric; we just
  // surface it). Months from the Metrics tab are already sorted chronologically
  // by sheets.ts so the chart goes left→right in time.
  const concentrationRow =
    lookup("Client Concentration") ??
    lookup("Concentration") ??
    lookup("Top Client Share") ??
    lookup("Top-1 Share");

  const concentrationData = metricMonthLabels.map((label, i) => ({
    label,
    concentration: concentrationRow?.values[i] ?? 0,
  }));
  const concForecastIdx = metricForecastIdx;

  // Latest-month concentration powers an extra insight callout.
  const concNow = concentrationData[concentrationData.length - 1];
  if (concNow && concNow.concentration > 0) {
    const pct = (concNow.concentration * 100).toFixed(0);
    if (concNow.concentration >= 0.4) {
      insights.push({
        type: concNow.concentration >= 0.6 ? "alert" : "warn",
        text: `Client concentration at ${pct}% — diversifying would lower revenue risk.`,
      });
    }
  }

  // ── Ending Cash + Burn Rate (new Metrics tab columns) ───────────────────
  const endingCashRow =
    lookup("Total for bank accounts") ??
    lookup("Ending Cash") ??
    lookup("Cash on hand") ??
    lookup("Cash");

  const burnRateRow =
    lookup("Burn Rate") ??
    lookup("Net Burn") ??
    lookup("Burn");

  // OpEx (from PL) aligned to the Metrics tab months — for each metric month
  // iso, find the matching PL month index and pull data.pl.opex[plIdx].
  const opexVsCashData = metricMonthLabels.map((label, i) => {
    const iso = m.metricMonthsIso?.[i] ?? "";
    const plIdx = iso
      ? data.pl.months.findIndex(mo => (labelToIso(mo.label) ?? "") === iso)
      : -1;
    return {
      label,
      opex: plIdx >= 0 ? data.pl.opex[plIdx] ?? 0 : 0,
      cash: endingCashRow?.values[i] ?? 0,
    };
  });

  const burnRateData = metricMonthLabels.map((label, i) => ({
    label,
    burn: burnRateRow?.values[i] ?? 0,
  }));

  const ltvVsCacData = metricMonthLabels.map((label, i) => ({
    label,
    ltv: ltvVals[i] ?? 0,
    cac: cacVals[i] ?? 0,
  }));

  const churnTrendData = metricMonthLabels.map((label, i) => ({
    label,
    churn: churnVals[i] ?? 0,
  }));

  const signedLostData = metricMonthLabels.map((label, i) => ({
    label,
    signed: signedVals[i] ?? 0,
    lost:   lostVals[i] ?? 0,
    total:  totalVals[i] ?? 0,
  }));


  // Period label uses the selected single month per the screenshot
  // ("WHAT TO DO NEXT · APR 26").
  const insightsHeadline = (selectedMonthLabel || isoToLabel(latestActualIso)).toUpperCase();

  // KPI labels prefixed when "unique" is active.
  const prefix = KPI_PREFIX[counting];
  const lbl = (base: string) => (prefix ? `${prefix} ${base}` : base);

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

            <CountingToggle value={counting} />

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiStat
                label={lbl("LTV")}
                value={formatCurrency(ltvNow, { compact: true })}
                tone={ltvTone}
                delta={moMDelta(ltvNow, ltvPrev)}
                deltaLabel={deltaLabel}
                size="sm"
              />
              <KpiStat
                label={lbl("CAC")}
                value={formatCurrency(cacNow, { compact: true })}
                tone={cacTone}
                delta={moMDelta(cacNow, cacPrev)}
                deltaLabel={deltaLabel}
                size="sm"
              />
              <KpiStat
                label="LTV/CAC"
                value={ratioNow > 0 ? `${ratioNow.toFixed(1)}x` : "—"}
                tone={ratioTone}
                delta={moMDelta(ratioNow, ratioPrev)}
                deltaLabel={deltaLabel}
                size="sm"
              />
              <KpiStat
                label={lbl("Churn")}
                value={formatPercent(churnNow)}
                tone={churnTone}
                delta={moMDeltaInverted(churnNow, churnPrev)}
                deltaLabel={deltaLabel}
                size="sm"
              />
              <KpiStat
                label={counting === "unique" ? "Total Unique Clients" : "Total Clients"}
                value={String(Math.round(totalNow))}
                tone={totalTone}
                delta={moMDelta(totalNow, totalPrev)}
                deltaLabel={deltaLabel}
                size="sm"
              />
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
                  forecastStartIndex={concForecastIdx >= 0 ? concForecastIdx : undefined}
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
                  forecastStartIndex={concForecastIdx >= 0 ? concForecastIdx : undefined}
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
                    { key: "burn", label: "Burn rate", color: CHART_PALETTE.amber, format: "currency" },
                  ]}
                  leftFormat="currency"
                  height={300}
                  forecastStartIndex={concForecastIdx >= 0 ? concForecastIdx : undefined}
                />
              </CardShell>
            </section>

            <section className="mt-6">
              <CardShell
                title="LTV vs CAC"
                subtitle="Lifetime value over customer acquisition cost — gap = unit economics health"
              >
                <MultiLineChart
                  data={ltvVsCacData}
                  xKey="label"
                  series={[
                    { key: "cac", label: "CAC", color: CHART_PALETTE.red,  format: "currency" },
                    { key: "ltv", label: "LTV", color: CHART_PALETTE.blue, format: "currency" },
                  ]}
                  leftFormat="currency"
                  height={360}
                  forecastStartIndex={metricForecastIdx >= 0 ? metricForecastIdx : undefined}
                />
              </CardShell>
            </section>

            <section className="mt-6">
              <CardShell
                title="Churn"
                subtitle="Monthly client churn rate · click title for the full Churn tab"
              >
                <MultiLineChart
                  data={churnTrendData}
                  xKey="label"
                  series={[
                    { key: "churn", label: "Churn", color: CHART_PALETTE.red, format: "percent" },
                  ]}
                  leftFormat="percent"
                  height={300}
                  forecastStartIndex={metricForecastIdx >= 0 ? metricForecastIdx : undefined}
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
                  forecastStartIndex={metricForecastIdx >= 0 ? metricForecastIdx : undefined}
                  totalLabel={counting === "unique" ? "Total unique clients" : "Total clients"}
                />
              </CardShell>
            </section>

            <section className="mt-8">
              <CardShell title="" subtitle="">
                <MetricsTable
                  rows={m.metricRows ?? []}
                  monthLabels={metricMonthLabels}
                  statuses={metricStatuses}
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
        movement, and ARPU. None of those rows were found in the connected sheet yet, so showing the page would be a
        wall of em-dashes (per <code className="rounded bg-white/5 px-1">tabs.md</code> anti-patterns).
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        To unlock this tab, add a <strong className="text-foreground">Metrics</strong> tab to your sheet with one row
        per metric and one column per month (and a Status row marking Actuals/Forecast).
      </p>
    </div>
  );
}
