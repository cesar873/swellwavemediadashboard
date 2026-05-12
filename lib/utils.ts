import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Number formatting — formatting.md §1.9 ───────────────────────────────────
export function formatCurrency(value: number, opts: { compact?: boolean } = {}): string {
  if (!isFinite(value)) return "—";
  if (opts.compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!isFinite(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

// ── Tone / threshold helpers ─────────────────────────────────────────────────
export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "success": return "var(--green)";
    case "warning": return "var(--amber)";
    case "danger":  return "var(--red)";
    case "info":    return "var(--blue)";
    default:        return "var(--text)";
  }
}
