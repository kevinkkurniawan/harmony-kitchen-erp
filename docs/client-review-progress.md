# Client review progress (doc "Clarimity HM")

Doc and rules: see `AGENTS.md` ("Client review doc"). Status as of 2026-11-20 (all four tabs closed).

## Master Barang: done (green)
1. Form without Kategori / Merk / Satuan; Kategori Grosir = the old K1–K5 bundles (`m_promo` via
   `m_inventory.promobundle`, same as the POS), Grosir 1 / 2 / 3 on one row.
2. Grosir 1 / 2 / 3 columns in the grid and in Export Data.
3. Aktif check column moved to the far right.
4. Newest items first when no column sort is chosen (`sort=id&order=desc`).

New items save no brand / category (like ~6.5k existing items) and uom Pcs, instead of the first lookup or id 1.

## Inventory Stock
1. Sync (old `Frm_SyncInventory`, SPs read from the MSSQL backup): **done (green)**.
   - Per-row Sync button (Admin): "Qty Opname :", old confirm "Yakin Akan Melakukan Sync ?", posts a direct
     COUNT opname (stock + Last Sync = today).
   - .:: Detail folds the history up to the last sync into one "Sync On <date>" row (display only, tick to show all).
   - RT Stok / Status "Perlu Sync" / "Tampilkan Stok Tidak Sama": **not needed, won't build**. Luki (2026-11-20):
     it existed because the old app had 2 stocks; now there is one, Inventory Stock is the correct one (RT Stok was
     the one often wrong). They sync per item later when they move to the opname program again.
2. Stock opname locked to Admin: **done (green)**. Server refuses every opname write for non-Admin; the
   OPNAME_POST / OPNAME_REVERSE per-user grants are removed; Stok Opname screen locked, Master Barang Show Detail
   opname buttons and right-click Stok Opname hidden, no Sync button. Not tested with a real staff login
   (none seeded).

## Cetak Barcode: done (green), physical print to be confirmed by the client
1. Roll label = product name + barcode (no "HARMONY KITCHEN", no Header Toko toggle, no No. Barang prefix).
2. Name wraps to 2 lines in Arial 6.5pt; fits the longest active name (50 chars) on the 36 x 18.2 mm label.
   "Print A4" still prints the name on one line (old Rpt_PrintOpname, not in the complaint).
3. Search list shows "Stok: N".

## Sales Monitoring: closed, not an app bug
"Nota seminggu terakhir tidak tampil": not an ERP bug, the notes are not in the database. Confirmed 2026-11-20:
the cashier did not fill in / save the receipts properly. Nothing to fix in the ERP.
- Up to 10 Nov: old desktop POS (`DESKTOP-…/user`) wrote live; 11 Nov: web POS 66 notes; 12–17 Nov: only 4 web
  notes (PS2611140001, PS2611160001/2, PS2611170001), no DRAFT rows.
- The web POS saves a DRAFT at the first scanned item and has no offline queue, so a note entered there would be
  in the database. The production POS deployments (10 and 16 Nov) reach the Seoul database.
- Asked Luki: which app the cashiers use since 12 Nov, the address opened, any save error, whether the notes
  still exist in the old app.

## Notes for the next session
- `tests/cetak-barcode.spec.ts` (older tests) and the "Real" tests in other specs write to the live database
  (`DELETE /api/barcode-list?all=1`, opname posts); run mocked tests with `--grep-invert "Real"` / `--grep mocked`.
- The `POS_DATABASE_URL` (Singapore) in `.env` is dead ("tenant not found") and unused by the code.
