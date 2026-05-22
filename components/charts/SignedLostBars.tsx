"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  AXIS_TICK,
  CHART_PALETTE,
  GRID_STROKE,
  formatCompact,
} from "./chart-shared";
import { ChartTooltip } from "./ChartTooltip";

export interface SignedLostBarsProps {
  data: Array<{
    label: string;
    signed: number;
    lost: number;
    total: number;
  }>;
  height?: number;
  /** First index in `data` that is forecast styling. */
  forecastStartIndex?: number;
  /** Label shown for the line overlay. Defaults to "Total clients". */
  totalLabel?: string;
}

// Combo chart per formatting.md §2.B.12:
//   - Green bars for signed, red bars for lost.
//   - Blue line on right axis for total clients on the books.
//   - Bar/line values labelled directly on the chart.
export function SignedLostBars({
  data,
  height = 360,
  forecastStartIndex,
  totalLabel = "Total clients",
}: SignedLostBarsProps) {
  const hasForecast =
    forecastStartIndex != null &&
    forecastStartIndex >= 0 &&
    forecastStartIndex < data.length;

  // Split the line into actual + forecast halves so we can dash the forecast.
  const splitData = hasForecast
    ? data.map((row, i) => {
        const isForecast = i >= forecastStartIndex!;
        const isBoundary = i === forecastStartIndex! - 1;
        return {
          ...row,
          total__a: !isForecast ? row.total : null,
          total__f: isForecast || isBoundary ? row.total : null,
        };
      })
    : data;

  const forecastX =
    hasForecast && data[forecastStartIndex!]?.label != null
      ? data[forecastStartIndex!].label
      : null;
  const lastX = data.length > 0 ? data[data.length - 1].label : null;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={splitData} margin={{ top: 24, right: 32, left: 4, bottom: 8 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => String(Math.round(v as number))}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ ...AXIS_TICK, fill: CHART_PALETTE.blue }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => formatCompact(v as number, "number")}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<ChartTooltip format="number" />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.7)", paddingBottom: 8 }}
          />
          {hasForecast && forecastX != null && lastX != null && (
            <ReferenceArea
              x1={forecastX}
              x2={lastX}
              yAxisId="left"
              fill="rgba(255,255,255,0.04)"
              strokeOpacity={0}
              ifOverflow="extendDomain"
            />
          )}

          <Bar
            yAxisId="left"
            dataKey="lost"
            name="Lost"
            fill={CHART_PALETTE.red}
            isAnimationActive={false}
            radius={[3, 3, 0, 0]}
            barSize={14}
          >
            <LabelList
              dataKey="lost"
              position="top"
              formatter={(v: unknown) => (v == null || v === 0 ? "" : String(v))}
              fill="rgba(255,255,255,0.85)"
              fontSize={10}
              fontFamily="var(--font-dm-sans), DM Sans, sans-serif"
            />
          </Bar>
          <Bar
            yAxisId="left"
            dataKey="signed"
            name="Signed"
            fill={CHART_PALETTE.green}
            isAnimationActive={false}
            radius={[3, 3, 0, 0]}
            barSize={14}
          >
            <LabelList
              dataKey="signed"
              position="top"
              formatter={(v: unknown) => (v == null || v === 0 ? "" : String(v))}
              fill="rgba(255,255,255,0.85)"
              fontSize={10}
              fontFamily="var(--font-dm-sans), DM Sans, sans-serif"
            />
          </Bar>

          <Line
            yAxisId="right"
            type="monotone"
            dataKey={hasForecast ? "total__a" : "total"}
            name={totalLabel}
            stroke={CHART_PALETTE.blue}
            strokeWidth={2}
            dot={{ r: 3, fill: "transparent", stroke: CHART_PALETTE.blue, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          >
            <LabelList
              dataKey={hasForecast ? "total__a" : "total"}
              position="top"
              formatter={(v: unknown) => (v == null ? "" : String(v))}
              fill={CHART_PALETTE.blue}
              fontSize={10}
              fontFamily="var(--font-dm-sans), DM Sans, sans-serif"
            />
          </Line>
          {hasForecast && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="total__f"
              stroke={CHART_PALETTE.blue}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "transparent", stroke: CHART_PALETTE.blue, strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
              legendType="none"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
