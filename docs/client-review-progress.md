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
3. Confirm-only stock check for staff (Luki, 23 Nov): **deployed, waiting on Luki**; tested on local DB.
   Luki is the only Admin; staff (e.g. Siti) must not +/- stock. Separate menu "Konfirmasi Stok" (`konfirmasi-stok`;
   access is one tick per module, so it can't be a sub-right of Stok Opname), API `/api/inventory/stock-confirm`.
   - Staff enter the counted qty blind (system stock hidden); count = stock -> SCO post with the row locked
     (Last Sync = today, stock unchanged); mismatch -> refused "hubungi admin", Luki fixes it in Stok Opname.
   - Every attempt logged as audit `STOCK_CONFIRM`: Admin sees all users with Stok Sistem, staff only their own.
   - Blind only on this screen: GET /api/inventory still returns stock to any logged-in user.
   - Phones (< 768 px): sidebar became a Menu button overlay and the header was compacted (all screens).
   - Owner rule (Luki keeps Siti as User Type Admin): only the login `admin` (Luki) changes stock: opname / sync /
     reset, `/api/inventory/usage`, `/api/purchasing/returns`, and sees every user's confirmations with Stok Sistem.
     Other Admins keep all other rights, but cannot edit / delete the `admin` account or take the name `admin`.
     Siti as Admin still sees stock in Master Barang / Inventory Stock, so her count is not blind.
   - Local test DB: `postgres-erp` container, db `harmony_local` (prisma db push + 2 live items, users luki / siti).

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
- `tests/user-access.spec.ts` is all live-DB (creates Admin / Kasir users, password 4321) with no "Real" tag; a
  timeout skips its cleanup (23 Nov: 3 users left, deleted by hand). Don't run it against the live database.
- The `POS_DATABASE_URL` (Singapore) in `.env` is dead ("tenant not found") and unused by the code.
