"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCustomItem, getSeller, nextInvoiceNo, saveInvoice, searchItems } from "@/lib/repo";
import { inr, today } from "@/lib/format";
import { GSTIN_RE, normGstin, stateOf } from "@/lib/gst";
import { DEFAULT_HSN, DEFAULT_SELLER, DEFAULT_UNIT } from "@/lib/config";
import { BILLING_DRAFT_KEY, readBillingDraft, writeBillingDraft } from "@/lib/billing-draft";
import type { Buyer, Item, Line, Seller } from "@/lib/types";

const MINROWS = 8;
const NO_BUYER: Buyer = { name: "", address: "", gstin: "", state: "", code: "" };

export default function NewBill() {
  const router = useRouter();
  const qRef = useRef<HTMLInputElement>(null);
  const [no, setNo] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [seller, setSeller] = useState<Seller>(DEFAULT_SELLER);
  const [buyer, setBuyer] = useState<Buyer>(NO_BUYER);
  const [q, setQ] = useState("");
  const [picks, setPicks] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    nextInvoiceNo().then(setNo).catch((e) => setErrs([String(e)]));
    getSeller().then(setSeller).catch((e) => setErrs([String(e)]));
    try {
      const draft = readBillingDraft();
      if (draft) {
        setDate(draft.date);
        setBuyer(draft.buyer);
        setLines(draft.lines);
      }
    } catch (e) {
      setErrs([String(e)]);
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    try {
      writeBillingDraft({ date, buyer, lines });
    } catch (e) {
      setErrs([String(e)]);
    }
  }, [draftReady, date, buyer, lines]);
  useEffect(() => {
    let live = true;
    searchItems(q).then((r) => live && setPicks(r)).catch(() => {});
    return () => { live = false; };
  }, [q]);

  // ---- items
  const add = (i: Item) =>
    setLines((ls) => {
      const at = ls.findIndex((l) => l.itemId === i.id);
      if (at >= 0) return ls.map((l, k) => (k === at ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { itemId: i.id, code: i.code, name: i.name, hsn: i.hsn || DEFAULT_HSN, unit: i.unit || DEFAULT_UNIT, qty: 1, rate: i.rate }];
    });
  // New items are saved to the database straight away; an existing name is reused, never duplicated.
  const addCustom = async (name: string) => {
    try { add(await addCustomItem(name)); setQ(""); } catch (e) { setErrs([String(e)]); }
  };
  const patch = (k: number, p: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === k ? { ...l, ...p } : l)));

  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.rate, 0) * 100) / 100;
  const qtyTotal = lines.reduce((s, l) => s + (l.qty || 0), 0);

  const validate = (): string[] => {
    const e: string[] = [];
    if (!date) e.push("Date is required.");
    if (!seller.name.trim()) e.push("Seller name is required.");
    if (!GSTIN_RE.test(normGstin(seller.gstin))) e.push("Seller GSTIN is missing or invalid. Use Edit seller.");
    if (!buyer.name.trim()) e.push("Buyer name is required.");
    if (!buyer.gstin) e.push("Buyer GSTIN is required.");
    else if (!GSTIN_RE.test(buyer.gstin)) e.push("Buyer GSTIN is invalid (15 characters, e.g. 33AAFCT3292B1ZN).");
    const used = lines.filter((l) => l.qty > 0);
    if (!used.length) e.push("Add at least one item with a quantity.");
    if (used.some((l) => !(l.rate > 0))) e.push("Every item needs a rate.");
    return e;
  };

  const clear = () => { setLines([]); setBuyer(NO_BUYER); setDate(today()); setQ(""); setErrs([]); };
  const save = async () => {
    if (busy) return;
    const e = validate();
    setErrs(e);
    if (e.length) return;
    setBusy(true);
    try {
      const st = stateOf(buyer.gstin);
      const n = await saveInvoice({ date, seller, buyer: { ...buyer, name: buyer.name.trim(), address: buyer.address.trim(), ...st }, lines });
      sessionStorage.removeItem(BILLING_DRAFT_KEY);
      router.push(`/invoice?no=${n}&dl=1`);
    } catch (x) {
      setErrs([String(x)]); setBusy(false);
    }
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const v = q.trim();
    if (!v) return;
    const hit = picks.find((i) => i.code.toLowerCase() === v.toLowerCase()) ?? picks[0];
    if (hit) add(hit); else addCustom(v);
    setQ("");
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); save(); }
      else if (e.key === "F3") { e.preventDefault(); qRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); clear(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const filler = Math.max(0, MINROWS - lines.length);
  const hasQ = q.trim().length > 0;

  return (
    <>
      <div className="strip">
        <label>Invoice No <output className="box">{no ?? "…"}</output></label>
        <label>Date <span className="req">*</span> <input type="date" value={date} className={date ? "" : "bad"} onChange={(e) => setDate(e.target.value)} /></label>
      </div>

      <div className="parties">
        <section className="party-card">
          <div className="ph">Seller</div>
          <div className="party-info">
            <strong>{seller.name}</strong>
            <span>{seller.gstin ? `GSTIN ${seller.gstin} · ${seller.state}, ${seller.code}` : "Seller GSTIN not set"}</span>
            <button className="b" onClick={() => router.push("/seller")}>Edit seller details</button>
          </div>
        </section>

        <section className="party-card">
          <div className="ph">Buyer (Bill to) <span className="req">*</span></div>
          <div className="party-info">
            <strong>{buyer.name || "No buyer selected"}</strong>
            <span>{buyer.gstin ? `GSTIN ${buyer.gstin} · ${buyer.state}, ${buyer.code}` : "Buyer GSTIN required"}</span>
            <button className="b" onClick={() => router.push("/buyer")}>{buyer.name ? "Edit / choose buyer" : "Add / choose buyer"}</button>
          </div>
        </section>
      </div>

      <div className="cols">
        <section className="panel items">
          <div className="ph">Items</div>
          <input ref={qRef} placeholder="Code or name, Enter to add" autoComplete="off" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} />
          <div className="ilist">
            <table className="g">
              <thead><tr><th>Code</th><th>Item</th><th className="num">Rate</th></tr></thead>
              <tbody>
                {picks.map((i, n) => (
                  <tr key={i.id} className={"pick" + (hasQ && n === 0 ? " sel" : "")} onClick={() => add(i)}>
                    <td>{i.code || "—"}</td><td>{i.name}</td><td className="num">{inr(i.rate)}</td>
                  </tr>
                ))}
                {hasQ && picks.length === 0 && (
                  <tr className="pick sel" onClick={() => { addCustom(q.trim()); setQ(""); }}>
                    <td colSpan={3}>+ Add “{q.trim()}” as a new item (Enter)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="ph">Bill</div>
          <div className="grid">
            <table className="g">
              <thead><tr><th>Sl</th><th>Description</th><th>HSN</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {lines.map((l, k) => (
                  <tr key={k}>
                    <td className="num">{k + 1}</td><td>{l.name}</td>
                    <td><input style={{ width: 64, textAlign: "left" }} value={l.hsn} aria-label="HSN" onChange={(e) => patch(k, { hsn: e.target.value })} /></td>
                    <td><input type="number" min={0} step="any" value={l.qty} aria-label="Quantity" onChange={(e) => patch(k, { qty: Number(e.target.value) })} /></td>
                    <td><input type="number" min={0} step="any" value={l.rate} aria-label="Rate" onChange={(e) => patch(k, { rate: Number(e.target.value) })} /></td>
                    <td className="num">{inr(l.qty * l.rate)}</td>
                    <td><button className="x" aria-label="Remove item" onClick={() => setLines((ls) => ls.filter((_, i) => i !== k))}>×</button></td>
                  </tr>
                ))}
                {Array.from({ length: filler }, (_, i) => (
                  <tr key={`f${i}`}><td>&nbsp;</td><td /><td /><td /><td /><td /><td /></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="foot">
        <div className="stats"><span>Items {lines.length}</span><span>Qty {qtyTotal}</span></div>
        <div className="lcdwrap"><div className="lcdlabel">TOTAL</div><div className="lcd">{inr(total)}</div></div>
      </div>
      {errs.length > 0 && <ul className="errs">{errs.map((e) => <li key={e}>• {e}</li>)}</ul>}

      <div className="fkeys noprint">
        <button className="b" disabled={busy} onClick={save}><kbd>F2</kbd>Save &amp; PDF</button>
        <button className="b" onClick={() => qRef.current?.focus()}><kbd>F3</kbd>Find item</button>
        <button className="b" onClick={clear}><kbd>F4</kbd>Clear bill</button>
      </div>
    </>
  );
}