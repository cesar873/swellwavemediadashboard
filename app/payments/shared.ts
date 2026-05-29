import type { Receivable } from "@/lib/types";

// Template status enum (buildout §Tab 7). UI styling is keyed to these strings.
export const STATUS_ENUM = [
  "In Progress",
  "AgenCFO Review",
  "Client Review",
  "Ready",
  "Unpaid",
  "Partially Paid",
  "Fully Paid",
] as const;

export const STATUS_CLIENT_REVIEW = "Client Review";
export const STATUS_AGENCY_REVIEW = "AgenCFO Review"; // what Approve writes

export type StatusKind = "review-client" | "review-agency" | "pipeline" | "paid" | "unpaid" | "neutral";

export function statusKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s.includes("client review")) return "review-client";
  if (s.includes("agencfo") || s.includes("agency") || s.includes("fo review")) return "review-agency";
  if (s.includes("fully paid") || s === "paid") return "paid";
  if (s.includes("unpaid") || s.includes("partially") || s.includes("overdue")) return "unpaid";
  if (s.includes("in progress") || s.includes("ready") || s.includes("draft")) return "pipeline";
  return "neutral";
}

// {bg, fg} CSS values for a status pill.
export function statusPillStyle(status: string): { bg: string; fg: string } {
  switch (statusKind(status)) {
    case "review-client":  return { bg: "var(--blue-soft)",  fg: "var(--blue)" };
    case "review-agency":  return { bg: "var(--amber-soft)", fg: "var(--amber)" };
    case "paid":           return { bg: "var(--green-soft)", fg: "var(--green)" };
    case "unpaid":         return { bg: "var(--red-soft)",   fg: "var(--red)" };
    case "pipeline":       return { bg: "rgba(255,255,255,0.08)", fg: "var(--muted)" };
    default:               return { bg: "rgba(255,255,255,0.08)", fg: "var(--muted)" };
  }
}

// Worst-status color for an AR-grid cell (red > amber > blue > green > neutral).
export function worstStatusColor(statuses: string[]): string {
  const kinds = statuses.map(statusKind);
  if (kinds.includes("unpaid"))        return "var(--red)";
  if (kinds.includes("review-agency")) return "var(--amber)";
  if (kinds.includes("review-client")) return "var(--blue)";
  if (kinds.includes("paid"))          return "var(--green)";
  return "rgba(255,255,255,0.18)";
}

export function isPaid(status: string): boolean {
  return statusKind(status) === "paid";
}

export function isOverdue(r: Receivable): boolean {
  const k = statusKind(r.status);
  return (k === "unpaid") && r.daysOverdue > 0;
}

export interface BreakdownLine {
  label: string;
  value: number;
}

// "How this amount was calculated" — derived from payType / rule / adSpend /
// discounts / other. Falls back to a single "Invoice amount" line.
export function amountBreakdown(r: Receivable): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const pt = r.payType.toLowerCase();
  const rule = r.paymentRule.toLowerCase();

  if (r.adSpend && (rule.includes("ad spend") || rule.includes("%"))) {
    const pctMatch = r.paymentRule.match(/(\d+(?:\.\d+)?)\s*%/);
    const pct = pctMatch ? parseFloat(pctMatch[1]) / 100 : 0;
    const base = pct > 0 ? r.adSpend * pct : 0;
    lines.push({ label: r.paymentRule || "Variable fee", value: base || r.amount });
  } else if (pt.includes("retainer") || pt.includes("monthly")) {
    lines.push({ label: "Monthly retainer", value: r.amount - r.discounts - r.otherChange });
  } else {
    lines.push({ label: "Invoice amount", value: r.amount - r.discounts - r.otherChange });
  }

  if (r.discounts) lines.push({ label: "Discount", value: -Math.abs(r.discounts) });
  if (r.otherChange) lines.push({ label: "Other adjustment", value: r.otherChange });
  return lines;
}

export function hasAdjustments(r: Receivable): boolean {
  return !!(r.discounts || r.otherChange || r.adSpend);
}
