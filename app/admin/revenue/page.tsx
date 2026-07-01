import type { Metadata } from "next";
import AdminRevenueClient from "./AdminRevenueClient";

export const metadata: Metadata = {
  title: "Revenue Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminRevenuePage() {
  return <AdminRevenueClient />;
}
