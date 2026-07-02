"use client";

import { useEffect, useState } from "react";

export interface CountdownResult {
  /** true once expiresAt has passed (or is missing) */
  expired: boolean;
  /** compact human label, e.g. "2d 04h" or "03:59:12" */
  label: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Ticking countdown to a given ISO timestamp. Updates every second.
 * Returns expired=true immediately if expiresAt is missing or already past.
 */
export function useCountdown(expiresAt?: string | null): CountdownResult {
  const target = expiresAt ? new Date(expiresAt).getTime() : NaN;

  const compute = (): CountdownResult => {
    if (!expiresAt || Number.isNaN(target)) {
      return { expired: true, label: "", days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const diff = target - Date.now();
    if (diff <= 0) {
      return { expired: true, label: "Expired", days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const pad = (n: number) => String(n).padStart(2, "0");
    const label =
      days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
        : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    return { expired: false, label, days, hours, minutes, seconds };
  };

  const [state, setState] = useState<CountdownResult>(compute);

  useEffect(() => {
    if (!expiresAt || Number.isNaN(target)) {
      setState({ expired: true, label: "", days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }
    setState(compute());
    const interval = setInterval(() => {
      setState(compute());
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return state;
}
