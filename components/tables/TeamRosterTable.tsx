"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { formatLong } from "../charts/chart-shared";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/types";

export interface TeamRosterTableProps {
  rows: TeamMember[];
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  const tone =
    s.includes("active") ? "var(--green)"
    : s.includes("paus") || s.includes("hold") ? "var(--amber)"
    : s.includes("end") || s.includes("inact") || s.includes("term") ? "var(--red)"
    : "var(--muted)";
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${tone}22`, color: tone }}
    >
      {status || "—"}
    </span>
  );
}

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 80) : 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="inline-block h-1.5 rounded-sm" style={{ width: w, background: color }} />
      <span className="tabular-nums">
        {value ? formatLong(value, "currency") : <span className="text-muted-foreground/40">—</span>}
      </span>
    </div>
  );
}

export function TeamRosterTable({ rows }: TeamRosterTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "contractedSalary", desc: true }]);

  const maxSalary = useMemo(() => Math.max(1, ...rows.map(r => r.contractedSalary)), [rows]);

  const columns = useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.department || "—"}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.category || "—"}</span>,
      },
      {
        accessorKey: "totalHours",
        header: "Hours",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.totalHours || <span className="text-muted-foreground/40">—</span>}</span>
        ),
      },
      {
        accessorKey: "costPerHour",
        header: "Cost / Hour",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.costPerHour ? formatLong(row.original.costPerHour, "currency") : <span className="text-muted-foreground/40">—</span>}</span>
        ),
      },
      {
        accessorKey: "contractedSalary",
        header: "Contracted Salary",
        cell: ({ row }) => <BarCell value={row.original.contractedSalary} max={maxSalary} color="rgba(34,211,238,0.45)" />,
      },
      {
        accessorKey: "startDate",
        header: "Start Date",
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.startDate || "—"}</span>,
      },
    ],
    [maxSalary],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _id, value) => {
      const q = String(value).toLowerCase();
      const r = row.original;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.department?.toLowerCase().includes(q) ?? false) ||
        (r.category?.toLowerCase().includes(q) ?? false)
      );
    },
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search name, department, category…"
            className="h-8 w-72 rounded-md border border-[var(--card-border)] bg-white/5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
          />
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {table.getRowModel().rows.length} people
        </span>
      </div>

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
                      hi >= 4 ? "text-right" : "text-left",
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
                  <td key={cell.id} className={cn("border-b border-white/[0.04] px-3 py-2", ci >= 4 ? "text-right" : "text-left")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
