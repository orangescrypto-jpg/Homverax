"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Edit2, Save, X, Megaphone } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBanners, createBanner, updateBanner, deleteBanner, toggleBanner,
  type Banner, type BannerInput,
} from "@/services/banners";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BG_OPTIONS = [
  { label: "Blue",   value: "from-blue-600 to-blue-800" },
  { label: "Green",  value: "from-green-600 to-green-800" },
  { label: "Purple", value: "from-purple-600 to-purple-800" },
  { label: "Orange", value: "from-orange-500 to-orange-700" },
  { label: "Red",    value: "from-red-600 to-red-800" },
  { label: "Navy",   value: "from-slate-700 to-slate-900" },
];

const EMPTY: BannerInput = {
  title: "", subtitle: "", ctaText: "Browse Now", ctaLink: "/listings",
  bgColor: "from-blue-600 to-blue-800", isActive: true, order: 0,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerInput>({ ...EMPTY });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try { setBanners(await getBanners()); }
    catch { toast.error("Failed to load banners"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateBanner(editingId, form);
        toast.success("Banner updated");
      } else {
        await createBanner({ ...form, order: banners.length });
        toast.success("Banner created");
      }
      setEditingId(null);
      setShowAdd(false);
      setForm({ ...EMPTY });
      await load();
    } catch { toast.error("Failed to save banner"); }
    finally { setSaving(false); }
  };

  const handleEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({ title: b.title, subtitle: b.subtitle, ctaText: b.ctaText, ctaLink: b.ctaLink, bgColor: b.bgColor, isActive: b.isActive, order: b.order });
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try { await deleteBanner(id); setBanners((prev) => prev.filter((b) => b.id !== id)); toast.success("Banner deleted"); }
    catch { toast.error("Failed to delete"); }
  };

  const handleToggle = async (b: Banner) => {
    try {
      await toggleBanner(b.id, !b.isActive);
      setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, isActive: !b.isActive } : x));
      toast.success(b.isActive ? "Banner hidden" : "Banner activated");
    } catch { toast.error("Failed to toggle"); }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> Homepage Banners
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage promotional banners shown on the homepage</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setEditingId(null); setForm({ ...EMPTY }); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Banner
        </Button>
      </div>

      {/* Add / Edit form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">{editingId ? "Edit Banner" : "New Banner"}</h2>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Preview */}
          <div className={cn("bg-gradient-to-r rounded-xl p-6 mb-4 text-white", form.bgColor)}>
            <p className="text-xl font-serif font-bold">{form.title || "Banner Title"}</p>
            <p className="text-sm opacity-80 mt-1">{form.subtitle || "Subtitle text"}</p>
            <button className="mt-3 bg-white/20 backdrop-blur px-4 py-1.5 rounded-lg text-sm font-semibold">
              {form.ctaText || "CTA Button"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Title</Label>
              <Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input className="mt-1" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div>
              <Label>CTA Button Text</Label>
              <Input className="mt-1" value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} />
            </div>
            <div>
              <Label>CTA Link</Label>
              <Input className="mt-1" value={form.ctaLink} onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))} />
            </div>
            <div>
              <Label>Order (position)</Label>
              <Input className="mt-1" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Background Color</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {BG_OPTIONS.map((opt) => (
                  <button key={opt.value}
                    onClick={() => setForm((f) => ({ ...f, bgColor: opt.value }))}
                    className={cn("w-8 h-8 rounded-lg bg-gradient-to-r border-2 transition-all", opt.value,
                      form.bgColor === opt.value ? "border-foreground scale-110" : "border-transparent"
                    )}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-foreground">Active (show on homepage)</span>
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Banner"}
            </Button>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Banner list */}
      {isLoading ? (
        <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : banners.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No banners yet. Add your first banner above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className={cn("bg-gradient-to-r p-4 text-white flex items-center justify-between", b.bgColor)}>
                <div>
                  <p className="font-serif font-bold">{b.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">{b.subtitle}</p>
                </div>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{b.ctaText}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                    b.isActive ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground"
                  )}>
                    {b.isActive ? "Active" : "Hidden"}
                  </span>
                  <span className="text-xs text-muted-foreground">Order: {b.order}</span>
                  <span className="text-xs text-muted-foreground">→ {b.ctaLink}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handleToggle(b)}>
                    {b.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {b.isActive ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handleEdit(b)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
