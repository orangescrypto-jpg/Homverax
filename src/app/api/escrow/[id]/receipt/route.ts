/**
 * app/api/escrow/[id]/receipt/route.ts
 * GET /api/escrow/[id]/receipt — generates and streams a PDF receipt for a
 * completed (released) escrow transaction.
 *
 * Only available once escrow.status === "released" — that's the point where
 * money has actually changed hands (buyer confirmed delivery / admin
 * released funds to seller), so it's the only point a receipt is accurate.
 * Gated to the buyer or seller on this specific escrow (or admin/moderator),
 * same access pattern as /api/escrow/[id].
 */
import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { d1Query } from "@/lib/d1";
import type { EscrowTransaction, EscrowStatus } from "@/types";

interface EscrowRow {
  id: string; listing_id: string; buyer_id: string; seller_id: string;
  amount: number; status: string; release_at: string | null;
  created_at: string; updated_at: string; meta: string | null;
}

function rowToEscrow(row: EscrowRow): EscrowTransaction {
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row.meta || "{}"); } catch {}
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: (meta.listingTitle as string) ?? "",
    listingImage: (meta.listingImage as string) ?? "",
    listingPrice: (meta.listingPrice as number) ?? row.amount,
    listingLocation: (meta.listingLocation as string) ?? "",
    listingType: ((meta.listingType as string) ?? "sale") as EscrowTransaction["listingType"],
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: row.amount,
    buyerServiceCharge: (meta.buyerServiceCharge as number) ?? 0,
    buyerServiceChargePercent: (meta.buyerServiceChargePercent as number) ?? 0,
    buyerServiceChargeLabel: (meta.buyerServiceChargeLabel as string) ?? "Service Charge",
    buyerTotal: (meta.buyerTotal as number) ?? row.amount,
    platformFee: (meta.platformFee as number) ?? 0,
    platformFeePercent: (meta.platformFeePercent as number) ?? 0,
    sellerReceives: (meta.sellerReceives as number) ?? row.amount,
    status: row.status as EscrowStatus,
    role: "buyer", // overwritten by caller where relevant; unused for the PDF itself
    paymentReference: (meta.paymentReference as string) ?? undefined,
    transferReference: (meta.transferReference as string) ?? undefined,
    receiptUrl: (meta.receiptUrl as string) ?? undefined,
    depositPaidAt: (meta.depositPaidAt as string) ?? undefined,
    releasedAt: (meta.releasedAt as string) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function money(n: number): string {
  return `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await d1Query<EscrowRow>("SELECT * FROM escrows WHERE id = ?", [id]);
  if (!rows.length) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  const escrow = rowToEscrow(rows[0]);

  // Access control: buyer, seller, or staff only.
  const userRows = await d1Query<{ role: string }>("SELECT role FROM users WHERE id = ?", [user.id]);
  const isStaff = ["admin", "moderator"].includes(userRows[0]?.role ?? "");
  const isParty = user.id === escrow.buyerId || user.id === escrow.sellerId;
  if (!isParty && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Receipts only make sense once funds have actually moved.
  if (escrow.status !== "released") {
    return NextResponse.json(
      { error: "Receipt is only available after funds have been released." },
      { status: 400 }
    );
  }

  const users = await d1Query<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE id IN (?, ?)",
    [escrow.buyerId, escrow.sellerId]
  );
  const buyer  = users.find((u) => u.id === escrow.buyerId);
  const seller = users.find((u) => u.id === escrow.sellerId);

  // ── Build the PDF ─────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primary = rgb(0.05, 0.2, 0.55);
  const muted   = rgb(0.45, 0.45, 0.45);
  const dark    = rgb(0.1, 0.1, 0.1);
  const line    = rgb(0.85, 0.85, 0.85);

  let y = height - 60;
  const marginX = 50;
  const contentWidth = width - marginX * 2;

  const drawText = (text: string, x: number, yPos: number, opts?: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> }) => {
    page.drawText(text, {
      x, y: yPos, size: opts?.size ?? 10, font: opts?.f ?? font, color: opts?.color ?? dark,
    });
  };

  const drawLine = (yPos: number) => {
    page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width - marginX, y: yPos }, thickness: 0.75, color: line });
  };

  // ── Header ──────────────────────────────────────────────────────────
  drawText("HomveraX", marginX, y, { size: 22, f: bold, color: primary });
  drawText("Escrow Payment Receipt", marginX, y - 20, { size: 11, color: muted });
  drawText(`Receipt #${escrow.id.slice(0, 12).toUpperCase()}`, width - marginX - 180, y, { size: 10, color: muted });
  drawText(`Issued: ${formatDate(new Date().toISOString())}`, width - marginX - 180, y - 15, { size: 9, color: muted });
  y -= 45;
  drawLine(y);
  y -= 30;

  // ── Status banner ───────────────────────────────────────────────────
  drawText("PAYMENT COMPLETE — FUNDS RELEASED", marginX, y, { size: 12, f: bold, color: rgb(0.1, 0.5, 0.2) });
  y -= 25;

  // ── Property details ────────────────────────────────────────────────
  drawText("Property", marginX, y, { size: 9, f: bold, color: muted });
  y -= 16;
  drawText(escrow.listingTitle || "—", marginX, y, { size: 12, f: bold });
  y -= 15;
  if (escrow.listingLocation) {
    drawText(escrow.listingLocation, marginX, y, { size: 10, color: muted });
    y -= 15;
  }
  drawText(`Transaction type: ${escrow.listingType.charAt(0).toUpperCase() + escrow.listingType.slice(1)}`, marginX, y, { size: 10, color: muted });
  y -= 30;
  drawLine(y);
  y -= 25;

  // ── Parties ─────────────────────────────────────────────────────────
  const colWidth = contentWidth / 2;
  drawText("Buyer", marginX, y, { size: 9, f: bold, color: muted });
  drawText("Seller", marginX + colWidth, y, { size: 9, f: bold, color: muted });
  y -= 16;
  drawText(buyer?.name ?? "—", marginX, y, { size: 11, f: bold });
  drawText(seller?.name ?? "—", marginX + colWidth, y, { size: 11, f: bold });
  y -= 15;
  drawText(buyer?.email ?? "—", marginX, y, { size: 9, color: muted });
  drawText(seller?.email ?? "—", marginX + colWidth, y, { size: 9, color: muted });
  y -= 30;
  drawLine(y);
  y -= 25;

  // ── Payment breakdown ───────────────────────────────────────────────
  drawText("Payment Breakdown", marginX, y, { size: 9, f: bold, color: muted });
  y -= 20;

  const rowsData: [string, string][] = [
    ["Listing price", money(escrow.amount)],
    [escrow.buyerServiceChargeLabel || "Buyer service charge", money(escrow.buyerServiceCharge)],
    ["Total paid by buyer", money(escrow.buyerTotal)],
  ];
  rowsData.forEach(([label, value], i) => {
    const isTotal = i === rowsData.length - 1;
    drawText(label, marginX, y, { size: 10, f: isTotal ? bold : font, color: isTotal ? dark : muted });
    drawText(value, width - marginX - 120, y, { size: 10, f: isTotal ? bold : font, color: isTotal ? dark : muted });
    y -= 18;
  });
  y -= 5;
  drawLine(y);
  y -= 25;

  const rowsData2: [string, string][] = [
    ["HomveraX platform fee", money(escrow.platformFee)],
    ["Amount released to seller", money(escrow.sellerReceives)],
  ];
  rowsData2.forEach(([label, value], i) => {
    const isTotal = i === rowsData2.length - 1;
    drawText(label, marginX, y, { size: 10, f: isTotal ? bold : font, color: isTotal ? primary : muted });
    drawText(value, width - marginX - 120, y, { size: 10, f: isTotal ? bold : font, color: isTotal ? primary : muted });
    y -= 18;
  });
  y -= 15;
  drawLine(y);
  y -= 25;

  // ── Timeline ────────────────────────────────────────────────────────
  drawText("Transaction Timeline", marginX, y, { size: 9, f: bold, color: muted });
  y -= 20;
  const timeline: [string, string | undefined][] = [
    ["Escrow opened",        escrow.createdAt],
    ["Payment confirmed",    escrow.depositPaidAt],
    ["Funds released",       escrow.releasedAt],
  ];
  timeline.forEach(([label, date]) => {
    drawText(label, marginX, y, { size: 9, color: muted });
    drawText(formatDate(date), width - marginX - 180, y, { size: 9, color: dark });
    y -= 16;
  });
  if (escrow.paymentReference) {
    y -= 5;
    drawText(`Payment reference: ${escrow.paymentReference}`, marginX, y, { size: 8, color: muted });
    y -= 14;
  }
  if (escrow.transferReference) {
    drawText(`Transfer reference: ${escrow.transferReference}`, marginX, y, { size: 8, color: muted });
  }

  // ── Footer ──────────────────────────────────────────────────────────
  const footerY = 60;
  drawLine(footerY + 20);
  drawText(
    "This receipt confirms that escrow funds for this transaction have been released. Keep it for your records.",
    marginX, footerY, { size: 8, color: muted }
  );
  drawText(`Generated by HomveraX — escrow@homverax.com`, marginX, footerY - 12, { size: 8, color: muted });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="HomveraX-Receipt-${escrow.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
