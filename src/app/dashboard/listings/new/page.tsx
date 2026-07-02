"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2, Wrench, Upload, X, ChevronRight,
  ChevronLeft, CheckCircle2, MapPin, DollarSign,
  Image as ImageIcon, Info, AlertTriangle, Loader2,
  Home, Briefcase, ShieldCheck, Sofa, Star, Hammer,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createListing } from "@/services/listings";
import { checkDuplicateListing, addWatermarkToFiles } from "@/services/listingGuard";
import { getPlatformConfig } from "@/services/platformSettings";
import { getUserPlanStatus } from "@/services/subscriptions";
import type { PlanStatus } from "@/services/subscriptions";
import { useAuth } from "@/hooks/useAuth";
import {
  NIGERIAN_STATES, PROPERTY_TYPES, SERVICE_TYPES,
  COMMERCIAL_TYPES, LAND_TYPES, SHORTLET_TYPES,
  REPAIR_CONSTRUCTION_TYPES, COMMERCIAL_EQUIPMENT_TYPES, FURNITURE_HOME_TYPES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

// ✅ FIX: `register(field, numOpt)` turns an empty input
// into `NaN`, not `undefined`. Zod's `.optional()` only excuses `undefined`,
// so a blank optional number field (e.g. Size (sqm) on the Land form) makes
// the ENTIRE multi-step form fail validation on final submit — silently,
// since the offending field lives on a step that's no longer rendered by
// the time you reach Publish. The Publish button looked completely
// unresponsive because of this. Use `setValueAs` instead so blank inputs
// become `undefined` (correctly optional) rather than `NaN` (always invalid).
const numOpt = { setValueAs: (v: string) => (v === "" || v === undefined || v === null ? undefined : Number(v)) };
import { toast } from "sonner";
import LivePayoutBreakdown from "@/components/features/LivePayoutBreakdown";
import type { BreakdownListingType } from "@/components/features/LivePayoutBreakdown";

// ─── Shared base fields ────────────────────────────────────────────────────────
const baseFields = {
  title:       z.string().min(10, "Title must be at least 10 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  price:       z.number({ invalid_type_error: "Enter a valid price" }).positive(),
  state:       z.string().min(1, "Select state"),
  lga:         z.string().min(2, "Enter LGA/area"),
  address:     z.string().min(5, "Enter address"),
};

// ─── Schemas per category ──────────────────────────────────────────────────────

const housingSchema = z.object({
  ...baseFields,
  propertyType: z.string().min(1, "Select property type"),
  listingType:  z.enum(["rent", "sale", "shortlet"], { required_error: "Select listing type" }),
  priceUnit:    z.string().min(1, "Select price unit"),
  bedrooms:     z.number().min(0).optional(),
  bathrooms:    z.number().min(0).optional(),
  toilets:      z.number().min(0).optional(),
  parkingSpaces:z.number().min(0).optional(),
  areaSqM:      z.number().positive().optional(),
  floor:        z.number().optional(),
  yearBuilt:    z.number().optional(),
  furnished:    z.boolean().optional(),
  serviced:     z.boolean().optional(),
  newlyBuilt:   z.boolean().optional(),
  features:     z.array(z.string()).optional(),
  nearbyAmenities: z.string().optional(),
  agencyFee:    z.number().min(0).optional(),
  cautionFee:   z.number().min(0).optional(),
});

const commercialSchema = z.object({
  ...baseFields,
  propertyType:   z.string().min(1, "Select commercial type"),
  listingType:    z.enum(["rent", "sale"], { required_error: "Select listing type" }),
  priceUnit:      z.string().min(1, "Select price unit"),
  areaSqM:        z.number().positive().optional(),
  floors:         z.number().min(1).optional(),
  parkingSpaces:  z.number().min(0).optional(),
  powerSupply:    z.string().optional(),
  waterSupply:    z.boolean().optional(),
  securitySystem: z.boolean().optional(),
  nearbyAmenities:z.string().optional(),
  agencyFee:      z.number().min(0).optional(),
});

const landSchema = z.object({
  ...baseFields,
  landType:      z.string().min(1, "Select land type"),
  listingType:   z.enum(["sale", "rent"], { required_error: "Select listing type" }),
  priceUnit:     z.string().min(1, "Select price unit"),
  sizeInSqM:     z.number().positive().optional(),
  sizeInPlots:   z.number().positive().optional(),
  documentType:  z.string().optional(),
  isGated:       z.boolean().optional(),
  hasSurvey:     z.boolean().optional(),
  isFloodFree:   z.boolean().optional(),
  nearbyLandmarks: z.string().optional(),
});

const shortletsSchema = z.object({
  ...baseFields,
  propertyType:  z.string().min(1, "Select accommodation type"),
  priceUnit:     z.enum(["per_day", "per_week", "per_month"]),
  bedrooms:      z.number().min(0).optional(),
  bathrooms:     z.number().min(0).optional(),
  maxGuests:     z.number().min(1).optional(),
  amenities:     z.string().optional(),
  checkInTime:   z.string().optional(),
  checkOutTime:  z.string().optional(),
  minimumNights: z.number().min(1).optional(),
  houseRules:    z.string().optional(),
  wifi:          z.boolean().optional(),
  airConditioned:z.boolean().optional(),
  petsAllowed:   z.boolean().optional(),
});

const servicesSchema = z.object({
  title:          z.string().min(10, "Title must be at least 10 characters"),
  description:    z.string().min(50, "Description must be at least 50 characters"),
  serviceType:    z.string().min(1, "Select service type"),
  price:          z.number({ invalid_type_error: "Enter a valid price" }).positive(),
  priceUnit:      z.enum(["per_service", "per_hour", "per_day"]),
  state:          z.string().min(1, "Select state"),
  lga:            z.string().min(2, "Enter primary area"),
  coverageAreas:  z.string().optional(),
  experienceYears:z.number().min(0).optional(),
  certifications: z.string().optional(),
  hasTeam:        z.boolean().optional(),
  teamSize:       z.number().optional(),
  availability:   z.string().optional(),
  responseTime:   z.string().optional(),
  minimumJob:     z.number().optional(),
});

const repairSchema = z.object({
  title:          z.string().min(10, "Title must be at least 10 characters"),
  description:    z.string().min(50, "Describe your service in detail"),
  serviceType:    z.string().min(1, "Select repair type"),
  price:          z.number({ invalid_type_error: "Enter a valid price" }).positive(),
  priceUnit:      z.enum(["per_service", "per_hour", "per_day"]),
  state:          z.string().min(1, "Select state"),
  lga:            z.string().min(2, "Enter your area"),
  coverageAreas:  z.string().optional(),
  experienceYears:z.number().min(0).optional(),
  certifications: z.string().optional(),
  licenseNumber:  z.string().optional(),
  hasEquipment:   z.boolean().optional(),
  offersWarranty: z.boolean().optional(),
  warrantyMonths: z.number().optional(),
  availability:   z.string().optional(),
  responseTime:   z.string().optional(),
});

const equipmentSchema = z.object({
  ...baseFields,
  equipmentType:   z.string().min(1, "Select equipment type"),
  listingType:     z.enum(["sale", "rent"], { required_error: "Select sale or hire" }),
  priceUnit:       z.string().min(1, "Select price unit"),
  brand:           z.string().optional(),
  model:           z.string().optional(),
  yearOfMake:      z.number().optional(),
  condition:       z.string().min(1, "Select condition"),
  capacityOrSpec:  z.string().optional(),
  hasWarranty:     z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
  installationIncluded: z.boolean().optional(),
});

const furnitureSchema = z.object({
  ...baseFields,
  itemType:        z.string().min(1, "Select item type"),
  listingType:     z.enum(["sale", "rent"], { required_error: "Select sale or hire" }),
  priceUnit:       z.string().min(1, "Select price unit"),
  brand:           z.string().optional(),
  material:        z.string().optional(),
  color:           z.string().optional(),
  condition:       z.string().min(1, "Select condition"),
  dimensions:      z.string().optional(),
  quantity:        z.number().min(1).optional(),
  deliveryAvailable: z.boolean().optional(),
  assemblyIncluded:  z.boolean().optional(),
});

type HousingForm    = z.infer<typeof housingSchema>;
type CommercialForm = z.infer<typeof commercialSchema>;
type LandForm       = z.infer<typeof landSchema>;
type ShortletsForm  = z.infer<typeof shortletsSchema>;
type ServicesForm   = z.infer<typeof servicesSchema>;
type RepairForm     = z.infer<typeof repairSchema>;
type EquipmentForm  = z.infer<typeof equipmentSchema>;
type FurnitureForm  = z.infer<typeof furnitureSchema>;

type CategoryType = "housing" | "commercial" | "land" | "shortlets" | "services" | "repair_construction" | "commercial_equipment" | "furniture_home";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_FEATURES = [
  "Swimming Pool", "Generator", "Borehole/Water", "Security/Gate",
  "CCTV", "Gym", "Air Conditioning", "Balcony", "Garden",
  "Elevator/Lift", "Solar Power", "Smart Home", "En-suite Bathroom",
  "Open Plan Kitchen", "Tiled Floors", "POP Ceiling",
  "Fitted Wardrobe", "Walk-in Closet", "Prepaid Meter", "Water Heater",
  "Furnished", "Serviced Apartment", "24/7 Power Supply", "Fire Alarm",
  "Intercom System", "Gated Estate", "Playground", "Parking Space",
  "Visitors' Parking", "Rooftop Terrace", "Jacuzzi", "Pet Friendly",
  "Wheelchair Accessible", "Fenced Compound", "CCTV Monitored Estate",
  "Estate Security", "Waste Disposal", "Cinema Room", "Study Room",
  "Store Room", "Guest Toilet", "Laundry Room", "WiFi/Internet Ready",
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
            i + 1 < step  ? "bg-green-500 text-white" :
            i + 1 === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
            "bg-secondary text-muted-foreground"
          )}>
            {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn("h-1 flex-1 mx-1 rounded-full transition-all",
              i + 1 < step ? "bg-green-500" : "bg-secondary"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Shared nav buttons ───────────────────────────────────────────────────────

function NavButtons({
  step, total, isSubmitting, submitLabel = "Publish Listing",
  onBack, onNext,
}: {
  step: number; total: number; isSubmitting: boolean;
  submitLabel?: string; onBack: () => void; onNext: () => void;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {step > 1 && (
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      )}
      {step < total ? (
        <Button type="button" className="flex-1" onClick={onNext}>
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      ) : (
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Publishing…</> : submitLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Shared photo uploader ────────────────────────────────────────────────────

function PhotoUploader({
  previews, onSelect, onRemove, fileRef, autoWatermark, label = "Photos",
  maxImages = 10, maxFileSizeMB = 5,
}: {
  previews: string[]; onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void; fileRef: React.RefObject<HTMLInputElement | null>;
  autoWatermark: boolean; label?: string;
  maxImages?: number; maxFileSizeMB?: number;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-primary" /> {label}
        <span className="text-xs text-muted-foreground font-normal ml-auto">{previews.length}/{maxImages}</span>
      </h2>
      <div onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          previews.length === 0 ? "border-primary/40 hover:border-primary bg-primary/5" : "border-border hover:border-primary/40"
        )}>
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Click to upload photos</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP up to {maxFileSizeMB}MB each · Max {maxImages}</p>
        {autoWatermark && <p className="text-xs text-primary mt-2 font-medium">✓ HomveraX watermark will be added</p>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onSelect} />
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={src} alt="" className="w-full h-full object-cover" />
              {i === 0 && <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">Cover</span>}
              <button type="button" onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Location fields (shared) ─────────────────────────────────────────────────

function LocationFields({ register, setValue, errors, placeholder = "e.g. 14 Admiralty Way, Lekki Phase 1", onBlurAddress }: {
  register: any; setValue: any; errors: any;
  placeholder?: string; onBlurAddress?: () => void;
}) {
  return (
    <>
      <div>
        <Label>State</Label>
        <Select onValueChange={(v) => setValue("state", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select state" /></SelectTrigger>
          <SelectContent>{NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
      </div>
      <div>
        <Label>LGA / Area</Label>
        <Input {...register("lga")} className="mt-1" placeholder="e.g. Eti-Osa, Lekki, Victoria Island" />
        {errors.lga && <p className="text-xs text-red-500 mt-1">{errors.lga.message}</p>}
      </div>
      <div>
        <Label>Full Address</Label>
        <Input {...register("address")} className="mt-1" placeholder={placeholder} onBlur={onBlurAddress} />
        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateListingPage() {
  const router  = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [step, setStep]         = useState(1);
  const [imageFiles, setImageFiles]     = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [autoWatermark, setAutoWatermark] = useState(false);
  // ✅ Upload limits from admin settings
  const [maxImages, setMaxImages] = useState(10);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(5);
  // ✅ Subscription plan status
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  // ✅ Image compression settings from admin
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionQuality, setCompressionQuality] = useState(0.8);
  const [compressionMaxWidth, setCompressionMaxWidth] = useState(1920);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    // ✅ FIX: Load config + enforce subscription plan limits
    Promise.all([
      getPlatformConfig(),
      getUserPlanStatus(user.id, user.subscriptionPlan ?? "free", user.subscriptionExpiry),
    ]).then(([cfg, status]) => {
      setAutoWatermark(cfg.features.enableAutoWatermark === true);
      setMaxImages(cfg.uploadLimits?.maxImages ?? 10);
      setMaxFileSizeMB(cfg.uploadLimits?.maxFileSizeMB ?? 5);
      setCompressionEnabled(cfg.enableImageCompression ?? true);
      setCompressionQuality(cfg.imageCompressionQuality ?? 0.8);
      setCompressionMaxWidth(cfg.imageCompressionMaxWidthPx ?? 1920);
      setPlanStatus(status);
    });
  }, [user]);

  // ─── One form per category ────────────────────────────────────────────────
  const housingForm    = useForm<HousingForm>   ({ resolver: zodResolver(housingSchema),    defaultValues: { furnished: false, serviced: false, newlyBuilt: false } });
  const commercialForm = useForm<CommercialForm>({ resolver: zodResolver(commercialSchema), defaultValues: { waterSupply: false, securitySystem: false } });
  const landForm       = useForm<LandForm>      ({ resolver: zodResolver(landSchema),       defaultValues: { isGated: false, hasSurvey: false, isFloodFree: false } });
  const shortletsForm  = useForm<ShortletsForm> ({ resolver: zodResolver(shortletsSchema),  defaultValues: { wifi: false, airConditioned: false, petsAllowed: false } });
  const servicesForm   = useForm<ServicesForm>  ({ resolver: zodResolver(servicesSchema),   defaultValues: { priceUnit: "per_service", hasTeam: false } });
  const repairForm     = useForm<RepairForm>    ({ resolver: zodResolver(repairSchema),     defaultValues: { priceUnit: "per_service", hasEquipment: false, offersWarranty: false } });
  const equipmentForm  = useForm<EquipmentForm> ({ resolver: zodResolver(equipmentSchema),  defaultValues: { hasWarranty: false, deliveryAvailable: false, installationIncluded: false } });
  const furnitureForm  = useForm<FurnitureForm> ({ resolver: zodResolver(furnitureSchema),  defaultValues: { deliveryAvailable: false, assemblyIncluded: false } });

  const listingType    = housingForm.watch("listingType");
  const housingPrice   = housingForm.watch("price");

  // ─── Image handling ───────────────────────────────────────────────────────

  // ✅ Compress image in-browser before upload (if enabled by admin)
  const compressImage = async (file: File): Promise<File> => {
    if (!compressionEnabled || !file.type.startsWith("image/")) return file;
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > compressionMaxWidth) {
          height = Math.round((height * compressionMaxWidth) / width);
          width = compressionMaxWidth;
        }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            // Only use compressed version if it's smaller
            if (blob.size < file.size) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          compressionQuality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // ✅ FIX: Use admin-configured maxImages limit
    if (imageFiles.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    // ✅ FIX: Use admin-configured maxFileSizeMB limit
    const oversized = files.filter(f => f.size > maxFileSizeMB * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} file(s) exceed the ${maxFileSizeMB}MB limit`);
      return;
    }
    // ✅ Compress images before setting (admin-configured quality + max width)
    const compressed = await Promise.all(files.map(compressImage));
    setImageFiles(p => [...p, ...compressed]);
    setImagePreviews(p => [...p, ...compressed.map(f => URL.createObjectURL(f))]);
  };
  const removeImage = (i: number) => {
    setImageFiles(p => p.filter((_, idx) => idx !== i));
    setImagePreviews(p => p.filter((_, idx) => idx !== i));
  };
  const toggleFeature = (f: string) => setSelectedFeatures(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);

  // ─── Duplicate check ──────────────────────────────────────────────────────
  const checkDuplicate = async () => {
    if (!user) return;
    const vals = category === "housing" ? housingForm.getValues() : null;
    if (!vals?.address) return;
    setCheckingDuplicate(true);
    try {
      const result = await checkDuplicateListing({ address: vals.address, lga: vals.lga, state: vals.state, title: vals.title, agentId: user.id });
      setDuplicateWarning(result.isDuplicate ? `Similar listing found: "${result.existingTitle}" (${result.confidence}% match). Is this a new listing?` : null);
    } catch { /* ignore */ }
    finally { setCheckingDuplicate(false); }
  };

  // ─── Submit helpers ───────────────────────────────────────────────────────
  const uploadAndCreate = async (payload: any, files: File[]) => {
    // ✅ FIX: This used to silently `return` here with no feedback whenever
    // `user` was momentarily null (auth still resolving, or a profile-lookup
    // hiccup). That made "Publish Listing" look completely unresponsive with
    // no error shown. Now it surfaces a toast and encourages a retry.
    if (!user) {
      toast.error("You're not signed in yet. Please wait a moment and try again, or refresh the page.");
      return false;
    }
    if (files.length === 0) { toast.error("Add at least one photo"); return false; }
    // ✅ Admin bypass: skip plan/slot limits — admin can list in any category freely
    const isAdmin = user.role === "admin";
    if (!isAdmin && planStatus && !planStatus.canPost) {
      toast.error(`You've reached your listing limit (${planStatus.activeListingCount}/${planStatus.plan.maxListings}). Upgrade your plan to post more.`);
      return false;
    }
    setIsSubmitting(true);
    try {
      let filesToUpload = files;
      if (autoWatermark) { toast("Adding watermarks…"); filesToUpload = await addWatermarkToFiles(files, "HomveraX"); }
      await createListing({ ...payload, agentId: user.id, agent: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, isVerified: user.isVerified, phone: user.phone }, status: "active" } as any, filesToUpload);
      toast.success("Listing published successfully!");
      router.push("/dashboard/listings");
      return true;
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create listing");
      return false;
    } finally { setIsSubmitting(false); }
  };

  const goBack  = () => setStep(s => s - 1);

  // ─── Category picker ──────────────────────────────────────────────────────
  const CATEGORY_CARDS = [
    { id: "housing",              icon: Home,        color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40",     border: "hover:border-blue-400",    title: "Property",              desc: "Apartments, houses, duplexes, flats — rent or sell.",          tags: ["Rent", "Sale"] },
    { id: "commercial",           icon: Building2,   color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/40", border: "hover:border-violet-400",   title: "Commercial",            desc: "Office spaces, shops, warehouses, event halls & co-working.",  tags: ["Office", "Shop", "Warehouse"] },
    { id: "land",                 icon: MapPin,      color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/40",   border: "hover:border-green-400",    title: "Land",                  desc: "Residential, commercial, and agricultural land listings.",     tags: ["Residential", "Commercial"] },
    { id: "shortlets",            icon: Star,        color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/40",   border: "hover:border-amber-400",    title: "Short Stays",           desc: "Short-term rentals — apartments, villas by day or week.",      tags: ["Daily", "Weekly"] },
    { id: "services",             icon: Briefcase,   color: "text-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-950/40",     border: "hover:border-cyan-400",     title: "Services",              desc: "Cleaning, logistics, installations & professional services.",  tags: ["Cleaning", "Moving"] },
    { id: "repair_construction",  icon: Hammer,      color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-950/40", border: "hover:border-orange-400",   title: "Repair & Construction", desc: "Plumbers, electricians, builders & skilled contractors.",       tags: ["Plumbing", "Building"] },
    { id: "commercial_equipment", icon: ShieldCheck, color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/40",       border: "hover:border-red-400",      title: "Comm. Equipment",       desc: "Generators, AC, solar systems & property machinery.",          tags: ["Generator", "Solar"] },
    { id: "furniture_home",       icon: Sofa,        color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-950/40",     border: "hover:border-pink-400",     title: "Furniture & Home",      desc: "Furniture, décor, appliances for your home or office.",        tags: ["Furniture", "Décor"] },
  ] as const;

  if (!category) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Create a Listing</h1>
          <p className="text-muted-foreground mb-8">What would you like to list on HomveraX?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORY_CARDS.map((cat) => {
              const Icon = cat.icon;
              return (
                <button key={cat.id}
                  onClick={() => { setCategory(cat.id as CategoryType); setStep(1); setImageFiles([]); setImagePreviews([]); }}
                  className={`group bg-card border-2 border-border ${cat.border} rounded-2xl p-6 text-left transition-all hover:shadow-lg`}>
                  <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${cat.color}`} />
                  </div>
                  <h2 className="text-base font-serif font-bold text-foreground mb-1">{cat.title}</h2>
                  <p className="text-xs text-muted-foreground mb-3">{cat.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.tags.map(t => <span key={t} className={`text-xs ${cat.bg} ${cat.color} px-2 py-0.5 rounded-full font-medium`}>{t}</span>)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. HOUSING FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "housing") {
    const steps = ["Type & Details", "Location", "Pricing", "Photos & Features"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = housingForm;
    const onSubmit = async (data: HousingForm) => {
      await uploadAndCreate({ ...data, category: "housing", features: selectedFeatures, listingType: data.listingType, propertyType: data.propertyType }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List a Property</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="space-y-5">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Listing Type</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ value: "rent", label: "For Rent", desc: "Monthly/yearly" }, { value: "sale", label: "For Sale", desc: "One-time purchase" }, { value: "shortlet", label: "Shortlet", desc: "Daily/weekly stays" }].map(lt => (
                      <button key={lt.value} type="button" onClick={() => setValue("listingType", lt.value as any)}
                        className={cn("border-2 rounded-xl p-3 text-left transition-all", listingType === lt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                        <p className={cn("text-sm font-bold", listingType === lt.value ? "text-primary" : "text-foreground")}>{lt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lt.desc}</p>
                      </button>
                    ))}
                  </div>
                  {errors.listingType && <p className="text-xs text-red-500 mt-2">{errors.listingType.message}</p>}
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Property Details</h2>
                  <div>
                    <Label>Property Type</Label>
                    <Select onValueChange={(v) => setValue("propertyType", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select property type" /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.propertyType && <p className="text-xs text-red-500 mt-1">{errors.propertyType.message}</p>}
                  </div>
                  <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. Spacious 3-Bedroom Apartment in Lekki Phase 1" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                  <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-28 resize-none" placeholder="Describe the property — condition, unique features, what makes it great..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[{ label: "Bedrooms", field: "bedrooms" as const }, { label: "Bathrooms", field: "bathrooms" as const }, { label: "Toilets", field: "toilets" as const }, { label: "Parking", field: "parkingSpaces" as const }].map(({ label, field }) => (
                      <div key={field}><Label>{label}</Label><Input type="number" min={0} className="mt-1" {...register(field, numOpt)} placeholder="0" /></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Area (sqm)</Label><Input type="number" min={0} className="mt-1" {...register("areaSqM", numOpt)} placeholder="e.g. 120" /></div>
                    <div><Label>Year Built</Label><Input type="number" className="mt-1" {...register("yearBuilt", numOpt)} placeholder="e.g. 2020" /></div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {[{ label: "Furnished", field: "furnished" as const }, { label: "Serviced", field: "serviced" as const }, { label: "Newly Built", field: "newlyBuilt" as const }].map(({ label, field }) => (
                      <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Location</h2>
                <LocationFields register={register} setValue={setValue} errors={errors} onBlurAddress={checkDuplicate} />
                {checkingDuplicate && <p className="text-xs text-muted-foreground">Checking for duplicates…</p>}
                {duplicateWarning && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2"><AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" /><p className="text-xs text-yellow-800">{duplicateWarning}</p></div>}
                <div><Label>Nearby Amenities</Label><Textarea {...register("nearbyAmenities")} className="mt-1 h-20 resize-none" placeholder="e.g. 5 mins from expressway, close to Shoprite, schools nearby" /></div>
              </div>
            )}
            {step === 3 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 1500000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Price Unit</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {listingType === "rent" && <><SelectItem value="per_month">Per Month</SelectItem><SelectItem value="per_year">Per Year</SelectItem></>}
                        {listingType === "sale" && <SelectItem value="total">Total (Sale Price)</SelectItem>}
                        {listingType === "shortlet" && <><SelectItem value="per_day">Per Day</SelectItem><SelectItem value="per_week">Per Week</SelectItem></>}
                        {!listingType && <><SelectItem value="per_year">Per Year</SelectItem><SelectItem value="total">Total</SelectItem></>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {listingType === "rent" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Agency Fee (₦)</Label><Input type="number" min={0} className="mt-1" {...register("agencyFee", numOpt)} placeholder="Optional" /></div>
                    <div><Label>Caution Fee (₦)</Label><Input type="number" min={0} className="mt-1" {...register("cautionFee", numOpt)} placeholder="Optional" /></div>
                  </div>
                )}
                <LivePayoutBreakdown
                  price={housingPrice}
                  listingType={(listingType as BreakdownListingType) ?? "sale"}
                />
              </div>
            )}
            {step === 4 && (
              <div className="space-y-5">
                <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} />
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h2 className="font-semibold text-foreground mb-4">Property Features</h2>
                  <div className="flex flex-wrap gap-2">
                    {PROPERTY_FEATURES.map(f => (
                      <button key={f} type="button" onClick={() => toggleFeature(f)}
                        className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", selectedFeatures.includes(f) ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:border-primary/40")}>
                        {selectedFeatures.includes(f) ? "✓ " : ""}{f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "propertyType", "listingType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "address"]);
                else if (step === 3) valid = await trigger(["price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. COMMERCIAL FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "commercial") {
    const steps = ["Space Details", "Location", "Pricing", "Photos"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = commercialForm;
    const listType = commercialForm.watch("listingType");
    const commercialPrice = commercialForm.watch("price");
    const onSubmit = async (data: CommercialForm) => {
      await uploadAndCreate({ ...data, category: "commercial", propertyType: data.propertyType, listingType: data.listingType }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List Commercial Space</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-500" /> Commercial Space Details</h2>
                <div>
                  <Label>Space Type</Label>
                  <Select onValueChange={(v) => setValue("propertyType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select space type" /></SelectTrigger>
                    <SelectContent>{COMMERCIAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.propertyType && <p className="text-xs text-red-500 mt-1">{errors.propertyType.message}</p>}
                </div>
                <div>
                  <Label>Listing Type</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {[{ value: "rent", label: "For Rent" }, { value: "sale", label: "For Sale" }].map(lt => (
                      <button key={lt.value} type="button" onClick={() => setValue("listingType", lt.value as any)}
                        className={cn("border-2 rounded-xl p-3 text-sm font-semibold transition-all", listType === lt.value ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border hover:border-violet-300")}>
                        {lt.label}
                      </button>
                    ))}
                  </div>
                  {errors.listingType && <p className="text-xs text-red-500 mt-1">{errors.listingType.message}</p>}
                </div>
                <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. Open-Plan Office Space in Victoria Island" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-28 resize-none" placeholder="Describe the space — layout, fittings, suitable businesses, access..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Total Area (sqm)</Label><Input type="number" min={0} className="mt-1" {...register("areaSqM", numOpt)} placeholder="e.g. 200" /></div>
                  <div><Label>Number of Floors</Label><Input type="number" min={1} className="mt-1" {...register("floors", numOpt)} placeholder="e.g. 2" /></div>
                </div>
                <div><Label>Parking Spaces</Label><Input type="number" min={0} className="mt-1 w-1/2" {...register("parkingSpaces", numOpt)} placeholder="e.g. 10" /></div>
                <div>
                  <Label>Power Supply</Label>
                  <Select onValueChange={(v) => setValue("powerSupply", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select power situation" /></SelectTrigger>
                    <SelectContent>
                      {["PHCN Only", "Generator Backup", "Solar Backup", "24/7 Power (Solar + Generator)", "Inverter System"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[{ label: "Water Supply Available", field: "waterSupply" as const }, { label: "Security System", field: "securitySystem" as const }].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-500" /> Location</h2>
                <LocationFields register={register} setValue={setValue} errors={errors} placeholder="e.g. 5 Broad Street, Lagos Island" />
                <div><Label>Nearby Landmarks / Access</Label><Textarea {...register("nearbyAmenities")} className="mt-1 h-20 resize-none" placeholder="e.g. Near Eko Hotel, accessible from Marina road, close to key banks" /></div>
              </div>
            )}
            {step === 3 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-violet-500" /> Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 5000000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Price Unit</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {listType === "rent" && <><SelectItem value="per_month">Per Month</SelectItem><SelectItem value="per_year">Per Year</SelectItem></>}
                        {listType === "sale" && <SelectItem value="total">Total (Sale Price)</SelectItem>}
                        {!listType && <><SelectItem value="per_year">Per Year</SelectItem><SelectItem value="total">Total</SelectItem></>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {listType === "rent" && <div><Label>Agency Fee (₦)</Label><Input type="number" min={0} className="mt-1" {...register("agencyFee", numOpt)} placeholder="Optional" /></div>}
                <LivePayoutBreakdown
                  price={commercialPrice}
                  listingType={(listType as BreakdownListingType) ?? "sale"}
                />
              </div>
            )}
            {step === 4 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Space Photos" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "propertyType", "listingType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "address"]);
                else if (step === 3) valid = await trigger(["price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LAND FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "land") {
    const steps = ["Land Details", "Location & Documents", "Pricing", "Photos"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = landForm;
    const landPrice    = landForm.watch("price");
    const landListType = landForm.watch("listingType");
    const onSubmit = async (data: LandForm) => {
      await uploadAndCreate({ ...data, category: "land", propertyType: data.landType, listingType: data.listingType }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List Land</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" /> Land Details</h2>
                <div>
                  <Label>Land Type</Label>
                  <Select onValueChange={(v) => setValue("landType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select land type" /></SelectTrigger>
                    <SelectContent>{LAND_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.landType && <p className="text-xs text-red-500 mt-1">{errors.landType.message}</p>}
                </div>
                <div>
                  <Label>Listing Type</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {[{ value: "sale", label: "For Sale" }, { value: "rent", label: "For Lease" }].map(lt => (
                      <button key={lt.value} type="button" onClick={() => setValue("listingType", lt.value as any)}
                        className={cn("border-2 rounded-xl p-3 text-sm font-semibold transition-all", landForm.watch("listingType") === lt.value ? "border-green-500 bg-green-50 text-green-700" : "border-border hover:border-green-300")}>
                        {lt.label}
                      </button>
                    ))}
                  </div>
                  {errors.listingType && <p className="text-xs text-red-500 mt-1">{errors.listingType.message}</p>}
                </div>
                <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. 500sqm Residential Plot in Ibeju-Lekki" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-28 resize-none" placeholder="Describe the land — topography, best use, access road, development potential..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Size (sqm)</Label><Input type="number" min={0} className="mt-1" {...register("sizeInSqM", numOpt)} placeholder="e.g. 500" /></div>
                  <div><Label>Size (plots)</Label><Input type="number" min={0} className="mt-1" {...register("sizeInPlots", numOpt)} placeholder="e.g. 2" /></div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" /> Location & Documents</h2>
                <LocationFields register={register} setValue={setValue} errors={errors} placeholder="e.g. Km 60, Lekki-Epe Expressway" />
                <div><Label>Nearby Landmarks</Label><Input {...register("nearbyLandmarks")} className="mt-1" placeholder="e.g. Near Dangote Refinery, 2km from expressway junction" /></div>
                <div>
                  <Label>Title Document</Label>
                  <Select onValueChange={(v) => setValue("documentType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select document type" /></SelectTrigger>
                    <SelectContent>
                      {["C of O (Certificate of Occupancy)", "Deed of Assignment", "Governor's Consent", "Survey Plan Only", "Receipt + Survey", "Registered Survey", "Excision", "Gazette"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[{ label: "Gated / Fenced", field: "isGated" as const }, { label: "Survey Available", field: "hasSurvey" as const }, { label: "Flood-Free Zone", field: "isFloodFree" as const }].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 8000000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Price Unit</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="total">Total Price</SelectItem><SelectItem value="per_sqm">Per sqm</SelectItem><SelectItem value="per_plot">Per Plot</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <LivePayoutBreakdown
                  price={landPrice}
                  listingType={(landListType as BreakdownListingType) ?? "sale"}
                />
              </div>
            )}
            {step === 4 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Land Photos & Documents" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "landType", "listingType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "address"]);
                else if (step === 3) valid = await trigger(["price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SHORT STAYS FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "shortlets") {
    const steps = ["Accommodation", "Location", "Rules & Pricing", "Photos"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = shortletsForm;
    const priceUnitVal  = shortletsForm.watch("priceUnit");
    const shortletPrice = shortletsForm.watch("price");
    const onSubmit = async (data: ShortletsForm) => {
      await uploadAndCreate({ ...data, category: "shortlets", propertyType: data.propertyType, listingType: "shortlet" }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List Short Stay</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Accommodation Details</h2>
                <div>
                  <Label>Accommodation Type</Label>
                  <Select onValueChange={(v) => setValue("propertyType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{SHORTLET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.propertyType && <p className="text-xs text-red-500 mt-1">{errors.propertyType.message}</p>}
                </div>
                <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. Luxury 2-Bed Shortlet in Lekki Phase 1" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-28 resize-none" placeholder="Describe the space — décor style, what's included, nearby attractions, vibe..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Bedrooms</Label><Input type="number" min={0} className="mt-1" {...register("bedrooms", numOpt)} placeholder="0" /></div>
                  <div><Label>Bathrooms</Label><Input type="number" min={0} className="mt-1" {...register("bathrooms", numOpt)} placeholder="0" /></div>
                  <div><Label>Max Guests</Label><Input type="number" min={1} className="mt-1" {...register("maxGuests", numOpt)} placeholder="e.g. 4" /></div>
                </div>
                <div><Label>Amenities Included</Label><Textarea {...register("amenities")} className="mt-1 h-20 resize-none" placeholder="e.g. Netflix, WiFi, Smart TV, fully equipped kitchen, washing machine, gym access..." /></div>
                <div className="flex flex-wrap gap-4">
                  {[{ label: "WiFi", field: "wifi" as const }, { label: "Air Conditioned", field: "airConditioned" as const }, { label: "Pets Allowed", field: "petsAllowed" as const }].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500" /> Location</h2>
                <LocationFields register={register} setValue={setValue} errors={errors} placeholder="e.g. 12 Admiralty Road, Lekki Phase 1" />
              </div>
            )}
            {step === 3 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-500" /> Rules & Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 25000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Per</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v as any)} defaultValue="per_day">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="per_day">Per Day</SelectItem><SelectItem value="per_week">Per Week</SelectItem><SelectItem value="per_month">Per Month</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Check-in Time</Label><Input {...register("checkInTime")} className="mt-1" placeholder="e.g. 2:00 PM" /></div>
                  <div><Label>Check-out Time</Label><Input {...register("checkOutTime")} className="mt-1" placeholder="e.g. 11:00 AM" /></div>
                </div>
                <div><Label>Minimum Nights</Label><Input type="number" min={1} className="mt-1 w-1/2" {...register("minimumNights", numOpt)} placeholder="e.g. 2" /></div>
                <div><Label>House Rules</Label><Textarea {...register("houseRules")} className="mt-1 h-20 resize-none" placeholder="e.g. No parties, no smoking indoors, quiet hours after 10pm..." /></div>
                <LivePayoutBreakdown
                  price={shortletPrice}
                  listingType="shortlet"
                />
              </div>
            )}
            {step === 4 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Interior & Exterior Photos" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "propertyType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "address"]);
                else if (step === 3) valid = await trigger(["price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SERVICES FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "services") {
    const steps = ["Service Info", "Coverage & Pricing", "Portfolio"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = servicesForm;
    const servicePrice = servicesForm.watch("price");
    const onSubmit = async (data: ServicesForm) => {
      await uploadAndCreate({ ...data, category: "services", propertyType: data.serviceType, listingType: "service" }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List a Service</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center"><Briefcase className="w-5 h-5 text-cyan-600" /></div>
                  <div><p className="font-semibold text-foreground text-sm">Service Listing</p><p className="text-xs text-muted-foreground">Reach thousands of property owners needing your skills</p></div>
                </div>
                <div>
                  <Label>Service Type</Label>
                  <Select onValueChange={(v) => setValue("serviceType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="What service do you offer?" /></SelectTrigger>
                    <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.serviceType && <p className="text-xs text-red-500 mt-1">{errors.serviceType.message}</p>}
                </div>
                <div><Label>Service Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. Professional Home Deep Cleaning in Lagos" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Service Description</Label><Textarea {...register("description")} className="mt-1 h-32 resize-none" placeholder="Describe exactly what you do, equipment used, what clients can expect, and what sets you apart..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Years of Experience</Label><Input type="number" min={0} className="mt-1" {...register("experienceYears", numOpt)} placeholder="e.g. 5" /></div>
                  <div>
                    <Label>Response Time</Label>
                    <Select onValueChange={(v) => setValue("responseTime", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="How fast?" /></SelectTrigger>
                      <SelectContent>{["Within 1 hour", "Within 3 hours", "Same day", "Within 24 hours", "Within 48 hours"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Certifications / Qualifications</Label><Input {...register("certifications")} className="mt-1" placeholder="e.g. COREN certified, 5-star rated, Lagos State registered" /></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register("hasTeam")} className="w-4 h-4 rounded" /><span className="text-sm">I work with a team</span></label>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-500" /> Coverage & Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Base State</Label>
                    <Select onValueChange={(v) => setValue("state", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Your state" /></SelectTrigger>
                      <SelectContent>{NIGERIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
                  </div>
                  <div><Label>Primary Area</Label><Input {...register("lga")} className="mt-1" placeholder="e.g. Lekki, Ikeja" />{errors.lga && <p className="text-xs text-red-500 mt-1">{errors.lga.message}</p>}</div>
                </div>
                <div><Label>Other Areas Covered</Label><Input {...register("coverageAreas")} className="mt-1" placeholder="e.g. Ajah, Sangotedo, Yaba (comma separated)" /></div>
                <div>
                  <Label>Availability</Label>
                  <Select onValueChange={(v) => setValue("availability", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="When are you available?" /></SelectTrigger>
                    <SelectContent>{["Mon–Fri (9am–5pm)", "Mon–Sat (8am–6pm)", "Mon–Sun (7am–7pm)", "Weekends only", "Flexible / By appointment"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Starting Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 15000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Per</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v as any)} defaultValue="per_service">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="per_service">Per Job</SelectItem><SelectItem value="per_hour">Per Hour</SelectItem><SelectItem value="per_day">Per Day</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Minimum Job Value (₦)</Label><Input type="number" min={0} className="mt-1" {...register("minimumJob", numOpt)} placeholder="Minimum you'll accept (optional)" /></div>
                <LivePayoutBreakdown price={servicePrice} listingType="service" />
              </div>
            )}
            {step === 3 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Portfolio / Work Photos" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} submitLabel="Publish Service" onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "serviceType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. REPAIR & CONSTRUCTION FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "repair_construction") {
    const steps = ["Trade Info", "Coverage & Pricing", "Portfolio"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = repairForm;
    const offersWarranty = repairForm.watch("offersWarranty");
    const repairPrice    = repairForm.watch("price");
    const onSubmit = async (data: RepairForm) => {
      await uploadAndCreate({ ...data, category: "repair_construction", propertyType: data.serviceType, listingType: "service" }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List Repair & Construction</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><Hammer className="w-5 h-5 text-orange-600" /></div>
                  <div><p className="font-semibold text-foreground text-sm">Trade / Construction Listing</p><p className="text-xs text-muted-foreground">Connect with property owners who need your skilled trade</p></div>
                </div>
                <div>
                  <Label>Trade / Repair Type</Label>
                  <Select onValueChange={(v) => setValue("serviceType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select your trade" /></SelectTrigger>
                    <SelectContent>{REPAIR_CONSTRUCTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.serviceType && <p className="text-xs text-red-500 mt-1">{errors.serviceType.message}</p>}
                </div>
                <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. Licensed Plumber — Leak Repairs & New Installations in Lagos" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-28 resize-none" placeholder="Describe your trade, tools/equipment used, types of jobs you handle, past projects..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Years of Experience</Label><Input type="number" min={0} className="mt-1" {...register("experienceYears", numOpt)} placeholder="e.g. 8" /></div>
                  <div>
                    <Label>Response Time</Label>
                    <Select onValueChange={(v) => setValue("responseTime", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="How fast?" /></SelectTrigger>
                      <SelectContent>{["Within 1 hour", "Within 3 hours", "Same day", "Within 24 hours", "Within 48 hours"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>License / Certification Number</Label><Input {...register("licenseNumber")} className="mt-1" placeholder="e.g. COREN Reg. No. 1234 (optional)" /></div>
                <div><Label>Certifications</Label><Input {...register("certifications")} className="mt-1" placeholder="e.g. COREN certified, SON registered, NIOB member" /></div>
                <div className="flex flex-wrap gap-4">
                  {[{ label: "I have my own tools/equipment", field: "hasEquipment" as const }, { label: "I offer warranty on my work", field: "offersWarranty" as const }].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
                {offersWarranty && <div><Label>Warranty Duration (months)</Label><Input type="number" min={1} className="mt-1 w-1/2" {...register("warrantyMonths", numOpt)} placeholder="e.g. 6" /></div>}
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500" /> Coverage & Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Base State</Label>
                    <Select onValueChange={(v) => setValue("state", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Your state" /></SelectTrigger>
                      <SelectContent>{NIGERIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
                  </div>
                  <div><Label>Primary Area</Label><Input {...register("lga")} className="mt-1" placeholder="e.g. Surulere, Yaba" />{errors.lga && <p className="text-xs text-red-500 mt-1">{errors.lga.message}</p>}</div>
                </div>
                <div><Label>Other Areas Covered</Label><Input {...register("coverageAreas")} className="mt-1" placeholder="e.g. Ikoyi, Victoria Island, Lekki (comma separated)" /></div>
                <div>
                  <Label>Availability</Label>
                  <Select onValueChange={(v) => setValue("availability", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="When are you available?" /></SelectTrigger>
                    <SelectContent>{["Mon–Fri (7am–6pm)", "Mon–Sat (7am–6pm)", "Mon–Sun (7am–7pm)", "Flexible / By appointment", "Emergency calls accepted"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Starting Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 20000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Per</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v as any)} defaultValue="per_service">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="per_service">Per Job</SelectItem><SelectItem value="per_hour">Per Hour</SelectItem><SelectItem value="per_day">Per Day</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <LivePayoutBreakdown price={repairPrice} listingType="service" />
              </div>
            )}
            {step === 3 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Past Projects & Work Photos" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} submitLabel="Publish Listing" onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "serviceType"]);
                else if (step === 2) valid = await trigger(["state", "lga", "price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. COMMERCIAL EQUIPMENT FORM
  // ═══════════════════════════════════════════════════════════════════════════
  if (category === "commercial_equipment") {
    const steps = ["Equipment Details", "Location & Delivery", "Pricing", "Photos"];
    const { register, handleSubmit, setValue, trigger, formState: { errors } } = equipmentForm;
    const listType      = equipmentForm.watch("listingType");
    const equipmentPrice = equipmentForm.watch("price");
    const onSubmit = async (data: EquipmentForm) => {
      await uploadAndCreate({ ...data, category: "commercial_equipment", propertyType: data.equipmentType, listingType: data.listingType }, imageFiles);
    };
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <div><h1 className="text-xl font-serif font-bold text-foreground">List Commercial Equipment</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
          </div>
          <StepIndicator step={step} total={steps.length} labels={steps} />
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-red-500" /> Equipment Details</h2>
                <div>
                  <Label>Equipment Type</Label>
                  <Select onValueChange={(v) => setValue("equipmentType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select equipment type" /></SelectTrigger>
                    <SelectContent>{COMMERCIAL_EQUIPMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.equipmentType && <p className="text-xs text-red-500 mt-1">{errors.equipmentType.message}</p>}
                </div>
                <div>
                  <Label>Sale or Hire</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {[{ value: "sale", label: "For Sale" }, { value: "rent", label: "For Hire / Rent" }].map(lt => (
                      <button key={lt.value} type="button" onClick={() => setValue("listingType", lt.value as any)}
                        className={cn("border-2 rounded-xl p-3 text-sm font-semibold transition-all", listType === lt.value ? "border-red-500 bg-red-50 text-red-700" : "border-border hover:border-red-300")}>
                        {lt.label}
                      </button>
                    ))}
                  </div>
                  {errors.listingType && <p className="text-xs text-red-500 mt-1">{errors.listingType.message}</p>}
                </div>
                <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. 20KVA Perkins Generator — For Sale, Lagos" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
                <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-24 resize-none" placeholder="Describe the equipment — specs, usage history, current condition, reason for selling/hiring..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Brand</Label><Input {...register("brand")} className="mt-1" placeholder="e.g. Perkins, Honda, Thermocool" /></div>
                  <div><Label>Model</Label><Input {...register("model")} className="mt-1" placeholder="e.g. P20S" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Year of Make</Label><Input type="number" className="mt-1" {...register("yearOfMake", numOpt)} placeholder="e.g. 2021" /></div>
                  <div>
                    <Label>Condition</Label>
                    <Select onValueChange={(v) => setValue("condition", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select condition" /></SelectTrigger>
                      <SelectContent>{["Brand New", "Excellent (Tokunbo)", "Good (Used)", "Fair (Needs Minor Repair)", "For Parts"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.condition && <p className="text-xs text-red-500 mt-1">{errors.condition.message}</p>}
                  </div>
                </div>
                <div><Label>Capacity / Key Spec</Label><Input {...register("capacityOrSpec")} className="mt-1" placeholder="e.g. 20KVA, 1.5HP, 12,000 BTU, 5000L" /></div>
                <div className="flex flex-wrap gap-4">
                  {[{ label: "Has Warranty", field: "hasWarranty" as const }, { label: "Delivery Available", field: "deliveryAvailable" as const }, { label: "Installation Included", field: "installationIncluded" as const }].map(({ label, field }) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Location & Delivery</h2>
                <LocationFields register={register} setValue={setValue} errors={errors} placeholder="e.g. 4 Industrial Avenue, Ogba, Lagos" />
              </div>
            )}
            {step === 3 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-500" /> Pricing</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 500000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                  <div>
                    <Label>Price Unit</Label>
                    <Select onValueChange={(v) => setValue("priceUnit", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {listType === "sale" && <SelectItem value="total">Total (Sale Price)</SelectItem>}
                        {listType === "rent" && <><SelectItem value="per_day">Per Day</SelectItem><SelectItem value="per_week">Per Week</SelectItem><SelectItem value="per_month">Per Month</SelectItem></>}
                        {!listType && <><SelectItem value="total">Total</SelectItem><SelectItem value="per_month">Per Month</SelectItem></>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <LivePayoutBreakdown
                  price={equipmentPrice}
                  listingType={(listType as BreakdownListingType) ?? "sale"}
                />
              </div>
            )}
            {step === 4 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Equipment Photos" />}
            <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
              onNext={async () => {
                let valid = false;
                if (step === 1) valid = await trigger(["title", "description", "equipmentType", "listingType", "condition"]);
                else if (step === 2) valid = await trigger(["state", "lga", "address"]);
                else if (step === 3) valid = await trigger(["price", "priceUnit"]);
                else valid = true;
                if (valid) setStep(s => s + 1);
              }} />
          </form>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. FURNITURE & HOME FORM
  // ═══════════════════════════════════════════════════════════════════════════
  const steps = ["Item Details", "Location & Delivery", "Pricing", "Photos"];
  const { register, handleSubmit, setValue, trigger, formState: { errors } } = furnitureForm;
  const listType      = furnitureForm.watch("listingType");
  const furniturePrice = furnitureForm.watch("price");
  const onSubmit = async (data: FurnitureForm) => {
    await uploadAndCreate({ ...data, category: "furniture_home", propertyType: data.itemType, listingType: data.listingType }, imageFiles);
  };
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setCategory(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
          <div><h1 className="text-xl font-serif font-bold text-foreground">List Furniture & Home Item</h1><p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p></div>
        </div>
        <StepIndicator step={step} total={steps.length} labels={steps} />
        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 1 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><Sofa className="w-4 h-4 text-pink-500" /> Item Details</h2>
              <div>
                <Label>Item Type</Label>
                <Select onValueChange={(v) => setValue("itemType", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select item category" /></SelectTrigger>
                  <SelectContent>{FURNITURE_HOME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                {errors.itemType && <p className="text-xs text-red-500 mt-1">{errors.itemType.message}</p>}
              </div>
              <div>
                <Label>Sale or Hire</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[{ value: "sale", label: "For Sale" }, { value: "rent", label: "For Hire / Rent" }].map(lt => (
                    <button key={lt.value} type="button" onClick={() => setValue("listingType", lt.value as any)}
                      className={cn("border-2 rounded-xl p-3 text-sm font-semibold transition-all", listType === lt.value ? "border-pink-500 bg-pink-50 text-pink-700" : "border-border hover:border-pink-300")}>
                      {lt.label}
                    </button>
                  ))}
                </div>
                {errors.listingType && <p className="text-xs text-red-500 mt-1">{errors.listingType.message}</p>}
              </div>
              <div><Label>Listing Title</Label><Input {...register("title")} className="mt-1" placeholder="e.g. 7-Seater L-Shaped Leather Sofa — For Sale, Lagos" />{errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}</div>
              <div><Label>Description</Label><Textarea {...register("description")} className="mt-1 h-24 resize-none" placeholder="Describe the item — style, materials, size, age, reason for selling, any defects..." />{errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Brand / Make</Label><Input {...register("brand")} className="mt-1" placeholder="e.g. Ikea, Vitafoam, Nexus" /></div>
                <div><Label>Material</Label><Input {...register("material")} className="mt-1" placeholder="e.g. Leather, Wood, Steel" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Colour</Label><Input {...register("color")} className="mt-1" placeholder="e.g. Brown, White, Grey" /></div>
                <div>
                  <Label>Condition</Label>
                  <Select onValueChange={(v) => setValue("condition", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>{["Brand New", "Like New", "Good (Lightly Used)", "Fair (Visible Wear)", "Needs Repair"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.condition && <p className="text-xs text-red-500 mt-1">{errors.condition.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dimensions</Label><Input {...register("dimensions")} className="mt-1" placeholder="e.g. 2.5m × 1.8m × 0.9m" /></div>
                <div><Label>Quantity</Label><Input type="number" min={1} className="mt-1" {...register("quantity", numOpt)} placeholder="e.g. 1" /></div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{ label: "Delivery Available", field: "deliveryAvailable" as const }, { label: "Assembly Included", field: "assemblyIncluded" as const }].map(({ label, field }) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register(field)} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-pink-500" /> Location & Delivery</h2>
              <LocationFields register={register} setValue={setValue} errors={errors} placeholder="e.g. 10 Opebi Road, Ikeja, Lagos" />
            </div>
          )}
          {step === 3 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-pink-500" /> Pricing</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (₦)</Label><Input type="number" min={0} className="mt-1" {...register("price", numOpt)} placeholder="e.g. 120000" />{errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}</div>
                <div>
                  <Label>Price Unit</Label>
                  <Select onValueChange={(v) => setValue("priceUnit", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {listType === "sale" && <SelectItem value="total">Total (Sale Price)</SelectItem>}
                      {listType === "rent" && <><SelectItem value="per_day">Per Day</SelectItem><SelectItem value="per_week">Per Week</SelectItem><SelectItem value="per_month">Per Month</SelectItem></>}
                      {!listType && <><SelectItem value="total">Total</SelectItem><SelectItem value="per_month">Per Month</SelectItem></>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <LivePayoutBreakdown
                price={furniturePrice}
                listingType={(listType as BreakdownListingType) ?? "sale"}
              />
            </div>
          )}
          {step === 4 && <PhotoUploader previews={imagePreviews} onSelect={handleImageSelect} onRemove={removeImage} fileRef={fileRef} autoWatermark={autoWatermark} maxImages={maxImages} maxFileSizeMB={maxFileSizeMB} label="Item Photos" />}
          <NavButtons step={step} total={steps.length} isSubmitting={isSubmitting} onBack={goBack}
            onNext={async () => {
              let valid = false;
              if (step === 1) valid = await trigger(["title", "description", "itemType", "listingType", "condition"]);
              else if (step === 2) valid = await trigger(["state", "lga", "address"]);
              else if (step === 3) valid = await trigger(["price", "priceUnit"]);
              else valid = true;
              if (valid) setStep(s => s + 1);
            }} />
        </form>
      </div>
    </DashboardLayout>
  );
}
