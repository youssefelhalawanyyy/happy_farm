import type jsPDF from "jspdf";
import type { Quotation } from "@/types";

// ── Brand palette ─────────────────────────────────────────
const BRAND = {
  primary:    [31,  122, 99]  as [number,number,number], // #1F7A63
  primaryDark:[18,  74,  59]  as [number,number,number], // deep green
  accent:     [244, 185, 66]  as [number,number,number], // #F4B942
  dark:       [30,  41,  59]  as [number,number,number], // #1E293B
  muted:      [100, 116, 139] as [number,number,number], // #64748B
  subtle:     [148, 163, 184] as [number,number,number], // #94A3B8
  border:     [226, 232, 240] as [number,number,number], // #E2E8F0
  lightBg:    [240, 244, 240] as [number,number,number], // tinted green bg
  white:      [255, 255, 255] as [number,number,number],
  success:    [34,  197, 94]  as [number,number,number],
};

// ── Logo loader ───────────────────────────────────────────
const loadLogo = async (): Promise<string | null> => {
  try {
    const response = await fetch("/mazra3ty-logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ── Helpers ───────────────────────────────────────────────
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);

type DocWithLastTable = jsPDF & { lastAutoTable: { finalY: number } };

let pdfDepsPromise:
  | Promise<{ jsPDF: (new (...args: unknown[]) => jsPDF) & { API: unknown }; autoTable: typeof import("jspdf-autotable").default }>
  | null = null;

const loadPdfDeps = async (): Promise<{
  jsPDF: (new (...args: unknown[]) => jsPDF) & { API: unknown };
  autoTable: typeof import("jspdf-autotable").default;
}> => {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([import("jspdf"), import("jspdf-autotable")]).then(
      ([jspdfModule, autoTableModule]) => ({
        jsPDF: jspdfModule.default as (new (...args: unknown[]) => jsPDF) & { API: unknown },
        autoTable: autoTableModule.default
      })
    );
  }

  return pdfDepsPromise;
};

// ── Main export ───────────────────────────────────────────
export const exportQuotationPdf = async (quotation: Quotation): Promise<void> => {
  const { jsPDF, autoTable } = await loadPdfDeps();
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as DocWithLastTable;
  const logo = await loadLogo();
  const PW = 210; // page width mm
  const PH = 297; // page height mm

  // ── 1. HEADER BAND ──────────────────────────────────────
  // Full-width dark green header bar
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, PW, 42, "F");

  // Accent stripe at very top
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 0, PW, 3, "F");

  // Logo on the left inside header
  if (logo) {
    doc.addImage(logo, "PNG", 12, 8, 26, 26);
  }

  // Company name + tagline
  const textStartX = logo ? 44 : 14;
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MAZRA3TY", textStartX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.accent);
  doc.text("FARM INTELLIGENCE PLATFORM", textStartX, 26);

  // "QUOTATION" label — right side of header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...BRAND.white);
  doc.text("QUOTATION", PW - 14, 22, { align: "right" });

  // Accent underline beneath QUOTATION text
  doc.setFillColor(...BRAND.accent);
  doc.rect(PW - 14 - 56, 25, 56, 1.2, "F");

  // ── 2. META INFO ROW ─────────────────────────────────────
  // Light tinted band below header
  doc.setFillColor(...BRAND.lightBg);
  doc.rect(0, 42, PW, 20, "F");

  const metaItems: [string, string][] = [
    ["Quotation #",  quotation.quotationNumber],
    ["Date",         new Date().toLocaleDateString("en-EG")],
    ["Valid Until",  quotation.validUntil],
    ["Status",       "PENDING APPROVAL"],
  ];

  const colW = PW / metaItems.length;
  metaItems.forEach(([label, value], i) => {
    const x = i * colW + 14;
    // label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.muted);
    doc.text(label.toUpperCase(), x, 50);
    // value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    doc.text(value, x, 57);
    // vertical divider
    if (i > 0) {
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.3);
      doc.line(i * colW, 45, i * colW, 60);
    }
  });

  // ── 3. ADDRESSES SECTION ──────────────────────────────────
  let y = 72;

  // From / To cards side by side
  const cardW = 85;
  const cardH = 34;
  const gutter = 8;

  // "From" card — left
  doc.setFillColor(...BRAND.white);
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, cardW, cardH, 3, 3, "FD");

  // Green top bar on card
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(14, y, cardW, 7, 3, 3, "F");
  doc.rect(14, y + 3, cardW, 4, "F"); // fill bottom corners of bar

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.white);
  doc.text("FROM", 19, y + 5.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text("Mazra3ty Farm Operations", 19, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text("Cairo, Egypt", 19, y + 21);
  doc.text("operations@mazra3ty.com", 19, y + 27);

  // "Bill To" card — right
  const toX = 14 + cardW + gutter;
  doc.setFillColor(...BRAND.white);
  doc.setDrawColor(...BRAND.border);
  doc.roundedRect(toX, y, cardW, cardH, 3, 3, "FD");

  doc.setFillColor(...BRAND.accent);
  doc.roundedRect(toX, y, cardW, 7, 3, 3, "F");
  doc.rect(toX, y + 3, cardW, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.dark);
  doc.text("BILL TO", toX + 5, y + 5.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.dark);
  doc.text(quotation.customerName, toX + 5, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  if (quotation.customerContact) {
    doc.text(quotation.customerContact, toX + 5, y + 21);
  }

  // ── 4. ITEMS TABLE ────────────────────────────────────────
  y += cardH + 10;

  // Section label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.primary);
  doc.text("QUOTATION ITEMS", 14, y);
  doc.setFillColor(...BRAND.primary);
  doc.rect(14, y + 1.5, 36, 0.8, "F");

  autoTable(doc, {
    startY: y + 6,
    margin: { left: 14, right: 14 },
    head: [["#", "Description", "Qty", "Unit Price", "Total"]],
    body: quotation.items.map((item, i) => [
      String(i + 1),
      item.item,
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.total),
    ]),
    theme: "plain",
    headStyles: {
      fillColor: BRAND.dark,
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
    bodyStyles: {
      textColor: BRAND.dark,
      fontSize: 8.5,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    alternateRowStyles: {
      fillColor: BRAND.lightBg,
    },
    styles: {
      lineColor: BRAND.border,
      lineWidth: 0.2,
    },
    tableLineColor: BRAND.border,
    tableLineWidth: 0.3,
  });

  // ── 5. TOTALS BLOCK ───────────────────────────────────────
  const tableEndY = (doc as DocWithLastTable).lastAutoTable.finalY;
  let ty = tableEndY + 8;

  const discountPercent = quotation.discountPercent ?? 0;
  const taxPercent      = quotation.taxPercent ?? 0;
  const discountAmount  = quotation.discountAmount ?? quotation.discount ?? 0;
  const taxAmount       = quotation.taxAmount ?? quotation.tax ?? 0;

  const totalsLeft = 118;
  const totalsW    = PW - 14 - totalsLeft;

  // Totals container background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsLeft, ty, totalsW, 46, 3, 3, "FD");

  const labelX  = totalsLeft + 6;
  const valueX  = PW - 18;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.muted);
  doc.text("Subtotal", labelX, ty + 10);
  doc.setTextColor(...BRAND.dark);
  doc.text(formatCurrency(quotation.subtotal), valueX, ty + 10, { align: "right" });

  // Divider
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.2);
  doc.line(totalsLeft + 4, ty + 13, PW - 16, ty + 13);

  // Discount
  doc.setTextColor(...BRAND.muted);
  doc.text(`Discount (${discountPercent.toFixed(2)}%)`, labelX, ty + 20);
  doc.setTextColor(239, 68, 68);
  doc.text(`- ${formatCurrency(discountAmount)}`, valueX, ty + 20, { align: "right" });

  // Tax
  doc.setTextColor(...BRAND.muted);
  doc.text(`Tax (${taxPercent.toFixed(2)}%)`, labelX, ty + 28);
  doc.setTextColor(...BRAND.dark);
  doc.text(formatCurrency(taxAmount), valueX, ty + 28, { align: "right" });

  // Total — full-width accent band inside card
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(totalsLeft, ty + 33, totalsW, 13, 3, 3, "F");
  doc.rect(totalsLeft, ty + 33, totalsW, 6, "F"); // fill top corners

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.white);
  doc.text("TOTAL DUE", labelX, ty + 42);
  doc.text(formatCurrency(quotation.total), valueX, ty + 42, { align: "right" });

  // ── 6. NOTES / TERMS ──────────────────────────────────────
  const notesY = ty + 52;
  const notesW = totalsLeft - 28;

  doc.setFillColor(255, 252, 232); // warm amber tint
  doc.setDrawColor(...BRAND.accent);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, tableEndY + 8, notesW, 46, 3, 3, "FD");

  // Left accent bar
  doc.setFillColor(...BRAND.accent);
  doc.rect(14, tableEndY + 8, 3, 46, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.dark);
  doc.text("NOTES & TERMS", 22, tableEndY + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.muted);
  const notes = [
    "• Payment due within 30 days of quotation acceptance.",
    "• Prices valid until the date indicated above.",
    "• All transactions in Egyptian Pounds (EGP).",
    "• Delivery timelines subject to stock availability.",
  ];
  notes.forEach((line, i) => {
    doc.text(line, 22, tableEndY + 25 + i * 6);
  });

  // ── 7. SIGNATURE BLOCK ────────────────────────────────────
  const sigY = Math.max(notesY + 12, ty + 64);

  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);

  // Two signature boxes
  const sigBoxW = 76;
  const sigBoxH = 22;
  const sigGap  = 10;
  const sig1X   = 14;
  const sig2X   = 14 + sigBoxW + sigGap;

  [sig1X, sig2X].forEach((sx, i) => {
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.border);
    doc.roundedRect(sx, sigY, sigBoxW, sigBoxH, 2, 2, "FD");

    // Top label bar
    doc.setFillColor(...(i === 0 ? BRAND.primary : BRAND.dark));
    doc.roundedRect(sx, sigY, sigBoxW, 6, 2, 2, "F");
    doc.rect(sx, sigY + 3, sigBoxW, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.white);
    doc.text(i === 0 ? "PREPARED BY" : "ACCEPTED BY", sx + 5, sigY + 4.5);

    // Signature line
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.4);
    doc.line(sx + 6, sigY + 17, sx + sigBoxW - 6, sigY + 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.subtle);
    doc.text("Signature & Date", sx + sigBoxW / 2, sigY + 21, { align: "center" });
  });

  // ── 8. FOOTER BAND ────────────────────────────────────────
  const footH = 14;
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, PH - footH, PW, footH, "F");

  // Accent stripe at bottom
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, PH - 2.5, PW, 2.5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.subtle);
  doc.text("Thank you for your business — Mazra3ty Farm Intelligence Platform", PW / 2, PH - 8, { align: "center" });
  doc.setTextColor(...BRAND.accent);
  doc.text("www.mazra3ty.com  ·  operations@mazra3ty.com", PW / 2, PH - 4, { align: "center" });

  // ── 9. SAVE ───────────────────────────────────────────────
  doc.save(`quotation-${quotation.quotationNumber}.pdf`);
};
