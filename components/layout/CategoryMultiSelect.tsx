"use client";

import * as Popover from "@radix-ui/react-popover";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoryMultiSelectProps {
  /** URL param name (e.g. "cats", "depts"). */
  paramName: string;
  /** Display label shown to the left of the trigger. */
  label: string;
  /** All available options. */
  options: string[];
  /** Currently selected (resolved from URL). Empty array == "all selected". */
  selected: string[];
}

export function CategoryMultiSelect({ paramName, label, options, selected }: CategoryMultiSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allSelected = selected.length === 0 || selected.length === options.length;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const push = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0 || next.length === options.length) {
        params.delete(paramName);
      } else {
        params.set(paramName, next.join(","));
      }
      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`));
    },
    [pathname, router, searchParams, paramName, options.length],
  );

  const toggle = (opt: string) => {
    const isAllImplicit = selected.length === 0;
    const current = isAllImplicit ? [...options] : [...selected];
    const i = current.indexOf(opt);
    if (i >= 0) current.splice(i, 1);
    else current.push(opt);
    push(current);
  };

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  const buttonLabel = allSelected
    ? `All ${options.length}`
    : `${selected.length} of ${options.length}`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
          {label}
        </span>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={pending}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-white/5 px-2.5 text-[11px] font-medium text-foreground transition",
              "hover:border-[var(--blue)]/40 focus:border-[var(--blue)] focus:outline-none",
              !allSelected && "border-[var(--blue)]/40 bg-[var(--blue-soft)]/30 text-[var(--blue)]",
            )}
          >
            <span className="tabular-nums">{buttonLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </Popover.Trigger>
        {!allSelected && (
          <button
            type="button"
            onClick={() => push([])}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--card-border)] px-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
            title="Reset to all"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-72 rounded-lg border border-white/15 p-2 shadow-2xl"
          style={{ background: "rgba(28, 60, 92, 0.96)", backdropFilter: "blur(10px)" }}
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="mb-2 h-7 w-full rounded-md border border-[var(--card-border)] bg-white/5 px-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
          />
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <button
              type="button"
              onClick={() => push([...options])}
              className="hover:text-foreground"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => push(["__none__"])}
              className="hover:text-foreground"
              title="Show none — effectively clears all charts"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-2 py-1.5 text-[12px] text-muted-foreground">No matches.</li>
            )}
            {filtered.map(opt => {
              const checked = allSelected || selectedSet.has(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-foreground hover:bg-white/5"
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
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
