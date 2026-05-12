"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { AXIS_TICK, formatCompact, type ChartFormat } from "./chart-shared";
import { ChartTooltip } from "./ChartTooltip";

export interface RankedBarItem {
  label: string;
  value: number;
}

export interface RankedBarChartProps {
  data: RankedBarItem[];
  color?: string;
  negativeColor?: string;
  format?: ChartFormat;
  height?: number;
  maxItems?: number;
}

export function RankedBarChart({
  data,
  color = "#1390eb",
  negativeColor = "#ef4444",
  format = "currency",
  height = 320,
  maxItems = 15,
}: RankedBarChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => formatCompact(v as number, format)}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...AXIS_TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<ChartTooltip format={format} />}
          />
          <Bar dataKey="value" isAnimationActive={false} radius={[0, 4, 4, 0]}>
            {sorted.map((d, i) => (
              <Cell key={i} fill={d.value < 0 ? negativeColor : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
