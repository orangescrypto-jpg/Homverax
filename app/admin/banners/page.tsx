import type { Metadata } from "next";
import AdminBannersClient from "./AdminBannersClient";

export const metadata: Metadata = {
  title: "Homepage Banners",
  robots: { index: false, follow: false },
};

export default function AdminBannersPage() {
  return <AdminBannersClient />;
}
