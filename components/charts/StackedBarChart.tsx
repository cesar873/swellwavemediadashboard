"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  GRID_STROKE,
  PALETTE_BLUE,
  PALETTE_RED,
  PALETTE_GREEN,
  LABEL_FILL,
  formatCompact,
  type ChartFormat,
} from "./chart-shared";
import { ChartTooltip } from "./ChartTooltip";

export interface StackedSeries {
  key: string;
  label: string;
  color?: string;
}

export interface StackedBarChartProps {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: StackedSeries[];
  paletteSort?: "blue" | "red" | "green";
  format?: ChartFormat;
  height?: number;
  /** First data index that is forecast — gets a translucent overlay. */
  forecastStartIndex?: number;
}

const PALETTES = { blue: PALETTE_BLUE, red: PALETTE_RED, green: PALETTE_GREEN };

export function StackedBarChart({
  data,
  xKey,
  series,
  paletteSort = "blue",
  format = "currency",
  height = 280,
  forecastStartIndex,
}: StackedBarChartProps) {
  const hasForecast =
    forecastStartIndex != null &&
    forecastStartIndex >= 0 &&
    forecastStartIndex < data.length;
  const forecastX1 = hasForecast ? (data[forecastStartIndex!][xKey] as string | number) : null;
  const forecastX2 = hasForecast ? (data[data.length - 1][xKey] as string | number) : null;

  // Per-bar total (used for the data label drawn above each stack).
  const dataWithTotals = data.map(row => {
    let total = 0;
    for (const s of series) total += Number(row[s.key] ?? 0);
    return { ...row, __total: total };
  });
  const palette = PALETTES[paletteSort];
  // Sort biggest → smallest so the largest series renders at the BASE of the
  // stack (first child of <BarChart> is the bottom layer in Recharts).
  const totals = new Map<string, number>();
  for (const s of series) {
    let total = 0;
    for (const row of data) total += Number(row[s.key] ?? 0);
    totals.set(s.key, total);
  }
  const sorted = [...series].sort((a, b) => (totals.get(b.key) ?? 0) - (totals.get(a.key) ?? 0));
  // Safe positive modulo so palette never returns undefined (which Recharts
  // renders as black fill) when there are more series than palette colours.
  const pick = (i: number) => palette[((i % palette.length) + palette.length) % palette.length];
  const withColor = sorted.map((s, i) => ({
    ...s,
    color: s.color ?? pick(i),
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={dataWithTotals} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => formatCompact(v as number, format)}
            width={64}
          />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip format={format} />} />
          {hasForecast && forecastX1 != null && forecastX2 != null && (
            <ReferenceArea
              x1={forecastX1}
              x2={forecastX2}
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
          )}
          {withColor.map((s, i) => {
            const isTop = i === withColor.length - 1;
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="x"
                fill={s.color}
                isAnimationActive={false}
                radius={isTop ? [4, 4, 0, 0] : 0}
              >
                {isTop && (
                  <LabelList
                    dataKey="__total"
                    position="top"
                    formatter={(v: unknown) => formatCompact(Number(v ?? 0), format)}
                    fill={LABEL_FILL}
                    fontSize={11}
                    fontWeight={600}
                  />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
