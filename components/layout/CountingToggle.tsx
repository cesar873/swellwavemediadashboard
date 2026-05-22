"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";

export type CountingMode = "engagement" | "unique";

export interface CountingToggleProps {
  value: CountingMode;
}

// Used on the Analytics page. URL param: ?counting=engagement|unique
// Default is "unique" — matches the screenshot.
export function CountingToggle({ value }: CountingToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pick = useCallback(
    (next: CountingMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "unique") params.delete("counting");
      else params.set("counting", next);
      const qs = params.toString();
      startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`));
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        Counting
      </span>
      <div className="inline-flex rounded-md border border-[var(--card-border)] bg-white/5 p-0.5">
        <button
          type="button"
          onClick={() => pick("engagement")}
          disabled={pending}
          className={cn(
            "h-7 rounded px-3 text-[11px] font-medium uppercase tracking-[0.08em] transition",
            value === "engagement"
              ? "bg-[var(--blue-soft)] text-[var(--blue)]"
              : "text-[color:var(--muted)] hover:text-foreground",
          )}
        >
          By engagement
        </button>
        <button
          type="button"
          onClick={() => pick("unique")}
          disabled={pending}
          className={cn(
            "h-7 rounded px-3 text-[11px] font-medium uppercase tracking-[0.08em] transition",
            value === "unique"
              ? "bg-[var(--blue-soft)] text-[var(--blue)]"
              : "text-[color:var(--muted)] hover:text-foreground",
          )}
        >
          By unique client
        </button>
      </div>
    </div>
  );
}
