"use client";

import { useEffect, useState, useRef } from "react";
import { BadgeCheck, CheckCircle2, Clock, FileText, Loader2, Shield, Upload, X } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitVerification, getMyVerification } from "@/services/verification";
import { getPlatformConfig } from "@/services/platformSettings";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { VerificationRequest } from "@/types";

const STATUS_CONFIG = {
  none:     { icon: Shield,        label: "Not Applied",    color: "text-muted-foreground" },
  pending:  { icon: Clock,         label: "Under Review",   color: "text-yellow-600" },
  approved: { icon: CheckCircle2,  label: "Verified",       color: "text-green-600" },
  rejected: { icon: X,             label: "Rejected",       color: "text-red-600" },
};

const BENEFITS = [
  "Verified badge on all your listings",
  "3× more inquiries on average",
  "Featured in verified agent directory",
  "Higher search ranking",
  "Client trust & conversion boost",
];

export default function VerificationPage() {
  const { user } = useAuth();
  const [verification, setVerification] = useState<VerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationFee, setVerificationFee] = useState(2500);
  const [bvn, setBvn] = useState("");
  const [nin, setNin] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyVerification(user.id),
      getPlatformConfig(),
    ])
      .then(([v, cfg]) => {
        setVerification(v);
        setVerificationFee(cfg.verificationPrices.agent);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!bvn || bvn.length < 10) { toast.error("Enter a valid BVN"); return; }
    if (!idDoc) { toast.error("Upload your government-issued ID"); return; }
    setIsSubmitting(true);
    try {
      const result = await submitVerification({
        userId: user.id, userName: user.name, userEmail: user.email,
        type: "agent", bvn, nin: nin || undefined,
        idDocument: idDoc, selfie: selfie ?? undefined,
        amountPaid: verificationFee,
      });
      setVerification(result);
      toast.success("Verification submitted! We'll review within 1–2 business days.");
    } catch { toast.error("Submission failed. Please try again."); }
    finally { setIsSubmitting(false); }
  };

  const status = user?.verificationStatus ?? "none";
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground">Get Verified</h1>
          <p className="text-muted-foreground text-sm mt-1">Verify your identity to build trust and get more clients.</p>
        </div>

        <div className={`bg-card border-2 rounded-2xl p-5 mb-8 flex items-center gap-4 ${
          status === "approved" ? "border-green-200 bg-green-50/50" :
          status === "pending" ? "border-yellow-200 bg-yellow-50/50" :
          status === "rejected" ? "border-red-200 bg-red-50/50" : "border-border"
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status === "approved" ? "bg-green-100" :
            status === "pending" ? "bg-yellow-100" :
            status === "rejected" ? "bg-red-100" : "bg-secondary"
          }`}>
            <StatusIcon className={`w-6 h-6 ${cfg.color}`} />
          </div>
          <div>
            <p className="font-semibold text-foreground">{cfg.label}</p>
            <p className="text-sm text-muted-foreground">
              {status === "approved" && "Your identity is verified. Enjoy full platform benefits!"}
              {status === "pending" && "We're reviewing your submission. 1–2 business days."}
              {status === "rejected" && (verification?.rejectionReason ?? "Your submission was rejected. Please reapply.")}
              {status === "none" && `One-time fee of ${formatCurrency(verificationFee)}`}
            </p>
          </div>
        </div>

        {status !== "approved" && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Benefits of Verification</h3>
            </div>
            <ul className="space-y-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(status === "none" || status === "rejected") && !isLoading && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h3 className="font-semibold text-foreground">Submit Verification Documents</h3>
            <div>
              <Label>BVN *</Label>
              <Input className="mt-1.5" placeholder="11-digit BVN" maxLength={11} value={bvn} onChange={(e) => setBvn(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label>NIN (optional but recommended)</Label>
              <Input className="mt-1.5" placeholder="National Identification Number" value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label>Government-Issued ID *</Label>
              <div onClick={() => idRef.current?.click()} className={`mt-1.5 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${idDoc ? "border-green-300 bg-green-50/50" : "border-border hover:border-primary/40"}`}>
                {idDoc ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                    <FileText className="w-4 h-4" />{idDoc.name}
                    <button onClick={(e) => { e.stopPropagation(); setIdDoc(null); }}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Upload NIN slip, passport, or driver's license</p>
                  </>
                )}
              </div>
              <input ref={idRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>Selfie (optional)</Label>
              <div onClick={() => selfieRef.current?.click()} className={`mt-1.5 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${selfie ? "border-green-300 bg-green-50/50" : "border-border hover:border-primary/40"}`}>
                {selfie ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                    <FileText className="w-4 h-4" />{selfie.name}
                    <button onClick={(e) => { e.stopPropagation(); setSelfie(null); }}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <><Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Upload a clear selfie</p></>
                )}
              </div>
              <input ref={selfieRef} type="file" accept="image/*" className="hidden" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">One-time fee</p>
                <p className="text-xl font-serif font-bold text-primary">{formatCurrency(verificationFee)}</p>
              </div>
              <Button className="gap-2 px-6" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Submit & Pay
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
