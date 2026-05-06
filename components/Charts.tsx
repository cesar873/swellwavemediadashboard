'use client';

import { useEffect, useRef } from 'react';
import {
  Chart,
  BarController, BarElement,
  LineController, LineElement,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale,
  PointElement, Tooltip, Legend, Filler,
  type ChartConfiguration,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(
  BarController, BarElement,
  LineController, LineElement,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale,
  PointElement, Tooltip, Legend, Filler,
  ChartDataLabels,
);

Chart.defaults.color = 'rgba(255,255,255,0.65)';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'var(--font-dm-sans), system-ui, sans-serif';

const BLUE   = '#1390eb';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';
const PURPLE = '#c084fc';
const YELLOW = '#fde047';

export const fmt = (v: number) => '$' + (v / 1000).toFixed(0) + 'k';
export const fmtFull = (v: number) => '$' + v.toLocaleString();
export const fmtPct = (v: number) => v.toFixed(1) + '%';

type Props = { config: ChartConfiguration; className?: string };

export function ChartCanvas({ config, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, config);
    return () => { chartRef.current?.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className={className} />;
}

// ── Revenue + Net Income trend ────────────────────────────────────────────────
export function TrendChart({ labels, revenue, cogs, netIncome }: {
  labels: string[]; revenue: number[]; cogs: number[]; netIncome: number[];
}) {
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Revenue', data: revenue, backgroundColor: 'rgba(19,144,235,0.25)', borderColor: BLUE, borderWidth: 1.5, borderRadius: 4, order: 2 },
        { label: 'COGS',    data: cogs,    backgroundColor: 'rgba(239,68,68,0.2)',   borderColor: RED,  borderWidth: 1,   borderRadius: 4, order: 3 },
        { type: 'line' as const, label: 'Net Income', data: netIncome, borderColor: GREEN, backgroundColor: 'rgba(34,197,94,0.1)',
          pointBackgroundColor: GREEN, tension: 0.35, pointRadius: 4, borderWidth: 2.5, fill: true, order: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 14 } },
        datalabels: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw as number) } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => fmt(v as number) }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  };
  return <ChartCanvas config={config} />;
}

// ── Margin line chart ─────────────────────────────────────────────────────────
export function MarginChart({ labels, values, color, min, max }: {
  labels: string[]; values: number[]; color: string; min: number; max: number;
}) {
  const config: ChartConfiguration = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgb', 'rgba'),
        tension: 0.35, pointRadius: 3, borderWidth: 2, fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true, color, font: { size: 10, weight: 700 },
          formatter: (v: number) => fmtPct(v), align: 'top', offset: 4,
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' }, min, max },
      },
    },
  };
  return <ChartCanvas config={config} />;
}

// ── Stacked bar (revenue by client) ──────────────────────────────────────────
export function StackedBarChart({ labels, datasets, statuses }: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
  statuses?: string[];
}) {
  // For forecast columns, use a dashed border + lighter fill
  const buildDatasets = () => datasets.map(d => {
    if (!statuses || statuses.every(s => s !== 'Forecast')) {
      return { label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 2, stack: 'main' };
    }
    return {
      label: d.label,
      data: d.data,
      backgroundColor: d.data.map((_, i) =>
        statuses[i] === 'Forecast' ? d.color.replace(/[\d.]+\)$/, '0.35)').replace(/^#/, 'rgba(').replace(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i, (_, r, g, b) =>
          `${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},0.35)`) : d.color
      ),
      borderColor: statuses.map(s => s === 'Forecast' ? 'rgba(255,255,255,0.2)' : 'transparent'),
      borderWidth: statuses.map(s => s === 'Forecast' ? 1 : 0),
      borderDash: [4, 4],
      borderRadius: 2,
      stack: 'main',
    };
  });

  const config: ChartConfiguration = {
    type: 'bar',
    data: { labels, datasets: buildDatasets() },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 10, font: { size: 11 } } },
        datalabels: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw as number) } },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => fmt(v as number) }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  };
  return <ChartCanvas config={config} />;
}

// ── Grouped bar chart (COGS breakdown) ───────────────────────────────────────
export function GroupedBarChart({ labels, datasets }: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
}) {
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label, data: d.data,
        backgroundColor: d.color, borderRadius: 3,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 10 } },
        datalabels: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw as number) } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => fmt(v as number) }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  };
  return <ChartCanvas config={config} />;
}

// ── Doughnut chart ────────────────────────────────────────────────────────────
export function DonutChart({ labels, values, centerLabel, centerSub }: {
  labels: string[]; values: number[]; centerLabel: string; centerSub: string;
}) {
  const colors = [BLUE, GREEN, PURPLE, YELLOW, AMBER, 'rgba(255,255,255,0.25)', RED];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, values.length),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { callbacks: { label: (ctx: { label: string; raw: number }) => ' ' + ctx.label + ': ' + fmtFull(ctx.raw) } },
      },
    },
  };
  return (
    <div className="donut-wrap" style={{ width: 150, height: 150, margin: '12px auto 0' }}>
      <ChartCanvas config={config} />
      <div className="donut-label">
        <div className="dl-val">{centerLabel}</div>
        <div className="dl-sub">{centerSub}</div>
      </div>
    </div>
  );
}

// ── Horizontal bar chart (hours) ─────────────────────────────────────────────
export function HorizontalBarChart({ labels, datasets }: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
}) {
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label, data: d.data,
        backgroundColor: d.color, borderRadius: 3, stack: 'hrs',
      })),
    },
    options: {
      indexAxis: 'y' as const,
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, boxHeight: 8, padding: 10, font: { size: 10 } } },
        datalabels: { display: false },
      },
      scales: {
        x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  };
  return <ChartCanvas config={config} />;
}

// ── Labeled line chart (dual lines with data labels + forecast shading) ────────
export function LabeledLineChart({ labels, datasets, statuses }: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string; fill: boolean }[];
  statuses?: string[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        backgroundColor: d.fill
          ? d.color.startsWith('#')
            ? d.color + '22'
            : d.color.replace(')', ', 0.13)').replace('rgb(', 'rgba(')
          : 'transparent',
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: d.color,
        borderWidth: 2.5,
        fill: d.fill,
        pointHoverRadius: 6,
        segment: statuses
          ? {
              borderDash: (ctx: { p1DataIndex: number }) =>
                statuses[ctx.p1DataIndex] === 'Forecast' ? [5, 4] : [],
            }
          : undefined,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 14 } },
        datalabels: {
          display: true,
          align: 'top',
          offset: 5,
          font: { size: 10, weight: 700 },
          color: (ctx: { datasetIndex: number }) => datasets[ctx.datasetIndex]?.color ?? '#fff',
          formatter: (v: number) => fmt(v),
        },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label: string }; raw: number }) =>
              ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw),
            afterBody: (items: { dataIndex: number }[]) => {
              const i = items[0]?.dataIndex ?? 0;
              return statuses?.[i] === 'Forecast' ? ['⟡ Forecast'] : [];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: (v: number) => fmt(v) },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
    },
    plugins: statuses
      ? [
          {
            id: 'forecastShade',
            beforeDraw: (chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number; left: number; right: number }; scales: { x: { getPixelForValue: (v: number) => number } } }) => {
              const { ctx, chartArea, scales } = chart;
              ctx.save();
              statuses.forEach((s, i) => {
                if (s !== 'Forecast') return;
                const xLeft  = scales.x.getPixelForValue(i - 0.5);
                const xRight = scales.x.getPixelForValue(i + 0.5);
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(xLeft, chartArea.top, xRight - xLeft, chartArea.bottom - chartArea.top);
              });
              ctx.restore();
            },
          },
        ]
      : [],
  };
  return <ChartCanvas config={config} />;
}

export { BLUE, GREEN, RED, AMBER, PURPLE, YELLOW };
