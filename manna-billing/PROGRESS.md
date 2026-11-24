# Manna Billing — progress

Run: `npm i && npm run dev`. Offline/PWA only works in production: `npm run build && npm start` (or the Vercel deploy). Open once online, then it runs fully offline.

## Done
- Next.js 16 (Turbopack) + React 19 + TypeScript. Verified: `tsc` and `next build` pass.
- Storage: SQLite (sql.js WASM) in the browser, saved to IndexedDB. Fully offline after first visit (service worker caches pages, WASM, fonts).
- Each bill gets its own number: starts at 10000, +1 per saved bill (src/lib/config.ts).
- Bill of Supply PDF in the Tally layout of invoice 61 (jsPDF, A4, multi-page if many items). Auto-downloads on save; preview, Download and Print on the bill page.
- Required fields: date, seller name + GSTIN, buyer name + GSTIN (15-char GSTIN format check), at least one item with qty and rate. State/code filled from GSTIN.
- Seller (enterprise name, GSTIN, address, e-mail) editable in the app, stored on the device and copied onto every bill.
- Autofill: buyers (name, GSTIN, address) and item descriptions (HSN, rate) are remembered after each bill.
- Stored autofill data is never changed by updates: catalog sync only adds missing items, remembered entries use insert-or-ignore, schema changes are additive.
- Items: the 16 titles/rates from invoice 61 (public/items.json, version 2). Bump `version` when you add items.
- Classic billing UI, F2 save/PDF, F3 find item, F4 clear.

## Left
- Optional invoice fields (e-Way bill no., delivery note, mode of payment, buyer's order no., dispatch details) are printed blank; add inputs if needed.
- Real catalog/rates beyond invoice 61 (A4_Brochure.pdf is image-only and was not read).
- Backup/export of the SQLite file and cloud sync; edit/cancel a saved bill; bills list (removed on request).
- GST tax columns (this is a Bill of Supply: tax amount is NIL).
