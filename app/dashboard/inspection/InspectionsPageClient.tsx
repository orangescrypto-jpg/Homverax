"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, CheckCircle2, XCircle, MapPin, Phone, ChevronDown, Plus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  getBuyerInspections, getSellerInspections,
  approveInspection, rejectInspection, cancelInspection,
  type InspectionBooking,
} from "@/services/inspections";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG = {
  requested:  { label: "Pending",   color: "bg-yellow-100 text-yellow-700",  icon: Clock },
  approved:   { label: "Confirmed", color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  rejected:   { label: "Rejected",  color: "bg-red-100 text-red-700",        icon: XCircle },
  completed:  { label: "Done",      color: "bg-blue-100 text-blue-700",      icon: CheckCircle2 },
  cancelled:  { label: "Cancelled", color: "bg-secondary text-muted-foreground", icon: XCircle },
};

export default function InspectionsPageClient() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"buyer" | "seller">("buyer");
  const [bookings, setBookings] = useState<InspectionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [sellerNotes, setSellerNotes] = useState<Record<string, string>>({});
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = tab === "buyer"
        ? await getBuyerInspections(user.id)
        : await getSellerInspections(user.id);
      setBookings(data);
    } catch { toast.error("Failed to load inspections"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [tab, user]);

  const handleApprove = async (b: InspectionBooking) => {
    const date = selectedDates[b.id];
    if (!date) { toast.error("Select a confirmed date"); return; }
    setActing(b.id);
    try {
      await approveInspection(b.id, date, sellerNotes[b.id]);
      setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "approved", confirmedDate: date } : x));
      toast.success("Inspection confirmed!");
    } catch { toast.error("Failed to approve"); }
    finally { setActing(null); }
  };

  const handleReject = async (b: InspectionBooking) => {
    setActing(b.id);
    try {
      await rejectInspection(b.id, sellerNotes[b.id]);
      setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "rejected" } : x));
      toast.success("Inspection rejected");
    } catch { toast.error("Failed to reject"); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    setActing(id);
    try {
      await cancelInspection(id);
      setBookings((prev) => prev.map((x) => x.id === id ? { ...x, status: "cancelled" } : x));
      toast.success("Inspection cancelled");
    } catch { toast.error("Failed to cancel"); }
    finally { setActing(null); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" /> Inspections
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage property inspection bookings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-fit">
        {[
          { id: "buyer",  label: "My Requests" },
          { id: "seller", label: "Requests for My Listings" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-card shadow text-foreground" : "text-muted-foreground"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No inspection bookings yet</p>
          {tab === "buyer" && <p className="text-sm mt-1">Browse listings and request an inspection</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const cfg = STATUS_CONFIG[b.status];
            const Icon = cfg.icon;
            return (
              <div key={b.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{b.listingTitle}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {b.listingAddress}
                    </p>
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1", cfg.color)}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                </div>

                {/* Proposed dates */}
                <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {tab === "buyer" ? "Your proposed dates:" : "Buyer proposed dates:"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {b.proposedDates.map((d, i) => (
                      <div key={i} className={cn(
                        "text-xs px-2 py-1 rounded-lg border font-medium",
                        b.confirmedDate === d ? "bg-green-50 border-green-300 text-green-700" : "bg-card border-border text-foreground"
                      )}>
                        {new Date(d).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {b.confirmedDate === d && " ✓"}
                      </div>
                    ))}
                  </div>
                  {b.buyerNote && <p className="text-xs text-muted-foreground mt-2">Note: {b.buyerNote}</p>}
                </div>

                {/* Contact info */}
                {tab === "seller" && b.status === "requested" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Phone className="w-3 h-3" />
                    <span>Buyer: {b.buyerName} · {b.buyerPhone}</span>
                  </div>
                )}

                {/* Seller actions */}
                {tab === "seller" && b.status === "requested" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Select confirmed date</Label>
                      <select
                        className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        value={selectedDates[b.id] ?? ""}
                        onChange={(e) => setSelectedDates((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      >
                        <option value="">Choose a date…</option>
                        {b.proposedDates.map((d, i) => (
                          <option key={i} value={d}>
                            {new Date(d).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Textarea
                      placeholder="Note to buyer (optional)…"
                      className="h-16 resize-none text-xs"
                      value={sellerNotes[b.id] ?? ""}
                      onChange={(e) => setSellerNotes((prev) => ({ ...prev, [b.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => handleApprove(b)} disabled={acting === b.id}>
                        <CheckCircle2 className="w-3 h-3" /> Confirm Date
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                        onClick={() => handleReject(b)} disabled={acting === b.id}>
                        <XCircle className="w-3 h-3" /> Decline
                      </Button>
                    </div>
                  </div>
                )}

                {/* Buyer cancel */}
                {tab === "buyer" && b.status === "requested" && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                    onClick={() => handleCancel(b.id)} disabled={acting === b.id}>
                    <XCircle className="w-3 h-3" /> Cancel Request
                  </Button>
                )}

                {/* Confirmed info */}
                {b.status === "approved" && b.confirmedDate && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-green-800">Inspection Confirmed</p>
                      <p className="text-xs text-green-700">
                        {new Date(b.confirmedDate).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {b.sellerNote && <p className="text-xs text-green-700 mt-1">{b.sellerNote}</p>}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">{timeAgo(b.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
