import type { Database, SqlValue } from "sql.js";
import { getDb, getMeta, persist, setMeta } from "./db";
import { DEFAULT_SELLER, FIRST_INVOICE_NO } from "./config";
import type { Buyer, Invoice, InvoiceInput, InvoiceLine, Item, Seller } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

function all<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const st = db.prepare(sql);
  st.bind(params);
  const out: T[] = [];
  while (st.step()) out.push(st.getAsObject() as unknown as T);
  st.free();
  return out;
}

export async function searchItems(q: string): Promise<Item[]> {
  const db = await getDb();
  const like = `%${q.trim()}%`;
  return all<Item>(
    db,
    "SELECT id,code,name,hsn,unit,rate FROM items WHERE name LIKE ? OR code LIKE ? ORDER BY CASE WHEN code='' THEN 1 ELSE 0 END, code, name LIMIT 40",
    [like, like]
  );
}

export async function getSeller(): Promise<Seller> {
  const db = await getDb();
  const raw = getMeta(db, "seller");
  try { return raw ? { ...DEFAULT_SELLER, ...JSON.parse(raw) } : DEFAULT_SELLER; } catch { return DEFAULT_SELLER; }
}

export async function saveSeller(s: Seller): Promise<void> {
  const db = await getDb();
  setMeta(db, "seller", JSON.stringify(s));
  await persist(db);
}

export async function searchBuyers(q: string): Promise<Buyer[]> {
  const db = await getDb();
  const like = `%${q.trim()}%`;
  return all<Buyer>(db, "SELECT name,address,gstin,state,code FROM buyers WHERE name LIKE ? OR gstin LIKE ? ORDER BY name LIMIT 20", [like, like]);
}

export async function findBuyer(gstin: string): Promise<Buyer | undefined> {
  const db = await getDb();
  return all<Buyer>(db, "SELECT name,address,gstin,state,code FROM buyers WHERE gstin=?", [gstin])[0];
}

export async function nextInvoiceNo(): Promise<number> {
  const db = await getDb();
  const max = all<{ n: number | null }>(db, "SELECT MAX(no) AS n FROM invoices")[0]?.n;
  return (max ?? FIRST_INVOICE_NO - 1) + 1;
}

export async function saveInvoice(input: InvoiceInput): Promise<number> {
  const db = await getDb();
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new Error("No items on the bill.");
  const amounts = lines.map((l) => round2(l.qty * l.rate));
  const total = round2(amounts.reduce((a, b) => a + b, 0));
  const no = await nextInvoiceNo();
  const { seller: s, buyer: b } = input;

  db.run("BEGIN");
  try {
    db.run(
      "INSERT INTO invoices(no,date,total,buyer_name,buyer_address,buyer_gstin,buyer_state,buyer_code,seller_json) VALUES(?,?,?,?,?,?,?,?,?)",
      [no, input.date, total, b.name, b.address, b.gstin, b.state, b.code, JSON.stringify(s)]
    );
    lines.forEach((l, i) => {
      db.run(
        "INSERT INTO invoice_lines(invoice_no,sl,name,hsn,unit,qty,rate,amount) VALUES(?,?,?,?,?,?,?,?)",
        [no, i + 1, l.name, l.hsn, l.unit, l.qty, l.rate, amounts[i]]
      );
      // Autofill memory: new descriptions are remembered; existing ones are never changed.
      db.run("INSERT OR IGNORE INTO items(code,name,hsn,unit,rate) VALUES('',?,?,?,?)", [l.name, l.hsn, l.unit, l.rate]);
    });
    db.run("INSERT OR IGNORE INTO buyers(gstin,name,address,state,code) VALUES(?,?,?,?,?)", [b.gstin, b.name, b.address, b.state, b.code]);
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
  await persist(db);
  return no;
}

interface Row {
  no: number; date: string; total: number; seller_json: string | null;
  buyer_name: string | null; buyer_address: string | null; buyer_gstin: string | null;
  buyer_state: string | null; buyer_code: string | null;
}

export async function getInvoice(no: number): Promise<{ inv: Invoice; lines: InvoiceLine[] } | null> {
  const db = await getDb();
  const r = all<Row>(
    db,
    "SELECT no,date,total,seller_json,buyer_name,buyer_address,buyer_gstin,buyer_state,buyer_code FROM invoices WHERE no=?",
    [no]
  )[0];
  if (!r) return null;
  let seller = DEFAULT_SELLER;
  try { if (r.seller_json) seller = { ...DEFAULT_SELLER, ...JSON.parse(r.seller_json) }; } catch { /* keep default */ }
  const inv: Invoice = {
    no: r.no, date: r.date, total: r.total, seller,
    buyer: { name: r.buyer_name ?? "", address: r.buyer_address ?? "", gstin: r.buyer_gstin ?? "", state: r.buyer_state ?? "", code: r.buyer_code ?? "" },
  };
  const lines = all<InvoiceLine>(db, "SELECT sl,name,hsn,unit,qty,rate,amount FROM invoice_lines WHERE invoice_no=? ORDER BY sl", [no]);
  return { inv, lines };
}
