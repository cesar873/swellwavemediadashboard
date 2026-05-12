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
import { TeamRosterTable } from "@/components/tables/TeamRosterTable";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency, formatPercent, type Tone } from "@/lib/utils";
import type { Metadata } from "next";
import type { TeamMember, TeamProfitRow } from "@/lib/types";

export const metadata: Metadata = { title: "People · SwellWave Finance" };
export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function PeopleProfitPage({ searchParams }: Props) {
  const sp = await searchParams;
  const boot = await bootstrapPage(sp);
  const { data, monthsIso, latestActualIso, fromIso, toIso, monthsParam, periodLabel, selectedMonthIso } = boot;
  const profitRows = data.teamProfit;
  const teamRoster = data.teamMembers;

  // Choose the most-detailed view we have data for:
  //   1. Full Team Profit rollup (utilization, gap, target)
  //   2. Team roster fallback (headcount, cost, hours from People tab)
  //   3. Empty state
  const view: "profit" | "roster" | "empty" =
    profitRows.length > 0 ? "profit" : teamRoster.length > 0 ? "roster" : "empty";

  const source = view === "profit" ? "Team Profit" : view === "roster" ? "People" : "Team Profit";

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
          eyebrow={view === "roster" ? "Team overview" : "Team profitability"}
          title="People"
          period={periodLabel}
          source={source}
        />

        {view === "profit" && <ProfitBody rows={profitRows} periodLabel={periodLabel} />}
        {view === "roster" && <RosterBody rows={teamRoster} periodLabel={periodLabel} />}
        {view === "empty" && <EmptyState />}

        <LiveFooter sources={source} />
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-[var(--blue)]" />
        <h2 className="text-base font-semibold text-foreground">People needs a Team Profit rollup or People tab</h2>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Add either a People tab (Name · Department · Total Hours · Contracted Salary · Cost per Hour) for the team
        overview, or a Team Profit rollup (Name · Revenue Covered · Utilization · vs Target · Revenue Gap) for the
        full per-person profitability view.
      </p>
    </div>
  );
}

function ProfitBody({ rows, periodLabel }: { rows: TeamProfitRow[]; periodLabel: string }) {
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

  const gapData = [...rows]
    .map(r => ({ label: r.name, value: r.revenueGap }))
    .sort((a, b) => a.value - b.value);

  return (
    <>
      <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat label="Revenue Covered" value={formatCurrency(totalRevCovered, { compact: true })} size="sm" />
        <KpiStat label="Avg Utilization" value={formatPercent(avgUtil)} tone={utilTone} size="sm" />
        <KpiStat label="People on Target" value={`${onTarget} / ${rows.length}`} size="sm" />
        <KpiStat label="Revenue Gap" value={formatCurrency(underTotalGap, { compact: true })} tone={gapTone} size="sm" />
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

function RosterBody({ rows, periodLabel }: { rows: TeamMember[]; periodLabel: string }) {
  // ── KPIs (derived from People tab columns) ───────────────────────────────
  const isActive = (s: string) => /active/i.test(s);
  const active = rows.filter(r => isActive(r.status));
  const headcount = rows.length;
  const activeCount = active.length;
  const totalSalary = rows.reduce((a, r) => a + (r.contractedSalary || 0), 0);
  const activeSalary = active.reduce((a, r) => a + (r.contractedSalary || 0), 0);
  const totalHours = rows.reduce((a, r) => a + (r.totalHours || 0), 0);
  const hoursWeighted = rows.reduce(
    (acc, r) => {
      if (!r.costPerHour || !r.totalHours) return acc;
      acc.weight += r.totalHours;
      acc.value += r.costPerHour * r.totalHours;
      return acc;
    },
    { weight: 0, value: 0 },
  );
  const avgCostPerHour = hoursWeighted.weight > 0 ? hoursWeighted.value / hoursWeighted.weight : 0;
  const departments = new Set(rows.map(r => r.department).filter(Boolean));

  // ── Department aggregates for charts ─────────────────────────────────────
  const aggByDept = new Map<string, { headcount: number; salary: number; hours: number }>();
  for (const r of rows) {
    const k = r.department || "Unassigned";
    const e = aggByDept.get(k) ?? { headcount: 0, salary: 0, hours: 0 };
    e.headcount += 1;
    e.salary += r.contractedSalary || 0;
    e.hours += r.totalHours || 0;
    aggByDept.set(k, e);
  }
  const deptEntries = [...aggByDept.entries()];
  const headcountByDept = deptEntries
    .map(([label, v]) => ({ label, value: v.headcount }))
    .sort((a, b) => b.value - a.value);
  const salaryByDept = deptEntries
    .map(([label, v]) => ({ label, value: v.salary }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  if (headcountByDept.length) {
    const top = headcountByDept[0];
    const share = top.value / headcount;
    if (share > 0.5)
      insights.push({
        type: "warn",
        text: `${top.label} holds ${(share * 100).toFixed(0)}% of headcount (${top.value} of ${headcount}) — concentration risk if it loses someone.`,
      });
    else
      insights.push({
        type: "info",
        text: `${top.label} is the largest department at ${top.value} of ${headcount} people.`,
      });
  }
  if (avgCostPerHour > 0) {
    const sorted = [...rows].filter(r => r.costPerHour > 0).sort((a, b) => b.costPerHour - a.costPerHour);
    if (sorted.length) {
      const top = sorted[0];
      insights.push({
        type: "info",
        text: `Highest cost / hour: ${top.name} at ${formatCurrency(top.costPerHour)} — ${top.department || "—"}.`,
      });
    }
  }
  const inactive = rows.length - activeCount;
  if (inactive > 0)
    insights.push({
      type: "info",
      text: `${inactive} non-active record${inactive > 1 ? "s" : ""} in the roster — toggle the Status column to review.`,
    });
  insights.push({
    type: "info",
    text: `Per-person profitability (utilization, revenue gap, vs target) needs a Team Profit rollup tab — this view falls back to the People tab in the meantime.`,
  });

  void periodLabel;
  return (
    <>
      <WhatToDoNext periodLabel={periodLabel.toUpperCase()} insights={insights} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiStat label="Headcount" value={String(headcount)} size="sm" />
        <KpiStat
          label="Active"
          value={String(activeCount)}
          tone={activeCount === headcount ? "success" : "neutral"}
          size="sm"
        />
        <KpiStat label="Total Cost" value={formatCurrency(activeSalary || totalSalary, { compact: true })} size="sm" />
        <KpiStat
          label="Avg Cost / Hour"
          value={avgCostPerHour > 0 ? formatCurrency(avgCostPerHour) : "—"}
          size="sm"
        />
        <KpiStat label="Departments" value={String(departments.size || "—")} size="sm" />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardShell title="Headcount by department" subtitle="People per team">
          <RankedBarChart
            data={headcountByDept}
            color="#1390eb"
            format="number"
            height={Math.max(260, Math.min(420, headcountByDept.length * 32))}
            maxItems={headcountByDept.length}
          />
        </CardShell>
        <CardShell title="Contracted cost by department" subtitle="Sum of contracted salary per team">
          <RankedBarChart
            data={salaryByDept}
            color="#22c55e"
            format="currency"
            height={Math.max(260, Math.min(420, salaryByDept.length * 32))}
            maxItems={salaryByDept.length}
          />
        </CardShell>
      </section>

      <section className="mt-6">
        <CardShell title="Hours by person" subtitle="Total hours tracked per team member">
          <RankedBarChart
            data={rows
              .filter(r => r.totalHours > 0)
              .map(r => ({ label: r.name, value: r.totalHours }))
              .sort((a, b) => b.value - a.value)}
            color="#c084fc"
            format="number"
            height={Math.max(280, Math.min(520, rows.filter(r => r.totalHours > 0).length * 24))}
            maxItems={20}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Total tracked hours across the team: <strong className="text-foreground tabular-nums">{totalHours.toLocaleString()}</strong>
          </p>
        </CardShell>
      </section>

      <section className="mt-8">
        <CardShell title="Team roster" subtitle="Name · status · department · category · hours · cost · salary">
          <TeamRosterTable rows={rows} />
        </CardShell>
      </section>
    </>
  );
}
