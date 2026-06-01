import { Suspense } from "react";
import { PageHero } from "@/components/layout/PageHero";
import { GlobalFiltersBar } from "@/components/layout/GlobalFiltersBar";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { ActionsCenter } from "./ActionsCenter";
import { OpenSummary } from "./OpenSummary";
import { ArGrid } from "./ArGrid";
import { fetchReceivables } from "@/lib/sheets";
import { bootstrapPage, type PageSearchParams } from "@/lib/page-bootstrap";
import { formatCurrency } from "@/lib/utils";
import { statusKind, isPaid } from "./shared";
import type { Receivable } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payments · SwellWave Finance" };
export const dynamic = "force-dynamic";
export const revalidate = 0; // write-back tab — always read fresh

interface Props {
  searchParams: Promise<PageSearchParams>;
}

export default async function PaymentsPage({ searchParams }: Props) {
  const sp = await searchParams;

  let receivables: Receivable[] = [];
  let loadError: string | null = null;
  try {
    receivables = await fetchReceivables();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  // Global period filter (shared with the other tabs).
  const boot = await bootstrapPage(sp);
  const { monthsIso, latestActualIso, fromIso, toIso, monthsParam, selectedMonthIso, selectedMonths, rangeLabel } = boot;
  const selectedSet = new Set(selectedMonths);

  const openAmt = (r: Receivable) => r.openAmount || r.amount || 0;

  // Snapshot KPIs (current state, not period-scoped) — per buildout §Tab 7.
  const open = receivables.filter(r => !isPaid(r.status));
  const overdue = open.filter(r => r.daysOverdue > 0);
  const dueNext7 = open.filter(r => r.daysOverdue <= 0 && r.daysOverdue >= -7);
  const pipeline = receivables.filter(r => {
    const k = statusKind(r.status);
    return k === "pipeline" || k === "review-client" || k === "review-agency";
  });

  // Collected IS period-scoped: paid invoices whose paid-month (else invoice
  // month) falls inside the selected range.
  const collected = receivables.filter(r => {
    if (!isPaid(r.status)) return false;
    const pm = r.paidMonthIso || r.monthIso;
    return pm ? selectedSet.has(pm) : true;
  });

  const outstandingTotal = open.reduce((a, r) => a + openAmt(r), 0);
  const overdueTotal = overdue.reduce((a, r) => a + openAmt(r), 0);
  const dueNext7Total = dueNext7.reduce((a, r) => a + openAmt(r), 0);
  const pipelineTotal = pipeline.reduce((a, r) => a + (r.amount || 0), 0);
  const collectedTotal = collected.reduce((a, r) => a + (r.amount || r.openAmount || 0), 0);
  const worstOverdue = overdue.reduce((m, r) => Math.max(m, r.daysOverdue), 0);

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
          eyebrow="Accounts receivable"
          title="Payments"
          period={`${receivables.length} receivable${receivables.length === 1 ? "" : "s"}`}
          source="Receivables"
        />

        {loadError ? (
          <div className="rounded-2xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-6 text-[13px] text-foreground">
            <div className="font-semibold text-[var(--red)]">Could not load the Receivables tab</div>
            <pre className="mt-2 whitespace-pre-wrap text-[12px] text-muted-foreground">{loadError}</pre>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiStat label="Outstanding AR" value={formatCurrency(outstandingTotal, { compact: true })} tone={outstandingTotal > 0 ? "warning" : "neutral"} deltaLabel={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} size="sm" />
              <KpiStat label="Overdue" value={formatCurrency(overdueTotal, { compact: true })} tone={overdueTotal > 0 ? "danger" : "success"} deltaLabel={overdue.length > 0 ? `${overdue.length} late · worst ${worstOverdue}d` : "all current"} size="sm" />
              <KpiStat label="Due Next 7 Days" value={formatCurrency(dueNext7Total, { compact: true })} tone="neutral" deltaLabel={dueNext7.length > 0 ? `${dueNext7.length} due soon` : "nothing imminent"} size="sm" />
              <KpiStat label="Pipeline (pre-send)" value={formatCurrency(pipelineTotal, { compact: true })} tone="neutral" deltaLabel={`${pipeline.length} drafts + ready`} size="sm" />
              <KpiStat label={`Collected · ${rangeLabel}`} value={formatCurrency(collectedTotal, { compact: true })} tone="success" deltaLabel={`${collected.length} paid in period`} size="sm" />
            </section>

            <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-10">
              <div className="lg:col-span-6"><ActionsCenter receivables={receivables} /></div>
              <div className="lg:col-span-4"><OpenSummary receivables={receivables} /></div>
            </section>

            <section className="mt-8">
              <ArGrid receivables={receivables} latestActualIso={latestActualIso} />
            </section>
          </>
        )}

        <LiveFooter sources="Receivables" />
      </div>
    </>
  );
}
