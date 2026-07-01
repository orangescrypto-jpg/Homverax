/**
 * services/inspections.ts — backed by Cloudflare D1 (platform_settings JSON).
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";

export type InspectionStatus = "requested" | "approved" | "rejected" | "completed" | "cancelled";

export interface InspectionBooking {
  id: string; listingId: string; listingTitle: string; listingAddress: string;
  buyerId: string; buyerName: string; buyerPhone: string;
  sellerId: string; sellerName: string; proposedDates: string[];
  confirmedDate?: string; status: InspectionStatus; buyerNote?: string; sellerNote?: string;
  createdAt: string; updatedAt: string;
}

async function loadInspections(): Promise<InspectionBooking[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'inspections'", []);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as InspectionBooking[]; } catch { return []; }
}

async function saveInspections(inspections: InspectionBooking[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES ('inspections', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(inspections), now]);
}

async function updateInspection(id: string, updates: Partial<InspectionBooking>): Promise<void> {
  const all = await loadInspections();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveInspections(all);
}

export async function requestInspection(params: {
  listingId: string; listingTitle: string; listingAddress: string;
  buyerId: string; buyerName: string; buyerPhone: string;
  sellerId: string; sellerName: string; proposedDates: string[]; buyerNote?: string;
}): Promise<string> {
  const inspections = await loadInspections();
  const now = new Date().toISOString();
  const id = newId();
  inspections.push({ ...params, id, status: "requested", createdAt: now, updatedAt: now });
  await saveInspections(inspections);
  return id;
}

export async function approveInspection(inspectionId: string, confirmedDate: string, sellerNote?: string): Promise<void> {
  await updateInspection(inspectionId, { status: "approved", confirmedDate, sellerNote: sellerNote ?? "" });
}

export async function rejectInspection(inspectionId: string, sellerNote?: string): Promise<void> {
  await updateInspection(inspectionId, { status: "rejected", sellerNote: sellerNote ?? "" });
}

export async function completeInspection(inspectionId: string): Promise<void> {
  await updateInspection(inspectionId, { status: "completed" });
}

export async function cancelInspection(inspectionId: string): Promise<void> {
  await updateInspection(inspectionId, { status: "cancelled" });
}

export async function getBuyerInspections(buyerId: string): Promise<InspectionBooking[]> {
  const all = await loadInspections();
  return all.filter((i) => i.buyerId === buyerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSellerInspections(sellerId: string): Promise<InspectionBooking[]> {
  const all = await loadInspections();
  return all.filter((i) => i.sellerId === sellerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getListingInspections(listingId: string): Promise<InspectionBooking[]> {
  const all = await loadInspections();
  return all.filter((i) => i.listingId === listingId);
}
