## Why

Cashiers need the latest database price when selecting an item, while keeping the price of an already selected item unchanged. The written request and photographed notes also identify daily reporting, table usability, receiving, HPP visibility, receipt printing, and inventory export improvements across POS and ERP.

## What Changes

All eleven source requests are tracked in [scope.md](scope.md). The screenshot is a visual reference; proposed defaults and technical findings are distinguished from the user's original requirements.

- Fetch the latest database price for each item selection, including barcode scans; retain that price as a transaction-line snapshot.
- **BREAKING:** Replace quantity-driven wholesale tier changes in this POS flow with an explicit **Retail / Grosir 1** switch. Changing quantity or mode does not reprice existing lines. Preserve Grosir 2/3 master data and historical prices.
- Allow the same product to have separate transaction lines when selected prices or price types differ. Update the existing database uniqueness constraint accordingly.
- Remove **Refresh Data** once selection and search obtain fresh data automatically.
- Adapt the existing report icon/modal into **Rekap Harian**, defaulting to today's completed sales for the authenticated cashier, with an authorized all-cashier view and explicit date selection.
- Tidy the POS, inventory, and existing receiving screens; make item-name columns resizable and full names readable.
- Track goods receiving as explicitly deferred: the user will clarify the requested workflow revision later. Existing receiving screens remain covered only by the shared layout and HPP visibility changes.
- Enforce user-specific permissions, including HPP visibility, on the server and in every affected screen and export. An Admin label does not automatically grant HPP access.
- Automatically clear a completed sale's active receipt/cart items after successful transaction persistence, while preserving an independent saved receipt for printing and reprinting. The user clarified that the items, rather than Chrome notifications, require manual clearing today.
- Provide the user-confirmed **inventory export to XLSX**, including all filtered records and permission-aware columns. Import is excluded.

These are proposed implementation decisions, not claims that the user explicitly chose every default. See [design.md](design.md) for decisions and alternatives.

## Capabilities

### New Capabilities

- `pos-selection-pricing`: Fresh selection-time prices, immutable line prices, explicit Retail/Grosir 1 selection, and automatic data loading.
- `pos-daily-recap`: Authorized daily sales totals with accurate date, cashier, status, and payment coverage.
- `operational-table-usability`: Readable layouts and resizable item-name columns across the scoped screens.
- `hpp-access-control`: Verified user identity, explicit cost visibility, and consistent protection across UI/API/export paths.
- `pos-receipt-printing`: Automatic completed-item cleanup and recoverable receipt printing/reprinting without repeating a sale.
- `inventory-excel-transfer`: Complete, typed, permission-aware XLSX inventory exports.

### Modified Capabilities

None. No main specifications currently exist for these capabilities; several implementation features already exist and will be revised rather than rebuilt.

## Impact

- **ERP repository:** `C:/Ray/Project/harmony-kitchen-erp`; inventory/receiving layout and cost visibility, authentication and permissions, inventory APIs, Prisma schema, export handling. Receiving workflow changes are deferred.
- **POS repository:** `C:/Ray/Project/harmony-kitchen-pos`; selection/cart state, login identity, transactions, daily reports, receipt/hardware handling, Prisma schema.
- **Database:** coordinated migration for multiple product lines, line metadata, payment/cashier attribution, and server-verifiable sessions/permissions where needed. Reuse existing payment tables after verifying their mapping.
- **Compatibility:** preserve existing line prices and restored carts; represent absent historical payment or price-type metadata as unknown. Do not backfill invented values.
- **Dependencies:** XLSX generation requires a supported server-side workbook writer; choose and verify it during implementation.
- This step creates English planning artifacts only. Application code, database changes, hardware operations, and deployment belong to the later apply phase.
