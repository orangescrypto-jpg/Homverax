/**
 * services/leads.ts — backed by Cloudflare D1.
 * Same function signatures as the Firestore version.
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { getUserPlanStatus } from "@/services/subscriptions";

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed";
export type LeadType = "rental" | "purchase" | "shortlet" | "commercial" | "service";

export interface Lead {
  id: string; name: string; phone?: string; email?: string; userId?: string;
  type: LeadType; category?: string; state: string; lga?: string;
  minBudget?: number; maxBudget?: number; bedrooms?: number; message?: string;
  status: LeadStatus; assignedAgentId?: string; source: "form" | "saved_search" | "inquiry" | "whatsapp";
  createdAt: string; updatedAt: string;
}

interface LeadRow {
  id: string; name: string; phone: string | null; email: string | null; user_id: string | null;
  type: string; category: string | null; state: string; lga: string | null;
  min_budget: number | null; max_budget: number | null; bedrooms: number | null; message: string | null;
  status: string; assigned_agent_id: string | null; source: string; created_at: string; updated_at: string;
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id, name: row.name, phone: row.phone ?? undefined, email: row.email ?? undefined,
    userId: row.user_id ?? undefined, type: row.type as LeadType, category: row.category ?? undefined,
    state: row.state, lga: row.lga ?? undefined, minBudget: row.min_budget ?? undefined,
    maxBudget: row.max_budget ?? undefined, bedrooms: row.bedrooms ?? undefined,
    message: row.message ?? undefined, status: row.status as LeadStatus,
    assignedAgentId: row.assigned_agent_id ?? undefined, source: row.source as Lead["source"],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// Leads stored in platform_settings as JSON — quick workaround without a dedicated table
async function loadLeads(): Promise<Lead[]> {
  const rows = await d1Query<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'leads'", []);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value) as Lead[]; } catch { return []; }
}

async function saveLeads(leads: Lead[]): Promise<void> {
  const now = new Date().toISOString();
  await d1Exec("INSERT INTO platform_settings (key, value, updated_at) VALUES ('leads', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(leads), now]);
}

export async function createLead(params: Omit<Lead, "id" | "status" | "createdAt" | "updatedAt">): Promise<Lead> {
  const leads = await loadLeads();
  const now = new Date().toISOString();
  const lead: Lead = { ...params, id: newId(), status: "new", createdAt: now, updatedAt: now };
  leads.push(lead);
  await saveLeads(leads);
  return lead;
}

export async function getLeadsForAgent(agentId: string, planSlug: string, expiryIso?: string): Promise<Lead[]> {
  const planStatus = await getUserPlanStatus(agentId, planSlug, expiryIso);
  if (!planStatus.canAccessLeads) throw new Error("Upgrade to Pro or Premium to access leads.");
  const leads = await loadLeads();
  return leads.filter((l) => !l.assignedAgentId || l.assignedAgentId === agentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMyClaimedLeads(agentId: string): Promise<Lead[]> {
  const leads = await loadLeads();
  return leads.filter((l) => l.assignedAgentId === agentId);
}

export async function claimLead(leadId: string, agentId: string): Promise<void> {
  const leads = await loadLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) return;
  leads[idx] = { ...leads[idx], assignedAgentId: agentId, status: "contacted", updatedAt: new Date().toISOString() };
  await saveLeads(leads);
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  const leads = await loadLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) return;
  leads[idx] = { ...leads[idx], status, updatedAt: new Date().toISOString() };
  await saveLeads(leads);
}

export async function createLeadFromInquiry(params: {
  name: string; phone?: string; email?: string; userId?: string;
  state: string; lga?: string; type: LeadType; category?: string;
  minBudget?: number; maxBudget?: number; bedrooms?: number; message?: string;
}): Promise<Lead> {
  return createLead({ ...params, source: "inquiry" });
}
