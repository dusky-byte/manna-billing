"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BILLING_DRAFT_KEY, readBillingDraft, writeBillingDraft } from "@/lib/billing-draft";
import { today } from "@/lib/format";
import { GSTIN_RE, normGstin, stateOf } from "@/lib/gst";
import { findBuyer, saveBuyer, searchBuyers } from "@/lib/repo";
import type { Buyer } from "@/lib/types";

const EMPTY_BUYER: Buyer = { name: "", address: "", gstin: "", state: "", code: "" };

export default function BuyerPage() {
  const router = useRouter();
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const draft = readBillingDraft();
      if (draft) setBuyer(draft.buyer);
    } catch (e) {
      setError(String(e));
    }
    searchBuyers("").then(setBuyers).catch((e) => setError(String(e)));
  }, []);

  const selectBuyer = async (gstin: string) => {
    if (!gstin) {
      setBuyer(EMPTY_BUYER);
      return;
    }
    try {
      const found = await findBuyer(gstin);
      if (found) setBuyer(found);
    } catch (e) {
      setError(String(e));
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const gstin = normGstin(buyer.gstin);
    if (!buyer.name.trim()) return setError("Buyer name is required.");
    if (!GSTIN_RE.test(gstin)) return setError("Buyer GSTIN is invalid (15 characters).");

    setSaving(true);
    setError("");
    try {
      const updated = { ...buyer, name: buyer.name.trim(), gstin, ...stateOf(gstin) };
      const draft = readBillingDraft();
      await saveBuyer(updated);
      writeBillingDraft({
        date: draft?.date ?? today(),
        buyer: updated,
        lines: draft?.lines ?? [],
      });
      router.push("/");
    } catch (x) {
      setError(String(x));
      setSaving(false);
    }
  };

  return (
    <>
      <div className="strip"><strong>Buyer details</strong></div>
      <form className="party-settings" onSubmit={submit}>
        <label>Choose a saved buyer
          <select value={buyer.gstin} onChange={(e) => selectBuyer(e.target.value)}>
            <option value="">New buyer / select existing</option>
            {buyers.map((entry) => <option key={entry.gstin} value={entry.gstin}>{entry.name} · {entry.gstin}</option>)}
          </select>
        </label>
        <label>Enterprise name<input required value={buyer.name} onChange={(e) => setBuyer((current) => ({ ...current, name: e.target.value }))} /></label>
        <label>GSTIN / UIN<input required maxLength={15} value={buyer.gstin} onChange={(e) => setBuyer((current) => ({ ...current, gstin: normGstin(e.target.value), ...stateOf(normGstin(e.target.value)) }))} /></label>
        <div className="hint">{buyer.state ? `${buyer.state}, Code: ${buyer.code}` : "State is filled from the GSTIN"}</div>
        <label>Address<textarea rows={3} value={buyer.address} onChange={(e) => setBuyer((current) => ({ ...current, address: e.target.value }))} /></label>
        {error && <span className="req">{error}</span>}
        <div className="row">
          <button className="b" type="submit" disabled={saving}>{saving ? "Saving…" : "Save and return to billing"}</button>
          <button className="b" type="button" onClick={() => router.push("/")}>Cancel</button>
        </div>
      </form>
    </>
  );
}
