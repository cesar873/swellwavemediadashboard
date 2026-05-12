import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, type Tone, toneColor } from "@/lib/utils";

export interface KpiStatProps {
  label: string;
  value: string;
  tone?: Tone;
  size?: "default" | "sm";
  delta?: number | null;          // -0.123 means -12.3%
  deltaLabel?: string;            // "vs Apr 2026" or "no prior period"
  className?: string;
}

// formatting.md §1.8 — KPI tile
export function KpiStat({
  label,
  value,
  tone = "neutral",
  size = "default",
  delta,
  deltaLabel,
  className,
}: KpiStatProps) {
  const accent = toneColor(tone);
  const showDelta = delta != null && isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const deltaText = showDelta
    ? `${up ? "+" : ""}${(delta! * 100).toFixed(1)}%`
    : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] backdrop-blur",
        size === "sm" ? "px-4 py-3" : "px-5 py-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: accent }}
      />
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {label}
      </div>
      <div
        className={cn(
          "anton mt-1.5 leading-[1.1]",
          size === "sm" ? "text-[26px]" : "text-[32px]",
        )}
        style={tone !== "neutral" ? { color: accent } : undefined}
      >
        {value}
      </div>
      {(deltaText || deltaLabel) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-[color:var(--muted)] tabular-nums">
          {deltaText && (
            <>
              {up ? (
                <ArrowUp className="h-3 w-3" style={{ color: "var(--green)" }} />
              ) : (
                <ArrowDown className="h-3 w-3" style={{ color: "var(--red)" }} />
              )}
              <span style={{ color: up ? "var(--green)" : "var(--red)" }}>{deltaText}</span>
            </>
          )}
          {deltaLabel && <span className="text-[color:var(--muted)]">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
