import type { Metadata } from "next";
import { Anton, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { Nav } from "@/components/layout/Nav";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable}`}>
      <body>
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
