import { cn } from "@/lib/utils";

export interface SectionTitleProps {
  label: string;
  hint?: string;
  className?: string;
}

/** Small uppercase divider used above grouped KPI strips
 *  ("MONTH SNAPSHOT · APR 2026" / "RANGE · APR → JUN 2026"). */
export function SectionTitle({ label, hint, className }: SectionTitleProps) {
  return (
    <div className={cn("mb-2 mt-4 flex items-center gap-3", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </span>
      {hint && (
        <span
          className="rounded-full border border-[var(--amber)]/40 bg-[var(--warning-bg)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--amber)" }}
        >
          {hint}
        </span>
      )}
      <span className="h-px flex-1 bg-[var(--card-border)]" />
    </div>
  );
}
