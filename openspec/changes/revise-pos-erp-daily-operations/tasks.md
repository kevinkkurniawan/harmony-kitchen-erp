## 1. Confirm implementation boundaries and baseline

- [x] 1.1 Read AGENTS.md and relevant installed Next.js guides in both ERP and POS, then record current build/lint results and exact affected paths; verify the baseline report separates existing failures from change-related failures.
- [x] 1.2 Verify deployed/test schema mappings for sales lines, payment records, cashier identity, HPP, and existing permissions; deliver a mapping note and identify every consumer relying on one product line per sale.
- [x] 1.3 Record F3 goods receiving as deferred and the confirmed XLSX/item-cleanup clarifications in the implementation checklist; verify no receiving posting, stock, PO, or costing workflow task is introduced.
- [x] 1.4 Establish a test dataset covering mixed prices, long names, multiple cashiers/dates, incomplete historical metadata, and allowed/denied HPP users; verify it contains no production credentials or customer data.

## 2. Prepare coordinated schema and identity foundations

- [x] 2.1 Design and add the ERP-owned migration for nullable line metadata/display snapshots and removal of the sales-header/product uniqueness constraint in favor of a non-unique index; synchronize both Prisma schemas and verify a test sale can persist two differently priced lines for the same product without changing historical prices.
- [x] 2.2 Add stable checkout request identity and required payment/cashier metadata using verified existing payment mappings; verify legacy records remain readable and retry keys cannot create two completed sales.
- [x] 2.3 Add persisted session and explicit permission storage, including grant-administration authority; verify migration on a representative test database and document a named-account bootstrap procedure without automatically granting HPP to Admin.
- [x] 2.4 Implement ERP and POS server-session issuance, resolution, expiry, logout, and revocation; verify forged browser login state, invalid sessions, and revoked sessions cannot access protected endpoints.
- [x] 2.5 Replace hardcoded/browser-only ERP guards and mock tokens with session-backed login, integrate POS login, and provide credential compatibility/hash upgrade handling; verify real login/logout works and no credential or session secret is returned in user-list payloads.
- [x] 2.6 Implement permission reads and privileged grant updates; verify an ordinary Admin cannot self-grant HPP and a revocation takes effect on the next protected request.

## 3. Protect HPP across ERP and POS boundaries

- [x] 3.1 Map the authoritative inventory cost value and distinguish unavailable from true zero; verify permitted cost reads against the fixture instead of the current hardcoded HPP zero.
- [x] 3.2 Apply server-side field projection and cost-write restrictions to inventory lists/details, history, receiving cost responses, related reports, and mutation responses; verify direct requests without HPP permission disclose no restricted values.
- [x] 3.3 Apply server-resolved module and HPP permissions to dashboard menus, inventory/receiving views, dialogs, histories, and cost-derived cards; verify public inventory and quantity-only views remain usable for permitted users without HPP.
- [x] 3.4 Clear protected user-specific cached state on logout/permission change; verify switching from an HPP-authorized account to a restricted account does not briefly expose the previous account's data.

## 4. Fetch fresh prices and preserve cart snapshots

- [x] 4.1 Implement exact product-ID/barcode lookup with a fresh database read, Retail/Grosir 1 validation, and authenticated selection provenance; verify stale search results, off-page barcodes, invalid prices, and lookup failures satisfy pos-selection-pricing scenarios.
- [x] 4.2 Route click selection, input Enter scanning, and global barcode scanning through the same selection pipeline; verify every explicit selection uses the latest database price while preserving scanner focus.
- [x] 4.3 Add stable line IDs and merge only compatible product/unit/price/type/attribute combinations; verify differently priced repeats stay separate and voided rows are not merged.
- [x] 4.4 Replace quantity-based repricing with quantity-only edits and add the Retail / Grosir 1 switch for future selections; verify mode changes and quantities 12/60 never reprice existing lines.
- [x] 4.5 Isolate pending selections by request ID, captured mode, and transaction generation; verify rapid scans, delayed responses, internal retries, reset/logout, and checkout blocking do not lose or duplicate selections.
- [x] 4.6 Version persisted carts and implement the explicit authorized legacy-price confirmation path; verify restore preserves original prices/modes, including legacy wholesale tiers, without silently discarding or repricing items.
- [x] 4.7 Remove Refresh Data while preserving initial load, fresh search, selection loading, and error retry; verify a database update appears on the next selection without page reload.

## 5. Save transactions and clear completed receipt items

- [x] 5.1 Validate selection provenance and calculate supported checkout totals on the server from saved unit-price snapshots; verify altered payloads are rejected and later master-price changes do not change accepted prices.
- [x] 5.2 Persist non-void lines, payment attribution, cashier identity, and stock effects atomically using the stable checkout request key; verify forced stock failure rolls back the sale and an uncertain-response retry returns the same transaction.
- [x] 5.3 Read transactions into a faithful receipt representation with saved names/units where available, prices, discount/tax/service totals, payment, and timestamp; verify missing legacy metadata is marked unknown rather than synthesized.
- [x] 5.4 Check HTTP/application success before showing the receipt and retain a durable completion reference before resetting state; verify failed and uncertain checkout preserve the cart and never open a success receipt.
- [x] 5.5 Separate the completed receipt from active cart state and automatically reset only the completed generation's items, customer, voucher, payment input, notes, totals, and mode; verify a saved sale leaves an empty Retail transaction while its receipt remains populated.
- [x] 5.6 Implement completion recovery on reload and protect new cart generations from late print/close callbacks; verify a completed sale does not return as unpaid and reprinting the previous sale does not clear new items.

## 6. Complete daily recap behavior

- [x] 6.1 Implement configured-timezone date boundaries and verified completion/void/legacy attribution rules; verify midnight boundary fixtures and ambiguous legacy records produce the documented totals and coverage.
- [x] 6.2 Enforce own-cashier default and explicit cross-cashier permission in the recap API; verify caller-supplied names/IDs cannot widen access.
- [x] 6.3 Aggregate actual persisted payment attribution with Unknown for missing history and remove or mark unsupported metrics unavailable; verify transaction count, sales total, and displayed allocations reconcile to eligible fixture records.
- [x] 6.4 Adapt the existing report icon/modal and F10 entry to Rekap Harian with date/scope labels and loading/empty/error/retry states; verify opening or changing the date fetches the corresponding report without altering the cart.

## 7. Make printing recoverable

- [x] 7.1 Render browser and serial receipts from the saved transaction representation instead of live cart/current time; verify printed values include the saved total components and remain unchanged after master-price updates.
- [x] 7.2 Add single-invocation dispatch state, serial resource release on all exits, and actionable failure/uncertain-delivery feedback; verify rapid clicks and disconnects do not automatically dispatch duplicate copies.
- [x] 7.3 Verify print cancellation, failure, repeated print, and receipt close leave the saved sale posted once and completed active items cleared; record automated lifecycle checks and actual-device acceptance results, leaving device checks incomplete if hardware is unavailable.

## 8. Improve scoped layouts and column widths

- [x] 8.1 Rebalance the POS toolbar/table/receipt/payment layout and add accessible item-name resizing, wrapping, scrolling, and reset; verify long-name transactions at 1366x768 and 1920x1080 with all key controls reachable.
- [x] 8.2 Apply the same table usability behavior to ERP inventory and both existing receiving screens without changing receiving workflows; verify names remain fully readable and row actions remain usable.
- [x] 8.3 Persist widths by user/table and respect permission-dependent column visibility; verify account switching neither restores another user's settings nor reveals hidden HPP columns.

## 9. Export inventory to XLSX

- [x] 9.1 Select and integrate a supported server-only XLSX writer and a bounded consistent export query using list filters/sort; verify a multi-page fixture is exported completely and exactly once.
- [x] 9.2 Generate typed workbook cells, useful headers, filter/timestamp metadata, and row count; verify the workbook opens correctly with leading-zero barcodes, Unicode names, formula-like literal text, and numeric price/quantity values.
- [x] 9.3 Enforce inventory/export access and HPP projection before creation and delivery, including any retained CSV path; verify denied-cost exports contain no restricted values in cells, hidden sheets, or metadata and mid-generation revocation prevents unauthorized delivery.
- [x] 9.4 Add Export Excel loading, empty-result, success, and failure feedback; verify failed or capacity-limited generation does not download a partial file as successful.

## 10. Integration verification and rollout preparation

- [x] 10.1 Run the combined workflow: select a product, update its database price, select it again under both modes, edit quantities, pay, cancel printing, start another sale, and reprint; verify saved lines, stock, recap, automatic cleanup, and new-cart isolation agree.
- [x] 10.2 Run cross-surface HPP tests with authorized and restricted users across list/detail/write/history/report/export/receiving views; verify the Admin label never bypasses explicit grants.
- [x] 10.3 Run appropriate automated tests and build/lint checks in both repositories, then document differences from the recorded baseline; verify new failures are resolved before reporting completion.
- [x] 10.4 Rehearse migration and compatible rollout on test data, documenting permission bootstrap, timezone configuration, client ordering, and rollback limits after mixed-price rows exist; verify no plan restores the incompatible old unique constraint or a client that exposes HPP.
- [x] 10.5 Review P1-P5 and F1-F6 traceability against delivered acceptance evidence; verify all active requests are covered and F3 remains explicitly deferred rather than marked implemented.

