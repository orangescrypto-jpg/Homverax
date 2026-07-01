"use client";

import { useAuth } from "@/hooks/useAuth";
import AgentDashboard from "./AgentDashboard";
import TenantDashboard from "./TenantDashboard";
import ServiceProviderDashboard from "./ServiceProviderDashboard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Loader2 } from "lucide-react";

/**
 * /dashboard — routes to the correct dashboard component by role.
 *
 * agent / landlord     → AgentDashboard
 * tenant               → TenantDashboard
 * service_provider     → ServiceProviderDashboard
 * admin / moderator    → redirect handled by DashboardLayout → /admin
 */
export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const role = user.role ?? "tenant";

  if (role === "agent" || role === "landlord") {
    return <AgentDashboard />;
  }

  if (role === "service_provider") {
    return <ServiceProviderDashboard />;
  }

  // tenant (default)
  return <TenantDashboard />;
}
