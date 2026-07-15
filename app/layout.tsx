import type { Metadata } from "next";
import { Anton, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Nav } from "@/components/layout/Nav";
import { PasswordGate } from "@/components/auth/PasswordGate";
import { AUTH_COOKIE, authToken } from "@/lib/auth";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SwellWave Media × AgenCFO",
  description: "Live financial dashboard powered by AgenCFO",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const authed = store.get(AUTH_COOKIE)?.value === authToken();

  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable}`}>
      <body>
        {authed ? (
          <>
            <Suspense fallback={null}>
              <Nav />
            </Suspense>
            {children}
          </>
        ) : (
          <PasswordGate />
        )}
      </body>
    </html>
  );
}
