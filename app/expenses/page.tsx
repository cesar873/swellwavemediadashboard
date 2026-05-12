import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { VerticalBarChart } from "@/components/charts/VerticalBarChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { MonthOverMonthTable, type MoMRow } from "@/components/tables/MonthOverMonthTable";
import { bootstrapPage, sumAt, deltaPct, type PageSearchParams } from "@/lib/page-bootstrap";
import { labelToIso } from "@/lib/period";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Expenses · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, selectedIndices, priorIndices, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, selectedMonths, forecastStartInSelection } = boot;
  const hasForecast = forecastStartInSelection >= 0;

  const cogs = sumAt(data.pl.cogs, selectedIndices);
  const opex = sumAt(data.pl.opex, selectedIndices);
  const rev  = sumAt(data.pl.revenue, selectedIndices);
  const totalSpend = cogs + opex;
  const expensesPerRev = rev > 0 ? totalSpend / rev : 0;

  const cogsPrior = sumAt(data.pl.cogs, priorIndices);
  const opexPrior = sumAt(data.pl.opex, priorIndices);
  const totalSpendPrior = cogsPrior + opexPrior;

  const hasPrior = priorIndices.length > 0;
  const deltaLabel = hasPrior
    ? boot.priorMonths.length === 1 ? "vs prior month" : `vs prior ${boot.priorMonths.length}mo`
    : "no prior period";

  const erTone: Tone = expensesPerRev <= 0.5 ? "success" : expensesPerRev <= 0.7 ? "warning" : "danger";

  // ── Vendor aggregation from transactions ──────────────────────────────────
  const expTxns = data.transactions.filter(t => t.kind === "Expense");
  const distinctVendors = new Set<string>();
  for (const t of expTxns) {
    const tIso = monthFromDate(t.date);
    if (tIso && selectedMonths.includes(tIso)) {
      if (t.vendor) distinctVendors.add(t.vendor);
    }
  }

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  const dTotal = deltaPct(totalSpend, totalSpendPrior);
  if (dTotal != null) {
    if (dTotal >= 0.05) insights.push({ type: "warn", text: `Total spend up ${(dTotal*100).toFixed(1)}% vs prior — check what category is driving it.` });
    else if (dTotal <= -0.05) insights.push({ type: "info", text: `Total spend down ${Math.abs(dTotal*100).toFixed(1)}% vs prior.` });
  }
  if (expensesPerRev > 0.7) insights.push({ type: "warn", text: `Expenses are ${formatPercent(expensesPerRev)} of revenue — margin is thin.` });
  // Worst category overrun vs prior
  const monthLabelSet = new Set(selectedMonths.map(iso => iso));
  const cogsByCat: Record<string, number> = {};
  const opexByCat: Record<string, number> = {};
  const cogsByCatPrior: Record<string, number> = {};
  const opexByCatPrior: Record<string, number> = {};
  for (const c of data.cogsCategories) {
    const cur = sumAt(c.values, selectedIndices);
    const pr  = sumAt(c.values, priorIndices);
    if (cur || pr) cogsByCat[c.name] = cur, cogsByCatPrior[c.name] = pr;
  }
  for (const e of data.expenseCategories) {
    const cur = sumAt(e.values, selectedIndices);
    const pr  = sumAt(e.values, priorIndices);
    if (cur || pr) opexByCat[e.name] = cur, opexByCatPrior[e.name] = pr;
  }
  const overruns: Array<{ name: string; pct: number }> = [];
  for (const [k, cur] of Object.entries({ ...cogsByCat, ...opexByCat })) {
    const pr = cogsByCatPrior[k] ?? opexByCatPrior[k] ?? 0;
    if (pr > 0 && cur > pr) overruns.push({ name: k, pct: ((cur - pr) / pr) * 100 });
  }
  overruns.sort((a, b) => b.pct - a.pct);
  if (overruns.length) {
    const w = overruns[0];
    insights.push({ type: "warn", text: `Worst category overrun: ${w.name} at +${w.pct.toFixed(0)}% vs prior.` });
  }
  void monthLabelSet;

  // Phase 2: forecast trajectory — avg monthly spend forecast vs actuals in selection
  if (hasForecast) {
    const actIdx = selectedIndices.slice(0, forecastStartInSelection);
    const fcIdx  = selectedIndices.slice(forecastStartInSelection);
    if (actIdx.length && fcIdx.length) {
      const actAvg = (sumAt(data.pl.cogs, actIdx) + sumAt(data.pl.opex, actIdx)) / actIdx.length;
      const fcAvg  = (sumAt(data.pl.cogs, fcIdx)  + sumAt(data.pl.opex, fcIdx))  / fcIdx.length;
      if (actAvg > 0) {
        const t = (fcAvg - actAvg) / actAvg;
        if (t >= 0.05)       insights.push({ type: "warn", text: `Forecast spend trends +${(t*100).toFixed(0)}% above recent actuals — review what's pushing it up.` });
        else if (t <= -0.05) insights.push({ type: "info", text: `Forecast spend trends ${(t*100).toFixed(0)}% below recent actuals — assumed savings holding?` });
      }
    }
  }

  // ── Primary chart: by category (COGS + OpEx) stacked by month ───────────
  const allCategories = [
    ...data.cogsCategories.map(c => ({ name: c.name.replace("- Service Delivery", "").trim(), values: c.values })),
    ...data.expenseCategories.filter(e => e.values.some(v => v > 0)).map(e => ({ name: e.name.replace(" Expenses", "").replace("and other ", ""), values: e.values })),
  ];
  const stackedData = selectedIndices.map(i => {
    const row: Record<string, number | string> = { label: data.pl.months[i]?.label ?? "" };
    for (const c of allCategories) row[c.name] = c.values[i] ?? 0;
    return row;
  });
  const stackedSeries = allCategories.map(c => ({ key: c.name, label: c.name }));

  // ── Secondary chart: cost as % of revenue, line per month ────────────────
  const ratioData = selectedIndices.map(i => {
    const r = data.pl.revenue[i] ?? 0;
    return {
      label: data.pl.months[i]?.label ?? "",
      cogs: r > 0 ? (data.pl.cogs[i] ?? 0) / r : 0,
      opex: r > 0 ? (data.pl.opex[i] ?? 0) / r : 0,
    };
  });
  void ratioData;

  // ── Tertiary: by type (COGS / OpEx) and ranked by category ───────────────
  const byType: Array<{ label: string; value: number }> = [
    { label: "COGS", value: cogs },
    { label: "OpEx", value: opex },
  ];
  const rankedByCategory: Array<{ label: string; value: number }> = Object.entries({ ...cogsByCat, ...opexByCat })
    .map(([name, value]) => ({ label: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ── Vendor MoM table ─────────────────────────────────────────────────────
  const buckets = new Map<string, { vendor: string; category: string; monthly: Record<string, number>; total: number }>();
  for (const t of expTxns) {
    const tIso = monthFromDate(t.date);
    if (!tIso || !selectedMonths.includes(tIso)) continue;
    const key = (t.vendor || "—") + "||" + t.category;
    let b = buckets.get(key);
    if (!b) { b = { vendor: t.vendor || "—", category: t.category, monthly: {}, total: 0 }; buckets.set(key, b); }
    b.monthly[tIso] = (b.monthly[tIso] ?? 0) + t.amount;
    b.total += t.amount;
  }
  const vendorRows: MoMRow[] = [...buckets.values()].map((b, idx) => ({
    id: `${b.vendor}-${idx}`,
    primary: b.vendor,
    secondary: b.category,
    monthly: b.monthly,
    total: b.total,
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
          eyebrow="Costs"
          title="Expenses"
          period={periodLabel}
          source="Costs + Finance Model"
        />

        <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat label="Total Expenses" value={formatCurrency(totalSpend, { compact: true })} delta={deltaPct(totalSpend, totalSpendPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="COGS" value={formatCurrency(cogs, { compact: true })} delta={deltaPct(cogs, cogsPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="OpEx" value={formatCurrency(opex, { compact: true })} delta={deltaPct(opex, opexPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="Expenses / Revenue" value={formatPercent(expensesPerRev)} tone={erTone} size="sm" />
          <KpiStat label="Active Vendors" value={String(distinctVendors.size)} size="sm" />
        </section>

        <section className="mt-8">
          <CardShell
            title="Expenses by category"
            subtitle={`Stacked monthly · biggest category at the base${hasForecast ? " · shaded region is forecast" : ""}`}
          >
            <StackedBarChart
              data={stackedData}
              xKey="label"
              series={stackedSeries}
              paletteSort="red"
              format="currency"
              height={320}
              forecastStartIndex={hasForecast ? forecastStartInSelection : undefined}
            />
          </CardShell>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardShell title="By type" subtitle="COGS vs OpEx for the selected period">
            <VerticalBarChart data={byType} color="#ef4444" format="currency" height={260} />
          </CardShell>
          <CardShell title="By category" subtitle="Top 10 categories by spend">
            <RankedBarChart data={rankedByCategory} color="#ef4444" format="currency" height={300} maxItems={10} />
          </CardShell>
        </section>

        <section className="mt-8">
          <CardShell title="Vendor × month spend" subtitle="One row per vendor × category — sort and search">
            <MonthOverMonthTable
              rows={vendorRows}
              monthsIso={selectedMonths}
              primaryHeader="Vendor"
              tertiaryHeader="Category"
              barColor="rgba(244,63,94,0.45)"
              searchPlaceholder="Search vendor or category…"
              latestActualIso={latestActualIso}
            />
          </CardShell>
        </section>

        <LiveFooter sources="Costs + Finance Model" />
      </div>
    </>
  );
}

function monthFromDate(date: string): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(+d)) {
    const m = date.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(20\d{2})/);
    if (!m) return null;
    const MAP: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    return `${m[2]}-${String(MAP[m[1]] + 1).padStart(2, "0")}-01`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
