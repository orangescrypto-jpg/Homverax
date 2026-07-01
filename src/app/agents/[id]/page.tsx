import type { Metadata } from "next";
import AgentProfileClient from "./AgentProfileClient";
import { APP_NAME } from "@/lib/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return {
    title: `Agent Profile | ${APP_NAME}`,
    description: `View this agent's listings, verification status, and client reviews on ${APP_NAME}.`,
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentProfileClient agentId={id} />;
}
