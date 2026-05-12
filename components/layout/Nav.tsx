"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// formatting.md §1.5 + tabs.md §"Navigation order". Phase 1 only for now
// (Analytics / Clients / People are deferred until their data sources are
// confirmed). The pages still exist at /analytics, /client-profit and
// /people-profit — they're just not linked from the nav.
const NAV_ITEMS = [
  { href: "/financials", label: "Financials" },
  { href: "/revenue",    label: "Revenue" },
  { href: "/expenses",   label: "Expenses" },
];

const GLOBAL_PARAMS = ["months", "from", "to", "month"];

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const persisted = new URLSearchParams();
  for (const key of GLOBAL_PARAMS) {
    const v = searchParams.get(key);
    if (v) persisted.set(key, v);
  }
  const qs = persisted.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <header className="sticky top-0 z-30">
      <div className="border-b border-[var(--card-border)] backdrop-blur" style={{ background: "rgba(0, 21, 40, 0.7)" }}>
        <div className="mx-auto flex max-w-[1400px] items-center px-9 py-5">
          <Link href={`/financials${suffix}`} className="agencfo-logo">
            <span className="client">SWELLWAVE MEDIA</span>
            <span className="x">×</span>
            <span className="agen">AGEN</span><span className="cfo">CFO</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 overflow-x-auto md:gap-0">
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${suffix}`}
                  className={cn(
                    "relative anton text-[15px] tracking-[1.5px] px-5 py-3",
                    "max-md:text-xs max-md:px-3 max-md:py-1.5 max-md:tracking-[1px]",
                    active ? "text-[color:var(--blue)]" : "text-[color:var(--muted)] hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="pointer-events-none absolute -bottom-px left-3 right-3 h-[2px] bg-[var(--blue)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
