import type { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: `${APP_NAME} — Nigeria's Trusted Property & Services Marketplace`,
  description: APP_DESCRIPTION,
  openGraph: {
    title: `${APP_NAME} — Find, Buy, Rent & Transact Safely`,
    description: APP_DESCRIPTION,
  },
};

export default function HomePage() {
  return <HomeClient />;
}
