import { unstable_cache } from "next/cache";
import { fetchDashboardData } from "./sheets";

// Cache the full dashboard data fetch for 5 minutes (formatting.md mentions
// "cached 5 minutes" in the footer; tabs.md mentions `revalidate = 300`).
export const getCachedDashboardData = unstable_cache(
  fetchDashboardData,
  ["dashboard-data:v2-clientmonths"],
  { revalidate: 300 },
);

export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY";

export const SHEET_NAME = "SwellWave Media Finance";
