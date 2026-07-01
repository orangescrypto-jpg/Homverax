/**
 * services/verification.ts — backed by Cloudflare D1 + R2 storage.
 * Uses dedicated `verifications` table (not just user status column).
 */
import { d1Query, d1Exec, newId } from "@/lib/d1";
import { uploadVerificationId, uploadVerificationSelfie } from "@/services/storage";
import type { VerificationRequest, VerificationStatus } from "@/types";
import { sendVerificationApprovedEmail } from "@/services/emailService";

interface VerifRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: string;
  status: string;
  bvn: string | null;
  nin: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  amount_paid: number;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

function rowToVerif(row: VerifRow): VerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    type: row.type as VerificationRequest["type"],
    status: row.status as VerificationStatus,
    bvn: row.bvn ?? undefined,
    nin: row.nin ?? undefined,
    idDocumentUrl: row.id_document_url ?? undefined,
    selfieUrl: row.selfie_url ?? undefined,
    amountPaid: row.amount_paid,
    rejectionReason: row.rejection_reason ?? undefined,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

export async function submitVerification(params: {
  userId: string;
  userName: string;
  userEmail: string;
  type: "agent" | "property";
  bvn?: string;
  nin?: string;
  idDocument?: File;
  selfie?: File;
  amountPaid: number;
}): Promise<VerificationRequest> {
  const idDocumentUrl = params.idDocument
    ? await uploadVerificationId(params.userId, params.idDocument)
    : undefined;
  const selfieUrl = params.selfie
    ? await uploadVerificationSelfie(params.userId, params.selfie)
    : undefined;

  const id = newId();
  const now = new Date().toISOString();

  // Upsert into verifications table (one row per user)
  await d1Exec(
    `INSERT INTO verifications
       (id, user_id, user_name, user_email, type, status, bvn, nin,
        id_document_url, selfie_url, amount_paid, submitted_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       user_name = excluded.user_name,
       user_email = excluded.user_email,
       type = excluded.type,
       status = 'pending',
       bvn = excluded.bvn,
       nin = excluded.nin,
       id_document_url = excluded.id_document_url,
       selfie_url = excluded.selfie_url,
       amount_paid = excluded.amount_paid,
       submitted_at = excluded.submitted_at,
       rejection_reason = NULL,
       reviewed_at = NULL`,
    [
      id, params.userId, params.userName, params.userEmail, params.type,
      params.bvn ?? null, params.nin ?? null,
      idDocumentUrl ?? null, selfieUrl ?? null,
      params.amountPaid, now,
    ]
  );

  // Mirror status on users table
  await d1Exec(
    "UPDATE users SET verification_status = 'pending', updated_at = ? WHERE id = ?",
    [now, params.userId]
  );

  return {
    id, userId: params.userId, userName: params.userName, userEmail: params.userEmail,
    type: params.type, status: "pending",
    bvn: params.bvn, nin: params.nin,
    idDocumentUrl, selfieUrl, amountPaid: params.amountPaid, submittedAt: now,
  };
}

export async function getMyVerification(userId: string): Promise<VerificationRequest | null> {
  const rows = await d1Query<VerifRow>(
    "SELECT * FROM verifications WHERE user_id = ?", [userId]
  );
  if (!rows.length) return null;
  return rowToVerif(rows[0]);
}

export async function getPendingVerifications(): Promise<VerificationRequest[]> {
  const rows = await d1Query<VerifRow>(
    "SELECT * FROM verifications WHERE status = 'pending' ORDER BY submitted_at ASC",
    []
  );
  return rows.map(rowToVerif);
}

export async function getAllVerifications(): Promise<VerificationRequest[]> {
  const rows = await d1Query<VerifRow>(
    "SELECT * FROM verifications ORDER BY submitted_at DESC",
    []
  );
  return rows.map(rowToVerif);
}

/**
 * Admin reviews a verification.
 * On approval: updates verifications table, mirrors to users table,
 * and fires the verification_approved email (fire-and-forget).
 */
export async function reviewVerification(
  verificationId: string,
  userId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Update verifications table
  await d1Exec(
    `UPDATE verifications
     SET status = ?, rejection_reason = ?, reviewed_at = ?
     WHERE id = ? OR user_id = ?`,
    [decision, rejectionReason ?? null, now, verificationId, userId]
  );

  // Mirror to users table
  await d1Exec(
    "UPDATE users SET verification_status = ?, is_verified = ?, updated_at = ? WHERE id = ?",
    [decision, decision === "approved" ? 1 : 0, now, userId]
  );

  // ── Email trigger: verification approved ──────────────────────────────────
  if (decision === "approved") {
    try {
      const rows = await d1Query<{ email: string; name: string }>(
        "SELECT email, name FROM users WHERE id = ?", [userId]
      );
      if (rows.length) {
        void sendVerificationApprovedEmail({
          userEmail:        rows[0].email,
          userName:         rows[0].name,
          verificationType: "Identity",
        });
      }
    } catch (err) {
      console.warn("[verification] reviewVerification email error:", err);
    }
  }
}
