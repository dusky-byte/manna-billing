"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getInvoice } from "@/lib/repo";
import { buildInvoicePdf } from "@/lib/pdf";

export default function InvoicePage() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);
  const [state, setState] = useState<{ no: number; url: string } | null | undefined>(undefined);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const no = Number(p.get("no"));
        const data = await getInvoice(no);
        if (!data) { setState(null); return; }
        const url = URL.createObjectURL(await buildInvoicePdf(data.inv, data.lines));
        setState({ no, url });
        if (p.get("dl") === "1") {
          const a = document.createElement("a");
          a.href = url; a.download = `Invoice ${no}.pdf`; a.click();
          window.history.replaceState(null, "", `/invoice?no=${no}`);
        }
      } catch (e) {
        setErr(String(e)); setState(null);
      }
    })();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "F4") { e.preventDefault(); router.push("/"); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  if (state === undefined) return <p className="note">Building PDF…</p>;
  if (state === null) {
    return (
      <div className="row">
        <span>{err || "Bill not found."}</span>
        <button className="b" onClick={() => router.push("/")}>New bill</button>
      </div>
    );
  }
  return (
    <>
      <div className="row noprint">
        <a className="b" href={state.url} download={`Invoice ${state.no}.pdf`}>Download PDF</a>
        <button className="b" onClick={() => frame.current?.contentWindow?.print()}>Print</button>
        <button className="b" onClick={() => router.push("/")}><kbd>F4</kbd>New bill</button>
      </div>
      <iframe ref={frame} className="pdf" src={state.url} title={`Invoice ${state.no}`} />
    </>
  );
}
