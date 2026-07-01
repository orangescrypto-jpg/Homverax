import type { Metadata } from "next";
import AdminSettingsClient from "./AdminSettingsClient";

export const metadata: Metadata = {
  title: "Platform Settings",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return <AdminSettingsClient />;
}
