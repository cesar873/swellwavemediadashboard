"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, GRID_STROKE, LABEL_FILL, formatCompact, type ChartFormat } from "./chart-shared";
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
  /** Draw per-point data labels above each line. Defaults to true. */
  showLabels?: boolean;
}

export function MultiLineChart({
  data,
  xKey,
  series,
  leftFormat = "currency",
  height = 280,
  forecastStartIndex,
  showLabels = true,
}: MultiLineChartProps) {
  const labelsOn = showLabels;
  // For multi-series, alternate label position (top / bottom) so they don't
  // pile on each other. Single-series always sits on top.
  const labelPosition = (i: number): "top" | "bottom" =>
    series.length <= 1 ? "top" : i % 2 === 0 ? "top" : "bottom";
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
        <LineChart data={splitData} margin={{ top: 22, right: 12, left: 4, bottom: series.length > 1 ? 22 : 4 }}>
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
          {series.flatMap((s, sIdx) => {
            const fmt = s.format ?? leftFormat;
            const pos = labelPosition(sIdx);
            const labelEl = labelsOn ? (
              <LabelList
                key={`${s.key}-lbl`}
                dataKey={hasForecast ? `${s.key}__a` : s.key}
                position={pos}
                formatter={(v: unknown) =>
                  v == null || v === "" ? "" : formatCompact(Number(v), fmt)
                }
                fill={s.color}
                fontSize={10}
                fontWeight={600}
                offset={pos === "top" ? 8 : 6}
              />
            ) : null;
            const forecastLabelEl = labelsOn && hasForecast ? (
              <LabelList
                key={`${s.key}-flbl`}
                dataKey={`${s.key}__f`}
                position={pos}
                formatter={(v: unknown) =>
                  v == null || v === "" ? "" : formatCompact(Number(v), fmt)
                }
                fill={s.color}
                fillOpacity={0.7}
                fontSize={10}
                fontWeight={600}
                fontStyle="italic"
                offset={pos === "top" ? 8 : 6}
              />
            ) : null;
            return hasForecast
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
                  >
                    {labelEl}
                  </Line>,
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
                  >
                    {forecastLabelEl}
                  </Line>,
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
                  >
                    {labelEl}
                  </Line>,
                ];
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
