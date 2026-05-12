import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { PnlTable, type PnlGroup, type PnlTotalsRow } from "@/components/tables/PnlTable";
import { BudgetVsActualTable, type BvaGroup } from "@/components/tables/BudgetVsActualTable";
import { CHART_PALETTE } from "@/components/charts/chart-shared";
import { bootstrapPage, sumAt, deltaPct, type PageSearchParams } from "@/lib/page-bootstrap";
import { isoToLabel } from "@/lib/period";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Financials · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function FinancialsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, selectedIndices, priorIndices, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, rangeLabel, forecastStartInSelection } = boot;
  const hasForecast = forecastStartInSelection >= 0;

  // ── KPI numbers ──────────────────────────────────────────────────────────
  const rev   = sumAt(data.pl.revenue, selectedIndices);
  const cogs  = sumAt(data.pl.cogs, selectedIndices);
  const opex  = sumAt(data.pl.opex, selectedIndices);
  const net   = sumAt(data.pl.netIncome, selectedIndices);
  const grossM = rev > 0 ? (rev - cogs) / rev : 0;
  const opM    = rev > 0 ? (rev - cogs - opex) / rev : 0;
  const netM   = rev > 0 ? net / rev : 0;

  const revP  = sumAt(data.pl.revenue, priorIndices);
  const cogsP = sumAt(data.pl.cogs, priorIndices);
  const opexP = sumAt(data.pl.opex, priorIndices);
  const netP  = sumAt(data.pl.netIncome, priorIndices);
  const grossMP = revP > 0 ? (revP - cogsP) / revP : 0;
  const opMP    = revP > 0 ? (revP - cogsP - opexP) / revP : 0;
  const netMP   = revP > 0 ? netP / revP : 0;

  const hasPrior = priorIndices.length > 0;
  const deltaLabel = hasPrior
    ? boot.priorMonths.length === 1
      ? `vs ${isoToLabel(boot.priorMonths[0])}`
      : `vs prior ${boot.priorMonths.length}mo`
    : "no prior period";

  const grossTone: Tone = grossM >= 0.5 ? "success" : grossM >= 0.3 ? "warning" : "danger";
  const opTone: Tone    = opM    >= 0.15 ? "success" : opM    >= 0.05 ? "warning" : "danger";
  const opProfit = rev - cogs - opex;
  const opProfitTone: Tone = opProfit > 0 ? "success" : opProfit < 0 ? "danger" : "neutral";

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (net > 0 && netM >= 0.15) insights.push({ type: "win",  text: `Healthy net margin at ${(netM*100).toFixed(1)}% — keep this profile.` });
  else if (net > 0)            insights.push({ type: "info", text: `Net profit positive at ${formatCurrency(net,{compact:true})} but margin is ${(netM*100).toFixed(1)}%. Room to optimise.` });
  else                          insights.push({ type: "alert", text: `Net loss of ${formatCurrency(Math.abs(net),{compact:true})} this period — review the largest cost drivers.` });

  if (hasPrior) {
    const mPP = (netM - netMP) * 100;
    if (mPP <= -3)        insights.push({ type: "warn", text: `Margin compressed ${mPP.toFixed(1)}pp vs prior. Find where COGS or OpEx is creeping.` });
    else if (mPP >= 3)    insights.push({ type: "win",  text: `Margin expanded ${mPP.toFixed(1)}pp vs prior. Document what changed.` });
    else {
      const dr = deltaPct(rev, revP);
      if (dr != null && dr <= -0.05) insights.push({ type: "warn", text: `Revenue down ${(dr*100).toFixed(1)}% vs prior period.` });
    }
  }

  // Phase 2: forecast trajectory — compare forecast-portion avg vs actual-portion avg
  if (hasForecast) {
    const actualSelectedIdx = selectedIndices.slice(0, forecastStartInSelection);
    const forecastSelectedIdx = selectedIndices.slice(forecastStartInSelection);
    if (actualSelectedIdx.length && forecastSelectedIdx.length) {
      const actAvg = sumAt(data.pl.revenue, actualSelectedIdx) / actualSelectedIdx.length;
      const fcAvg  = sumAt(data.pl.revenue, forecastSelectedIdx) / forecastSelectedIdx.length;
      if (actAvg > 0) {
        const trajectory = (fcAvg - actAvg) / actAvg;
        if (trajectory <= -0.05)      insights.push({ type: "warn", text: `Forecast revenue trends ${(trajectory*100).toFixed(0)}% below recent actuals — pull on pipeline now.` });
        else if (trajectory >= 0.05)  insights.push({ type: "info", text: `Forecast revenue trends +${(trajectory*100).toFixed(0)}% vs recent actuals — confirm bookings are committed.` });
      }
    }
  }

  // Budget overrun callout
  if (data.budget?.length) {
    const monthLabelSet = new Set(boot.selectedMonths.map(iso => isoToLabel(iso).toLowerCase()));
    const inRange = data.budget.filter(b => monthLabelSet.has(b.month.trim().toLowerCase()) && !b.isTotal && b.group !== "Revenue");
    const aggBy = new Map<string, { budget: number; actual: number }>();
    for (const b of inRange) {
      const k = b.category;
      const e = aggBy.get(k) ?? { budget: 0, actual: 0 };
      e.budget += b.budget; e.actual += b.actual;
      aggBy.set(k, e);
    }
    const overruns = [...aggBy.entries()]
      .map(([k, v]) => ({ k, over: v.actual - v.budget, pct: v.budget > 0 ? ((v.actual - v.budget) / v.budget) * 100 : 0 }))
      .filter(o => o.over > 0 && o.pct > 5)
      .sort((a, b) => b.pct - a.pct);
    if (overruns.length) {
      const worst = overruns[0];
      const rest = overruns.length > 1 ? ` (${overruns.length} categories over budget)` : "";
      insights.push({ type: "warn", text: `Worst over-budget: ${worst.k} at +${worst.pct.toFixed(0)}%${rest}.` });
    }
  }

  // ── Trend chart data (within selected range) ─────────────────────────────
  const rangeTrendData = selectedIndices.map(i => ({
    label: data.pl.months[i]?.label ?? "",
    revenue: data.pl.revenue[i] ?? 0,
    operating: (data.pl.revenue[i] ?? 0) - (data.pl.cogs[i] ?? 0) - (data.pl.opex[i] ?? 0),
  }));

  const marginTrendData = selectedIndices.map(i => {
    const r = data.pl.revenue[i] ?? 0;
    const c = data.pl.cogs[i] ?? 0;
    const o = data.pl.opex[i] ?? 0;
    return {
      label: data.pl.months[i]?.label ?? "",
      gross:      r > 0 ? (r - c) / r : 0,
      operating:  r > 0 ? (r - c - o) / r : 0,
    };
  });

  // ── P&L table groups ─────────────────────────────────────────────────────
  const revRow: PnlGroup = {
    label: "Revenue",
    total: data.pl.revenue,
    children: undefined,
  };

  const cogsRow: PnlGroup = {
    label: "Cost of Sales",
    total: data.pl.cogs,
    isCost: true,
    children: data.cogsCategories.map(c => ({
      name: c.name.replace("- Service Delivery", "").trim(),
      values: c.values.slice(0, data.pl.months.length),
    })),
  };

  const opexRow: PnlGroup = {
    label: "Operating Expenses",
    total: data.pl.opex,
    isCost: true,
    children: data.expenseCategories
      .filter(e => e.values.some(v => v > 0))
      .map(e => ({
        name: e.name.replace(" Expenses", "").replace("and other ", ""),
        values: e.values.slice(0, data.pl.months.length),
      })),
  };

  const totalsRows: PnlTotalsRow[] = [
    { label: "Gross Profit", values: data.pl.grossProfit, emphasis: "subtotal" },
    { label: "Net Income",   values: data.pl.netIncome,   emphasis: "grand" },
    { label: "Gross Margin", values: data.pl.grossMargin.map(v => v / 100), emphasis: "muted", isMargin: true },
    { label: "Net Margin",   values: data.pl.netMargin.map(v => v / 100), emphasis: "muted", isMargin: true },
  ];

  // ── Budget vs Actual aggregation ─────────────────────────────────────────
  const bvaGroups: BvaGroup[] = [];
  let bvaNet: { label: string; budget: number; actual: number } | undefined;
  if (data.budget?.length) {
    const monthLabelSet = new Set(boot.selectedMonths.map(iso => isoToLabel(iso).toLowerCase()));
    const inRange = data.budget.filter(b => monthLabelSet.has(b.month.trim().toLowerCase()));
    const byGroupCat = new Map<string, Map<string, { budget: number; actual: number; isTotal: boolean }>>();
    for (const b of inRange) {
      const inner = byGroupCat.get(b.group) ?? new Map();
      const e = inner.get(b.category) ?? { budget: 0, actual: 0, isTotal: b.isTotal };
      e.budget += b.budget; e.actual += b.actual;
      inner.set(b.category, e);
      byGroupCat.set(b.group, inner);
    }
    const order: { name: string; positiveIsGood: boolean; display: string }[] = [
      { name: "Revenue",  positiveIsGood: true,  display: "Revenue" },
      { name: "COGS",     positiveIsGood: false, display: "Cost of Sales" },
      { name: "Expenses", positiveIsGood: false, display: "Operating Expenses" },
    ];
    for (const g of order) {
      const inner = byGroupCat.get(g.name);
      if (!inner) continue;
      const rows = [...inner.entries()].filter(([, v]) => !v.isTotal).map(([category, v]) => ({ category, budget: v.budget, actual: v.actual }));
      const totalRow = [...inner.entries()].find(([, v]) => v.isTotal)?.[1];
      if (!rows.length && !totalRow) continue;
      bvaGroups.push({
        name: g.display,
        positiveIsGood: g.positiveIsGood,
        rows,
        subTotal: totalRow ? { budget: totalRow.budget, actual: totalRow.actual } : undefined,
      });
    }
    const metricsRow = byGroupCat.get("Metrics");
    if (metricsRow) {
      for (const [k, v] of metricsRow.entries()) {
        if (/net income/i.test(k)) {
          bvaNet = { label: "Net Income", budget: v.budget, actual: v.actual };
          break;
        }
      }
    }
    if (!bvaNet && bvaGroups.length) {
      const get = (name: string) => bvaGroups.find(g => g.name === name);
      const r = get("Revenue");           const c = get("Cost of Sales");      const o = get("Operating Expenses");
      const rb = r ? r.subTotal?.budget ?? r.rows.reduce((a, x) => a + x.budget, 0) : 0;
      const ra = r ? r.subTotal?.actual ?? r.rows.reduce((a, x) => a + x.actual, 0) : 0;
      const cb = c ? c.subTotal?.budget ?? c.rows.reduce((a, x) => a + x.budget, 0) : 0;
      const ca = c ? c.subTotal?.actual ?? c.rows.reduce((a, x) => a + x.actual, 0) : 0;
      const ob = o ? o.subTotal?.budget ?? o.rows.reduce((a, x) => a + x.budget, 0) : 0;
      const oa = o ? o.subTotal?.actual ?? o.rows.reduce((a, x) => a + x.actual, 0) : 0;
      bvaNet = { label: "Net Income", budget: rb - cb - ob, actual: ra - ca - oa };
    }
  }

  void rangeLabel;
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
          eyebrow="Financial overview"
          title="Financials"
          period={periodLabel}
          source={data.budget?.length ? "Finance Model + Budget" : "Finance Model"}
        />

        <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Revenue"
            value={formatCurrency(rev, { compact: true })}
            delta={hasPrior ? deltaPct(rev, revP) : null}
            deltaLabel={deltaLabel}
            size="sm"
          />
          <KpiStat
            label="Operating Profit"
            value={formatCurrency(opProfit, { compact: true })}
            tone={opProfitTone}
            delta={hasPrior ? deltaPct(opProfit, revP - cogsP - opexP) : null}
            deltaLabel={deltaLabel}
            size="sm"
          />
          <KpiStat
            label="Gross Margin"
            value={formatPercent(grossM)}
            tone={grossTone}
            delta={hasPrior ? (grossM - grossMP) : null}
            deltaLabel={deltaLabel}
            size="sm"
          />
          <KpiStat
            label="Operating Margin"
            value={formatPercent(opM)}
            tone={opTone}
            delta={hasPrior ? (opM - opMP) : null}
            deltaLabel={deltaLabel}
            size="sm"
          />
          <KpiStat
            label="Net Margin"
            value={formatPercent(netM)}
            tone={netM >= 0.15 ? "success" : netM >= 0 ? "warning" : "danger"}
            delta={hasPrior ? (netM - netMP) : null}
            deltaLabel={deltaLabel}
            size="sm"
          />
        </section>

        <section className="mt-8">
          <CardShell
            title="Revenue & Operating Profit by month"
            subtitle={`Same axis — visual gap shows how much profit lags revenue${hasForecast ? " · dashed segment is forecast" : ""}`}
          >
            <MultiLineChart
              data={rangeTrendData}
              xKey="label"
              series={[
                { key: "revenue",   label: "Revenue",          color: CHART_PALETTE.blue,  format: "currency" },
                { key: "operating", label: "Operating Profit", color: CHART_PALETTE.green, format: "currency" },
              ]}
              leftFormat="currency"
              height={300}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>

        <section className="mt-6">
          <CardShell
            title="Gross & Operating Margin"
            subtitle={`Two-line margin trend${hasForecast ? " · dashed segment is forecast" : ""}`}
          >
            <MultiLineChart
              data={marginTrendData}
              xKey="label"
              series={[
                { key: "gross",     label: "Gross Margin",     color: CHART_PALETTE.blue,  format: "percent" },
                { key: "operating", label: "Operating Margin", color: CHART_PALETTE.green, format: "percent" },
              ]}
              leftFormat="percent"
              height={280}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>

        <section className="mt-8">
          <CardShell title="P&L by Month" subtitle="Revenue, COGS, gross profit, OpEx and net income · click ▶ to expand line items">
            <PnlTable monthsIso={monthsIso} groups={[revRow, cogsRow, opexRow]} totalsRows={totalsRows} />
          </CardShell>
        </section>

        {bvaGroups.length > 0 && (
          <section className="mt-8">
            <CardShell
              title="Budget vs Actual"
              subtitle={`Categorised across the selected months · ordered Revenue → COGS → Expenses`}
            >
              <BudgetVsActualTable groups={bvaGroups} netRow={bvaNet} rangeLabel={periodLabel} />
            </CardShell>
          </section>
        )}

        <LiveFooter sources={data.budget?.length ? "Finance Model + Budget" : "Finance Model"} />
      </div>
    </>
  );
}
