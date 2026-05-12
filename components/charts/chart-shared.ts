// formatting.md §2.A — shared chart tokens

export const CHART_PALETTE = {
  blue:   "#1390eb",
  green:  "#22c55e",
  red:    "#ef4444",
  amber:  "#f59e0b",
  purple: "#c084fc",
  yellow: "#fde047",
};

export const PALETTE_BLUE  = ["#1390eb", "#3aa6f0", "#62bbf5", "#8ed0fa", "#bce3ff"];
export const PALETTE_GREEN = ["#22c55e", "#4ad07a", "#72db96", "#9ae6b2", "#c3f0ce"];
export const PALETTE_RED   = ["#ef4444", "#f06a6a", "#f29191", "#f5b7b7", "#f8dddd"];

export const CATEGORICAL = [
  CHART_PALETTE.blue,
  CHART_PALETTE.green,
  CHART_PALETTE.purple,
  CHART_PALETTE.yellow,
  CHART_PALETTE.amber,
  CHART_PALETTE.red,
];

export type ChartFormat = "currency" | "percent" | "number";

export function formatCompact(n: number, kind: ChartFormat = "currency"): string {
  if (!isFinite(n)) return "—";
  if (kind === "percent") return `${(n * 100).toFixed(0)}%`;
  if (kind === "number") {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  }
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatLong(n: number, kind: ChartFormat = "currency"): string {
  if (!isFinite(n)) return "—";
  if (kind === "percent") return `${(n * 100).toFixed(1)}%`;
  if (kind === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export const AXIS_TICK = {
  fill: "rgba(255,255,255,0.55)",
  fontSize: 11,
  fontFamily: "var(--font-dm-sans), DM Sans, sans-serif",
};

export const GRID_STROKE = "rgba(255,255,255,0.06)";
