import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { CardShell } from "@/components/ui/CardShell";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { WhatToDoNext, type Insight } from "@/components/insights/WhatToDoNext";
import { StackedBarChart } from "@/components/charts/StackedBarChart";
import { VerticalBarChart } from "@/components/charts/VerticalBarChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { MonthOverMonthTable, type MoMRow } from "@/components/tables/MonthOverMonthTable";
import { ScopeToggle, type Scope } from "@/components/layout/ScopeToggle";
import { CategoryMultiSelect } from "@/components/layout/CategoryMultiSelect";
import { bootstrapPage, sumAt, deltaPct, type PageSearchParams } from "@/lib/page-bootstrap";
import { labelToIso, isoToLabel } from "@/lib/period";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Expenses · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams & { scope?: string; cats?: string }>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, selectedIndices, priorIndices, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, selectedMonths, forecastStartInSelection, selectedMonthIso, selectedMonthIndex, priorMonthIndex, selectedMonthLabel, selectedMonthIsForecast } = boot;
  const hasForecast = forecastStartInSelection >= 0;

  // ── Single-month snapshot ────────────────────────────────────────────────
  const mIdx = selectedMonthIndex;
  const pmIdx = priorMonthIndex;
  const at = (arr: number[], i: number) => (i >= 0 ? arr[i] ?? 0 : 0);
  const mCogs       = at(data.pl.cogs, mIdx);
  const mOpex       = at(data.pl.opex, mIdx);
  const mRev        = at(data.pl.revenue, mIdx);
  const mSpend      = mCogs + mOpex;
  const mSpendRatio = mRev > 0 ? mSpend / mRev : 0;
  const mCogsP      = at(data.pl.cogs, pmIdx);
  const mOpexP      = at(data.pl.opex, pmIdx);
  const mSpendP     = mCogsP + mOpexP;
  const hasMonthPrior = pmIdx >= 0;
  const monthDeltaLabel = hasMonthPrior
    ? `vs ${data.pl.months[pmIdx]?.label ?? "prior month"}`
    : "no prior month";
  const mErTone: Tone = mSpendRatio <= 0.5 ? "success" : mSpendRatio <= 0.7 ? "warning" : "danger";

  // Distinct vendors in the single selected month
  const mDistinctVendors = (() => {
    const set = new Set<string>();
    const targetIso = selectedMonthIso;
    for (const t of data.transactions) {
      if (t.kind !== "Expense") continue;
      const tIso = monthFromDate(t.date);
      if (tIso === targetIso && t.vendor) set.add(t.vendor);
    }
    return set;
  })();

  // ── Range KPI numbers (unchanged) ────────────────────────────────────────
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

  // ── Scope toggle (Month / Range / YTD) ───────────────────────────────────
  const scopeRaw = (sp.scope ?? "range").toLowerCase();
  const scope: Scope = scopeRaw === "month" || scopeRaw === "ytd" ? (scopeRaw as Scope) : "range";

  // YTD = same year as latestActualIso, from Jan to latestActualIso (inclusive).
  const ytdIndices: number[] = (() => {
    if (!latestActualIso) return [];
    const year = latestActualIso.slice(0, 4);
    return monthsIso
      .map((iso, i) => (iso.startsWith(year) && iso <= latestActualIso ? i : -1))
      .filter(i => i >= 0);
  })();

  const effectiveIndices =
    scope === "month" ? (selectedMonthIndex >= 0 ? [selectedMonthIndex] : [])
    : scope === "ytd" ? ytdIndices
    : selectedIndices;

  const effectiveMonths = effectiveIndices.map(i => monthsIso[i]).filter(Boolean);
  const effectiveLabel =
    scope === "month" ? `${selectedMonthLabel}`
    : scope === "ytd" && ytdIndices.length
      ? `YTD · ${isoToLabel(monthsIso[ytdIndices[0]])} → ${isoToLabel(monthsIso[ytdIndices[ytdIndices.length - 1]])} (${ytdIndices.length} mo)`
    : `Range · ${periodLabel}`;

  const ytdLabel = ytdIndices.length
    ? `${isoToLabel(monthsIso[ytdIndices[0]])} → ${isoToLabel(monthsIso[ytdIndices[ytdIndices.length - 1]])} (${ytdIndices.length} mo)`
    : "no actuals available";

  // ── Categories: every COGS + OpEx category with any data, normalized ─────
  const allCategories = [
    ...data.cogsCategories.map(c => ({ name: c.name.replace("- Service Delivery", "").trim(), values: c.values, type: "COGS" as const })),
    ...data.expenseCategories.filter(e => e.values.some(v => v > 0)).map(e => ({ name: e.name.replace(" Expenses", "").replace("and other ", ""), values: e.values, type: "OpEx" as const })),
  ];

  const allCategoryNames = allCategories.map(c => c.name);
  const catsParam = sp.cats?.trim();
  const isExplicitNone = catsParam === "__none__";
  const selectedCats: string[] = !catsParam || catsParam === ""
    ? []                                            // empty = all selected
    : isExplicitNone
      ? ["__none__"]
      : catsParam.split(",").map(s => s.trim()).filter(s => allCategoryNames.includes(s));
  const allCatsImplicit = selectedCats.length === 0;
  const isCatSelected = (name: string) =>
    isExplicitNone ? false : allCatsImplicit ? true : selectedCats.includes(name);
  const filteredCategories = allCategories.filter(c => isCatSelected(c.name));

  // ── Primary chart: stacked by category, over the effective window ────────
  const stackedData = effectiveIndices.map(i => {
    const row: Record<string, number | string> = { label: data.pl.months[i]?.label ?? "" };
    for (const c of filteredCategories) row[c.name] = c.values[i] ?? 0;
    return row;
  });
  const stackedSeries = filteredCategories.map(c => ({ key: c.name, label: c.name }));

  // ── Tertiary: by type (COGS / OpEx) and ranked by category ───────────────
  const effectiveTypeTotals = filteredCategories.reduce(
    (acc, c) => {
      const sum = sumAt(c.values, effectiveIndices);
      if (c.type === "COGS") acc.cogs += sum;
      else acc.opex += sum;
      return acc;
    },
    { cogs: 0, opex: 0 },
  );
  const byType: Array<{ label: string; value: number }> = [
    { label: "COGS", value: effectiveTypeTotals.cogs },
    { label: "OpEx", value: effectiveTypeTotals.opex },
  ];
  const rankedByCategory: Array<{ label: string; value: number }> = filteredCategories
    .map(c => ({ label: c.name, value: sumAt(c.values, effectiveIndices) }))
    .filter(d => d.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  // ── Vendor MoM table — filtered by both effective window AND categories ─
  const filteredCatNamesLC = new Set(filteredCategories.map(c => c.name.toLowerCase()));
  const buckets = new Map<string, { vendor: string; category: string; monthly: Record<string, number>; total: number }>();
  for (const t of expTxns) {
    const tIso = monthFromDate(t.date);
    if (!tIso || !effectiveMonths.includes(tIso)) continue;
    // Match transactions to their category, case-insensitive prefix match
    const txnCat = (t.category || "").toLowerCase();
    const matched = isExplicitNone
      ? false
      : allCatsImplicit
        ? true
        : [...filteredCatNamesLC].some(c => txnCat.includes(c) || c.includes(txnCat));
    if (!matched) continue;
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
          selectedMonthIso={selectedMonthIso}
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

        <SectionTitle label={`Month snapshot · ${selectedMonthLabel}`} hint={selectedMonthIsForecast ? "forecast month" : undefined} />
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat
            label="Total Expenses"
            value={formatCurrency(mSpend, { compact: true })}
            delta={hasMonthPrior ? deltaPct(mSpend, mSpendP) : null}
            deltaLabel={monthDeltaLabel}
            size="sm"
          />
          <KpiStat
            label="COGS"
            value={formatCurrency(mCogs, { compact: true })}
            delta={hasMonthPrior ? deltaPct(mCogs, mCogsP) : null}
            deltaLabel={monthDeltaLabel}
            size="sm"
          />
          <KpiStat
            label="OpEx"
            value={formatCurrency(mOpex, { compact: true })}
            delta={hasMonthPrior ? deltaPct(mOpex, mOpexP) : null}
            deltaLabel={monthDeltaLabel}
            size="sm"
          />
          <KpiStat
            label="Expenses / Revenue"
            value={formatPercent(mSpendRatio)}
            tone={mErTone}
            size="sm"
          />
          <KpiStat label="Active Vendors" value={String(mDistinctVendors.size)} size="sm" />
        </section>

        <SectionTitle label={`Range · ${periodLabel}`} className="mt-6" />
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiStat label="Total Expenses" value={formatCurrency(totalSpend, { compact: true })} delta={deltaPct(totalSpend, totalSpendPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="COGS" value={formatCurrency(cogs, { compact: true })} delta={deltaPct(cogs, cogsPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="OpEx" value={formatCurrency(opex, { compact: true })} delta={deltaPct(opex, opexPrior)} deltaLabel={deltaLabel} size="sm" />
          <KpiStat label="Expenses / Revenue" value={formatPercent(expensesPerRev)} tone={erTone} size="sm" />
          <KpiStat label="Active Vendors" value={String(distinctVendors.size)} size="sm" />
        </section>

        <SectionTitle label={`Chart scope · ${effectiveLabel}`} className="mt-8" />
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 backdrop-blur">
          <ScopeToggle
            value={scope}
            monthLabel={selectedMonthLabel}
            rangeLabel={periodLabel}
            ytdLabel={ytdLabel}
          />
          <span className="h-5 w-px bg-[var(--card-border)]" />
          <CategoryMultiSelect
            paramName="cats"
            label="Categories"
            options={allCategoryNames}
            selected={isExplicitNone ? [] : selectedCats}
          />
        </div>

        <section>
          <CardShell
            title="Expenses by category"
            subtitle={`Stacked over ${effectiveLabel.toLowerCase()} · biggest category at the base${scope === "range" && hasForecast ? " · shaded region is forecast" : ""}${!allCatsImplicit && !isExplicitNone ? ` · ${selectedCats.length} of ${allCategoryNames.length} categories` : ""}`}
          >
            {stackedSeries.length === 0 ? (
              <p className="px-1 py-12 text-center text-[12px] text-muted-foreground">
                No categories selected — pick at least one from the Categories filter above.
              </p>
            ) : (
              <StackedBarChart
                data={stackedData}
                xKey="label"
                series={stackedSeries}
                paletteSort="red"
                format="currency"
                height={320}
                forecastStartIndex={
                  scope === "range" && hasForecast ? forecastStartInSelection : undefined
                }
              />
            )}
          </CardShell>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardShell title="By type" subtitle={`COGS vs OpEx · ${effectiveLabel.toLowerCase()}`}>
            <VerticalBarChart data={byType} color="#ef4444" format="currency" height={260} />
          </CardShell>
          <CardShell
            title="By category"
            subtitle={`Top 12 by spend · ${effectiveLabel.toLowerCase()}`}
          >
            {rankedByCategory.length === 0 ? (
              <p className="px-1 py-12 text-center text-[12px] text-muted-foreground">
                No matching category totals in this window.
              </p>
            ) : (
              <RankedBarChart data={rankedByCategory} color="#ef4444" format="currency" height={300} maxItems={12} />
            )}
          </CardShell>
        </section>

        <section className="mt-8">
          <CardShell
            title="Vendor × month spend"
            subtitle={`One row per vendor × category · ${effectiveLabel.toLowerCase()}${!allCatsImplicit && !isExplicitNone ? ` · filtered to ${selectedCats.length} category${selectedCats.length === 1 ? "" : "ies"}` : ""}`}
          >
            <MonthOverMonthTable
              rows={vendorRows}
              monthsIso={effectiveMonths}
              primaryHeader="Vendor"
              tertiaryHeader="Category"
              barColor="rgba(244,63,94,0.45)"
              searchPlaceholder="Search vendor or category…"
              latestActualIso={latestActualIso}
              filterBy={{ key: "secondary", label: "Category" }}
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
