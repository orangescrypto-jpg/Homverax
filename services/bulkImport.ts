/**
 * services/bulkImport.ts — backed by Cloudflare D1 (platform_settings JSON).
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";

export interface BulkImportRecord {
  id: string; agentId: string; agentName: string; rows: Record<string, string>[];
  totalRows: number; status: "pending" | "approved" | "rejected";
  approvedCount: number; rejectedCount: number; adminNote?: string;
  createdAt: string; processedAt?: string;
}

async function loadImports(): Promise<BulkImportRecord[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'bulk_imports'", []);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as BulkImportRecord[]; } catch { return []; }
}

async function saveImports(imports: BulkImportRecord[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES ('bulk_imports', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(imports), now]);
}

export async function submitBulkImport(agentId: string, agentName: string, rows: Record<string, string>[]): Promise<void> {
  const imports = await loadImports();
  imports.push({
    id: newId(), agentId, agentName, rows, totalRows: rows.length,
    status: "pending", approvedCount: 0, rejectedCount: 0, createdAt: new Date().toISOString(),
  });
  await saveImports(imports);
}

export async function getBulkImports(status?: "pending" | "approved" | "rejected"): Promise<BulkImportRecord[]> {
  const all = await loadImports();
  return (status ? all.filter((i) => i.status === status) : all)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function processBulkImport(importId: string, status: "approved" | "rejected", adminNote?: string): Promise<void> {
  const imports = await loadImports();
  const idx = imports.findIndex((i) => i.id === importId);
  if (idx === -1) return;
  imports[idx] = { ...imports[idx], status, adminNote: adminNote ?? undefined, processedAt: new Date().toISOString() };
  await saveImports(imports);
}
