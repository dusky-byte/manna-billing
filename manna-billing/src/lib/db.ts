import type { Database } from "sql.js";
import type { Item } from "./types";

const IDB = "manna", STORE = "kv", KEY = "sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT DEFAULT '', name TEXT NOT NULL,
  hsn TEXT DEFAULT '', unit TEXT DEFAULT 'No', rate REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoices (no INTEGER PRIMARY KEY, date TEXT NOT NULL, total REAL NOT NULL);
CREATE TABLE IF NOT EXISTS invoice_lines (
  invoice_no INTEGER NOT NULL, sl INTEGER NOT NULL, name TEXT NOT NULL, hsn TEXT, unit TEXT,
  qty REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL, PRIMARY KEY (invoice_no, sl)
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

export function getMeta(db: Database, key: string): string | undefined {
  const v = db.exec("SELECT value FROM meta WHERE key=?", [key])[0]?.values[0][0];
  return v == null ? undefined : String(v);
}
export function setMeta(db: Database, key: string, value: string): void {
  db.run("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)", [key, value]);
}

function addCols(db: Database, table: string, cols: Record<string, string>) {
  const have = new Set((db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? []).map((r) => String(r[1])));
  for (const [c, def] of Object.entries(cols)) if (!have.has(c)) db.run(`ALTER TABLE ${table} ADD COLUMN ${c} ${def}`);
}

/** Additive only: app updates never remove or rewrite what is already stored. */
function migrate(db: Database) {
  db.run(SCHEMA);
  addCols(db, "invoices", {
    buyer_name: "TEXT DEFAULT ''", buyer_address: "TEXT DEFAULT ''", buyer_gstin: "TEXT DEFAULT ''",
    buyer_state: "TEXT DEFAULT ''", buyer_code: "TEXT DEFAULT ''", seller_json: "TEXT DEFAULT ''",
  });
  try { db.run("CREATE UNIQUE INDEX IF NOT EXISTS ux_items_name ON items(name COLLATE NOCASE)"); } catch { /* duplicates from an old build: skip */ }
  if (getMeta(db, "schema") !== "2") {
    db.run("DELETE FROM items WHERE code LIKE 'PF-%'"); // one-time: remove the placeholder photo-frame seed items
    setMeta(db, "schema", "2");
  }
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
  migrate(db);
  await syncItems(db);
  await persist(db);
  return db;
}

/** Adds catalog items from items.json that are not stored yet. Never overwrites or deletes stored items. */
async function syncItems(db: Database): Promise<void> {
  try {
    const res = await fetch("/items.json");
    const data = (await res.json()) as { version: number; items: Omit<Item, "id">[] };
    if (getMeta(db, "items_version") === String(data.version)) return;
    db.run("BEGIN");
    try {
      const st = db.prepare("INSERT OR IGNORE INTO items(code,name,hsn,unit,rate) VALUES(?,?,?,?,?)");
      for (const i of data.items) st.run([i.code ?? "", i.name, i.hsn ?? "", i.unit ?? "No", i.rate]);
      st.free();
      setMeta(db, "items_version", String(data.version));
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  } catch {
    /* offline or file missing: keep what is stored */
  }
}
