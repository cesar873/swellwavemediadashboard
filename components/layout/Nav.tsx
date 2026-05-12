"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// formatting.md §1.5 — top navigation. Phase 1 = Financials · Revenue · Expenses
// + Clients (Phase 3 table-only, no drilldown). Add Analytics + People when their data lands.
const NAV_ITEMS = [
  { href: "/financials",    label: "Financials" },
  { href: "/revenue",       label: "Revenue" },
  { href: "/expenses",      label: "Expenses" },
  { href: "/client-profit", label: "Clients" },
];

const GLOBAL_PARAMS = ["months", "from", "to"];

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
      <div className="border-b border-[var(--card-border)] bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-black/20">
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
