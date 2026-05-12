import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface CardShellProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  fillParent?: boolean;
}

// formatting.md §1.8 — Chart shell
export function CardShell({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
  fillParent,
}: CardShellProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm",
        fillParent && "flex h-full flex-col",
        className,
      )}
    >
      {(title || subtitle || right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={cn(fillParent && "flex-1 min-h-0", bodyClassName)}>{children}</div>
    </div>
  );
}
