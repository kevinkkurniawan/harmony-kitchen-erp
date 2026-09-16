# Baseline Report & Schema Mapping Note

**Change:** revise-pos-erp-daily-operations  
**Date:** 2026-09-14  

---

## 1. Baseline Verification (Task 1.1)

### Installed Next.js & React Environment
- **Next.js Version:** 16.2.12
- **React Version:** 19.2.4
- **Next.js Breaking Changes Observed (from `node_modules/next/dist/docs/`):**
  - Route Handlers: `params` is an asynchronous Promise (`const { id } = await params;`).
  - Headers / Cookies: `cookies()` is an asynchronous Promise (`const cookieStore = await cookies();`).
  - Dynamic APIs and caching behavior require explicit async resolution.

### Baseline Build & Lint Results
- **Typecheck (`npx tsc --noEmit`):**
  - **ERP:** Passed (0 errors).
  - **POS:** Passed (0 errors).
- **Linter (`npm run lint`):**
  - **ERP:** 304 problems (203 errors, 101 warnings). Existing pre-change issues consist of:
    - Unused imports and variables (`@typescript-eslint/no-unused-vars`)
    - `setState` directly inside `useEffect` bodies (`react-hooks/set-state-in-effect`) in `UserAccessManager.tsx`
    - `any` types (`@typescript-eslint/no-explicit-any`) in `pagination.ts`
  - **POS:** 64 problems (18 errors, 46 warnings). Existing pre-change issues consist of:
    - Unused variables and imports (`@typescript-eslint/no-unused-vars`)
    - `setState` directly inside `useEffect` (`react-hooks/set-state-in-effect`) in `MemberValidationModal.tsx`
    - `any` types in `usePOSHardware.ts` and `users/route.ts`

### Exact Affected Paths
- **ERP:**
  - `prisma/schema.prisma`
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/users/route.ts`
  - `src/app/api/users/permissions/route.ts`
  - `src/app/api/users/[id]/route.ts`
  - `src/app/api/inventory/route.ts`
  - `src/app/api/inventory/[id]/route.ts`
  - `src/app/api/inventory/[id]/hpp-history/route.ts`
  - `src/app/api/inventory/export/route.ts` (new server XLSX export)
  - `src/app/api/sales/monitoring/route.ts`
  - `src/app/api/sales/sync/route.ts`
  - `src/app/api/reports/sales/route.ts`
  - `src/components/MasterBarangManager.tsx`
  - `src/components/UserAccessManager.tsx`
  - `src/components/ERPDashboard.tsx`
  - `src/components/PenerimaanBarangEkspressManager.tsx`
  - `src/components/PenerimaanBarangHargaManager.tsx`
- **POS:**
  - `prisma/schema.prisma`
  - `src/lib/auth.ts` / `src/app/api/auth/`
  - `src/app/api/products/route.ts`
  - `src/app/api/products/quote/route.ts` (new fresh selection quote route)
  - `src/app/api/transactions/route.ts`
  - `src/app/api/reports/daily-recap/route.ts` (new / adapted daily recap route)
  - `src/components/POSClient.tsx`
  - `src/components/ReceiptModal.tsx`
  - `src/components/CashierSummaryModal.tsx`
  - `src/components/LoginModal.tsx`
  - `src/types/pos.ts`

---

## 2. Schema Mapping & Consumer Audit (Task 1.2)

### Deployed Runtime Database (`harmony_erp` in PostgreSQL)
- **Inventory (`m_inventory`):**
  - Runtime columns: `id`, `barcode`, `inventory_no`, `inventory_name`, `brand_id`, `category_id`, `uom_id`, `price`, `is_active`, `hpp`, `grosir1`, `grosir2`, `grosir3`, `stock`, `created_at`.
  - Count: 9,145 active records. Real wholesale tiers (`grosir1`, `grosir2`, `grosir3`) and `hpp` exist in this table.
- **Sales POS Headers (`t_sales_pos_header`):**
  - Runtime columns: `id`, `sales_pos_no`, `sales_pos_date`, `customer_name`, `total_amount`, `discount_amount`, `grand_total`, `cashier_name`, `status`, `created_at`.
  - Count: 30 completed transaction headers.
- **Sales POS Details (`t_sales_pos_detail`):**
  - Runtime columns: `id`, `header_id`, `barcode`, `inventory_no`, `inventory_name`, `qty`, `price`, `subtotal`.
  - Count: 105 line items.
- **Users (`t_access_user`):**
  - Runtime columns: `id`, `username`, `full_name`, `user_level`, `is_active`, `created_at`, `password`.
  - Count: 4 users (`admin`, `manager`, `supervisor`, `kasir`).
- **User Module Permissions (`t_access_user_module`):**
  - Runtime columns: `id`, `user_id`, `module_code`, `can_view`, `can_add`, `can_edit`, `can_delete`, `can_print`, `created_at`.

### Identified Single-Product-Line-Per-Sale Consumers
1. **Prisma Schema (`prisma/schema.prisma`):**
   - Line 1192 previously defined: `@@unique([salesposheaderid, inventoryid], map: "idx_20923_ix_t_salesposdetail")`.
   - Must be replaced with a non-unique index to permit multiple lines for the same product at differing price snapshots.
2. **POS Client Cart Addition (`src/components/POSClient.tsx`):**
   - `addToCart` matched only on `i.product.id === product.id && !i.isVoided`, unconditionally incrementing quantity and recalculating wholesale tiers.
   - Must be updated to match on product, unit, unit price, price type, and compatible attributes.
3. **POS Quantity Edit (`updateQty` in `POSClient.tsx`):**
   - Recalculated prices based on quantity >= 12 / 60. Must only modify quantity and retain original unit price.
4. **POS Wholesale Switch (`handleToggleGrosir` in `POSClient.tsx`):**
   - Mapped over all existing items and mutated their prices. Must affect future selections only.
5. **POS Transaction POST Route (`src/app/api/transactions/route.ts`):**
   - Stock decrement looped over items without isolating repeated products; must handle multiple lines properly and ensure idempotency.

---

## 3. Scope Clarifications & Deferred Tasks (Task 1.3)
- **F3 Goods Receiving:** Explicitly deferred as requested. No PO, costing workflow, or receiving stock posting workflow changes are included. Only table usability (item name column resizing) and server HPP permission masking apply to existing receiving views.
- **Inventory XLSX Export:** Server-side streaming/generation with typed numeric/string cells and HPP column suppression when denied.
- **Completed Item Cleanup:** Automatic clearing of cart items upon successful transaction completion; receipts remain independent snapshots for printing/reprinting.

---

## 4. Test Dataset Specification (Task 1.4)
Established in `harmony_erp` without production secrets:
- Mixed-price product lines for test sales (same barcode/inventory_no with different unit prices).
- Long item names (> 50 characters) to test column resizing and wrapping across 1366x768 and 1920x1080.
- Multiple cashiers (`Bambang (Admin POS)`, `Siti Aminah (Kasir 2)`, `Rina Kartika (Kasir 1)`) and date boundaries (spanning midnight, month boundaries).
- Distinct HPP permission profiles: Admin (unauthorized HPP by default), Supervisor (authorized HPP), Kasir (unauthorized HPP).
