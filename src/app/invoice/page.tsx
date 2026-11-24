"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInvoice } from "@/lib/repo";
import { DECLARATION } from "@/lib/config";
import { amountInWords, inr, pdfDate } from "@/lib/format";

type Data = Awaited<ReturnType<typeof getInvoice>>;

export default function InvoicePage() {
  const router = useRouter();
  const [data, setData] = useState<Data | undefined>(undefined);

  useEffect(() => {
    const no = Number(new URLSearchParams(window.location.search).get("no"));
    getInvoice(no).then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "F4") { e.preventDefault(); router.push("/"); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  if (data === undefined) return <p className="note">Loading…</p>;
  if (data === null) {
    return (
      <div className="row">
        <span>Bill not found.</span>
        <button className="b" onClick={() => router.push("/")}>New bill</button>
      </div>
    );
  }
  const { inv, lines } = data;
  const blanks = Math.max(0, 12 - lines.length);

  return (
    <>
      <div className="row noprint">
        <button className="b" onClick={() => window.print()}>Print</button>
        <button className="b" onClick={() => router.push("/")}><kbd>F4</kbd>New bill</button>
      </div>
      <div className="form">
        <div className="fh">BILL OF SUPPLY</div>
        <div className="fb">
          <div className="bn">{inv.seller.name}</div>
          <div>{inv.seller.address}</div>
          {inv.seller.gstin && <div>GSTIN: {inv.seller.gstin}</div>}
          {inv.seller.email && <div>E-mail: {inv.seller.email}</div>}
        </div>
        <div className="fmeta"><div>Bill No. <b>{inv.no}</b></div><div>Date: <b>{pdfDate(inv.date)}</b></div></div>
        <div className="fline">Buyer <span className="dot">{inv.buyer.name}</span></div>
        <div className="fline">Address <span className="dot">{inv.buyer.address}</span></div>
        <div className="fline">GSTIN <span className="dot">{inv.buyer.gstin}</span> State <span className="dot">{inv.buyer.state}</span></div>
        <table className="ft">
          <thead>
            <tr><th style={{ width: 40 }}>Sl</th><th>Description</th><th style={{ width: 70 }}>HSN</th><th className="num" style={{ width: 90 }}>Qty</th><th className="num" style={{ width: 90 }}>Rate</th><th className="num" style={{ width: 110 }}>Amount</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.sl}>
                <td>{l.sl}</td><td>{l.name}</td><td>{l.hsn || "—"}</td>
                <td className="num">{l.qty} {l.unit}</td><td className="num">{inr(l.rate)}</td><td className="num">{inr(l.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`b${i}`}><td>&nbsp;</td><td /><td /><td /><td /><td /></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={5} className="num">TOTAL ₹</td><td className="num">{inr(inv.total)}</td></tr></tfoot>
        </table>
        <div className="fline">Rupees <span className="dot">{amountInWords(inv.total)}</span></div>
        <div className="decl">{DECLARATION}</div>
        <div className="sig"><span>Customer’s signature</span><span>For {inv.seller.name}<br />Authorised signatory</span></div>
      </div>
    </>
  );
}
