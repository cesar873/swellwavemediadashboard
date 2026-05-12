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
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
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
  /** When set, renders an in-table multi-select that filters rows by the
   *  named field (e.g. `secondary` for "Category" on the vendor table). */
  filterBy?: { key: "secondary" | "tertiary"; label: string };
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
  filterBy,
}: MonthOverMonthTableProps) {
  const isForecastIso = (iso: string) => !!latestActualIso && iso > latestActualIso;

  // In-table category filter (optional).
  // State model:
  //   `null`       = no filter applied (all rows shown, implicit "all"). This
  //                  is the initial state so the table doesn't gate behaviour
  //                  before the user opens the popover.
  //   `string[]`   = explicit selection. Empty array = "show none".
  // This three-state model lets users actually deselect everything and see an
  // empty table — distinct from the default "all included" view.
  const filterOptions = useMemo(() => {
    if (!filterBy) return [] as string[];
    const set = new Set<string>();
    for (const r of rows) {
      const v = r[filterBy.key];
      if (v) set.add(v);
    }
    return [...set].sort();
  }, [rows, filterBy]);
  const [filterSelected, setFilterSelected] = useState<string[] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const isImplicitAll = filterSelected === null;
  const filterSelectedSet = useMemo(
    () => new Set(filterSelected ?? []),
    [filterSelected],
  );
  const isOptionSelected = (opt: string) =>
    isImplicitAll ? true : filterSelectedSet.has(opt);
  const filterCount = isImplicitAll ? filterOptions.length : filterSelected!.length;
  const filterButtonLabel = isImplicitAll
    ? `All ${filterOptions.length}`
    : filterCount === 0
      ? "None"
      : `${filterCount} of ${filterOptions.length}`;
  const toggleFilter = (opt: string) => {
    const current = isImplicitAll ? [...filterOptions] : [...filterSelected!];
    const i = current.indexOf(opt);
    if (i >= 0) current.splice(i, 1);
    else current.push(opt);
    // Don't collapse to "implicit all" automatically — let the user click
    // "Select all" explicitly so this remains a 3-state model.
    setFilterSelected(current);
  };
  const selectOnly = (opt: string) => setFilterSelected([opt]);
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

  // Apply filter-by category before passing to the table.
  const filteredRows = useMemo(() => {
    if (!filterBy || isImplicitAll) return rows;
    return rows.filter(r => {
      const v = r[filterBy.key];
      return v != null && filterSelectedSet.has(v);
    });
  }, [rows, filterBy, isImplicitAll, filterSelectedSet]);

  const table = useReactTable({
    data: filteredRows,
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-64 rounded-md border border-[var(--card-border)] bg-white/5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
          />
        </div>

        {filterBy && filterOptions.length > 0 && (
          <Popover.Root open={filterOpen} onOpenChange={setFilterOpen}>
            <div className="inline-flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {filterBy.label}
              </span>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-white/5 px-2.5 text-[11px] font-medium text-foreground transition hover:border-[var(--blue)]/40 focus:border-[var(--blue)] focus:outline-none",
                    !isImplicitAll && filterCount > 0 && "border-[var(--blue)]/40 bg-[var(--blue-soft)]/30 text-[var(--blue)]",
                    !isImplicitAll && filterCount === 0 && "border-[var(--amber)]/40 bg-[var(--warning-bg)]",
                  )}
                  style={!isImplicitAll && filterCount === 0 ? { color: "var(--amber)" } : undefined}
                >
                  <span className="tabular-nums">{filterButtonLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </Popover.Trigger>
              {!isImplicitAll && (
                <button
                  type="button"
                  onClick={() => setFilterSelected(null)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--card-border)] px-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                  title="Reset to all"
                >
                  <X className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={6}
                className="z-50 w-80 rounded-lg border border-white/15 p-2 shadow-2xl"
                style={{ background: "rgba(28, 60, 92, 0.96)", backdropFilter: "blur(10px)" }}
              >
                <input
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder={`Search ${filterBy.label.toLowerCase()}…`}
                  className="mb-2 h-7 w-full rounded-md border border-[var(--card-border)] bg-white/5 px-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
                />
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em]">
                  <button
                    type="button"
                    onClick={() => setFilterSelected([...filterOptions])}
                    className="rounded-md border border-[var(--card-border)] px-2 py-1 text-foreground hover:border-[var(--blue)]/40 hover:bg-white/5"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterSelected([])}
                    className="rounded-md border border-[var(--card-border)] px-2 py-1 text-foreground hover:border-[var(--amber)]/40 hover:bg-white/5"
                  >
                    Select none
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterSelected(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    title="Remove filter (implicit all)"
                  >
                    Reset filter
                  </button>
                </div>
                <ul className="max-h-72 overflow-y-auto">
                  {filterOptions
                    .filter(o => o.toLowerCase().includes(filterQuery.toLowerCase()))
                    .map(opt => {
                      const checked = isOptionSelected(opt);
                      return (
                        <li key={opt} className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleFilter(opt)}
                            className="flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-foreground hover:bg-white/5"
                          >
                            <span
                              className={cn(
                                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-[var(--blue)] bg-[var(--blue)]/30"
                                  : "border-[var(--card-border)] bg-transparent",
                              )}
                            >
                              {checked && <Check className="h-3 w-3" style={{ color: "var(--blue)" }} />}
                            </span>
                            <span className="truncate">{opt}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => selectOnly(opt)}
                            className="invisible mr-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-white/5 hover:text-[var(--blue)] group-hover:visible"
                            title={`Show only "${opt}"`}
                          >
                            Only
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}

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
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {filterBy && !isImplicitAll && filterSelected!.length === 0
                    ? `No ${filterBy.label.toLowerCase()} selected — open the filter to pick at least one, or hit Reset.`
                    : "No matching rows"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
