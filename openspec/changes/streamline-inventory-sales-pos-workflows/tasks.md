## 1. Implementation Preparation and Database Foundation

- [ ] 1.1 Read the relevant Next.js 16 Route Handler, server/client component, caching, and form guidance under each repository's `node_modules/next/dist/docs/` before code edits and verify the implementation notes identify the APIs and deprecations that apply
- [ ] 1.2 Inventory the authoritative stock, payment, HPP, and user identity sources in the current database and verify reconciliation queries document any disagreement between balance and movement tables
- [ ] 1.3 Create additive SQL migrations for opname headers/line snapshots, wholesale categories and thresholds, sales adjustment/HPP snapshots, granular capabilities, correction audit events, and required indexes and verify migrations apply cleanly to a representative database
- [ ] 1.4 Update ERP and POS Prisma schemas for the additive database contract and verify `npx prisma validate` and `npx prisma generate` succeed in both repositories
- [ ] 1.5 Implement a repeatable legacy-data migration that assigns the approved default wholesale category and classifies historical HPP as exact, estimated, or unavailable, and verify rerunning it produces no duplicate or changed classifications

## 2. Shared Server Safety and Permission Enforcement

- [ ] 2.1 Implement structured API success/error helpers with stable error code, field errors, and retryable metadata and verify representative `400`, `401`, `403`, `404`, `409`, and `500` contract tests pass
- [ ] 2.2 Implement append-only audit-event and idempotency helpers and verify concurrent/retried test requests resolve to one committed event and result
- [ ] 2.3 Add the granular capability catalog for opname post/reversal, inventory edit, payment correction, reprint, void, unvoid, Grosir 1 override, manual discount, barcode view/print, and View HPP/Profit and verify Admin defaults allow while non-Admin defaults deny
- [ ] 2.4 Implement shared server-side `requireCapability` enforcement and verify direct protected endpoint tests return `401` without a session and `403` without capability
- [ ] 2.5 Extend User Access UI and APIs with a sensitive-actions section and verify each capability can be changed independently without changing unrelated module CRUD permissions
- [ ] 2.6 Audit capability changes with actor and before/after values and verify a permission-change integration test records exactly one immutable event
- [ ] 2.7 Add permission regression coverage for all protected reads, mutations, exports, and print data and verify HPP/profit fields cannot be recovered by an unauthorized test user

## 3. Transactional Stock Opname

- [ ] 3.1 Implement opname draft creation/update with transaction number, warehouse, captured system quantity, physical quantity, difference, notes, and creator and verify saving a draft leaves stock balances unchanged
- [ ] 3.2 Implement atomic opname posting through the authoritative stock movement path and verify a multi-line posting produces referenced movements and expected balances in one transaction
- [ ] 3.3 Add posted-state immutability, conditional state transitions, and posting idempotency and verify edit/retry/concurrency tests cannot duplicate movements
- [ ] 3.4 Implement authorized opname reversal with reason and compensating movements and verify reversal restores the pre-posting balance and retains the original transaction
- [ ] 3.5 Update Stock Opname UI for draft, posted, and reversed states with actionable structured errors and verify an end-to-end test covers draft, post, history, and reversal
- [ ] 3.6 Update inventory movement/history views to link opname references and verify a posted and reversed opname can be traced from the item ledger

## 4. Master Barang Simplification and Save Reliability

- [ ] 4.1 Refactor the add/edit dialog into one responsive no-tab workspace and verify all editable fields and primary actions are usable at desktop and tablet Playwright viewports
- [ ] 4.2 Remove category and minimum/maximum stock from Master Barang form, table, detail, filters, and export while allow-listing update payloads and verify editing an old item does not overwrite its legacy values
- [ ] 4.3 Remove all barcode queue state, counters, context actions, and print actions from Master Barang and verify no queue UI or handler remains in component tests/search results
- [ ] 4.4 Replace the active-only control with adjacent Semua/Aktif/Nonaktif filters and verify each state returns the correct rows and reset behavior
- [ ] 4.5 Harden inventory create/update validation, response handling, submit locking, timeout/network errors, and retry behavior and verify failed saves preserve the complete form and successful retry submits once
- [ ] 4.6 Display effective wholesale category, thresholds, and tier prices in the item detail panel and verify uncategorized and categorized item states render correctly

## 5. ERP Wholesale Rule Management

- [ ] 5.1 Implement wholesale-category and three-tier threshold CRUD with active state and rule versioning and verify positive strictly ascending validation at UI and API layers
- [ ] 5.2 Refactor Master Promo Grosir so it manages quantity thresholds only while item prices remain in Master Barang and verify promo payloads no longer determine wholesale price amounts
- [ ] 5.3 Add wholesale category selection to inventory edit/create and verify inactive categories cannot be newly assigned
- [ ] 5.4 Extend ERP/POS product contracts with category, version, thresholds, and Grosir 1–3 prices while retaining existing fields and verify backward-compatible API contract tests pass
- [ ] 5.5 Implement ERP wholesale price-selection logic and versioned boundary fixtures for retail fallback, tiers 1–3, and missing prices and verify all fixtures pass

## 6. POS Wholesale Override and Manual Invoice Discount

- [ ] 6.1 Read the POS product-rule contract and implement the same pure tier calculator against the shared fixtures, replacing hard-coded quantity thresholds, and verify ERP and POS fixture outputs are identical
- [ ] 6.2 Add `Override Semua ke Grosir 1` with explicit active state, cancel/recalculation behavior, and invalid-price exception summary and verify cart tests cover mixed eligible and ineligible items
- [ ] 6.3 Enforce override capability and server-side effective-price revalidation at checkout and verify crafted or stale override payloads are rejected without completing a sale
- [ ] 6.4 Add the bottom-right manual discount control with Rupiah/percentage modes and mandatory reason and verify keyboard entry, validation, clear, and zero-total cap behavior
- [ ] 6.5 Implement the canonical discount/tax/service calculation order with integer-Rupiah half-up rounding and verify table-driven tests cover combined member, promo, voucher, and manual discounts
- [ ] 6.6 Persist line price source, wholesale category/version/tier, override flag, and manual discount metadata and verify transaction detail reload reproduces the completed cart without master-data recalculation
- [ ] 6.7 Update receipt, print text, reprint data, and checkout payloads to show discount components and adjustment markers and verify rendered totals reconcile with the stored sale
- [ ] 6.8 Add server enforcement for manual-discount capability and required reason and verify a crafted unauthorized or reasonless checkout returns an error and creates no sale

## 7. Sales Monitoring Corrections

- [ ] 7.1 Implement daily and explicit date-range filtering using Bangkok operational-day boundaries and verify transactions around UTC/local midnight appear in the correct day
- [ ] 7.2 Replace placeholder Sales Monitoring detail/action endpoints with authenticated transaction reads and verify detail returns the stored header, lines, adjustments, payment, and audit state
- [ ] 7.3 Implement authorized payment-type correction with immutable monetary values and before/after audit data and verify CASH-to-QRIS changes payment grouping without changing Net Sales
- [ ] 7.4 Implement snapshot-based reprint with a visible reprint marker and print audit event and verify it creates no sale, payment, or stock movement
- [ ] 7.5 Implement atomic authorized void with reason and compensating stock movements and verify retry/concurrency tests apply the reversal once
- [ ] 7.6 Implement atomic higher-privilege unvoid with dependency and stock validation and verify successful restoration and rejected-conflict cases leave consistent state
- [ ] 7.7 Update Sales Monitoring UI actions, confirmations, reasons, permission visibility, and refreshed summaries and verify an end-to-end test covers payment change, reprint, void, and unvoid

## 8. Goods Receiving Detail

- [ ] 8.1 Add permission-aware detail API responses for Express and Priced Receiving and verify price fields are omitted for users without price permission
- [ ] 8.2 Add double-click, visible Detail action, and Enter-key activation to both receiving lists and verify all three methods open the same transaction
- [ ] 8.3 Build the read-only accessible detail dialog with loading, void, not-found, error, and retry states and verify switching rows never exposes stale detail data

## 9. Profit and Unified Sales Reporting

- [ ] 9.1 Capture unit and total HPP with provenance on every newly completed sale line and verify later master-HPP changes do not alter the stored snapshot
- [ ] 9.2 Build one normalized authorized reporting pipeline for transactions, payment records, discounts, corrections, HPP, and filters and verify unit tests cover active, void, unvoid, and corrected-payment states
- [ ] 9.3 Generate daily and monthly groupings from the shared pipeline and verify summed daily metrics reconcile exactly with the corresponding monthly metrics
- [ ] 9.4 Add HPP, Net Income, and zero-safe margin to authorized report UI/API/export and verify the formula `Net Sales - HPP` across row and summary totals
- [ ] 9.5 Display exact/estimated/unavailable legacy HPP provenance and verify reports never silently substitute current master HPP for a missing historical snapshot
- [ ] 9.6 Enforce View HPP/Profit omission throughout API, UI, print, and exports and verify unauthorized snapshots contain no protected or reconstructable cost fields

## 10. Strict Per-Column Filtering

- [ ] 10.1 Implement a whitelisted typed filter parser for normalized exact text, enums, booleans, numeric ranges, and Bangkok date ranges and verify valid and invalid operator tests
- [ ] 10.2 Apply shared filter objects to Master Barang rows/count/export while preserving separate global contains search and verify combined AND semantics
- [ ] 10.3 Apply shared filter objects to both Receiving lists/details where applicable and verify pagination totals match filtered rows
- [ ] 10.4 Apply shared filter objects to Sales Monitoring rows/summaries and verify payment, status, and date filters reconcile with displayed totals
- [ ] 10.5 Apply shared filter objects to report detail/summary/export and verify all three outputs contain the same authorized dataset
- [ ] 10.6 Add filter-row UI, active indicators, validation feedback, URL/state persistence as appropriate, and reset-all controls to each scoped table and verify Playwright coverage for combined and reset filters

## 11. Create Barcode Page

- [ ] 11.1 Add permission-controlled ERP navigation and route for Create Barcode and verify unauthorized users cannot see or open the page
- [ ] 11.2 Implement scan, global search, strict filters, page-local batch selection, and positive quantity validation and verify duplicate scans increment one batch line
- [ ] 11.3 Implement barcode validation and item-level rejection messages and verify missing/invalid barcode items cannot enter printable output
- [ ] 11.4 Build label preview with optional price and selectable browser-print presets defaulting to 50 × 30 mm and verify print CSS renders expected dimensions in a browser/PDF snapshot
- [ ] 11.5 Implement permission-controlled browser print and print audit event and verify printing changes no inventory master or stock balance
- [ ] 11.6 Add end-to-end coverage proving an unfinished batch remains local to the page/session and never appears in Master Barang

## 12. Integration, Regression, and Release

- [ ] 12.1 Add cross-repository integration coverage from ERP wholesale configuration through POS checkout, ERP monitoring correction, stock movement, receipt reprint, and profit report and verify the full scenario reconciles
- [ ] 12.2 Run ERP lint, Prisma validation/generation, production build, and Playwright suite and resolve all failures attributable to this change
- [ ] 12.3 Run POS lint, Prisma validation/generation, production build, and targeted calculation/checkout tests and resolve all failures attributable to this change
- [ ] 12.4 Run database reconciliation checks for opname movements, sale/void/unvoid stock effects, payment totals, daily/monthly totals, and HPP totals and verify zero unexplained differences on test data
- [ ] 12.5 Exercise additive-schema rollback by disabling feature flags while retaining audit/snapshot data and verify legacy read paths remain operational
- [ ] 12.6 Document deployment order, capability assignments, legacy HPP status, barcode printer preset setup, and operator workflows and verify the release checklist is approved before enabling features
