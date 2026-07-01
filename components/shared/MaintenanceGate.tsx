"use client";

/**
 * components/shared/MaintenanceGate.tsx
 *
 * Wraps the entire app. If admin sets maintenanceMode = true in
 * platformSettings/config, all non-admin visitors see a maintenance
 * page instead of the real site.
 *
 * Admins (role === "admin") always bypass — so they can still preview
 * and manage the site while it's down.
 */

import { useEffect, useState } from "react";
import { Wrench, Clock, Building2 } from "lucide-react";
import { getPlatformConfig } from "@/services/platformSettings";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
}

export default function MaintenanceGate({ children }: Props) {
  const { user } = useAuth();
  const [inMaintenance, setInMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getPlatformConfig()
      .then((cfg) => setInMaintenance(cfg.features.maintenanceMode === true))
      .catch(() => setInMaintenance(false))
      .finally(() => setChecked(true));
  }, []);

  // Don't flash maintenance page before we've checked — just show children
  if (!checked) return <>{children}</>;

  // Admins always bypass maintenance mode
  if (!inMaintenance || user?.role === "admin") return <>{children}</>;

  // ── Maintenance Page ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-serif font-semibold text-foreground">
            Homvera<span className="text-accent font-bold">X</span>
          </span>
        </div>

        {/* Icon */}
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-9 h-9 text-primary animate-pulse" />
        </div>

        <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
          We'll be back soon
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          HomveraX is currently undergoing scheduled maintenance to improve
          your experience. We apologise for the inconvenience.
        </p>

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full px-4 py-2 text-sm font-semibold mb-8">
          <Clock className="w-4 h-4" />
          Maintenance in progress
        </div>

        {/* Contact line */}
        <p className="text-sm text-muted-foreground">
          For urgent enquiries contact us at{" "}
          <a
            href="mailto:hello@homverax.com"
            className="text-primary font-medium hover:underline"
          >
            hello@homverax.com
          </a>
        </p>

        {/* Admin hint */}
        <p className="mt-8 text-xs text-muted-foreground/50">
          Are you an admin?{" "}
          <a href="/login" className="underline hover:text-muted-foreground">
            Sign in
          </a>{" "}
          to bypass maintenance mode.
        </p>
      </div>
    </div>
  );
}
