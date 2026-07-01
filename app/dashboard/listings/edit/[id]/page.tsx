"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2, Upload, X, Save, ChevronLeft,
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
import { getListingById, updateListing, uploadListingImages } from "@/services/listings";
import { useAuth } from "@/hooks/useAuth";
import { NIGERIAN_STATES, PROPERTY_TYPES, SERVICE_TYPES, COMMERCIAL_TYPES, LAND_TYPES, SHORTLET_TYPES, REPAIR_CONSTRUCTION_TYPES, COMMERCIAL_EQUIPMENT_TYPES, FURNITURE_HOME_TYPES, LISTING_CATEGORIES } from "@/lib/constants";
import { toast } from "sonner";
import type { PropertyListing } from "@/types";

const schema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  category: z.enum(["housing", "services", "commercial", "land", "shortlets", "repair_construction", "commercial_equipment", "furniture_home"]),
  propertyType: z.string().min(1, "Select a property type"),
  listingType: z.string().min(1, "Select a listing type"),
  price: z.number({ invalid_type_error: "Enter a valid price" }).positive("Enter a valid price"),
  priceUnit: z.string().min(1, "Select price unit"),
  state: z.string().min(1, "Select state"),
  lga: z.string().min(2, "Enter LGA/area"),
  address: z.string().min(5, "Enter the address"),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  areaSqM: z.number().optional(),
  furnished: z.boolean().optional(),
  status: z.enum(["draft", "active", "paused"]),
});
type FormData = z.infer<typeof schema>;

export default function EditListingPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const category = watch("category");
  const propertyTypeOptions =
    category === "services"             ? SERVICE_TYPES :
    category === "commercial"           ? COMMERCIAL_TYPES :
    category === "land"                 ? LAND_TYPES :
    category === "shortlets"            ? SHORTLET_TYPES :
    category === "repair_construction"  ? REPAIR_CONSTRUCTION_TYPES :
    category === "commercial_equipment" ? COMMERCIAL_EQUIPMENT_TYPES :
    category === "furniture_home"       ? FURNITURE_HOME_TYPES :
    PROPERTY_TYPES;
  const isHousing = category === "housing";

  useEffect(() => {
    getListingById(id)
      .then((data) => {
        if (!data) { toast.error("Listing not found"); router.push("/dashboard/listings"); return; }
        if (data.agentId !== user?.id) { toast.error("Not authorized"); router.push("/dashboard/listings"); return; }
        setListing(data);
        setExistingImages(data.images ?? []);
        reset({
          title: data.title,
          description: data.description,
          category: data.category,
          propertyType: data.propertyType,
          listingType: data.listingType,
          price: data.price,
          priceUnit: data.priceUnit,
          state: data.location.state,
          lga: data.location.lga,
          address: data.location.address,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          areaSqM: data.areaSqM,
          furnished: data.furnished,
          status: data.status === "sold" || data.status === "rented" ? "active" : data.status,
        });
      })
      .catch(() => toast.error("Failed to load listing"))
      .finally(() => setPageLoading(false));
  }, [id, user?.id, reset, router]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const total = existingImages.length + newImageFiles.length + files.length;
    if (total > 10) { toast.error("Maximum 10 images allowed"); return; }
    const previews = files.map((f) => URL.createObjectURL(f));
    setNewImageFiles((prev) => [...prev, ...files]);
    setNewImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeExisting = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNew = (index: number) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    if (!user || !listing) return;
    const totalImages = existingImages.length + newImageFiles.length;
    if (totalImages === 0) { toast.error("Add at least one photo"); return; }
    setIsSubmitting(true);
    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) {
        uploadedUrls = await uploadListingImages(newImageFiles, listing.id);
      }
      await updateListing(listing.id, {
        title: data.title,
        description: data.description,
        category: data.category,
        propertyType: data.propertyType as PropertyListing["propertyType"],
        listingType: data.listingType as PropertyListing["listingType"],
        price: data.price,
        priceUnit: data.priceUnit as PropertyListing["priceUnit"],
        location: { state: data.state, lga: data.lga, address: data.address },
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        areaSqM: data.areaSqM,
        furnished: data.furnished,
        status: data.status,
        images: [...existingImages, ...uploadedUrls],
      });
      toast.success("Listing updated successfully!");
      router.push("/dashboard/listings");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-96 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!listing) return null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.push("/dashboard/listings")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Listings
        </button>
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-foreground">Edit Listing</h1>
          <p className="text-muted-foreground text-sm mt-1 truncate">{listing.title}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Status */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <h2 className="font-semibold text-foreground">Listing Status</h2>
            <div>
              <Select defaultValue={listing.status === "sold" || listing.status === "rented" ? "active" : listing.status}
                onValueChange={(v) => setValue("status", v as FormData["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — visible to everyone</SelectItem>
                  <SelectItem value="paused">Paused — hidden from search</SelectItem>
                  <SelectItem value="draft">Draft — not published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <h2 className="font-semibold text-foreground">Basic Information</h2>

            <div>
              <Label>Category *</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                {LISTING_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setValue("category", c.value as FormData["category"])}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                      category === c.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="block font-semibold">{c.label}</span>
                    <span className="block text-xs mt-0.5 opacity-70">{c.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Listing Title *</Label>
              <Input className="mt-1.5" {...register("title")} />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea className="mt-1.5" rows={5} {...register("description")} />
              {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property Type *</Label>
                <Select defaultValue={listing.propertyType} onValueChange={(v) => setValue("propertyType", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {propertyTypeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.propertyType && <p className="mt-1 text-xs text-destructive">{errors.propertyType.message}</p>}
              </div>
              <div>
                <Label>Listing Type *</Label>
                <Select defaultValue={listing.listingType} onValueChange={(v) => setValue("listingType", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isHousing ? (
                      <>
                        <SelectItem value="rent">For Rent</SelectItem>
                        <SelectItem value="sale">For Sale</SelectItem>
                        <SelectItem value="shortlet">Shortlet</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="service">Service</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.listingType && <p className="mt-1 text-xs text-destructive">{errors.listingType.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (₦) *</Label>
                <Input type="number" className="mt-1.5" {...register("price", { valueAsNumber: true })} />
                {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div>
                <Label>Price Unit *</Label>
                <Select defaultValue={listing.priceUnit} onValueChange={(v) => setValue("priceUnit", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_year">Per Year</SelectItem>
                    <SelectItem value="per_month">Per Month</SelectItem>
                    <SelectItem value="per_day">Per Day</SelectItem>
                    <SelectItem value="per_service">Per Service</SelectItem>
                    <SelectItem value="total">Total (Sale)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <h2 className="font-semibold text-foreground">Location</h2>
            <div>
              <Label>State *</Label>
              <Select defaultValue={listing.location.state} onValueChange={(v) => setValue("state", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIGERIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && <p className="mt-1 text-xs text-destructive">{errors.state.message}</p>}
            </div>
            <div>
              <Label>LGA / Area *</Label>
              <Input className="mt-1.5" {...register("lga")} />
              {errors.lga && <p className="mt-1 text-xs text-destructive">{errors.lga.message}</p>}
            </div>
            <div>
              <Label>Full Address *</Label>
              <Input className="mt-1.5" {...register("address")} />
              {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>}
            </div>
          </div>

          {/* Property Details */}
          {isHousing && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              <h2 className="font-semibold text-foreground">Property Details</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Bedrooms</Label>
                  <Input type="number" min={0} className="mt-1.5" {...register("bedrooms", { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Bathrooms</Label>
                  <Input type="number" min={0} className="mt-1.5" {...register("bathrooms", { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Area (m²)</Label>
                  <Input type="number" min={0} className="mt-1.5" {...register("areaSqM", { valueAsNumber: true })} />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" className="rounded" {...register("furnished")} />
                <span className="text-sm text-foreground">Property is furnished</span>
              </label>
            </div>
          )}

          {/* Photos */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Photos ({existingImages.length + newImageFiles.length}/10)</h2>

            {/* Existing images */}
            {existingImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {existingImages.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExisting(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {i === 0 && (
                      <div className="absolute bottom-1 left-1 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        Cover
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New image previews */}
            {newImagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {newImagePreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNew(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">
                      New
                    </div>
                  </div>
                ))}
              </div>
            )}

            {existingImages.length + newImageFiles.length < 10 && (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-secondary/30 transition-all"
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Add more photos</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB each</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Changes</>
            }
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
