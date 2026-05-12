"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoToLabel } from "@/lib/period";

export interface GlobalFiltersBarProps {
  monthsIso: string[];           // full window of months in the sheet
  latestActualIso: string;
  fromIso: string;
  toIso: string;
  monthsParam: number | null;    // if user picked "?months=N"
}

const MONTH_SHORTCUTS = [1, 3, 6, 12];

export function GlobalFiltersBar(props: GlobalFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pushParams = useCallback(
    (mut: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mut(params);
      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`));
    },
    [pathname, router, searchParams],
  );

  const onPickMonths = (n: number | null) => {
    pushParams(p => {
      p.delete("from");
      p.delete("to");
      if (n) p.set("months", String(n));
      else p.delete("months");
    });
  };

  const onPickFrom = (iso: string) => {
    pushParams(p => {
      p.delete("months");
      p.set("from", iso);
      if (!p.get("to")) p.set("to", props.toIso);
    });
  };

  const onPickTo = (iso: string) => {
    pushParams(p => {
      p.delete("months");
      p.set("to", iso);
      if (!p.get("from")) p.set("from", props.fromIso);
    });
  };

  const onRefresh = async () => {
    try {
      await fetch("/api/refresh", { method: "POST" });
    } catch {
      // ignore
    }
    startTransition(() => router.refresh());
  };

  // Phase 2: every month in the sheet is selectable. Forecast months (past
  // latestActualIso) carry a marker so the user knows what they're picking.
  const options = props.monthsIso.map(iso => ({
    iso,
    isForecast: iso > props.latestActualIso,
  }));

  return (
    <div className="sticky top-[68px] z-20 border-b border-[var(--card-border)] backdrop-blur" style={{ background: "rgba(0, 21, 40, 0.55)" }}>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-9 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Filters
        </span>

        <div className="flex items-center gap-1">
          {MONTH_SHORTCUTS.map(n => {
            const active = props.monthsParam === n;
            return (
              <button
                key={n}
                onClick={() => onPickMonths(n)}
                disabled={pending}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] transition",
                  active
                    ? "bg-[var(--blue-soft)] text-[var(--blue)] border border-[var(--blue)]/40"
                    : "border border-[var(--card-border)] text-[color:var(--muted)] hover:text-foreground",
                )}
              >
                {n}M
              </button>
            );
          })}
          <button
            onClick={() => onPickMonths(null)}
            disabled={pending}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] transition",
              props.monthsParam === null && !searchParams.get("from") && !searchParams.get("to")
                ? "bg-[var(--blue-soft)] text-[var(--blue)] border border-[var(--blue)]/40"
                : "border border-[var(--card-border)] text-[color:var(--muted)] hover:text-foreground",
            )}
          >
            All
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">From</span>
          <select
            value={props.fromIso}
            onChange={e => onPickFrom(e.target.value)}
            className="h-7 rounded-md border border-[var(--card-border)] bg-white/5 px-2 text-[11px] tabular-nums text-foreground focus:border-[var(--blue)] focus:outline-none"
          >
            {options.map(o => (
              <option key={o.iso} value={o.iso}>
                {isoToLabel(o.iso)}{o.isForecast ? " · forecast" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[color:var(--muted)]">→</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">To</span>
          <select
            value={props.toIso}
            onChange={e => onPickTo(e.target.value)}
            className="h-7 rounded-md border border-[var(--card-border)] bg-white/5 px-2 text-[11px] tabular-nums text-foreground focus:border-[var(--blue)] focus:outline-none"
          >
            {options.map(o => (
              <option key={o.iso} value={o.iso}>
                {isoToLabel(o.iso)}{o.isForecast ? " · forecast" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[color:var(--muted)]">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Last actuals
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {isoToLabel(props.latestActualIso)}
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={pending}
          title="Force-refresh from Google Sheets"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--card-border)] text-[color:var(--muted)] transition hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}
