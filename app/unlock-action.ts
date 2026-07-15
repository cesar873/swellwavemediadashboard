"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken, dashboardPassword } from "@/lib/auth";

export interface UnlockState {
  error: string | null;
}

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const pw = String(formData.get("password") ?? "");
  if (pw && pw === dashboardPassword()) {
    const store = await cookies();
    store.set(AUTH_COOKIE, authToken(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    redirect("/financials");
  }
  return { error: "Incorrect password. Try again." };
}
