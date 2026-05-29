// formatting.md §2.A — shared chart tokens

export const CHART_PALETTE = {
  blue:   "#1390eb",
  green:  "#22c55e",
  red:    "#ef4444",
  amber:  "#f59e0b",
  purple: "#c084fc",
  yellow: "#fde047",
  teal:   "#22d3ee",
  pink:   "#f472b6",
};

// Categorical palette per formatting.md §1.10: blue → green → purple → yellow → amber.
// Used by default for any chart with > 1 distinct series.
export const CATEGORICAL = [
  CHART_PALETTE.blue,
  CHART_PALETTE.green,
  CHART_PALETTE.purple,
  CHART_PALETTE.yellow,
  CHART_PALETTE.amber,
  CHART_PALETTE.teal,
  CHART_PALETTE.pink,
  CHART_PALETTE.red,
];

// Stacked-bar palettes — single-hue gradients, darkest first. Combined with
// the descending sort in StackedBarChart, the BIGGEST category sits at the
// base in the boldest shade and series fade as they get smaller.
export const PALETTE_BLUE = [
  "#0c4a82",
  "#1265b0",
  "#1390eb", // primary brand blue
  "#3aa6f0",
  "#62bbf5",
  "#8ed0fa",
  "#b9e2ff",
  "#dceffe",
];

export const PALETTE_RED = [
  "#7f1d1d",
  "#b91c1c",
  "#dc2626",
  "#ef4444", // primary brand red
  "#f87171",
  "#fca5a5",
  "#fecaca",
  "#fee2e2",
];

export const PALETTE_GREEN = [
  "#14532d",
  "#166534",
  "#15803d",
  "#22c55e", // primary brand green
  "#4ade80",
  "#86efac",
  "#bbf7d0",
  "#dcfce7",
];

export type ChartFormat = "currency" | "percent" | "number" | "decimal";

export function formatCompact(n: number, kind: ChartFormat = "currency"): string {
  if (!isFinite(n)) return "—";
  if (kind === "percent") return `${(n * 100).toFixed(0)}%`;
  if (kind === "decimal") {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(2);
  }
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
  if (kind === "decimal") {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
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

// Data-label text fill — white, never black. Recharts defaults LabelList fill
// to #666 which reads as black on dark cards; always override with this.
export const LABEL_FILL = "rgba(255,255,255,0.92)";
export const LABEL_FILL_SOFT = "rgba(255,255,255,0.7)";

export const LABEL_STYLE = {
  fill: LABEL_FILL,
  fontSize: 11,
  fontFamily: "var(--font-dm-sans), DM Sans, sans-serif",
  fontWeight: 600 as const,
};
