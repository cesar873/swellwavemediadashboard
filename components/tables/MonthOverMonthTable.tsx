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
import { cn } from "@/lib/utils";
import { isoToLabel } from "@/lib/period";
import { formatLong } from "../charts/chart-shared";

export interface MoMRow {
  id: string;
  primary: string;             // e.g. client name
  secondary?: string;          // e.g. service line
  tertiary?: string;           // e.g. pod / industry
  monthly: Record<string, number>; // monthIso → value
  total: number;
}

export interface MonthOverMonthTableProps {
  rows: MoMRow[];
  monthsIso: string[];
  primaryHeader: string;
  secondaryHeader?: string;
  tertiaryHeader?: string;
  barColor?: string;           // e.g. sky for revenue, rose for expenses
  searchPlaceholder?: string;
  /** Phase 2: months > latestActualIso render italic to flag forecast. */
  latestActualIso?: string;
}

export function MonthOverMonthTable({
  rows,
  monthsIso,
  primaryHeader,
  secondaryHeader,
  tertiaryHeader,
  barColor = "rgba(34,211,238,0.45)",
  searchPlaceholder = "Search…",
  latestActualIso,
}: MonthOverMonthTableProps) {
  const isForecastIso = (iso: string) => !!latestActualIso && iso > latestActualIso;
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "total", desc: true }]);

  const maxTotal = useMemo(
    () => Math.max(1, ...rows.map(r => Math.abs(r.total))),
    [rows],
  );

  const columns = useMemo<ColumnDef<MoMRow>[]>(() => {
    const cols: ColumnDef<MoMRow>[] = [
      {
        accessorKey: "primary",
        header: primaryHeader,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.primary}</span>
            {row.original.secondary && (
              <span className="text-[11px] text-muted-foreground">{row.original.secondary}</span>
            )}
          </div>
        ),
      },
    ];

    if (tertiaryHeader) {
      cols.push({
        accessorKey: "tertiary",
        header: tertiaryHeader,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.tertiary ?? "—"}</span>
        ),
      });
    }

    cols.push({
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => {
        const v = row.original.total;
        const w = Math.round((Math.abs(v) / maxTotal) * 80);
        return (
          <div className="flex items-center gap-2 justify-end">
            <span className="inline-block h-1.5 rounded-sm" style={{ width: w, background: barColor }} />
            <span className="tabular-nums font-semibold text-foreground">{formatLong(v, "currency")}</span>
          </div>
        );
      },
    });

    for (const iso of monthsIso) {
      const forecast = isForecastIso(iso);
      cols.push({
        id: iso,
        accessorFn: row => row.monthly[iso] ?? 0,
        header: forecast ? `${isoToLabel(iso)} · fc` : isoToLabel(iso),
        cell: ({ getValue }) => {
          const v = (getValue() as number) ?? 0;
          return (
            <span className={cn("tabular-nums text-foreground/85", forecast && "italic text-foreground/65")}>
              {v ? formatLong(v, "currency") : <span className="text-muted-foreground/40">—</span>}
            </span>
          );
        },
      });
    }
    return cols;
  }, [primaryHeader, tertiaryHeader, monthsIso, barColor, maxTotal, latestActualIso]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _id, value) => {
      const q = String(value).toLowerCase();
      return (
        row.original.primary.toLowerCase().includes(q) ||
        (row.original.secondary?.toLowerCase().includes(q) ?? false) ||
        (row.original.tertiary?.toLowerCase().includes(q) ?? false)
      );
    },
  });

  void secondaryHeader; // accepted for symmetry; secondary rendered inside primary cell

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-64 rounded-md border border-[var(--card-border)] bg-white/5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
          />
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {table.getRowModel().rows.length} rows
        </span>
      </div>

      <div className="relative max-h-[460px] overflow-auto rounded-lg">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map((h, hi) => (
                  <th
                    key={h.id}
                    className={cn(
                      "sticky top-0 z-10 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                      hi === 0 ? "left-0 z-20 text-left" : "text-right",
                    )}
                    style={hi === 0 ? { left: 0, position: "sticky" } : undefined}
                  >
                    {h.isPlaceholder ? null : (
                      <button
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? " ▲" : h.column.getIsSorted() === "desc" ? " ▼" : ""}
                      </button>
                    )}
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
                    className={cn(
                      "border-b border-white/[0.04] px-3 py-2",
                      ci === 0 ? "left-0 sticky-bg text-left" : "text-right tabular-nums",
                    )}
                    style={ci === 0 ? { left: 0, position: "sticky" } : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  No matching rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
