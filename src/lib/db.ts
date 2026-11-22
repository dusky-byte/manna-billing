import type { Database } from "sql.js";
import type { Item } from "./types";

const IDB = "manna", STORE = "kv", KEY = "sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL,
  hsn TEXT DEFAULT '', unit TEXT DEFAULT 'pcs', rate REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoices (
  no INTEGER PRIMARY KEY, date TEXT NOT NULL, customer TEXT DEFAULT '',
  phone TEXT DEFAULT '', total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  invoice_no INTEGER NOT NULL REFERENCES invoices(no), sl INTEGER NOT NULL,
  name TEXT NOT NULL, hsn TEXT, unit TEXT, qty REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL,
  PRIMARY KEY (invoice_no, sl)
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
  await syncItems(db);
  return db;
}

/** Loads items.json into SQLite whenever its version changes. Silent offline. */
async function syncItems(db: Database): Promise<void> {
  try {
    const res = await fetch("/items.json");
    const data = (await res.json()) as { version: number; items: Omit<Item, "id">[] };
    const cur = db.exec("SELECT value FROM meta WHERE key='items_version'")[0]?.values[0][0];
    if (String(cur) === String(data.version)) return;
    db.run("BEGIN");
    try {
      db.run("DELETE FROM items");
      const st = db.prepare("INSERT INTO items(code,name,hsn,unit,rate) VALUES(?,?,?,?,?)");
      for (const i of data.items) st.run([i.code, i.name, i.hsn ?? "", i.unit ?? "pcs", i.rate]);
      st.free();
      db.run("INSERT OR REPLACE INTO meta VALUES('items_version',?)", [String(data.version)]);
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