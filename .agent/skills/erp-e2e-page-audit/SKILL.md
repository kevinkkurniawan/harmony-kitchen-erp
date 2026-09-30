---
name: erp-e2e-page-audit
description: Critical end-to-end (E2E) page-by-page audit, Playwright test suite creation, and bug-fixing workflow for Harmony Kitchen ERP menus. Use when auditing, testing, or fixing an ERP menu/page end-to-end.
---

# Harmony Kitchen ERP — Page-by-Page E2E Audit & Testing Skill

Use this skill to systematically audit, test, and fix **one ERP menu (page) at a time** with maximum critical focus before moving to the next menu.

---

## 1. Menu-to-Component & API Mapping

Each menu in Harmony Kitchen ERP corresponds to one primary manager component and its backing API routes:

| # | Menu Group | Menu / Page Name | Tab Key / Route | Component | Primary API Routes | Spec File |
|---|---|---|---|---|---|---|
| 1 | Master Data | **Master Barang** | `master-barang` | `src/components/MasterBarangManager.tsx` | `/api/inventory`, `/api/inventory/[id]`, `/api/inventory/lookups`, `/api/inventory/usage`, `/api/inventory/opname` | `tests/master-barang.spec.ts` |
| 2 | Master Data | **Inventory Stock** | `inventory-stok` | `src/components/InventoryStockManager.tsx` | `/api/inventory`, `/api/inventory/stock-metrics` | `tests/inventory-stok.spec.ts` |
| 3 | Memo / Master Data | **Stok Opname** | `stok-opname` | `src/components/StockOpnameManager.tsx` | `/api/inventory/opname`, `/api/inventory/lookups` | `tests/stok-opname.spec.ts` |
| 4 | Master Data | **Cetak Barcode** | `cetak-barcode` & `/inventory/barcode` | `src/components/BarcodePrintManager.tsx` | `/api/inventory`, `/api/barcode/print` | `tests/cetak-barcode.spec.ts` |
| 5 | Master Data | **Master Promo** | `master-promo` | `src/components/MasterPromoManager.tsx` | `/api/promos`, `/api/promos/[id]`, `/api/promos/items`, `/api/wholesale-categories` | `tests/master-promo.spec.ts` |
| 6 | Master Data | **Master Supplier** | `master-supplier` | `src/components/MasterSupplierManager.tsx` | `/api/suppliers`, `/api/suppliers/[id]` | `tests/master-supplier.spec.ts` |
| 7 | Purchasing | **Penerimaan Barang Ekspress** | `penerimaan-barang` | `src/components/PenerimaanBarangEkspressManager.tsx` | `/api/purchasing/express`, `/api/suppliers`, `/api/inventory` | `tests/penerimaan-barang-ekspress.spec.ts` |
| 8 | Purchasing | **Penerimaan Barang dengan Harga** | `penerimaan-barang-harga` | `src/components/PenerimaanBarangHargaManager.tsx` | `/api/purchasing/priced`, `/api/suppliers`, `/api/inventory` | `tests/penerimaan-barang-harga.spec.ts` |
| 9 | Sales | **Sales Monitoring** | `sales-monitoring` | `src/components/SalesMonitoringManager.tsx` | `/api/sales/monitoring` | `tests/sales-monitoring.spec.ts` |
| 10 | Report | **Laporan Penjualan** | `laporan-penjualan` | `src/components/SalesReportManager.tsx` | `/api/reports/sales` | `tests/laporan-penjualan.spec.ts` |
| 11 | Admin System | **User ERP & Hak Akses** | `user-management` | `src/components/UserAccessManager.tsx` | `/api/users`, `/api/users/[id]`, `/api/users/permissions` | `tests/user-management.spec.ts` |

---

## 2. Four-Phase Workflow (Per Menu)

### Phase 1: Deep Static & Contract Audit
Before writing or running tests, thoroughly inspect:
1. **UI Component & Control Inventory**: Read the entire manager component (`src/components/<Component>.tsx`). List **every single button, link, toggle, input, modal trigger, reset/batal, cancel, print, delete, export, and context-menu action**. No button or interactive feature may be left untested.
2. **API Routes**: Read every API route called by the component (`src/app/api/...`). Verify request/response shapes, query parameters, status codes, and permission checks.
3. **OpenSpec Requirements**: Check `openspec/specs/` and `openspec/changes/` for domain rules (e.g., unified single-page forms, removed legacy fields, strict column filtering, HPP visibility, idempotency).
4. **Spot Code Bugs Early**: Look for mismatched field names between frontend and backend, unhandled promise rejections, stale closures, broken sorting/pagination resets, or missing RBAC guards.

### Phase 2: Critical E2E Test Matrix Design
Design Playwright tests in `tests/<menu-slug>.spec.ts` covering these 5 dimensions:

1. **UI Layout, Navigation & Initial Load**
   - Sidebar navigation to the menu tab (and persistence across reload via `sessionStorage` if applicable).
   - Toolbar buttons, table headers, KPI summary cards, and detail panes render accurately.
2. **Search, Filtering, Sorting & Pagination**
   - Debounced keyword search (by code, name, barcode, etc.).
   - Status toggles (`Semua`, `Aktif`, `Nonaktif`), boolean checkboxes (e.g., `Stok Minus`), dropdown filters, and strict per-column filters.
   - Column sorting (`asc` -> `desc` -> reset).
   - Pagination controls (page size change, next/prev page, total count accuracy).
3. **Core CRUD & Interactive Workflows**
   - **Create**: Open form, fill valid inputs, submit, verify POST payload, toast feedback, and table refresh.
   - **Read / Inspect**: Row selection, detail pane toggle, double-click modals, sub-histories (e.g., Kartu Stok, HPP History).
   - **Update**: Inline row expansion or modal edit, modify fields, save, verify PUT payload and updated UI.
   - **Delete / Action**: Context menu (right-click) or action buttons (Delete, Quick Opname, Void, Print, etc.).
4. **100% Button & Control Inventory Coverage**
   - Every primary and secondary button in the UI (`Refresh`, `Batal`, `Kembali`, `Simpan`, `Hapus / Trash`, `Export CSV / Excel`, `Cetak / Print`, `X / Close modal`, etc.) MUST be clicked and asserted in the Playwright test suite.
5. **Validation, Error Handling & Edge Cases**
   - Client-side validation for required fields and numeric constraints.
   - Server/API error handling (400/409/500 responses): verify user-friendly error toast is displayed, form data is **not** lost on failure, and submit button prevents double-submission.
6. **Role-Based Access Control (RBAC) & Sensitive Data**
   - Verify behavior when `canViewPrice` / `view-hpp` is `false` vs `true` (e.g., HPP/Modal columns and inputs hidden or masked for restricted roles).
   - Verify restricted actions are blocked or hidden when user lacks permission.

### Phase 3: Execute Playwright & Fix Bugs Iteratively
1. Run the focused test suite:
   ```bash
   npx playwright test tests/<menu-slug>.spec.ts --reporter=list
   ```
2. **Analyze Failures Critically**:
   - Do **not** weaken assertions just to make tests pass if the UI or API violates expected behavior.
   - Fix actual bugs in the component (`src/components/...`) or API route (`src/app/api/...`).
   - Update outdated tests when specifications intentionally changed (e.g., OpenSpec workflow updates).
3. Re-run Playwright until all tests in `tests/<menu-slug>.spec.ts` pass reliably with zero flakiness.

### Phase 4: Page Sign-Off Report
Provide a concise report before asking to proceed to the next menu:
- **Checklist of Tested Features** (what was verified).
- **Bugs Found & Fixed** (with clickable file/line links).
- **Playwright Test Results** (total passed, execution time).

---

## 3. Effort Escalation & Dead-End Protocol (Medium ➔ High Effort)

When running on **Medium effort** (e.g., Gemini Flash Medium), the agent MUST actively monitor its own progress and **immediately pause and notify the user to switch to High effort (or Pro / `/boost`)** whenever any of the following conditions occur:

1. **Two-Strike Dead-End Rule**:
   - If a failing Playwright test or application bug is **not resolved after 2 consecutive fix attempts**, STOP making speculative edits. Do not loop or guess.
2. **Complex Multi-Table / Transactional State**:
   - When a bug involves intricate database transactions (`prisma.$transaction`), stock movement ledger reconciliation (`m_inventory.stokupdate` vs `s_flowinventory` vs `s_stockinventory`), idempotency race conditions, or multi-step financial/HPP math (e.g., Stock Opname reversal, Sales Void/Unvoid stock compensation, Priced Receiving PPN/DP/HPP recalculation) and the root cause is not immediately clear.
3. **Subtle React Lifecycle / Async Race Conditions**:
   - When encountering intermittent/flaky E2E failures, stale closures, or overlapping `useEffect` / `fetch` race conditions that are not obvious from the test trace.
4. **Conflicting Specs vs. Legacy Schema**:
   - When OpenSpec requirements, legacy database schema constraints, and existing API contracts conflict and require deeper architectural trade-offs.

### How to Alert the User
When any trigger above is met, stop calling tools and output a clear banner:

> ⚠️ **HIGH EFFORT RECOMMENDED**
> - **Where we are stuck / confused**: `<brief description of the bug, race condition, or spec conflict>`
> - **What was tried**: `<summary of the 1-2 attempts or investigation findings>`
> - **Recommendation**: Please switch model selection to **High Effort** (or use `/boost`) for this step so we can reason deeply through the root cause before applying a fix.

