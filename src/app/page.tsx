"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextInvoiceNo, saveInvoice, searchItems } from "@/lib/repo";
import { inr, today } from "@/lib/format";
import type { Item, Line } from "@/lib/types";

const MINROWS = 10;

export default function NewBill() {
  const router = useRouter();
  const qRef = useRef<HTMLInputElement>(null);
  const [no, setNo] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [picks, setPicks] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { nextInvoiceNo().then(setNo).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    let live = true;
    searchItems(q).then((r) => live && setPicks(r)).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [q]);

  const add = (i: Item) =>
    setLines((ls) => {
      const at = ls.findIndex((l) => l.itemId === i.id);
      if (at >= 0) return ls.map((l, k) => (k === at ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { itemId: i.id, code: i.code, name: i.name, hsn: i.hsn, unit: i.unit, qty: 1, rate: i.rate }];
    });
  const addCustom = (name: string) =>
    setLines((ls) => [...ls, { itemId: null, code: "", name, hsn: "", unit: "pcs", qty: 1, rate: 0 }]);
  const patch = (k: number, p: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === k ? { ...l, ...p } : l)));

  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.rate, 0) * 100) / 100;
  const qty = lines.reduce((s, l) => s + (l.qty || 0), 0);
  const ready = lines.some((l) => l.qty > 0);

  const clear = () => { setLines([]); setCustomer(""); setPhone(""); setDate(today()); setQ(""); setErr(""); };
  const save = async () => {
    if (busy || !ready) return;
    setBusy(true); setErr("");
    try {
      router.push(`/invoice?no=${await saveInvoice({ date, customer, phone, lines })}`);
    } catch (e) {
      setErr(String(e)); setBusy(false);
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
        <label>Bill No <output className="box">{no ?? "…"}</output></label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="grow">Customer <input value={customer} onChange={(e) => setCustomer(e.target.value)} /></label>
        <label>Phone <input inputMode="tel" size={12} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
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
                    <td>{i.code}</td><td>{i.name}</td><td className="num">{inr(i.rate)}</td>
                  </tr>
                ))}
                {hasQ && picks.length === 0 && (
                  <tr className="pick sel" onClick={() => { addCustom(q.trim()); setQ(""); }}>
                    <td colSpan={3}>+ Add “{q.trim()}” as custom item (Enter)</td>
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
              <thead><tr><th>Sl</th><th>Code</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {lines.map((l, k) => (
                  <tr key={k}>
                    <td className="num">{k + 1}</td><td>{l.code || "—"}</td><td>{l.name}</td>
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
        <div className="stats"><span>Items {lines.length}</span><span>Qty {qty}</span></div>
        <div className="lcdwrap"><div className="lcdlabel">TOTAL</div><div className="lcd">{inr(total)}</div></div>
      </div>
      {err && <p className="note" style={{ color: "var(--alert)" }}>{err}</p>}

      <div className="fkeys noprint">
        <button className="b" disabled={!ready || busy} onClick={save}><kbd>F2</kbd>Save &amp; Print</button>
        <button className="b" onClick={() => qRef.current?.focus()}><kbd>F3</kbd>Find item</button>
        <button className="b" onClick={clear}><kbd>F4</kbd>Clear bill</button>
      </div>
    </>
  );
}
