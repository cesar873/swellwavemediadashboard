"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";

export type Scope = "month" | "range" | "ytd";

export interface ScopeToggleProps {
  value: Scope;
  monthLabel: string;        // "Apr 2026"
  rangeLabel: string;        // "Apr → Jun 2026 (3 mo)"
  ytdLabel: string;          // "YTD · Jan → Apr 2026 (4 mo)"
  className?: string;
}

const OPTIONS: { value: Scope; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "range", label: "Range" },
  { value: "ytd",   label: "YTD"   },
];

export function ScopeToggle({ value, monthLabel, rangeLabel, ytdLabel, className }: ScopeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pick = useCallback(
    (next: Scope) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "range") params.delete("scope");
      else params.set("scope", next);
      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`));
    },
    [pathname, router, searchParams],
  );

  const subline =
    value === "month" ? monthLabel
    : value === "ytd" ? ytdLabel
    : rangeLabel;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
        Scope
      </span>
      <div className="inline-flex overflow-hidden rounded-md border border-[var(--card-border)]">
        {OPTIONS.map((opt, i) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => pick(opt.value)}
              disabled={pending}
              className={cn(
                "h-7 px-3 text-[11px] font-medium uppercase tracking-[0.08em] transition",
                i > 0 && "border-l border-[var(--card-border)]",
                active
                  ? "bg-[var(--blue-soft)] text-[var(--blue)]"
                  : "text-[color:var(--muted)] hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{subline}</span>
    </div>
  );
}
