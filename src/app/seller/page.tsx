"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SELLER } from "@/lib/config";
import { saveSeller, getSeller } from "@/lib/repo";
import { GSTIN_RE, normGstin, stateOf } from "@/lib/gst";
import type { Seller } from "@/lib/types";

export default function SellerPage() {
  const router = useRouter();
  const [seller, setSeller] = useState<Seller>(DEFAULT_SELLER);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSeller().then(setSeller).catch((e) => setError(String(e)));
  }, []);

  const update = (patch: Partial<Seller>) => setSeller((current) => ({ ...current, ...patch }));
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const gstin = normGstin(seller.gstin);
    if (!seller.name.trim()) return setError("Seller name is required.");
    if (!GSTIN_RE.test(gstin)) return setError("Seller GSTIN is invalid (15 characters).");

    setSaving(true);
    setError("");
    try {
      const updated = { ...seller, name: seller.name.trim(), gstin, ...stateOf(gstin) };
      await saveSeller(updated);
      router.push("/");
    } catch (x) {
      setError(String(x));
      setSaving(false);
    }
  };

  return (
    <>
      <div className="strip"><strong>Seller details</strong></div>
      <form className="party-settings" onSubmit={submit}>
        <label>Enterprise name<input required value={seller.name} onChange={(e) => update({ name: e.target.value })} /></label>
        <label>GSTIN / UIN<input required maxLength={15} value={seller.gstin} onChange={(e) => update({ gstin: normGstin(e.target.value) })} /></label>
        <label>Address<textarea rows={3} value={seller.address} onChange={(e) => update({ address: e.target.value })} /></label>
        <label>E-mail<input type="email" value={seller.email} onChange={(e) => update({ email: e.target.value })} /></label>
        {error && <span className="req">{error}</span>}
        <div className="row">
          <button className="b" type="submit" disabled={saving}>{saving ? "Saving…" : "Save and return to billing"}</button>
          <button className="b" type="button" onClick={() => router.push("/")}>Cancel</button>
        </div>
      </form>
    </>
  );
}
