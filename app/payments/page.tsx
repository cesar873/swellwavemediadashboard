import { PageHero } from "@/components/layout/PageHero";
import { LiveFooter } from "@/components/layout/LiveFooter";
import { KpiStat } from "@/components/ui/KpiStat";
import { ReceivablesWorkspace } from "./ReceivablesWorkspace";
import { fetchReceivables } from "@/lib/sheets";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payments · SwellWave Finance" };
export const dynamic = "force-dynamic";
export const revalidate = 0; // write-back tab — always read fresh

function isFullyPaid(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("fully paid") || s === "paid";
}

export default async function PaymentsPage() {
  let receivables = [] as Awaited<ReturnType<typeof fetchReceivables>>;
  let loadError: string | null = null;
  try {
    receivables = await fetchReceivables();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const awaiting = receivables.filter(r => r.status.toLowerCase().includes("client review"));
  const agencyReview = receivables.filter(r => {
    const s = r.status.toLowerCase();
    return s.includes("agency") || s.includes("fo review");
  });
  const outstanding = receivables.filter(r => !isFullyPaid(r.status));
  const collected = receivables.filter(r => isFullyPaid(r.status));

  const sum = (rows: typeof receivables) => rows.reduce((a, r) => a + (r.amount || 0), 0);

  const outstandingTotal = sum(outstanding);
  const awaitingTotal = sum(awaiting);
  const collectedTotal = sum(collected);

  return (
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
            <KpiStat
              label="Outstanding AR"
              value={formatCurrency(outstandingTotal, { compact: true })}
              tone={outstandingTotal > 0 ? "warning" : "neutral"}
              deltaLabel={`${outstanding.length} open`}
              size="sm"
            />
            <KpiStat
              label="Awaiting Your Review"
              value={String(awaiting.length)}
              tone={awaiting.length > 0 ? "info" : "neutral"}
              deltaLabel={awaiting.length > 0 ? `${formatCurrency(awaitingTotal, { compact: true })} to approve` : "all clear"}
              size="sm"
            />
            <KpiStat
              label="In Agency Review"
              value={String(agencyReview.length)}
              tone="neutral"
              deltaLabel={agencyReview.length > 0 ? `${formatCurrency(sum(agencyReview), { compact: true })}` : "—"}
              size="sm"
            />
            <KpiStat
              label="Collected"
              value={formatCurrency(collectedTotal, { compact: true })}
              tone="success"
              deltaLabel={`${collected.length} paid`}
              size="sm"
            />
            <KpiStat
              label="Total Receivables"
              value={String(receivables.length)}
              tone="neutral"
              deltaLabel="all statuses"
              size="sm"
            />
          </section>

          <ReceivablesWorkspace receivables={receivables} />
        </>
      )}

      <LiveFooter sources="Receivables" />
    </div>
  );
}
