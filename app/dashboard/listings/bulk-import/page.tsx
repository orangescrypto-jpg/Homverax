"use client";

/**
 * src/app/dashboard/listings/bulk-import/page.tsx
 * Bulk CSV listing import for agents with 50+ properties.
 * Admin must approve before listings go live.
 * Feature-flagged: enableBulkListingImport must be true in admin settings.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, Download, FileText,
  Loader2, Upload, X, Eye,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureEnabled } from "@/services/platformSettings";
import { submitBulkImport } from "@/services/bulkImport";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// ─── Expected CSV columns ─────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
  "title", "description", "category", "listingType",
  "price", "state", "lga", "address",
];

const OPTIONAL_COLUMNS = [
  "propertyType", "bedrooms", "bathrooms", "toilets",
  "parkingSpaces", "areaSqM", "furnished", "priceUnit",
  "virtualTourUrl", "tags",
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => { data[h] = values[idx] ?? ""; });

    const errors: string[] = [];

    // Validate required fields
    for (const col of REQUIRED_COLUMNS) {
      if (!data[col]) errors.push(`Missing: ${col}`);
    }

    // Validate price is a number
    if (data.price && isNaN(Number(data.price))) {
      errors.push("Price must be a number");
    }

    // Validate listingType
    if (data.listingtype && !["sale", "rent", "shortlet", "service"].includes(data.listingtype)) {
      errors.push("listingType must be: sale, rent, shortlet, or service");
    }

    rows.push({ index: i, data, errors, valid: errors.length === 0 });
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [previewRow, setPreviewRow] = useState<ParsedRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    isFeatureEnabled("enableBulkListingImport").then((v) => {
      setIsEnabled(v);
      setIsLoading(false);
    });
  }, []);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast.error("Only CSV files are accepted");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!user || rows.length === 0) return;
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitBulkImport(user.id, user.name, validRows.map((r) => r.data));
      setSubmitted(true);
      toast.success(`${validRows.length} listings submitted for admin review`);
    } catch {
      toast.error("Failed to submit import. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const header = ALL_COLUMNS.join(",");
    const example = [
      "3 Bedroom Flat in Lekki",
      "Spacious 3 bed flat in a serene estate",
      "housing",
      "rent",
      "250000",
      "Lagos",
      "Lekki",
      "15 Palm Avenue Lekki Phase 1",
      "apartment",
      "3",
      "2",
      "2",
      "1",
      "120",
      "true",
      "per_month",
      "",
      "lekki;estate;flat",
    ].join(",");
    const csv = `${header}\n${example}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "homverax-bulk-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount   = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 text-muted-foreground py-10">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!isEnabled) {
    return (
      <DashboardLayout>
        <div className="max-w-lg text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h2 className="font-semibold text-foreground mb-2">Bulk Import Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            Bulk listing import is not currently enabled. Contact support to request access.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-lg text-center py-16">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">
            Import Submitted!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {validCount} listing{validCount !== 1 ? "s" : ""} submitted for admin review.
            They'll be published once approved — usually within 24 hours.
          </p>
          <Button onClick={() => { setFile(null); setRows([]); setSubmitted(false); }}>
            Import More Listings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">Bulk Listing Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file to import multiple listings at once. Admin reviews before publishing.
        </p>
      </div>

      <div className="space-y-5 max-w-4xl">

        {/* Step 1 — Template */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Step 1 — Download Template</h2>
              <p className="text-sm text-muted-foreground">
                Use our CSV template to ensure your data is in the correct format.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {REQUIRED_COLUMNS.map((c) => (
                  <span key={c} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{c}*</span>
                ))}
                {OPTIONAL_COLUMNS.map((c) => (
                  <span key={c} className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">* Required fields</p>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="shrink-0 gap-2">
              <Download className="w-4 h-4" />
              Template
            </Button>
          </div>
        </div>

        {/* Step 2 — Upload */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-3">Step 2 — Upload Your CSV</h2>

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop your CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Max 5MB · CSV files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {rows.length} rows found</p>
              </div>
              <button onClick={() => { setFile(null); setRows([]); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Step 3 — Preview & Validate */}
        {rows.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Step 3 — Preview & Validate</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-medium">{validCount} valid</span>
                {invalidCount > 0 && <span className="text-red-500 font-medium">{invalidCount} errors</span>}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-secondary/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{rows.length}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
                <p className="text-xs text-muted-foreground">Ready to Import</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${invalidCount > 0 ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30" : "bg-secondary/50 border-border"}`}>
                <p className={`text-2xl font-bold ${invalidCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{invalidCount}</p>
                <p className="text-xs text-muted-foreground">Errors (skipped)</p>
              </div>
            </div>

            {/* Row list */}
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {rows.map((row) => (
                <div
                  key={row.index}
                  className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-sm ${
                    row.valid
                      ? "bg-green-50/50 dark:bg-green-900/5 border-green-200 dark:border-green-800/20"
                      : "bg-red-50/50 dark:bg-red-900/5 border-red-200 dark:border-red-800/20"
                  }`}
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {row.valid
                      ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        Row {row.index}: {row.data.title || "(no title)"}
                      </p>
                      {!row.valid && (
                        <p className="text-xs text-red-600 mt-0.5">{row.errors.join(" · ")}</p>
                      )}
                      {row.valid && (
                        <p className="text-xs text-muted-foreground">
                          {row.data.listingtype} · {row.data.state} · ₦{Number(row.data.price || 0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {row.valid && (
                    <button
                      onClick={() => setPreviewRow(row)}
                      className="shrink-0 text-primary hover:text-primary/80"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {invalidCount > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl mb-4">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{invalidCount} row{invalidCount !== 1 ? "s" : ""} with errors will be skipped.</strong>
                  {" "}Fix them in your CSV and re-upload to include them.
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || validCount === 0}
              className="w-full gap-2"
            >
              {isSubmitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Upload className="w-4 h-4" />
              }
              Submit {validCount} Listing{validCount !== 1 ? "s" : ""} for Review
            </Button>
          </div>
        )}

        {/* Info note */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Before you submit</p>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• Each listing will be reviewed by our team before going live</li>
                <li>• Photos must be added individually after import is approved</li>
                <li>• Duplicate listings may be removed during review</li>
                <li>• All listings will start as <strong>draft</strong> until photos are added</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Preview modal */}
      {previewRow && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Row {previewRow.index} Preview</h2>
              <button onClick={() => setPreviewRow(null)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(previewRow.data).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-3 py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground w-32 shrink-0 font-medium">{k}</span>
                  <span className="text-xs text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
