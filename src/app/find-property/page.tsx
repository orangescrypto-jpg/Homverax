import type { Metadata } from "next";
import FindPropertyClient from "./FindPropertyClient";

export const metadata: Metadata = {
  title: "Find a Property — Tell Us What You Need",
  description:
    "Submit your property requirements and get matched with verified agents and listings on HomveraX.",
};

export default function FindPropertyPage() {
  return <FindPropertyClient />;
}
