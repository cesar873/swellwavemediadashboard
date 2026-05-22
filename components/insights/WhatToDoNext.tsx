import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightType = "win" | "info" | "warn" | "alert";

export interface Insight {
  type: InsightType;
  text: string;
}

export interface WhatToDoNextProps {
  periodLabel: string;
  insights: Insight[];
  className?: string;
}

// Sort: alert → warn → win → info (formatting.md §3.3)
const ORDER: Record<InsightType, number> = { alert: 0, warn: 1, win: 2, info: 3 };

const ICONS: Record<InsightType, typeof Info> = {
  win:   CheckCircle2,
  info:  Info,
  warn:  AlertTriangle,
  alert: AlertOctagon,
};

const COLORS: Record<InsightType, string> = {
  win:   "var(--green)",
  info:  "var(--blue)",
  warn:  "var(--amber)",
  alert: "var(--red)",
};

export function WhatToDoNext({ periodLabel, insights, className }: WhatToDoNextProps) {
  const sorted = [...insights].sort((a, b) => ORDER[a.type] - ORDER[b.type]).slice(0, 5);
  if (!sorted.length) return null;

  return (
    <div
      className={cn(
        "mb-6 rounded-2xl border border-[var(--blue)]/20 bg-gradient-to-br from-[var(--blue-soft)]/30 to-transparent p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="anton inline-flex items-center rounded-full border border-[var(--blue)] px-3 py-0.5 text-[11px] tracking-[0.18em] text-[var(--blue)]">
          INSIGHTS
        </span>
        <h2 className="anton text-[18px] tracking-[0.08em] text-foreground">
          What to do next · {periodLabel}
        </h2>
      </div>
      <ul className="flex flex-col gap-2.5">
        {sorted.map((ins, i) => {
          const Icon = ICONS[ins.type];
          const color = COLORS[ins.type];
          return (
            <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.5]">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
              <span
                className="text-foreground/90"
                dangerouslySetInnerHTML={{
                  __html: ins.text.replace(
                    /([+-]?\$?[\d,]+\.?\d*[Kk%pp×]?)/g,
                    '<strong class="text-foreground tabular-nums">$1</strong>',
                  ),
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
