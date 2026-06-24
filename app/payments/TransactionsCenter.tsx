"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { BookkeepingTxn } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { updateTransactionCategory, updateTransactionComment } from "./actions";

function fmtDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const isClarified = (t: BookkeepingTxn) => !!(t.category.trim() || t.comment.trim());

// Inline Category picker — empty = solid blue CTA, filled = subtle emerald pill.
function CategoryCell({ row, current, coa }: { row: number; current: string; coa: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (value: string) => {
    if (value === current) return;
    start(async () => {
      await updateTransactionCategory(row, value);
      router.refresh();
    });
  };
  const filled = current.trim().length > 0;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={pending}
          className={cn(
            "inline-flex max-w-[120px] items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50",
            filled
              ? "bg-[var(--green-soft)] text-[var(--green)]"
              : "bg-[var(--blue)] text-white hover:opacity-90",
          )}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <span className="truncate">{filled ? current : "Category"}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className="z-50 max-h-[280px] min-w-[200px] overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[#0b1f33] p-1 shadow-xl">
          {filled && (
            <DropdownMenu.Item onSelect={() => pick("")} className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] text-muted-foreground outline-none data-[highlighted]:bg-white/10">
              Clear category
            </DropdownMenu.Item>
          )}
          {coa.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-muted-foreground">No chart of accounts in column B.</div>
          ) : coa.map(c => (
            <DropdownMenu.Item key={c} onSelect={() => pick(c)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground outline-none data-[highlighted]:bg-white/10">
              {c === current && <Check className="h-3 w-3 text-[var(--green)]" />}
              <span className={c === current ? "" : "pl-5"}>{c}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// Inline Comment editor — empty = solid blue CTA, filled = subtle amber.
function CommentCell({ row, current }: { row: number; current: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current ?? "");
  const [pending, start] = useTransition();
  const filled = (current ?? "").trim().length > 0;
  const save = () => {
    start(async () => {
      await updateTransactionComment(row, text.trim());
      setOpen(false);
      router.refresh();
    });
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "inline-flex max-w-[120px] items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
            filled
              ? "bg-[var(--amber-soft)] text-[var(--amber)]"
              : "bg-[var(--blue)] text-white hover:opacity-90",
          )}
        >
          <span className="truncate">{filled ? current : "Comment"}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-50 w-72 rounded-lg border border-[var(--card-border)] bg-[#0b1f33] p-3 shadow-xl">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comment</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Explain this transaction…"
            className="w-full resize-y rounded-md border border-[var(--card-border)] bg-white/5 px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--blue)] focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={save} disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-[var(--blue)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TransactionsTable({ transactions, coa }: { transactions: BookkeepingTxn[]; coa: string[] }) {
  const awaiting = transactions.filter(t => !isClarified(t));
  const clarified = transactions.filter(isClarified);

  const headCell = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap";
  const cell = "px-2 py-2 align-middle";

  const Row = ({ t }: { t: BookkeepingTxn }) => (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.02]">
      <td className={cn(cell, "text-[11px] text-muted-foreground whitespace-nowrap")} style={{ width: 70 }}>{fmtDate(t.date)}</td>
      <td className={cn(cell)} style={{ maxWidth: 180 }}><span className="block truncate text-foreground" title={t.description}>{t.description || "—"}</span></td>
      <td className={cn(cell, "text-muted-foreground")} style={{ maxWidth: 120 }}><span className="block truncate" title={t.vendor}>{t.vendor || "—"}</span></td>
      <td className={cn(cell, "text-right tabular-nums font-semibold text-foreground whitespace-nowrap")} style={{ width: 80 }}>{t.amount ? formatCurrency(t.amount) : "—"}</td>
      <td className={cn(cell, "text-muted-foreground")} style={{ maxWidth: 100 }}><span className="block truncate" title={t.account}>{t.account || "—"}</span></td>
      <td className={cn(cell)} style={{ width: 130 }}><CategoryCell row={t.rowNumber} current={t.category} coa={coa} /></td>
      <td className={cn(cell)} style={{ width: 120 }}><CommentCell row={t.rowNumber} current={t.comment} /></td>
    </tr>
  );

  const SectionHead = ({ title, count, sub }: { title: string; count: number; sub: string }) => (
    <tr>
      <td colSpan={7} className="px-2 pb-1 pt-4">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--blue)]">
          {title} <span className="text-muted-foreground">· {count}</span>
        </span>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </td>
    </tr>
  );

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]">
      <thead>
        <tr>
          <th className={headCell}>Date</th>
          <th className={headCell}>Description</th>
          <th className={headCell}>Vendor</th>
          <th className={cn(headCell, "text-right")}>Amount</th>
          <th className={headCell}>Account</th>
          <th className={headCell}>Category</th>
          <th className={headCell}>Comment</th>
        </tr>
      </thead>
      <tbody>
        <SectionHead title="Awaiting clarification" count={awaiting.length} sub="Pick a category or add a comment so the bookkeeper can action it" />
        {awaiting.length === 0 ? (
          <tr><td colSpan={7} className="px-2 py-3 text-[12px] text-muted-foreground">Nothing awaiting clarification — you're all caught up.</td></tr>
        ) : awaiting.map((t, i) => <Row key={`a-${t.rowNumber}-${i}`} t={t} />)}

        <SectionHead title="Clarified" count={clarified.length} sub="Sent to the bookkeeper · they remove the row once actioned" />
        {clarified.length === 0 ? (
          <tr><td colSpan={7} className="px-2 py-3 text-[12px] text-muted-foreground">Nothing clarified yet.</td></tr>
        ) : clarified.map((t, i) => <Row key={`c-${t.rowNumber}-${i}`} t={t} />)}
      </tbody>
    </table>
  );
}

export function transactionsAwaitingCount(transactions: BookkeepingTxn[]): number {
  return transactions.filter(t => !isClarified(t)).length;
}
