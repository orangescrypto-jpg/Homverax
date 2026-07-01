import type { Metadata } from "next";
import AdminSubscriptionsClient from "./AdminSubscriptionsClient";

export const metadata: Metadata = {
  title: "Subscription Payments",
  robots: { index: false, follow: false },
};

export default function AdminSubscriptionsPage() {
  return <AdminSubscriptionsClient />;
}
