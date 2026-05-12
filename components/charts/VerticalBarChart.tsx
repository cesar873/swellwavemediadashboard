"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, GRID_STROKE, LABEL_FILL, formatCompact, type ChartFormat } from "./chart-shared";
import { ChartTooltip } from "./ChartTooltip";

export interface VerticalBarChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  format?: ChartFormat;
  height?: number;
}

export function VerticalBarChart({
  data,
  color = "#1390eb",
  format = "currency",
  height = 280,
}: VerticalBarChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => formatCompact(v as number, format)}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<ChartTooltip format={format} />}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: unknown) => formatCompact(Number(v ?? 0), format)}
              fill={LABEL_FILL}
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
