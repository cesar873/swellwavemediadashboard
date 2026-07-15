"use client";

import { useActionState } from "react";
import { unlock, type UnlockState } from "@/app/unlock-action";

const initial: UnlockState = { error: null };

export function PasswordGate() {
  const [state, formAction, pending] = useActionState(unlock, initial);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--card-border)] bg-white/[0.03] p-8 backdrop-blur-sm">
        <div className="agencfo-logo text-center text-[26px]">
          <span className="client">SWELLWAVE MEDIA</span>
          <span className="x">×</span>
          <span className="agen">AGEN</span><span className="cfo">CFO</span>
        </div>

        <h1 className="anton mt-6 text-center text-[22px] tracking-[0.08em]">Restricted access</h1>
        <p className="mt-1 text-center text-[13px] text-muted-foreground">
          Enter password to view the dashboard
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--blue)]/40 bg-white/5 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--blue)] focus:outline-none"
          />
          {state.error && (
            <p className="text-[12px] text-[var(--red)]">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--blue)] px-4 py-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
