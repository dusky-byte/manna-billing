import type { Invoice, InvoiceLine } from "./types";
import { amountInWords, inr, pdfDate } from "./format";
import { DECLARATION, DEFAULT_UNIT } from "./config";
import { stateOf } from "./gst";

let fonts: { reg: string; bold: string } | null = null;

async function b64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function loadFonts() {
  if (!fonts) fonts = { reg: await b64("/fonts/pdf-regular.ttf"), bold: await b64("/fonts/pdf-bold.ttf") };
  return fonts;
}

// A4, millimetres. Layout follows the Tally-style Bill of Supply (Invoice 61).
const L = 10, W = 190, R = L + W, Y0 = 18, TOP_H = 92, LW = 95, HEAD_H = 9, BODY_H = 100;
const CW = [6, 90.5, 20, 18.3, 18.3, 8.5, 28.4]; // Sl, description, HSN, qty, rate, per, amount
const CX = CW.map((_, i) => L + CW.slice(0, i).reduce((a, b) => a + b, 0));
const qty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));

type Row = { l: InvoiceLine; wrap: string[]; h: number };

export async function buildInvoicePdf(inv: Invoice, lines: InvoiceLine[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const f = await loadFonts();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("pdf-regular.ttf", f.reg);
  doc.addFont("pdf-regular.ttf", "Sans", "normal");
  doc.addFileToVFS("pdf-bold.ttf", f.bold);
  doc.addFont("pdf-bold.ttf", "Sans", "bold");
  doc.setLineWidth(0.2);

  const font = (bold: boolean, size: number) => {
    doc.setFont("Sans", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };
  const txt = (s: string, x: number, y: number, align: "left" | "right" | "center" = "left") => {
    doc.text(s, x, y, { align });
  };
  const ln = (x1: number, y1: number, x2: number, y2: number) => {
    doc.line(x1, y1, x2, y2);
  };
  const wrap = (s: string, w: number) => doc.splitTextToSize(s, w) as string[];

  const { seller: s, buyer: b } = inv;
  const sState = s.state ? { state: s.state, code: s.code } : stateOf(s.gstin);
  const bState = b.state ? { state: b.state, code: b.code } : stateOf(b.gstin);

  font(true, 7.5);
  const rows: Row[] = lines.map((l) => {
    const w = wrap(l.name, CW[1] - 2);
    return { l, wrap: w, h: w.length * 3.5 + 1.2 };
  });
  const pages: Row[][] = [[]];
  let used = 0;
  for (const r of rows) {
    if (used + r.h > BODY_H && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(r);
    used += r.h;
  }

  pages.forEach((pg, pi) => {
    if (pi) doc.addPage();
    const last = pi === pages.length - 1;

    font(false, 10);
    txt("Bill of Supply", 105, 14, "center");

    // ---- top block: seller / buyer (left) and reference grid (right)
    doc.rect(L, Y0, W, TOP_H);
    ln(L + LW, Y0, L + LW, Y0 + TOP_H);
    ln(L + LW + 47.5, Y0, L + LW + 47.5, Y0 + 60);
    for (let k = 1; k <= 6; k++) ln(L + LW, Y0 + k * 10, R, Y0 + k * 10);
    ln(L, Y0 + 30, L + LW, Y0 + 30);

    const cx1 = L + LW, cx2 = cx1 + 47.5;
    const cell = (cx: number, row: number, label: string, value = "") => {
      font(false, 7);
      txt(label, cx + 1, Y0 + row * 10 + 3.4);
      if (value) {
        font(true, 8.5);
        txt(value, cx + 1, Y0 + row * 10 + 8);
      }
    };
    cell(cx1, 0, "Invoice No.", String(inv.no));
    font(false, 7);
    txt("e-Way Bill No.", cx2 - 1, Y0 + 3.4, "right");
    cell(cx2, 0, "Dated", pdfDate(inv.date));
    cell(cx1, 1, "Delivery Note");
    cell(cx2, 1, "Mode/Terms of Payment");
    cell(cx1, 2, "Reference No. & Date.");
    cell(cx2, 2, "Other References");
    cell(cx1, 3, "Buyer’s Order No.");
    cell(cx2, 3, "Dated");
    cell(cx1, 4, "Dispatch Doc No.");
    cell(cx2, 4, "Delivery Note Date");
    cell(cx1, 5, "Dispatched through");
    cell(cx2, 5, "Destination");
    font(false, 7);
    txt("Terms of Delivery", cx1 + 1, Y0 + 63.4);

    let y = Y0 + 4;
    font(true, 8.5);
    for (const line of wrap(s.name, LW - 2)) {
      txt(line, L + 1, y);
      y += 3.5;
    }
    font(false, 7.5);
    for (const rawLine of s.address.split("\n").filter(Boolean)) {
      for (const a of wrap(rawLine, LW - 2)) {
        txt(a, L + 1, y);
        y += 3.5;
      }
    }
    if (s.gstin) {
      txt(`GSTIN/UIN: ${s.gstin}`, L + 1, y);
      y += 3.5;
    }
    if (sState.state) {
      txt(`State Name : ${sState.state}, Code : ${sState.code}`, L + 1, y);
      y += 3.5;
    }
    if (s.email) txt(`E-Mail : ${s.email}`, L + 1, y);

    y = Y0 + 33.4;
    font(false, 7);
    txt("Buyer (Bill to)", L + 1, y);
    y += 4;
    font(true, 8);
    for (const n of wrap(b.name, LW - 2)) {
      txt(n, L + 1, y);
      y += 3.6;
    }
    font(false, 7.5);
    for (const rawLine of b.address.split("\n").filter(Boolean)) {
      for (const a of wrap(rawLine, LW - 2)) {
        txt(a, L + 1, y);
        y += 3.5;
      }
    }
    if (b.gstin) {
      txt("GSTIN/UIN", L + 1, y);
      txt(`: ${b.gstin}`, L + 24, y);
      y += 3.5;
    }
    if (bState.state) {
      txt("State Name", L + 1, y);
      txt(`: ${bState.state}, Code : ${bState.code}`, L + 24, y);
    }

    // ---- item table
    const yh = Y0 + TOP_H, yb = yh + HEAD_H, ye = yb + BODY_H;
    doc.rect(L, yh, W, HEAD_H);
    font(false, 7);
    txt("Sl", CX[0] + CW[0] / 2, yh + 3.6, "center");
    txt("No.", CX[0] + CW[0] / 2, yh + 6.6, "center");
    ["Description of Goods", "HSN/SAC", "Quantity", "Rate", "per", "Amount"].forEach((t, i) =>
      txt(t, CX[i + 1] + CW[i + 1] / 2, yh + 5.6, "center")
    );
    doc.rect(L, yb, W, BODY_H);
    for (let i = 1; i < 7; i++) ln(CX[i], yh, CX[i], ye);

    let ry = yb + 1;
    for (const r of pg) {
      const base = ry + 3;
      const unit = r.l.unit || DEFAULT_UNIT;
      font(false, 7.5);
      txt(String(r.l.sl), CX[0] + CW[0] - 1, base, "right");
      font(true, 7.5);
      r.wrap.forEach((w, k) => txt(w, CX[1] + 1, base + k * 3.5));
      font(false, 7.5);
      txt(r.l.hsn, CX[2] + 1, base);
      font(true, 7.5);
      txt(`${qty(r.l.qty)} ${unit}`, CX[3] + CW[3] - 1, base, "right");
      font(false, 7.5);
      txt(inr(r.l.rate), CX[4] + CW[4] - 1, base, "right");
      txt(unit, CX[5] + 1, base);
      font(true, 7.5);
      txt(inr(r.l.amount), CX[6] + CW[6] - 1, base, "right");
      ry += r.h;
    }

    if (!last) {
      font(false, 7);
      txt("continued …", R - 1, ye - 1.5, "right");
      return;
    }

    // ---- total row
    doc.rect(L, ye, W, 6);
    for (let i = 1; i < 7; i++) ln(CX[i], ye, CX[i], ye + 6);
    font(false, 7.5);
    txt("Total", CX[1] + CW[1] - 1, ye + 4, "right");
    const tq = lines.reduce((a, l) => a + l.qty, 0);
    const units = new Set(lines.map((l) => l.unit || DEFAULT_UNIT));
    const totalQtyText = units.size === 1 ? `${qty(tq)} ${[...units][0]}` : qty(tq);
    font(true, 7.5);
    txt(totalQtyText, CX[3] + CW[3] - 1, ye + 4, "right");
    font(true, 9.5);
    txt(`₹ ${inr(inv.total)}`, R - 1, ye + 4.3, "right");

    // ---- amount in words
    let y2 = ye + 6;
    font(true, 8.5);
    const words = wrap(amountInWords(inv.total), W - 2);
    const hAC = 8 + words.length * 3.8;
    doc.rect(L, y2, W, hAC);
    font(false, 7);
    txt("Amount Chargeable (in words)", L + 1, y2 + 3.2);
    txt("E. & O.E", R - 1, y2 + 3.2, "right");
    font(true, 8.5);
    words.forEach((w, k) => txt(w, L + 1, y2 + 7.6 + k * 3.8));
    y2 += hAC;

    // ---- HSN summary
    const groups = new Map<string, number>();
    for (const l of lines) {
      const k = l.hsn || "-";
      groups.set(k, Math.round(((groups.get(k) ?? 0) + l.amount) * 100) / 100);
    }
    const c1 = W - 28.4, hH = 8, rH = 4.6, tH = hH + (groups.size + 1) * rH;
    doc.rect(L, y2, W, tH);
    ln(L + c1, y2, L + c1, y2 + tH);
    ln(L, y2 + hH, R, y2 + hH);
    font(false, 7);
    txt("HSN/SAC", L + c1 / 2, y2 + 4.8, "center");
    txt("Taxable", R - 1, y2 + 3.4, "right");
    txt("Value", R - 1, y2 + 6.6, "right");
    let yr = y2 + hH;
    groups.forEach((amt, h) => {
      font(false, 7.5);
      txt(h, L + 1, yr + 3.4);
      txt(inr(amt), R - 1, yr + 3.4, "right");
      yr += rH;
    });
    ln(L, yr, R, yr);
    font(true, 7.5);
    txt("Total", L + c1 - 1, yr + 3.4, "right");
    txt(inr(inv.total), R - 1, yr + 3.4, "right");
    y2 += tH;

    // ---- tax in words, declaration, signature
    font(false, 7.5);
    const declLines = wrap(DECLARATION, LW - 3);
    const footH = Math.max(25, 13 + declLines.length * 3.5);
    doc.rect(L, y2, W, footH);
    ln(L + LW, y2 + 5, R, y2 + 5);
    ln(L + LW, y2 + 5, L + LW, y2 + footH);

    font(false, 7.5);
    txt("Tax Amount (in words) :", L + 1, y2 + 3.5);
    font(true, 7.5);
    txt("NIL", L + 34, y2 + 3.5);

    font(false, 7.5);
    txt("Declaration", L + 1, y2 + 9);
    ln(L + 1, y2 + 9.7, L + 15.5, y2 + 9.7);
    declLines.forEach((t, k) => txt(t, L + 1, y2 + 13 + k * 3.5));

    font(true, 8);
    txt(`for ${s.name}`, R - 1, y2 + 9, "right");
    font(false, 7.5);
    txt("Authorised Signatory", R - 1, y2 + footH - 2, "right");
    txt("This is a Computer Generated Invoice", 105, y2 + footH + 5, "center");
  });

  return doc.output("blob");
}
