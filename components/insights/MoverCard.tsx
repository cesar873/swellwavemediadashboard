import { ArrowDown, ArrowUp } from "lucide-react";
import { formatLong } from "../charts/chart-shared";
import { cn } from "@/lib/utils";

export interface MoverItem {
  name: string;
  current: number;
  prior: number;
}

export interface MoverCardProps {
  title: string;             // "Top growers" | "Top decliners"
  subtitle?: string;         // "Comparing Apr vs Mar"
  items: MoverItem[];        // already sorted
  variant: "grower" | "decliner";
  max?: number;              // visual max for bar scaling
}

// formatting.md §2.B.11 — comparable to side-by-side scorecard cards.
export function MoverCard({ title, subtitle, items, variant, max }: MoverCardProps) {
  const accent = variant === "grower" ? "var(--green)" : "var(--red)";
  const accentSoft = variant === "grower" ? "var(--green-soft)" : "var(--red-soft)";
  const Icon = variant === "grower" ? ArrowUp : ArrowDown;
  const maxAbs = max ?? Math.max(1, ...items.map(i => Math.abs(i.current - i.prior)));

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/30 p-5 backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: accentSoft, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {subtitle && <p className="mb-3 text-[11px] text-muted-foreground">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No qualifying movers in this period.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(it => {
            const delta = it.current - it.prior;
            const pct = it.prior !== 0 ? (delta / Math.abs(it.prior)) * 100 : null;
            const w = Math.round((Math.abs(delta) / maxAbs) * 100);
            return (
              <li key={it.name} className="flex items-center gap-3 text-[13px]">
                <span className="flex-1 truncate font-medium text-foreground">{it.name}</span>
                <span className="relative inline-block h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${w}%`, background: accent, opacity: 0.85 }}
                  />
                </span>
                <span className={cn("w-20 text-right font-semibold tabular-nums")} style={{ color: accent }}>
                  {delta >= 0 ? "+" : ""}
                  {formatLong(Math.abs(delta), "currency")}
                </span>
                <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
                  {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
