import { Suspense } from "react";
import { Info } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { CHART_PALETTE } from "@/components/charts/chart-shared";
import { bootstrapPage, sumAt, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
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
  const { data, selectedIndices, priorIndices, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, forecastStartInSelection } = boot;
  const hasForecast = forecastStartInSelection >= 0;
  const m = data.metrics;

  // Detect what's available so we can pick the right KPI mix or show the empty
  // state. tabs.md anti-pattern: "Don't ship a tab with `—` in every KPI cell."
  const has = {
    mrr:          (m.mrr?.some(v => v !== 0)) ?? false,
    ltv:          (m.ltv?.some(v => v !== 0)) ?? false,
    ltgp:         (m.ltgp?.some(v => v !== 0)) ?? false,
    cac:          (m.cac?.some(v => v !== 0)) ?? false,
    mrrChurn:     (m.mrrChurn?.some(v => v !== 0)) ?? false,
    clientChurn:  (m.clientChurn?.some(v => v !== 0)) ?? false,
    signed:       (m.newClients?.some(v => v !== 0)) ?? false,
    lost:         (m.lostClients?.some(v => v !== 0)) ?? false,
  };
  const anyMetricFound = Object.values(has).some(Boolean);

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
          eyebrow="Unit economics"
          title="Analytics"
          period={periodLabel}
          source="Metrics"
        />

        {!anyMetricFound ? (
          <EmptyState />
        ) : (
          <AnalyticsBody
            data={data}
            selectedIndices={selectedIndices}
            priorIndices={priorIndices}
            forecastStartInSelection={hasForecast ? forecastStartInSelection : -1}
            periodLabel={periodLabel}
            has={has}
          />
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
        This view tracks <strong className="text-foreground">unit economics</strong> — LTV, CAC, MRR / client churn,
        and signed vs lost movement. None of those rows were found in the connected sheet yet, so showing the page
        would be a wall of em-dashes (per <code className="rounded bg-white/5 px-1">tabs.md</code> anti-patterns).
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        To unlock this tab, add a <strong className="text-foreground">Metrics</strong> tab to your sheet with one
        row per metric and one column per month. The parser will detect any of:
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-muted-foreground sm:grid-cols-3">
        <li>· MRR</li>
        <li>· LTV / LTGP</li>
        <li>· CAC</li>
        <li>· MRR Churn</li>
        <li>· Client Churn</li>
        <li>· New Clients (signed)</li>
        <li>· Lost Clients</li>
        <li>· Active Clients</li>
      </ul>
    </div>
  );
}

interface AnalyticsBodyProps {
  data: import("@/lib/types").DashboardData;
  selectedIndices: number[];
  priorIndices: number[];
  forecastStartInSelection: number;
  periodLabel: string;
  has: Record<string, boolean>;
}

function AnalyticsBody({ data, selectedIndices, priorIndices, forecastStartInSelection, periodLabel, has }: AnalyticsBodyProps) {
  const hasForecast = forecastStartInSelection >= 0;
  const m = data.metrics;

  // Latest-actual values for KPIs (single-month snapshot per tabs.md).
  const latestIdx = selectedIndices[selectedIndices.length - 1] ?? -1;
  const at = (arr?: number[]) => (arr && latestIdx >= 0 ? arr[latestIdx] ?? 0 : 0);
  const avg = (arr?: number[], idxs: number[] = selectedIndices) => {
    if (!arr || !idxs.length) return 0;
    return sumAt(arr, idxs) / idxs.length;
  };

  const ltvNow = has.ltv ? at(m.ltv) : has.ltgp ? at(m.ltgp) : 0;
  const cacNow = at(m.cac);
  const ratio  = cacNow > 0 ? ltvNow / cacNow : 0;
  const mrrChurnNow    = at(m.mrrChurn);
  const clientChurnNow = at(m.clientChurn);

  const ratioTone: Tone     = ratio >= 3 ? "success" : ratio >= 1 ? "warning" : "danger";
  const mrrChurnTone: Tone  = mrrChurnNow <= 0.02 ? "success" : mrrChurnNow <= 0.05 ? "warning" : "danger";
  const clientChurnTone: Tone = clientChurnNow <= 0.02 ? "success" : clientChurnNow <= 0.05 ? "warning" : "danger";

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (cacNow > 0 && ltvNow > 0) {
    if (ratio >= 3)      insights.push({ type: "win",   text: `LTV/CAC at ${ratio.toFixed(1)}:1 — healthy unit economics.` });
    else if (ratio >= 1) insights.push({ type: "warn",  text: `LTV/CAC at ${ratio.toFixed(1)}:1 — covering CAC but room to lift LTV or cut CAC.` });
    else                  insights.push({ type: "alert", text: `LTV/CAC at ${ratio.toFixed(1)}:1 — CAC exceeds LTV. Acquisition is unprofitable.` });
  }
  if (has.mrrChurn && mrrChurnNow > 0.05)
    insights.push({ type: "warn", text: `MRR churn at ${(mrrChurnNow * 100).toFixed(1)}% — investigate the largest losses.` });
  if (has.signed && has.lost) {
    const signed = sumAt(m.newClients!, selectedIndices);
    const lost   = sumAt(m.lostClients!, selectedIndices);
    const net = signed - lost;
    if (net > 0)      insights.push({ type: "win", text: `Net +${net} clients in this period (${signed} signed · ${lost} lost).` });
    else if (net < 0) insights.push({ type: "alert", text: `Net ${net} clients in this period (${signed} signed · ${lost} lost) — replace lost ARR.` });
  }
  if (hasForecast && has.mrr) {
    const actIdx = selectedIndices.slice(0, forecastStartInSelection);
    const fcIdx  = selectedIndices.slice(forecastStartInSelection);
    if (actIdx.length && fcIdx.length) {
      const a = avg(m.mrr, actIdx);
      const f = avg(m.mrr, fcIdx);
      if (a > 0) {
        const t = (f - a) / a;
        if (t <= -0.05)     insights.push({ type: "warn", text: `Forecast MRR ${(t * 100).toFixed(0)}% below recent actuals — pipeline gap.` });
        else if (t >= 0.05) insights.push({ type: "info", text: `Forecast MRR +${(t * 100).toFixed(0)}% vs recent actuals — confirm signed pipeline.` });
      }
    }
  }
  void priorIndices;

  // ── Chart data ───────────────────────────────────────────────────────────
  const trendRows = selectedIndices.map(i => {
    const r: Record<string, number | string> = { label: data.pl.months[i]?.label ?? "" };
    if (m.ltv)   r.ltv  = m.ltv[i] ?? 0;
    if (m.ltgp)  r.ltgp = m.ltgp[i] ?? 0;
    if (m.cac)   r.cac  = m.cac[i] ?? 0;
    return r;
  });
  const ltvKey = has.ltv ? "ltv" : has.ltgp ? "ltgp" : null;
  const ltvLabel = has.ltv ? "LTV" : "LTGP";

  const churnRows = selectedIndices.map(i => ({
    label: data.pl.months[i]?.label ?? "",
    mrrChurn: m.mrrChurn?.[i] ?? 0,
    clientChurn: m.clientChurn?.[i] ?? 0,
  }));

  const movementRows = selectedIndices.map(i => ({
    label: data.pl.months[i]?.label ?? "",
    signed: m.newClients?.[i] ?? 0,
    lost: -(m.lostClients?.[i] ?? 0),
    active: m.activeClients?.[i] ?? 0,
  }));
  void movementRows;

  // KPI tiles — pick 5 most-relevant.
  const kpis: Array<{ key: string; el: React.ReactNode }> = [];
  if (has.ltv || has.ltgp)
    kpis.push({ key: "ltv", el: <KpiStat label={ltvLabel} value={formatCurrency(ltvNow, { compact: true })} size="sm" /> });
  if (has.cac)
    kpis.push({ key: "cac", el: <KpiStat label="CAC" value={formatCurrency(cacNow, { compact: true })} size="sm" /> });
  if (cacNow > 0 && ltvNow > 0)
    kpis.push({ key: "ratio", el: <KpiStat label="LTV / CAC" value={`${ratio.toFixed(1)}:1`} tone={ratioTone} size="sm" /> });
  if (has.mrrChurn)
    kpis.push({ key: "mrrc", el: <KpiStat label="MRR Churn" value={formatPercent(mrrChurnNow)} tone={mrrChurnTone} size="sm" /> });
  if (has.clientChurn)
    kpis.push({ key: "cc", el: <KpiStat label="Client Churn" value={formatPercent(clientChurnNow)} tone={clientChurnTone} size="sm" /> });
  if (has.mrr)
    kpis.push({ key: "mrr", el: <KpiStat label="MRR" value={formatCurrency(at(m.mrr), { compact: true })} size="sm" /> });

  const shownKpis = kpis.slice(0, 5);

  return (
    <>
      <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

      {shownKpis.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shownKpis.map(k => <div key={k.key}>{k.el}</div>)}
        </section>
      )}

      {ltvKey && has.cac && (
        <section className="mt-8">
          <CardShell title={`${ltvLabel}, CAC and ratio`} subtitle="Currency on the left">
            <MultiLineChart
              data={trendRows}
              xKey="label"
              series={[
                { key: ltvKey, label: ltvLabel, color: CHART_PALETTE.blue,  format: "currency" },
                { key: "cac",  label: "CAC",     color: CHART_PALETTE.red,   format: "currency" },
              ]}
              leftFormat="currency"
              height={300}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>
      )}

      {(has.mrrChurn || has.clientChurn) && (
        <section className="mt-6">
          <CardShell title="Churn" subtitle="MRR vs client churn">
            <MultiLineChart
              data={churnRows}
              xKey="label"
              series={[
                ...(has.mrrChurn   ? [{ key: "mrrChurn",    label: "MRR Churn",    color: CHART_PALETTE.red,   format: "percent" as const }] : []),
                ...(has.clientChurn ? [{ key: "clientChurn", label: "Client Churn", color: CHART_PALETTE.amber, format: "percent" as const }] : []),
              ]}
              leftFormat="percent"
              height={280}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>
      )}

      {has.mrr && (
        <section className="mt-6">
          <CardShell title="MRR" subtitle="Monthly recurring revenue trend">
            <MultiLineChart
              data={selectedIndices.map(i => ({
                label: data.pl.months[i]?.label ?? "",
                mrr: m.mrr?.[i] ?? 0,
              }))}
              xKey="label"
              series={[{ key: "mrr", label: "MRR", color: CHART_PALETTE.green, format: "currency" }]}
              leftFormat="currency"
              height={280}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>
      )}
    </>
  );
}
