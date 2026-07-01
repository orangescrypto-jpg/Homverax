"use client";

/**
 * app/find-property/FindPropertyClient.tsx
 *
 * Public form — ANY visitor (registered or not) can submit.
 * Creates a lead in the `leads` Firestore collection.
 * Pro/Premium agents see these leads in their /dashboard/leads inbox.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Building2, CheckCircle2, Home, Loader2,
  MapPin, MessageSquare, Search,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/services/leads";
import { useAuth } from "@/hooks/useAuth";
import { NIGERIAN_STATES } from "@/lib/nigerianStates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LeadType } from "@/services/leads";

const PROPERTY_TYPES: { value: LeadType; label: string; icon: React.ElementType }[] = [
  { value: "rental",     label: "House / Flat to Rent",   icon: Home },
  { value: "purchase",   label: "Buy a Property",         icon: Building2 },
  { value: "shortlet",   label: "Short Stay",             icon: MapPin },
  { value: "commercial", label: "Commercial Space",        icon: Building2 },
  { value: "service",    label: "Hire a Service",         icon: MessageSquare },
];

export default function FindPropertyClient() {
  const { user } = useAuth();

  // Form state
  const [type, setType]               = useState<LeadType>("rental");
  const [name, setName]               = useState(user?.name ?? "");
  const [phone, setPhone]             = useState(user?.phone ?? "");
  const [email, setEmail]             = useState(user?.email ?? "");
  const [state, setState]             = useState("");
  const [lga, setLga]                 = useState("");
  const [minBudget, setMinBudget]     = useState("");
  const [maxBudget, setMaxBudget]     = useState("");
  const [bedrooms, setBedrooms]       = useState("");
  const [message, setMessage]         = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Enter your name"); return; }
    if (!phone.trim() && !email.trim()) { toast.error("Enter your phone or email"); return; }
    if (!state) { toast.error("Select a state"); return; }

    setIsSubmitting(true);
    try {
      await createLead({
        name:       name.trim(),
        phone:      phone.trim() || undefined,
        email:      email.trim() || undefined,
        userId:     user?.id,
        type,
        state,
        lga:        lga.trim() || undefined,
        minBudget:  minBudget ? Number(minBudget) : undefined,
        maxBudget:  maxBudget ? Number(maxBudget) : undefined,
        bedrooms:   bedrooms ? Number(bedrooms) : undefined,
        message:    message.trim() || undefined,
        source:     "form",
      });
      setSubmitted(true);
      toast.success("Your request has been submitted!");
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Request Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Our verified agents will review your requirements and reach out within 24 hours.
          </p>
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground">What happens next:</p>
            {[
              "Verified agents matching your area review your request",
              "They'll contact you via the phone or email you provided",
              "You can also browse listings while you wait",
            ].map((step) => (
              <div key={step} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {step}
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/listings">
              <Button className="gap-2"><Search className="w-4 h-4" /> Browse Listings</Button>
            </Link>
            <Button variant="outline" onClick={() => setSubmitted(false)}>Submit Another</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Tell Us What You're Looking For
          </h1>
          <p className="text-muted-foreground">
            Submit your requirements and our verified agents will reach out with matching properties.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">

          {/* Type */}
          <div>
            <Label className="text-base font-semibold mb-3 block">I'm looking for…</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROPERTY_TYPES.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setType(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all",
                    type === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}>
                  <Icon className={cn("w-5 h-5", type === value ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium leading-tight",
                    type === value ? "text-primary" : "text-foreground"
                  )}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Your Name <span className="text-red-500">*</span></Label>
              <Input className="mt-1" placeholder="Ada Okonkwo" value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input className="mt-1" placeholder="08012345678" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input className="mt-1" placeholder="you@example.com" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>State <span className="text-red-500">*</span></Label>
              <select className="mt-1 w-full h-10 border border-input rounded-md px-3 text-sm bg-background text-foreground"
                value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select state…</option>
                {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>LGA / Area</Label>
              <Input className="mt-1" placeholder="e.g. Lekki, Victoria Island" value={lga}
                onChange={(e) => setLga(e.target.value)} />
            </div>
          </div>

          {/* Budget + bedrooms */}
          {type !== "service" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Min Budget (₦)</Label>
                <Input className="mt-1" type="number" placeholder="e.g. 500000" value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)} />
              </div>
              <div>
                <Label>Max Budget (₦)</Label>
                <Input className="mt-1" type="number" placeholder="e.g. 2000000" value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)} />
              </div>
              {["rental", "purchase", "shortlet"].includes(type) && (
                <div>
                  <Label>Bedrooms</Label>
                  <select className="mt-1 w-full h-10 border border-input rounded-md px-3 text-sm bg-background text-foreground"
                    value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
                    <option value="">Any</option>
                    {[1,2,3,4,5,6].map((n) => (
                      <option key={n} value={n}>{n}{n === 6 ? "+" : ""} bed{n !== 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <Label>Additional Details</Label>
            <Textarea className="mt-1 resize-none" rows={3}
              placeholder="Any specific requirements — furnished, parking, floor level, move-in date, etc."
              value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground">
            🔒 Your contact details are only shared with verified HomveraX agents.
            We do not sell your information.
          </p>

          <Button className="w-full h-12 font-semibold gap-2" onClick={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><Search className="w-4 h-4" /> Submit My Requirements</>
            }
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Or{" "}
          <Link href="/listings" className="text-primary font-medium hover:underline">
            browse listings directly →
          </Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}
