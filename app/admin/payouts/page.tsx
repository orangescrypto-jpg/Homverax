import type { Metadata } from "next";
import AdminPayoutsClient from "./AdminPayoutsClient";

export const metadata: Metadata = {
  title: "Seller Payouts",
  robots: { index: false, follow: false },
};

export default function AdminPayoutsPage() {
  return <AdminPayoutsClient />;
}
