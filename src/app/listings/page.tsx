import type { Metadata } from "next";
import ListingsClient from "./ListingsClient";

export const metadata: Metadata = {
  title: "Browse Property Listings",
  description:
    "Search thousands of verified properties across Nigeria — apartments, houses, land, shortlets and services. Filter by location, price, and more.",
  openGraph: {
    title: "Browse Properties | HomveraX",
    description: "Find verified properties and services across Nigeria.",
  },
};

export default function ListingsPage() {
  return <ListingsClient />;
}
