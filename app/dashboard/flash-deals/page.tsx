"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle, CheckCircle2, Clock, Flame,
  Loader2, PlusCircle, Tag, Trash2, X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyListings } from "@/services/listings";
import { setFlashDeal, removeFlashDeal, getActiveFlashDeals } from "@/services/flashDeals";
import { getPlatformConfig } from "@/services/platformSettings";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";
import type { FlashDeal } from "@/services/flashDeals";

function Countdown({ endsAt }: { endsAt: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setText("Ended"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setText(`${h}h ${m}m remaining`);
    };
    calc();
    const t = setInterval(calc, 30_000);
    return () => clearInterval(t);
  }, [endsAt]);
  return <span className="text-xs font-medium text-amber-600">{text}</span>;
}

export default function AgentFlashDealsPage() {
  const { user } = useAuth();
  const [listings, setListings]         = useState<PropertyListing[]>([]);
  const [myDeals, setMyDeals]           = useState<FlashDeal[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [maxDiscount, setMaxDiscount]   = useState(70);
  const [maxHours, setMaxHours]         = useState(168);
  // Create form state
  const [showForm, setShowForm]         = useState(false);
  const [selectedId, setSelectedId]     = useState("");
  const [flashPrice, setFlashPrice]     = useState("");
  const [durationH, setDurationH]       = useState("24");
  const [creating, setCreating]         = useState(false);
  const [removing, setRemoving]         = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyListings(user.id),
      getActiveFlashDeals(50),
      getPlatformConfig(),
    ]).then(([l, deals, cfg]) => {
      setListings(l.filter(li => li.status === "active"));
      setMyDeals(deals.filter(d => d.agentId === user.id));
      setFlashEnabled(cfg.features.enableFlashDeals !== false);
      setMaxDiscount(cfg.flashDealMaxDiscountPercent ?? 70);
      setMaxHours(cfg.flashDealMaxDurationHours ?? 168);
    }).finally(() => setIsLoading(false));
  }, [user]);

  const selectedListing = listings.find(l => l.id === selectedId);
  const discountPct = selectedListing && flashPrice
    ? Math.round(((selectedListing.price - Number(flashPrice)) / selectedListing.price) * 100)
    : 0;

  const handleCreate = async () => {
    if (!user || !selectedId || !flashPrice) return;
    setCreating(true);
    try {
      await setFlashDeal({
        listingId:     selectedId,
        agentId:       user.id,
        flashPrice:    Number(flashPrice),
        durationHours: Number(durationH),
      });
      toast.success("Flash deal created! It will appear on /flash-deals.");
      // Refresh
      const [l, deals] = await Promise.all([getMyListings(user.id), getActiveFlashDeals(50)]);
      setListings(l.filter(li => li.status === "active"));
      setMyDeals(deals.filter(d => d.agentId === user.id));
      setShowForm(false);
      setFlashPrice(""); setDurationH("24"); setSelectedId("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create flash deal");
    } finally { setCreating(false); }
  };

  const handleRemove = async (listingId: string) => {
    if (!user) return;
    setRemoving(listingId);
    try {
      await removeFlashDeal(listingId, user.id);
      setMyDeals(prev => prev.filter(d => d.listingId !== listingId));
      toast.success("Flash deal removed — listing price restored");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove deal");
    } finally { setRemoving(null); }
  };

  if (!flashEnabled) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <Flame className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h1 className="text-xl font-serif font-bold text-foreground mb-2">Flash Deals Disabled</h1>
          <p className="text-muted-foreground text-sm">Admin has disabled flash deals on this platform.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500" /> Flash Deals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create time-limited discounts to drive quick enquiries and sales.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 shrink-0">
          <PlusCircle className="w-4 h-4" /> Create Flash Deal
        </Button>
      </div>

      {/* Rules */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 space-y-0.5">
          <p className="font-semibold">Flash Deal Rules</p>
          <p>Max discount: <strong>{maxDiscount}%</strong> · Max duration: <strong>{maxHours}h ({Math.round(maxHours / 24)} days)</strong></p>
          <p>Flash price must be lower than current listing price. Deal expires automatically.</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border-2 border-orange-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> New Flash Deal
            </h2>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Select Listing</Label>
              <select className="mt-1 w-full h-10 border border-input rounded-md px-3 text-sm bg-background text-foreground"
                value={selectedId} onChange={e => { setSelectedId(e.target.value); setFlashPrice(""); }}>
                <option value="">Choose an active listing…</option>
                {listings
                  .filter(l => !myDeals.some(d => d.listingId === l.id))
                  .map(l => (
                    <option key={l.id} value={l.id}>
                      {l.title} — {formatCurrency(l.price)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Flash Price (₦)</Label>
                <Input type="number" className="mt-1"
                  placeholder={selectedListing ? `Max: ${formatCurrency(selectedListing.price - 1)}` : "Enter flash price"}
                  value={flashPrice} onChange={e => setFlashPrice(e.target.value)} />
                {selectedListing && flashPrice && (
                  <p className={cn("text-xs mt-1 font-semibold",
                    discountPct > maxDiscount ? "text-red-600" : "text-green-600"
                  )}>
                    {discountPct}% off
                    {discountPct > maxDiscount && ` — exceeds ${maxDiscount}% limit`}
                  </p>
                )}
              </div>
              <div>
                <Label>Duration (hours)</Label>
                <Input type="number" min={1} max={maxHours} className="mt-1"
                  value={durationH} onChange={e => setDurationH(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">
                  Max {maxHours}h ({Math.round(maxHours / 24)}d)
                </p>
              </div>
            </div>
            {selectedListing && flashPrice && Number(flashPrice) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Original:</span><span className="line-through">{formatCurrency(selectedListing.price)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Flash price:</span><span className="font-bold text-orange-600">{formatCurrency(Number(flashPrice))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expires:</span><span>{durationH}h from now</span></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleCreate}
                disabled={creating || !selectedId || !flashPrice || discountPct > maxDiscount || Number(flashPrice) <= 0}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                Create Flash Deal
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Active deals */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : myDeals.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Flame className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-foreground">No active flash deals</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a deal to appear on the <Link href="/flash-deals" className="text-primary underline">/flash-deals</Link> page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myDeals.map(deal => (
            <div key={deal.listingId} className="bg-card border-2 border-orange-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="relative w-14 h-12 rounded-lg overflow-hidden shrink-0 bg-secondary">
                {deal.images?.[0] && <Image src={deal.images[0]} alt={deal.listingTitle} fill className="object-cover" sizes="56px" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{deal.listingTitle}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm font-bold text-orange-600">{formatCurrency(deal.flashPrice)}</span>
                  <span className="text-xs text-muted-foreground line-through">{formatCurrency(deal.originalPrice)}</span>
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded">-{deal.discountPercent}%</span>
                </div>
                <Countdown endsAt={deal.endsAt} />
              </div>
              <Button size="sm" variant="outline"
                className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 shrink-0"
                disabled={removing === deal.listingId}
                onClick={() => handleRemove(deal.listingId)}>
                {removing === deal.listingId
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                End Deal
              </Button>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
