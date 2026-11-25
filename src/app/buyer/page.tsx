"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readBillingDraft, writeBillingDraft } from "@/lib/billing-draft";
import { today } from "@/lib/format";
import { GSTIN_RE, normGstin, stateOf } from "@/lib/gst";
import { findBuyer, saveBuyer, searchBuyers } from "@/lib/repo";
import type { Buyer } from "@/lib/types";

const EMPTY_BUYER: Buyer = { name: "", address: "", gstin: "", state: "", code: "" };
type AutoField = "name" | "gstin";

export default function BuyerPage() {
  const router = useRouter();
  const [buyer, setBuyer] = useState<Buyer>(EMPTY_BUYER);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [suggestions, setSuggestions] = useState<Buyer[]>([]);
  const [activeField, setActiveField] = useState<AutoField | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const searchReqRef = useRef(0);
  const gstinReqRef = useRef(0);

  useEffect(() => {
    try {
      const draft = readBillingDraft();
      if (draft) setBuyer(draft.buyer);
    } catch (e) {
      setError(String(e));
    }
    searchBuyers("")
      .then((list) => {
        setBuyers(list);
        setSuggestions(list);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const applyBuyer = (entry: Buyer) => {
    const gstin = normGstin(entry.gstin);
    setBuyer({ ...entry, gstin, ...stateOf(gstin) });
    setActiveField(null);
    setHighlightIdx(-1);
  };

  const fillEmptyFrom = (hit: Buyer) => {
    setBuyer((current) => {
      const gstin = current.gstin || normGstin(hit.gstin);
      return {
        name: current.name || hit.name,
        address: current.address || hit.address,
        gstin,
        ...stateOf(gstin),
      };
    });
  };

  const refreshSuggestions = async (field: AutoField, query: string, openList = true) => {
    const reqId = ++searchReqRef.current;
    if (openList) setActiveField(field);
    setHighlightIdx(-1);
    try {
      const hits = await searchBuyers(query);
      if (searchReqRef.current !== reqId) return;
      setSuggestions(hits);
    } catch {
      /* ignore lookup errors while typing */
    }
  };

  const selectBuyer = async (gstin: string) => {
    if (!gstin) {
      setBuyer(EMPTY_BUYER);
      return;
    }
    try {
      const found = await findBuyer(gstin);
      if (found) applyBuyer(found);
    } catch (e) {
      setError(String(e));
    }
  };

  const onNameChange = (value: string) => {
    setBuyer((current) => ({ ...current, name: value }));
    void refreshSuggestions("name", value);
  };

  const onNameBlur = () => {
    setActiveField((current) => (current === "name" ? null : current));
    setHighlightIdx(-1);
    const trimmed = buyer.name.trim().toLowerCase();
    if (!trimmed || buyer.gstin) return;
    const pool = suggestions.length ? suggestions : buyers;
    const hit = pool.find((entry) => entry.name.trim().toLowerCase() === trimmed);
    if (hit) fillEmptyFrom(hit);
  };

  const onGstinChange = async (raw: string) => {
    const gstin = normGstin(raw).slice(0, 15);
    setBuyer((current) => ({ ...current, gstin, ...stateOf(gstin) }));
    void refreshSuggestions("gstin", gstin, gstin.length < 15);
    if (gstin.length !== 15) return;

    const reqId = ++gstinReqRef.current;
    try {
      const hit = await findBuyer(gstin);
      if (gstinReqRef.current !== reqId || !hit) return;
      fillEmptyFrom(hit);
      setActiveField(null);
      setHighlightIdx(-1);
    } catch {
      /* ignore lookup errors while typing */
    }
  };

  const onAutoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeField || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((idx) => (idx + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      const chosen = suggestions[highlightIdx];
      if (chosen) applyBuyer(chosen);
    } else if (e.key === "Escape") {
      setActiveField(null);
      setHighlightIdx(-1);
    }
  };

  const renderSuggestions = (field: AutoField) => {
    if (activeField !== field || suggestions.length === 0) return null;
    return (
      <ul className="ac-list" role="listbox" aria-label="Saved buyers">
        {suggestions.map((entry, idx) => (
          <li
            key={entry.gstin}
            role="option"
            aria-selected={idx === highlightIdx}
            className={"ac-opt" + (idx === highlightIdx ? " sel" : "")}
            onMouseDown={(e) => {
              e.preventDefault();
              applyBuyer(entry);
            }}
          >
            <span>{entry.name}</span>
            <small>{entry.gstin}</small>
          </li>
        ))}
      </ul>
    );
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
        <div className="ac-field">
          <label htmlFor="buyer-name">Enterprise name</label>
          <div className="ac">
            <input
              id="buyer-name"
              required
              autoComplete="off"
              role="combobox"
              aria-expanded={activeField === "name" && suggestions.length > 0}
              aria-autocomplete="list"
              value={buyer.name}
              onFocus={() => { if (!buyer.gstin) void refreshSuggestions("name", buyer.name); }}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={onAutoKeyDown}
              onBlur={onNameBlur}
            />
            {renderSuggestions("name")}
          </div>
        </div>
        <div className="ac-field">
          <label htmlFor="buyer-gstin">GSTIN / UIN</label>
          <div className="ac">
            <input
              id="buyer-gstin"
              required
              maxLength={15}
              autoComplete="off"
              role="combobox"
              aria-expanded={activeField === "gstin" && suggestions.length > 0}
              aria-autocomplete="list"
              value={buyer.gstin}
              onFocus={() => { if (!buyer.gstin) void refreshSuggestions("gstin", buyer.gstin); }}
              onChange={(e) => void onGstinChange(e.target.value)}
              onKeyDown={onAutoKeyDown}
              onBlur={() => {
                setActiveField((current) => (current === "gstin" ? null : current));
                setHighlightIdx(-1);
              }}
            />
            {renderSuggestions("gstin")}
          </div>
        </div>
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
