# Manna Billing — progress

Run: `npm i && npm run dev`. Offline/PWA only works in production: `npm run build && npm start`, open once online, then go offline.

## Done
- Next.js 14 + TypeScript project (App Router), client-side SQLite via sql.js (WASM), persisted to IndexedDB
- items.json → SQLite (reloads when `version` changes), works offline after first load
- New bill screen: item search, custom items, editable qty/rate, auto invoice numbers (starts at 10000, +1 each bill, see src/lib/config.ts)
- Bill of Supply print view with amount in words (Indian numbering); no bills list (removed)
- Service worker: app shell precache, network-first pages/items.json, cache-first static assets
- Classic billing UI (same as the published demo): title bar with online lamp and clock, item panel, ruled bill grid, LCD total, F2/F3/F4 keys, framed printed form, rounded containers, Rajdhani headers

## Left
- Replace public/items.json with the real catalog from A4_Brochure.pdf (names, HSN, rates)
- Match invoice layout and business details (address, GSTIN, declaration) to the invoice 61 screenshot
- PWA icons for installability
- DB backup: export/import .sqlite file, then cloud sync (Turso / PowerSync / ElectricSQL / RxDB)
- Edit/cancel bill, customer history, daily totals
- Optional Next.js API routes if server-side storage is wanted
