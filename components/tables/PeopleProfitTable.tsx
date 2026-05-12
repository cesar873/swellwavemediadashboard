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

export interface PeopleProfitRow {
  name: string;
  department: string;
  hoursAvailable: number;
  revenueCovered: number;
  utilization: number;        // 0..1
  vsTarget: number;           // 0..1 (or negative)
  revenueGap: number;         // negative = below target
}

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((Math.abs(value) / max) * 80) : 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="inline-block h-1.5 rounded-sm" style={{ width: w, background: color }} />
      <span className="tabular-nums">
        {value ? formatLong(Math.abs(value), "currency") : <span className="text-muted-foreground/40">—</span>}
      </span>
    </div>
  );
}

function PctBadge({ value, lowerIsBad = false }: { value: number; lowerIsBad?: boolean }) {
  if (!isFinite(value)) return <span className="text-muted-foreground">—</span>;
  const pct = value * 100;
  const ok = lowerIsBad ? pct >= 75 : pct >= 0;
  const warn = lowerIsBad ? pct >= 50 : pct >= -15;
  const tone = ok ? "var(--green)" : warn ? "var(--amber)" : "var(--red)";
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{ background: `${tone}22`, color: tone }}
    >
      {pct >= 0 && !lowerIsBad ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export function PeopleProfitTable({ rows }: { rows: PeopleProfitRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "revenueCovered", desc: true }]);

  const maxRev = useMemo(() => Math.max(1, ...rows.map(r => r.revenueCovered)), [rows]);
  const maxGap = useMemo(() => Math.max(1, ...rows.map(r => Math.abs(r.revenueGap))), [rows]);

  const columns = useMemo<ColumnDef<PeopleProfitRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Team Member",
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.department || "—"}</span>,
      },
      {
        accessorKey: "hoursAvailable",
        header: "Hours",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.hoursAvailable || <span className="text-muted-foreground/40">—</span>}</span>
        ),
      },
      {
        accessorKey: "revenueCovered",
        header: "Revenue Covered",
        cell: ({ row }) => <BarCell value={row.original.revenueCovered} max={maxRev} color="rgba(34,211,238,0.45)" />,
      },
      {
        accessorKey: "utilization",
        header: "Utilization",
        cell: ({ row }) => <PctBadge value={row.original.utilization} lowerIsBad />,
      },
      {
        accessorKey: "vsTarget",
        header: "vs Target",
        cell: ({ row }) => <PctBadge value={row.original.vsTarget} />,
      },
      {
        accessorKey: "revenueGap",
        header: "Revenue Gap",
        cell: ({ row }) => {
          const v = row.original.revenueGap;
          const color = v >= 0 ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)";
          return <BarCell value={v} max={maxGap} color={color} />;
        },
      },
    ],
    [maxRev, maxGap],
  );

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
                    hi >= 2 ? "text-right" : "text-left",
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
                <td
                  key={cell.id}
                  className={cn("border-b border-white/[0.04] px-3 py-2", ci >= 2 ? "text-right" : "text-left")}
                >
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
