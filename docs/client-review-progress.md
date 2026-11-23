# Client review progress (doc "Clarimity HM")

Doc and rules: see `AGENTS.md` ("Client review doc"). Status as of 2026-11-23.

## Where we are (2026-11-23, round 2 of the doc)
| Doc tab | Status |
|---|---|
| Komplain Kasir (POS) | done, live, green with notes (POS `b540db3`, follow-up `6878583`) |
| Master Barang | done, live, green with notes (`50e2855`) |
| Inventory Stock | green (nothing new) |
| Stock Opname | done, live, green with note (`6af7622`, "Load Data" removed) |
| Cetak Barcode | done, live (`6ce6cfb`), green with note; **waiting on Luki: physical print** |
| Sales Monitoring | done, live (`8feb088`, `ec61286`), green with notes (3 points) |

Open, not in the doc:
- Luki asked why user `admin` shows the Otorisasi Aksi Sensitif ticks empty: Admin (username `admin` or User
  Type Admin) ignores all ticks and has full access (stock changes: login `admin` only). Ticks matter only for
  non-admin users. Offered (not built): show an Admin's ticks all checked and locked with "Admin: akses penuh".
- His screenshot still had "konfirmasi-stok" under "Lainnya" = browser on the old bundle; refresh fixes it.

## Master Barang: done (green)
1. Form without Kategori / Merk / Satuan; Kategori Grosir = the old K1–K5 bundles (`m_promo` via
   `m_inventory.promobundle`, same as the POS), Grosir 1 / 2 / 3 on one row.
2. Grosir 1 / 2 / 3 columns in the grid and in Export Data.
3. Aktif check column moved to the far right.
4. Newest items first when no column sort is chosen (`sort=id&order=desc`).

New items save no brand / category (like ~6.5k existing items) and uom Pcs, instead of the first lookup or id 1.

Round 2 (doc items, 23 Nov): **done, live (`50e2855`), green with notes**. Old screen read from `Master_Data.dll`
(ilspycmd with `DOTNET_ROOT=~/git/POS/dotnet`): grid No. Barang, Barcode, Nama, Description, Kode, ...; HPP is
not on the old form, only Harga Beli.
1. HPP read-only on the form, never saved from it (set by Penerimaan Barang dengan harga); Harga Beli editable.
2. Form capped at 1024 px, Nama Barang two columns wide.
3. Kode: no "STD" default (API mapped empty to STD and the form would save it; 0 live rows had it). Empty like old.
4. Grid and Export Data add Deskripsi (cut, full text in tooltip) and Kode after Nama; still fits 1366 px.

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

## Stock Opname: done (green, `6af7622`)
"Load Data 500 itu apa ya?": the bulk "Load Data (N)" button loaded the first 500 of ~5,800 items with their
system stock; posting unchanged marked all as checked today. Not in the old opname program (`Mod_Opname.dll`),
so it was removed; items are added by scan / search (works for every item). Doc note explains what it did and why
it is gone, in plain words for Luki.

## Cetak Barcode: done (green), physical print to be confirmed by the client
Round 2 (doc, 23 Nov 16:06): Luki's photo "Barcode masih belum pas, angka kepotong" shows the NEW layout (2-line name, no
No. Barang prefix; the fix `31618a9` was live on Production 20 Nov 14:45) printed with the number cut off. The
screen render fit, the physical printer clips the bottom edge because the cell used `space-between` (number on the
last millimetre). Fix: content packed to the top, bars 5 mm, ~5 mm free under the number (test 9 asserts it).
Pushed 23 Nov (Vercel success); doc note reworded to match (ruang kosong di bawah angka, mohon dicoba cetak ulang).
(Round 1 status below.)
1. Roll label = product name + barcode (no "HARMONY KITCHEN", no Header Toko toggle, no No. Barang prefix).
2. Name wraps to 2 lines in Arial 6.5pt; fits the longest active name (50 chars) on the 36 x 18.2 mm label.
   "Print A4" still prints the name on one line (old Rpt_PrintOpname, not in the complaint).
3. Search list shows "Stok: N".

## Sales Monitoring, round 2 (doc, 23 Nov): 3 points
1. "Void & unvoid diminta alasan, tapi alasan tidak keluar dimanapun": **done, live (`8feb088`), green with note**. The
   reason was only in `t_auditevent` (SALES_VOID / SALES_UNVOID). GET /api/sales/monitoring now adds the latest one to
   Keterangan as "VOID oleh <user>: <alasan>" (`loadVoidNotes`). Live example: sale 900000165, VOID "Ngetest" then
   UNVOID "Tidak jadi" (admin, 23 Nov). The 520 voided sales before that have no reason (old app / earlier voids).
   Not run against a DB (docker was off); typecheck passes. Doc note to write once live.
2. "Dipisahkan per segmen antar user": Luki (23 Nov): **per kasir with a subtotal each**. Old Bill Opname
   (`sp_SPSalesPOS_OpnameGetSummary`) is one flat list with no per-user subtotal, so this is new. **Done, live (`ec61286`), green with note**: the grid groups notes per kasir (legacy "DESKTOP-x/linda" and web "linda" = one group) and closes each group
   with a bold "Subtotal <kasir> (N nota)" row, void notes not counted; only when 2+ kasir sold that day. Mocked test
   `tests/sales-monitoring-mocked.spec.ts` passes.
3. "Coba cek kok ada yang bisa belum bayar": BELUM BAYAR rows are old desktop POS notes with no payment row (linda /
   lia, ~100 a month, only ~25% have items, rest are empty notes opened and left). Old Bill Opname is
   `T_SalesPOSHeader INNER JOIN T_SalesPayment`, so a never-paid note was NOT listed there. **Done, live (`ec61286`), green with note**: GET /api/sales/monitoring leaves them out (count adjusted). Old sources are in `C:\GitHub\Module Manager`
   and `C:\GitHub\POS` on this PC (no .NET decompiler installed; stored procedures read from
   `database_backup/HM_241115.bak` with a Python regex on `create proc`, ASCII text).

### Earlier (round 1)
## Sales Monitoring: closed, not an app bug
"Nota seminggu terakhir tidak tampil": not an ERP bug, the notes are not in the database. Confirmed 2026-11-20:
the cashier did not fill in / save the receipts properly. Nothing to fix in the ERP.
- Up to 10 Nov: old desktop POS (`DESKTOP-…/user`) wrote live; 11 Nov: web POS 66 notes; 12–17 Nov: only 4 web
  notes (PS2611140001, PS2611160001/2, PS2611170001), no DRAFT rows.
- The web POS saves a DRAFT at the first scanned item and has no offline queue, so a note entered there would be
  in the database. The production POS deployments (10 and 16 Nov) reach the Seoul database.
- Asked Luki: which app the cashiers use since 12 Nov, the address opened, any save error, whether the notes
  still exist in the old app.

## Komplain Kasir (POS app, repo harmony-kitchen-pos): done, live (`b540db3`, `6878583`), green with notes
Old POS behaviour read from `~/git/POS/pos_decompiled.cs`.
1. Relogin timeout: session slides (renewed on use, ends after 7 days unused or Logout); was a fixed 12 h.
2. Receipt: grosir line prints "@ <retail>", Sub Total at retail, then "-- Potongan Diskon <tier>" -(saving)
   (old SP: 'Potongan Diskon ' + grosir tier); manual potongan is its own "-- Potongan @ x" row.
3. X-Report: adds the old "Rekap Penjualan Harian" (per cashier, notes grouped by payment, totals, Dicetak);
   report day is now WIB (was server UTC). The 0 omset in Luki's 20 Nov photo was real: no web POS sales that day.
4. Name search shows G1 / G2 / G3 under the retail price (old lookup grid had Grosir1-3 columns).
5. Override Grosir 1 asks "Nama Reseller" (min 3 chars, as the old Frm_MemberValidation) with the PIN; saved in
   t_salesposheader.customername, printed "Reseller : <name>".
6. Follow-up (Luki 23 Nov photos): the bill panel next to the cart shows the same rows as the receipt, so the
   potongan is visible before printing; reseller mode (Override Grosir 1) is labelled "Potongan Reseller", bands
   "Potongan Diskon N" (old `sp_SPSalesPOSDetail_CalculateDiscount` in the MSSQL backup). Shared helper
   `src/lib/receipt-lines.ts` (POS repo).
- Seen, not fixed: Reprint Bill prints the current cashier, not the sale's; lia has 2 completed CASH sales of 0.

## Notes for the next session
- `tests/cetak-barcode.spec.ts` (older tests) and the "Real" tests in other specs write to the live database
  (`DELETE /api/barcode-list?all=1`, opname posts); run mocked tests with `--grep-invert "Real"` / `--grep mocked`.
- `tests/user-access.spec.ts` is all live-DB (creates Admin / Kasir users, password 4321) with no "Real" tag; a
  timeout skips its cleanup (23 Nov: 3 users left, deleted by hand). Don't run it against the live database.
- The `POS_DATABASE_URL` (Singapore) in `.env` is dead ("tenant not found") and unused by the code.
