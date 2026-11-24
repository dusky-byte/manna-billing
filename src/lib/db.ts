import type { Database } from "sql.js";
import type { Item } from "./types";

const IDB = "manna", STORE = "kv", KEY = "sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT DEFAULT '', name TEXT NOT NULL,
  hsn TEXT DEFAULT '', unit TEXT DEFAULT 'pcs', rate REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoices (
  no INTEGER PRIMARY KEY, date TEXT NOT NULL, total REAL NOT NULL,
  customer TEXT DEFAULT '', phone TEXT DEFAULT '',
  buyer_name TEXT DEFAULT '', buyer_address TEXT DEFAULT '', buyer_gstin TEXT DEFAULT '',
  buyer_state TEXT DEFAULT '', buyer_code TEXT DEFAULT '', seller_json TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  invoice_no INTEGER NOT NULL REFERENCES invoices(no), sl INTEGER NOT NULL,
  name TEXT NOT NULL, hsn TEXT, unit TEXT, qty REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL,
  PRIMARY KEY (invoice_no, sl)
);
CREATE TABLE IF NOT EXISTS buyers (
  gstin TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT DEFAULT '', state TEXT DEFAULT '', code TEXT DEFAULT ''
);`;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbGet(): Promise<Uint8Array | undefined> {
  const d = await openIdb();
  return new Promise((res, rej) => {
    const q = d.transaction(STORE).objectStore(STORE).get(KEY);
    q.onsuccess = () => res(q.result as Uint8Array | undefined);
    q.onerror = () => rej(q.error);
  });
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const d = await openIdb();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(bytes, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

let dbp: Promise<Database> | null = null;
export const getDb = (): Promise<Database> => (dbp ??= init());

export const ADD_ITEM_SQL = "INSERT INTO items(code,name,hsn,unit,rate) VALUES(?,?,?,?,?)";

export function getMeta(db: Database, key: string): string | undefined {
  const value = db.exec("SELECT value FROM meta WHERE key=?", [key])[0]?.values[0][0];
  return value == null ? undefined : String(value);
}

export function setMeta(db: Database, key: string, value: string): void {
  db.run("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)", [key, value]);
}

function addInvoiceColumns(db: Database): void {
  const columns = new Set(
    (db.exec("PRAGMA table_info(invoices)")[0]?.values ?? []).map((row) => String(row[1]))
  );
  const additions: Record<string, string> = {
    buyer_name: "TEXT DEFAULT ''",
    buyer_address: "TEXT DEFAULT ''",
    buyer_gstin: "TEXT DEFAULT ''",
    buyer_state: "TEXT DEFAULT ''",
    buyer_code: "TEXT DEFAULT ''",
    seller_json: "TEXT DEFAULT ''",
  };
  for (const [column, definition] of Object.entries(additions)) {
    if (!columns.has(column)) db.run(`ALTER TABLE invoices ADD COLUMN ${column} ${definition}`);
  }
}

export async function persist(db?: Database): Promise<void> {
  await idbPut((db ?? (await getDb())).export());
}

async function init(): Promise<Database> {
  const initSqlJs = (await import("sql.js")).default;
  // Held in a variable: some @types/sql.js versions mark useOldExtensionFunctions as required.
  const cfg = { locateFile: () => "/sql-wasm.wasm", useOldExtensionFunctions: false };
  const SQL = await initSqlJs(cfg);
  const saved = await idbGet();
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run(SCHEMA);
  addInvoiceColumns(db);
  await syncItems(db);
  await persist(db);
  return db;
}

/** Adds catalog items from items.json without replacing items saved by the user. */
async function syncItems(db: Database): Promise<void> {
  try {
    const res = await fetch("/items.json");
    const data = (await res.json()) as { version: number; items: Omit<Item, "id">[] };
    if (getMeta(db, "items_version") === String(data.version)) return;
    db.run("BEGIN");
    try {
      const st = db.prepare("INSERT INTO items(code,name,hsn,unit,rate) VALUES(?,?,?,?,?)");
      for (const i of data.items) {
        const found = db.exec("SELECT 1 FROM items WHERE lower(name)=lower(?) LIMIT 1", [i.name]);
        if (!found.length) st.run([i.code, i.name, i.hsn ?? "", i.unit ?? "pcs", i.rate]);
      }
      st.free();
      setMeta(db, "items_version", String(data.version));
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
    await persist(db);
  } catch {
    /* offline or file missing: keep existing items */
  }
}