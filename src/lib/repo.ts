import type { Database, SqlValue } from "sql.js";
import { getDb, persist } from "./db";
import { FIRST_INVOICE_NO } from "./config";
import type { Invoice, InvoiceInput, InvoiceLine, Item } from "./types";

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
    "SELECT id,code,name,hsn,unit,rate FROM items WHERE name LIKE ? OR code LIKE ? ORDER BY name LIMIT 30",
    [like, like]
  );
}

export async function saveInvoice(input: InvoiceInput): Promise<number> {
  const db = await getDb();
  const lines = input.lines.filter((l) => l.qty > 0);
  const amounts = lines.map((l) => round2(l.qty * l.rate));
  const total = round2(amounts.reduce((a, b) => a + b, 0));
  const max = all<{ n: number | null }>(db, "SELECT MAX(no) AS n FROM invoices")[0]?.n;
  const no = (max ?? FIRST_INVOICE_NO - 1) + 1;

  db.run("BEGIN");
  try {
    db.run("INSERT INTO invoices(no,date,customer,phone,total) VALUES(?,?,?,?,?)", [
      no, input.date, input.customer.trim(), input.phone.trim(), total,
    ]);
    lines.forEach((l, i) =>
      db.run(
        "INSERT INTO invoice_lines(invoice_no,sl,name,hsn,unit,qty,rate,amount) VALUES(?,?,?,?,?,?,?,?)",
        [no, i + 1, l.name, l.hsn, l.unit, l.qty, l.rate, amounts[i]]
      )
    );
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
  await persist(db);
  return no;
}

export async function listInvoices(): Promise<Invoice[]> {
  const db = await getDb();
  return all<Invoice>(db, "SELECT no,date,customer,phone,total FROM invoices ORDER BY no DESC LIMIT 200");
}

export async function getInvoice(no: number): Promise<{ inv: Invoice; lines: InvoiceLine[] } | null> {
  const db = await getDb();
  const inv = all<Invoice>(db, "SELECT no,date,customer,phone,total FROM invoices WHERE no=?", [no])[0];
  if (!inv) return null;
  const lines = all<InvoiceLine>(
    db,
    "SELECT sl,name,hsn,unit,qty,rate,amount FROM invoice_lines WHERE invoice_no=? ORDER BY sl",
    [no]
  );
  return { inv, lines };
}

export async function nextInvoiceNo(): Promise<number> {
  const db = await getDb();
  const max = all<{ n: number | null }>(db, "SELECT MAX(no) AS n FROM invoices")[0]?.n;
  return (max ?? FIRST_INVOICE_NO - 1) + 1;
}
