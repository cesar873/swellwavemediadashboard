import { cn } from "@/lib/utils";

export interface PageHeroProps {
  eyebrow: string;
  title: string;
  period?: string;
  source?: string;
  className?: string;
}

// formatting.md §1.4 — every non-auth page starts with this
export function PageHero({ eyebrow, title, period, source, className }: PageHeroProps) {
  const subline =
    period && source
      ? `${period} · live from ${source}`
      : period || source || null;

  return (
    <div className={cn("mb-6", className)}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {eyebrow}
      </div>
      <h1 className="anton mt-1 text-[40px] leading-[1] md:text-[44px]">
        {title}
      </h1>
      {subline && (
        <div className="mt-2 text-[12px] text-[color:var(--muted)]">{subline}</div>
      )}
    </div>
  );
}
