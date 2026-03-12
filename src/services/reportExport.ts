import type jsPDF from "jspdf";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ExcelSheetDefinition {
  name: string;
  rows: Record<string, unknown>[];
}

export interface PdfReportSection {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export interface PdfChartData {
  title: string;
  type: "bar" | "line" | "donut";
  labels: string[];
  values: number[];
  /** hex color e.g. "#2e6b4e" */
  color?: string;
  /** unit appended to axis labels e.g. "kg", "EGP" */
  unit?: string;
}

export interface PdfKpiCard {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "amber" | "blue" | "default";
}

export interface ExportSystemReportPdfOptions {
  reportTitle: string;
  periodLabel: string;
  generatedAtLabel: string;
  summaryRows: Array<{ metric: string; value: string }>;
  sections: PdfReportSection[];
  fileName: string;
  // optional enrichment
  farmName?: string;
  preparedBy?: string;
  chartData?: PdfChartData[];
  kpiCards?: PdfKpiCard[];
  notes?: string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

type DocWithLastTable = jsPDF & { lastAutoTable?: { finalY: number } };

// brand palette
const C = {
  brand:      [46,  107, 78]  as RGB,
  brandDark:  [29,  74,  53]  as RGB,
  brandLight: [230, 240, 235] as RGB,
  white:      [255, 255, 255] as RGB,
  pageBg:     [244, 246, 240] as RGB,
  surface:    [255, 255, 255] as RGB,
  border:     [220, 228, 212] as RGB,
  text:       [28,  33,  23]  as RGB,
  textMid:    [72,  82,  63]  as RGB,
  textMuted:  [122, 136, 112] as RGB,
  profit:     [21,  128, 61]  as RGB,
  profitBg:   [220, 252, 231] as RGB,
  profitBdr:  [187, 247, 208] as RGB,
  loss:       [185, 28,  28]  as RGB,
  lossBg:     [254, 226, 226] as RGB,
  lossBdr:    [254, 202, 202] as RGB,
  warn:       [146, 64,  14]  as RGB,
  warnBg:     [254, 243, 199] as RGB,
  warnBdr:    [253, 230, 138] as RGB,
  blue:       [30,  64,  175] as RGB,
  blueBg:     [219, 234, 254] as RGB,
  blueBdr:    [147, 197, 253] as RGB,
  rowAlt:     [249, 250, 246] as RGB,
  headBg:     [28,  33,  23]  as RGB,
  chartPalette: [
    [46,107,78], [74,144,104], [217,119,6], [30,64,175],
    [185,28,28], [109,40,217], [15,118,110], [161,98,7],
  ] as RGB[],
};

type RGB = [number, number, number];

// ── Lazy deps ──
let _pdfDeps: Promise<{ jsPDF: new (...a: unknown[]) => jsPDF; autoTable: typeof import("jspdf-autotable").default }> | null = null;

const loadPdfDeps = async () => {
  if (!_pdfDeps) {
    _pdfDeps = Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([j, a]) => ({
      jsPDF: j.default as unknown as new (...a: unknown[]) => jsPDF,
      autoTable: a.default,
    }));
  }
  return _pdfDeps;
};

// ── Logo loader ──
const loadLogo = async (): Promise<string | null> => {
  try {
    const res = await fetch("/mazra3ty-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

// ── Draw helpers ──
function setFill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RGB)   { doc.setDrawColor(c[0], c[1], c[2]); }
function setTextC(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }

function rrect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: RGB, stroke?: RGB) {
  setFill(doc, fill);
  if (stroke) { setDraw(doc, stroke); doc.setLineWidth(0.25); doc.roundedRect(x, y, w, h, r, r, "FD"); }
  else doc.roundedRect(x, y, w, h, r, r, "F");
}

function hexRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function shortNum(n: number, unit = ""): string {
  const s = Math.abs(n) >= 1e6 ? `${(n/1e6).toFixed(1)}M`
           : Math.abs(n) >= 1e3 ? `${(n/1e3).toFixed(1)}K`
           : (n % 1 === 0 ? String(n) : n.toFixed(1));
  return unit ? `${s} ${unit}` : s;
}

function kpiColors(color?: PdfKpiCard["color"]) {
  if (color === "green")  return { bg: C.profitBg, text: C.profit, bdr: C.profitBdr };
  if (color === "red")    return { bg: C.lossBg,   text: C.loss,   bdr: C.lossBdr };
  if (color === "amber")  return { bg: C.warnBg,   text: C.warn,   bdr: C.warnBdr };
  if (color === "blue")   return { bg: C.blueBg,   text: C.blue,   bdr: C.blueBdr };
  return { bg: C.rowAlt, text: C.textMid, bdr: C.border };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lighten(c: RGB, t: number): RGB {
  return [lerp(c[0],255,t), lerp(c[1],255,t), lerp(c[2],255,t)] as RGB;
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function drawBarChart(doc: jsPDF, chart: PdfChartData, x: number, y: number, w: number, h: number) {
  if (!chart.values.length) return;
  const maxV  = Math.max(...chart.values, 1);
  const n     = chart.values.length;
  const barW  = Math.max(4, Math.min(20, (w - 12) / n - 2));
  const cH    = h - 14;
  const bY    = y + cH;
  const color = hexRgb(chart.color ?? "#2e6b4e");
  const totalW = n * (barW + 2) - 2;
  const startX = x + 5 + Math.max(0, (w - 10 - totalW) / 2);

  // axes
  setDraw(doc, C.border); doc.setLineWidth(0.25);
  doc.line(x+4, y, x+4, bY); doc.line(x+4, bY, x+w, bY);

  // gridlines
  doc.setLineWidth(0.12);
  [0.33, 0.66, 1].forEach(t => {
    const gy = bY - t * cH;
    setDraw(doc, C.border); doc.line(x+5, gy, x+w, gy);
    doc.setFontSize(5); setTextC(doc, C.textMuted);
    doc.text(shortNum(maxV * t, chart.unit ?? ""), x+3.5, gy+1, { align: "right", maxWidth: 10 });
  });

  chart.values.forEach((val, i) => {
    const bh  = Math.max(1, (val / maxV) * cH);
    const bx  = startX + i * (barW + 2);
    const by  = bY - bh;

    // shadow
    setFill(doc, lighten(color, 0.35));
    doc.rect(bx+0.5, by+0.5, barW, bh, "F");

    // bar (gradient effect via two passes)
    setFill(doc, lighten(color, 0.2));
    doc.rect(bx, by, barW, bh * 0.45, "F");
    setFill(doc, color);
    doc.rect(bx, by + bh * 0.45, barW, bh * 0.55, "F");

    // top cap
    setFill(doc, lighten(color, 0.1));
    doc.rect(bx, by, barW, 1.5, "F");

    // value label
    doc.setFontSize(5); setTextC(doc, C.textMid);
    doc.text(shortNum(val), bx + barW/2, by - 1.5, { align: "center" });

    // x label
    doc.setFontSize(5); setTextC(doc, C.textMuted);
    doc.text(String(chart.labels[i] ?? "").slice(0,9), bx + barW/2, bY + 4.5, { align: "center" });
  });
}

function drawLineChart(doc: jsPDF, chart: PdfChartData, x: number, y: number, w: number, h: number) {
  if (chart.values.length < 2) return;
  const maxV  = Math.max(...chart.values, 1);
  const minV  = Math.min(...chart.values);
  const range = maxV - minV || 1;
  const cH    = h - 14;
  const bY    = y + cH;
  const color = hexRgb(chart.color ?? "#2e6b4e");

  setDraw(doc, C.border); doc.setLineWidth(0.25);
  doc.line(x+4, y, x+4, bY); doc.line(x+4, bY, x+w, bY);

  doc.setLineWidth(0.12);
  [0.33, 0.66, 1].forEach(t => {
    const gy = bY - t * cH;
    setDraw(doc, C.border); doc.line(x+5, gy, x+w-1, gy);
    doc.setFontSize(5); setTextC(doc, C.textMuted);
    doc.text(shortNum(minV + range * t, chart.unit ?? ""), x+3.5, gy+1, { align: "right", maxWidth: 10 });
  });

  const pts: [number,number][] = chart.values.map((v, i) => [
    x + 5 + (i / (chart.values.length - 1)) * (w - 9),
    bY - ((v - minV) / range) * cH,
  ]);

  // filled area
  setFill(doc, lighten(color, 0.78));
  doc.lines(
    [[pts[0][0], bY], ...pts, [pts[pts.length-1][0], bY]].slice(1).map(([px,py], i2, arr) => {
      const prev = i2 === 0 ? [pts[0][0], bY] : arr[i2-1];
      return [px - (prev as number[])[0], py - (prev as number[])[1]] as [number,number];
    }),
    pts[0][0], bY, [1,1], "F"
  );

  // line
  setDraw(doc, color); doc.setLineWidth(0.8);
  for (let i = 1; i < pts.length; i++) doc.line(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);

  // dots
  pts.forEach(([px,py]) => {
    setFill(doc, C.white); doc.circle(px, py, 1.1, "F");
    setDraw(doc, color); doc.setLineWidth(0.55); doc.circle(px, py, 1.1, "D");
  });

  // x labels (sparse)
  const step = Math.max(1, Math.floor(chart.labels.length / 7));
  chart.labels.forEach((lbl, i) => {
    if (i % step !== 0 && i !== chart.labels.length - 1) return;
    doc.setFontSize(5); setTextC(doc, C.textMuted);
    doc.text(String(lbl).slice(0,8), pts[i][0], bY + 4.5, { align: "center" });
  });
}

function drawDonut(doc: jsPDF, chart: PdfChartData, cx: number, cy: number, r: number) {
  if (!chart.values.length) return;
  const total = chart.values.reduce((a,b) => a+b, 0) || 1;
  let angle = -Math.PI / 2;

  chart.values.forEach((val, i) => {
    const sweep = (val / total) * Math.PI * 2;
    const steps = Math.max(8, Math.round((sweep / (Math.PI*2)) * 72));
    const inner = r * 0.52;
    const outer: [number,number][] = [];
    const inr: [number,number][] = [];
    const col = C.chartPalette[i % C.chartPalette.length];

    for (let s = 0; s <= steps; s++) {
      const a = angle + sweep * (s / steps);
      outer.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r]);
    }
    for (let s = steps; s >= 0; s--) {
      const a = angle + sweep * (s / steps);
      inr.push([cx + Math.cos(a)*inner, cy + Math.sin(a)*inner]);
    }

    setFill(doc, col);
    const all = [...outer, ...inr];
    doc.lines(
      all.slice(1).map(([px,py], k) => [px-all[k][0], py-all[k][1]] as [number,number]),
      all[0][0], all[0][1], [1,1], "F"
    );
    angle += sweep;
  });

  // hole + center text
  setFill(doc, C.surface); doc.circle(cx, cy, r*0.52, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica","bold"); setTextC(doc, C.textMuted);
  doc.text("TOTAL", cx, cy - 2.5, { align: "center" });
  doc.setFontSize(9); setTextC(doc, C.text);
  doc.text(shortNum(chart.values.reduce((a,b)=>a+b,0)), cx, cy + 3.5, { align: "center" });
  doc.setFont("helvetica","normal");

  // legend
  const lx = cx + r + 5;
  let   ly = cy - (chart.values.length * 7) / 2;
  chart.values.forEach((val, i) => {
    const pct = ((val / total) * 100).toFixed(1);
    setFill(doc, C.chartPalette[i % C.chartPalette.length]);
    doc.roundedRect(lx, ly - 2.5, 5, 3.5, 0.8, 0.8, "F");
    doc.setFontSize(6.5); setTextC(doc, C.textMid);
    doc.text(`${String(chart.labels[i] ?? "").slice(0,14)}  ${pct}%`, lx + 7, ly+0.3);
    ly += 7;
  });
}

// ─── Page header / footer (pages 2+) ─────────────────────────────────────────

function stampPage(doc: jsPDF, page: number, total: number, title: string, period: string, logo: string | null) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // header band
  setFill(doc, C.brand);   doc.rect(0, 0, pw, 16, "F");
  setFill(doc, C.brandDark); doc.rect(0, 0, 4, 16, "F");

  if (logo) { try { doc.addImage(logo, "PNG", 6, 2, 12, 12); } catch { /**/ } }

  const tx = logo ? 22 : 8;
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); setTextC(doc, C.white);
  doc.text(title, tx, 8);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5); setTextC(doc, lighten(C.brand, 0.65));
  doc.text(`Period: ${period}`, tx, 13.5);

  doc.setFontSize(6.5); setTextC(doc, lighten(C.brand, 0.65));
  doc.text(`Page ${page} / ${total}`, pw - 10, 10, { align: "right" });

  // footer
  setFill(doc, C.brandDark); doc.rect(0, ph - 9, pw, 9, "F");
  doc.setFontSize(6); setTextC(doc, lighten(C.brand, 0.5));
  doc.text("Mazra3ty Smart Farms — Confidential", 8, ph - 3.5);
  doc.text("mazra3ty.app", pw - 10, ph - 3.5, { align: "right" });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const exportSystemReportPdf = async (options: ExportSystemReportPdfOptions): Promise<void> => {
  const { jsPDF, autoTable } = await loadPdfDeps();
  const logo = await loadLogo();

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true }) as DocWithLastTable;
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();  // 297
  const mx = 12;
  const cw = pw - mx * 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════

  // page background
  setFill(doc, C.pageBg); doc.rect(0, 0, pw, ph, "F");

  // hero band
  setFill(doc, C.brand);     doc.rect(0, 0, pw, 70, "F");
  setFill(doc, C.brandDark); doc.rect(0, 0, 5, 70, "F");

  // geometric accent (triangle top-right)
  doc.setFillColor(29, 74, 53);
  doc.triangle(pw - 55, 70, pw, 0, pw, 70, "F");

  // logo
  if (logo) { try { doc.addImage(logo, "PNG", 13, 9, 22, 22); } catch { /**/ } }

  // farm name / tagline
  const lx = logo ? 40 : 13;
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  setTextC(doc, lighten(C.brand, 0.6));
  doc.text((options.farmName ?? "Mazra3ty Smart Farms").toUpperCase(), lx, 16);
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  setTextC(doc, lighten(C.brand, 0.5));
  doc.text("Intelligent Poultry Farm Management Platform", lx, 22);

  // report title
  doc.setFont("helvetica","bold"); doc.setFontSize(20); setTextC(doc, C.white);
  const titleLines = doc.splitTextToSize(options.reportTitle, cw - 22) as string[];
  doc.text(titleLines, 13, 46);

  // ── Meta strip ──
  const metaY = 75;
  const metaCols = 3;
  const metaW = (cw - (metaCols-1)*4) / metaCols;
  const metaH = 19;
  const metas = [
    { label: "REPORTING PERIOD", value: options.periodLabel },
    { label: "GENERATED ON",     value: options.generatedAtLabel },
    { label: "PREPARED BY",      value: options.preparedBy ?? "System" },
  ];
  metas.forEach((m, i) => {
    const bx = mx + i * (metaW + 4);
    rrect(doc, bx, metaY, metaW, metaH, 3, C.surface, C.border);
    // left accent
    setFill(doc, C.brand);
    doc.roundedRect(bx, metaY, 3, metaH, 1.5, 1.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(6); setTextC(doc, C.textMuted);
    doc.text(m.label, bx + 7, metaY + 6);
    doc.setFont("helvetica","bold"); doc.setFontSize(8); setTextC(doc, C.text);
    doc.text(String(m.value).slice(0, 30), bx + 7, metaY + 13.5);
  });

  let curY = metaY + metaH + 8;

  // ── KPI Cards ──
  if (options.kpiCards?.length) {
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); setTextC(doc, C.textMid);
    doc.text("KEY PERFORMANCE INDICATORS", mx, curY);
    curY += 4;

    const cols  = Math.min(options.kpiCards.length, 4);
    const cardW = (cw - (cols-1)*4) / cols;
    const cardH = 24;

    options.kpiCards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx  = mx + col * (cardW + 4);
      const by  = curY + row * (cardH + 5);
      const cs  = kpiColors(card.color);

      rrect(doc, bx, by, cardW, cardH, 3, cs.bg, cs.bdr);

      // colored top bar
      setFill(doc, cs.text);
      doc.roundedRect(bx, by, cardW, 2.8, 1.5, 1.5, "F");
      doc.rect(bx, by+1.5, cardW, 1.3, "F");

      doc.setFont("helvetica","normal"); doc.setFontSize(6); setTextC(doc, C.textMuted);
      doc.text(card.label.toUpperCase(), bx + 5, by + 8.5);
      doc.setFont("helvetica","bold"); doc.setFontSize(11.5); setTextC(doc, cs.text);
      doc.text(card.value, bx + 5, by + 17.5);
      if (card.sub) {
        doc.setFont("helvetica","normal"); doc.setFontSize(6); setTextC(doc, C.textMuted);
        doc.text(card.sub, bx + 5, by + 22.5);
      }
    });

    curY += Math.ceil(options.kpiCards.length / 4) * (cardH + 5) + 5;
  }

  // ── Executive Summary table ──
  if (options.summaryRows?.length) {
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); setTextC(doc, C.textMid);
    doc.text("EXECUTIVE SUMMARY", mx, curY);
    curY += 2;

    autoTable(doc, {
      startY: curY,
      margin: { left: mx, right: mx },
      head: [["Metric", "Value"]],
      body: options.summaryRows.map(r => [r.metric, r.value]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, font: "helvetica" },
      headStyles: { fillColor: C.brand, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 82, textColor: C.textMid },
        1: { textColor: C.text },
      },
      tableLineColor: C.border, tableLineWidth: 0.2,
    });
    curY = (doc.lastAutoTable?.finalY ?? curY) + 6;
  }

  // ── Notes ──
  if (options.notes) {
    rrect(doc, mx, curY, cw, 16, 3, C.warnBg, C.warnBdr);
    setFill(doc, C.warn); doc.roundedRect(mx, curY, 3.5, 16, 1.5, 1.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7); setTextC(doc, C.warn);
    doc.text("NOTE", mx + 7, curY + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(7); setTextC(doc, C.textMid);
    const nl = doc.splitTextToSize(options.notes, cw - 32) as string[];
    doc.text(nl.slice(0, 2), mx + 24, curY + 7);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART PAGES (2 per page)
  // ═══════════════════════════════════════════════════════════════════════════

  const charts = options.chartData ?? [];

  for (let ci = 0; ci < charts.length; ci++) {
    if (ci % 2 === 0) {
      doc.addPage();
      setFill(doc, C.pageBg); doc.rect(0, 0, pw, ph, "F");
    }

    const chart  = charts[ci];
    const slot   = ci % 2;
    const slotH  = (ph - 36) / 2 - 6;
    const slotY  = 22 + slot * (slotH + 8);

    // card shell
    rrect(doc, mx, slotY, cw, slotH, 4, C.surface, C.border);

    // title bar
    setFill(doc, C.brand); doc.roundedRect(mx, slotY, cw, 11, 3, 3, "F");
    doc.rect(mx, slotY + 7, cw, 4, "F");
    setFill(doc, C.brandDark); doc.roundedRect(mx, slotY, 4, 11, 2, 2, "F");
    doc.rect(mx + 2, slotY, 2, 11, "F");

    doc.setFont("helvetica","bold"); doc.setFontSize(9); setTextC(doc, C.white);
    doc.text(chart.title, mx + 8, slotY + 8);

    // type badge
    rrect(doc, pw - mx - 20, slotY + 2.5, 18, 6.5, 2, C.brandDark);
    doc.setFontSize(6); setTextC(doc, C.white);
    doc.text(chart.type.toUpperCase(), pw - mx - 11, slotY + 7, { align: "center" });

    const cix  = mx + 6;
    const ciy  = slotY + 14;
    const ciw  = chart.type === "donut" ? slotH * 0.65 : cw - 12;
    const cih  = slotH - 18;

    if (chart.type === "bar") {
      drawBarChart(doc, chart, cix, ciy, ciw, cih);
    } else if (chart.type === "line") {
      drawLineChart(doc, chart, cix, ciy, ciw, cih);
    } else if (chart.type === "donut") {
      const dr = Math.min(cih * 0.44, 26);
      drawDonut(doc, chart, cix + dr + 8, ciy + cih / 2, dr);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA SECTION PAGES (one section per page)
  // ═══════════════════════════════════════════════════════════════════════════

  for (const section of options.sections) {
    doc.addPage();
    setFill(doc, C.pageBg); doc.rect(0, 0, pw, ph, "F");

    let sy = 22;

    // section header card
    rrect(doc, mx, sy, cw, 14, 3, C.brand);
    setFill(doc, C.brandDark); doc.roundedRect(mx, sy, 4, 14, 2, 2, "F");
    doc.rect(mx+2, sy, 2, 14, "F");

    doc.setFont("helvetica","bold"); doc.setFontSize(11); setTextC(doc, C.white);
    doc.text(section.title, mx + 8, sy + 10);

    // records badge
    rrect(doc, pw - mx - 26, sy + 3.5, 24, 7, 2.5, C.brandDark);
    doc.setFontSize(6.5); setTextC(doc, C.white);
    doc.text(`${section.rows.length} records`, pw - mx - 14, sy + 8.5, { align: "center" });

    sy += 17;

    autoTable(doc, {
      startY: sy,
      margin: { left: mx, right: mx },
      head: [section.columns],
      body: section.rows.length ? section.rows : [Array(section.columns.length).fill("No data")],
      theme: "plain",
      styles: {
        fontSize: 7.8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        textColor: C.text, overflow: "linebreak",
        lineColor: C.border, lineWidth: 0.2,
      },
      headStyles: {
        fillColor: C.headBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: Object.fromEntries(
        section.columns.map((_, i) => [i, { halign: i === 0 ? "left" : "right" as "left" | "right" }])
      ),
      tableLineColor: C.border, tableLineWidth: 0.2,
      willDrawCell: (data) => {
        if (data.section === "body" && typeof data.cell.raw === "string") {
          const raw = data.cell.raw as string;
          if (raw.startsWith("-")) data.cell.styles.textColor = C.loss;
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAMP ALL PAGES
  // ═══════════════════════════════════════════════════════════════════════════

  const total = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p === 1) {
      // cover footer only
      setFill(doc, C.brandDark); doc.rect(0, ph - 9, pw, 9, "F");
      doc.setFontSize(6); setTextC(doc, lighten(C.brand, 0.5));
      doc.text("Mazra3ty Smart Farms — Confidential", 8, ph - 3.5);
      doc.text(`Page 1 / ${total}`, pw - 10, ph - 3.5, { align: "right" });
    } else {
      stampPage(doc, p, total, options.reportTitle, options.periodLabel, logo);
    }
  }

  doc.save(`${options.fileName}.pdf`);
};

// ─── Excel exports (unchanged) ───────────────────────────────────────────────

export const exportExcelFile = async (
  sheetName: string,
  rows: Record<string, unknown>[],
  fileName: string
): Promise<void> => {
  const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), `${fileName}.xlsx`);
};

export const exportExcelWorkbook = async (
  sheets: ExcelSheetDefinition[],
  fileName: string
): Promise<void> => {
  const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const rows = s.rows.length ? s.rows : [{ Info: "No data in selected period" }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), s.name.slice(0, 31));
  }
  saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), `${fileName}.xlsx`);
};