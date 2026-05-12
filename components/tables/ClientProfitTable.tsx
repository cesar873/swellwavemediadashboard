"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { formatLong } from "../charts/chart-shared";
import { cn } from "@/lib/utils";

export interface ClientProfitRow {
  client: string;
  service: string;
  pod: string;
  revenue: number;
  peopleCost: number;
  profit: number;
  margin: number;        // already a percentage (e.g. 35.2 means 35.2%)
}

export interface ClientProfitTableProps {
  rows: ClientProfitRow[];
}

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((Math.abs(value) / max) * 80) : 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="inline-block h-1.5 rounded-sm" style={{ width: w, background: color }} />
      <span className="tabular-nums">{value ? formatLong(Math.abs(value), "currency") : <span className="text-muted-foreground/40">—</span>}</span>
    </div>
  );
}

export function ClientProfitTable({ rows }: ClientProfitTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "profit", desc: true }]);

  const maxRev = useMemo(() => Math.max(1, ...rows.map(r => r.revenue)), [rows]);
  const maxCost = useMemo(() => Math.max(1, ...rows.map(r => r.peopleCost)), [rows]);
  const maxProfit = useMemo(() => Math.max(1, ...rows.map(r => Math.abs(r.profit))), [rows]);

  const columns = useMemo<ColumnDef<ClientProfitRow>[]>(
    () => [
      {
        accessorKey: "client",
        header: "Client",
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.client}</span>,
      },
      {
        accessorKey: "service",
        header: "Service",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.service || "—"}</span>,
      },
      {
        accessorKey: "pod",
        header: "Pod",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.pod || "—"}</span>,
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: ({ row }) => <BarCell value={row.original.revenue} max={maxRev} color="rgba(34,211,238,0.45)" />,
      },
      {
        accessorKey: "peopleCost",
        header: "People Cost",
        cell: ({ row }) => <BarCell value={row.original.peopleCost} max={maxCost} color="rgba(244,63,94,0.45)" />,
      },
      {
        accessorKey: "profit",
        header: "Profit",
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold" style={{ color: row.original.profit >= 0 ? "var(--green)" : "var(--red)" }}>
            {row.original.profit !== 0 ? (row.original.profit < 0 ? "-" : "") + formatLong(Math.abs(row.original.profit), "currency") : "—"}
          </span>
        ),
      },
      {
        accessorKey: "margin",
        header: "Margin",
        cell: ({ row }) => {
          const m = row.original.margin;
          if (!isFinite(m) || m === 0) return <span className="text-muted-foreground">—</span>;
          const tone = m >= 50 ? "var(--green)" : m >= 30 ? "var(--amber)" : "var(--red)";
          return (
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ background: `${tone}22`, color: tone }}
            >
              {m.toFixed(1)}%
            </span>
          );
        },
      },
    ],
    [maxRev, maxCost, maxProfit],
  );
  void maxProfit;

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="relative max-h-[520px] overflow-auto rounded-lg">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map((h, hi) => (
                <th
                  key={h.id}
                  className={cn(
                    "sticky top-0 z-10 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                    hi >= 3 ? "text-right" : "text-left",
                  )}
                >
                  <button onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ▲" : h.column.getIsSorted() === "desc" ? " ▼" : ""}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(r => (
            <tr key={r.id} className="hover:bg-white/[0.02]">
              {r.getVisibleCells().map((cell, ci) => (
                <td key={cell.id} className={cn("border-b border-white/[0.04] px-3 py-2", ci >= 3 ? "text-right" : "text-left")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
