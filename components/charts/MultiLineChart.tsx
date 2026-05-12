"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, GRID_STROKE, formatCompact, type ChartFormat } from "./chart-shared";
import { ChartTooltip } from "./ChartTooltip";

export interface MultiLineSeries {
  key: string;
  label: string;
  color: string;
  format?: ChartFormat;
}

export interface MultiLineChartProps {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: MultiLineSeries[];
  leftFormat?: ChartFormat;
  height?: number;
  /** First index in `data` that is forecast (Phase 2 styling). Omit in Phase 1. */
  forecastStartIndex?: number;
}

export function MultiLineChart({
  data,
  xKey,
  series,
  leftFormat = "currency",
  height = 280,
  forecastStartIndex,
}: MultiLineChartProps) {
  const hasForecast =
    forecastStartIndex != null &&
    forecastStartIndex >= 0 &&
    forecastStartIndex < data.length;

  // Split each series into an actual half and a forecast half (overlapping one
  // point at the boundary so the line stays continuous visually).
  const splitData = hasForecast
    ? data.map((row, i) => {
        const next: Record<string, number | string | null> = { ...row };
        for (const s of series) {
          const v = row[s.key];
          const isForecast = i >= forecastStartIndex!;
          const isBoundary = i === forecastStartIndex! - 1;
          next[`${s.key}__a`] = !isForecast ? v : null;
          next[`${s.key}__f`] = isForecast || isBoundary ? v : null;
        }
        return next;
      })
    : data;

  const forecastX =
    hasForecast && data[forecastStartIndex!]?.[xKey] != null
      ? (data[forecastStartIndex!][xKey] as string | number)
      : null;
  const lastX = data.length > 0 ? (data[data.length - 1][xKey] as string | number) : null;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={splitData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => formatCompact(v as number, leftFormat)}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
            content={<ChartTooltip format={leftFormat} />}
          />
          {hasForecast && forecastX != null && lastX != null && (
            <ReferenceArea
              x1={forecastX}
              x2={lastX}
              fill="rgba(255,255,255,0.04)"
              strokeOpacity={0}
              ifOverflow="extendDomain"
            />
          )}
          {series.flatMap(s =>
            hasForecast
              ? [
                  <Line
                    key={`${s.key}-actual`}
                    type="monotone"
                    dataKey={`${s.key}__a`}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />,
                  <Line
                    key={`${s.key}-forecast`}
                    type="monotone"
                    dataKey={`${s.key}__f`}
                    name={`${s.label} (forecast)`}
                    stroke={s.color}
                    strokeOpacity={0.7}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 2.5, fill: s.color, strokeWidth: 0, fillOpacity: 0.7 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                    connectNulls={false}
                    legendType="none"
                  />,
                ]
              : [
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />,
                ],
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
