## Context

See proposal.md for motivation and scope.md for request provenance, defaults, and inspected files. This change spans the ERP and POS repositories and their shared inventory/sales domain. Both use Next.js 16.2.12, React, and Prisma/PostgreSQL; applicable local Next.js documentation must be read before application code is written.

Observed constraints:

- Cart operations currently recalculate prices from browser-loaded product objects. Cart and mode are persisted locally.
- Both Prisma schemas prohibit multiple lines for the same product under one sales header.
- Transaction prices are stored, but reconstructed price types/payment methods are placeholders.
- The existing recap is labeled as a shift report, ignores cashier filtering, uses server-local day boundaries, and assigns all sales to cash.
- ERP browser guards, mock login tokens, and placeholder permission endpoints cannot enforce cost confidentiality. The dashboard also grants Admin broad access.
- Receiving records and stock updates are not consistently atomic; workflow fixes are deferred by the user's clarification. Inventory HPP mappings and some report values are placeholders.
- CSV export operates on browser-loaded records. ReceiptModal consumes the live cart, checkout does not reset it, and the receipt opens without checking HTTP/application success. The user clarified the complaint as receipt-item cleanup, not browser notification clearing.

## Goals / Non-Goals

**Goals**

- Make selection-time price freshness and saved-line immutability compatible with repeated scans, restore, checkout, and historical receipts.
- Reuse existing reporting, receiving, and printing components while correcting their data boundaries.
- Establish sufficient authenticated identity and explicit grants to enforce cashier report scope and HPP confidentiality.
- Produce observable, testable results for the ten active source requests and retain the explicitly deferred receiving request in traceability.

**Non-Goals**

- Inventory import, new procurement states, new HPP valuation algorithms, refund accounting, full shift reconciliation, offline price fallback, or a storewide UI redesign.
- Silent browser printing, browser notification management, or an unsolicited desktop print service.
- Reconstructing absent historical information by guessing, or a broad identity-provider migration.

## Decisions

### 1. Use a fresh server quote for every explicit selection

Keep paginated/debounced product search for discovery. Add an exact lookup/quote operation accepting a product ID or exact barcode plus Retail/Grosir 1 mode. It reads the database for that selection and returns public product fields, unit, selected price, price type, and an opaque or authenticated quote reference. Responses must not be served from a stale application/browser cache.

Use a server-authenticated quote snapshot so checkout can validate that a price was issued for that product and cashier/cart without replacing it with the current master price. A signed payload or persisted reference may implement this contract; use the existing authenticated session as its identity boundary. Quote authentication is validation, not authority to recalculate prices. Do not expose HPP.

Missing/ambiguous identities or a missing, non-finite, zero, or negative selected price fail explicitly. Do not silently substitute retail for an invalid Grosir 1 value. Network failure leaves the cart unchanged and provides retry.

Alternative: refresh the entire catalog before each scan. Rejected because it is expensive and still separates the price read from the selected identity. Repricing at checkout is also rejected because it violates the requested snapshot behavior.

### 2. Preserve line identity and isolate asynchronous selections

Each cart line has a stable line ID, product/unit identity, selected price, price type, quote reference for new selections, and existing memo/void attributes. Capture mode when the selection begins. Repeated user scan events are distinct intents; internal retries retain their request ID so one response is not applied twice.

A serialized selection queue or equivalent ordered application of results preserves scan order. Discard responses from a previous transaction generation after reset, logout, or completed checkout. Disable checkout while additions are pending.

Merge only matching non-void product/unit/price/type/compatible-attribute lines. A different price or type creates a separate line. Quantity edits change quantity only. Mode changes affect future selections only; quantities 12 and 60 do not trigger tier changes.

Default a new empty transaction to Retail. Restore existing carts with their saved mode and prices, including historical Grosir 2/3 snapshots. Version local state and validate its shape. Legacy carts without quote references enter an explicit migration path: preserve their amount, mark their provenance as legacy, and require a server-authorized legacy-price confirmation before checkout rather than silently refreshing or discarding them. An invalid legacy line requires user correction with its original value still visible.

Alternative: merge by product alone. Rejected because it overwrites prices or hides mixed-price sales.

### 3. Persist multiple same-product lines and genuine transaction metadata

Replace the unique sales-header/product constraint with a non-unique lookup index and retain the existing detail primary key. Persist line identity/order, price type (nullable for legacy data), and product display snapshots required for historical receipts. Keep price and quantity as authoritative stored sales values. Update queries/consumers that assume one product row per sale.

Coordinate schema definitions in both repositories, with one migration owner in ERP so a shared database is not migrated twice. Verify deployed mappings before generating SQL; source schema and runtime naming are not assumed identical.

Write header, non-void details, payment metadata, and stock mutations within one database transaction. Do not swallow stock-write failures. Use a stable checkout request key to prevent sale duplication after retry or an uncertain response. Server-calculated totals use validated snapshot prices and the supported discount/tax fields, not current inventory prices or untrusted client totals.

Reuse t_salespayment after verifying its salesposid relationship and payment-type mapping. Persist real payment attribution for new sales. Populate stable cashier identity from the authenticated user, not a supplied display name. Never invent historical price types, product names, or payment methods; show unavailable metadata explicitly.

### 4. Adapt the recap to an explicit business day and permission scope

Reuse CashierSummaryModal and the toolbar/F10 entry point, labeled Rekap Harian in the product UI. Accept a selected local date; derive half-open UTC boundaries [start, next-day start) from a configured operating timezone (proposal default Asia/Jakarta).

Use the recorded transaction timestamp for grouping, rather than server-local midnight. Include completed, non-void sales. For legacy completion markers, use a documented mapping verified against representative records; ambiguous records are identified as unclassified, not silently counted as completed.

Default to the authenticated cashier. A separate reports.viewAllCashiers grant permits all-cashier or specific-cashier views; enforce it on the server. Resolve legacy cashier names only when they map unambiguously to an identity. Include unmapped legacy records only in an authorized all-cashier view with explicit coverage information.

Show transaction count and sales total as the minimum recap. Derive payment attribution from persisted payment records; use an Unknown bucket when metadata is absent. Do not display placeholder zeros as known discounts, taxes, returns, or cash-to-deposit. Hide unsupported metrics or label them unavailable. Fetch on open/date change and show explicit loading, empty, error, and retry states.

Alternative: retain the current shift labels and just change the icon. Rejected because the current aggregation does not support that meaning.

### 5. Establish verified identity and explicit cost permissions

Use server-issued, unpredictable, expiring sessions stored as digests with a user association, delivered in HTTP-only cookies with appropriate secure/same-site settings. Resolve active identity server-side for each protected request and support logout/revocation. Existing browser flags and serialized user objects are presentation state only. Replace the outer hardcoded guard and mock-token path; integrate the POS login boundary so quotes, checkout, and cashier reports have a trusted identity.

Use explicit per-user grants backed by persisted records, integrating existing module permission UI. Introduce inventory.viewHpp independently of role labels and independently of ordinary user management. HPP starts denied for every ordinary role, including Admin. Grant management requires a separate privileged capability; an ordinary administrator cannot grant themselves HPP through the API. Establish the initial grant administrator through an audited operational bootstrap identifying the account explicitly; do not infer it from a username.

Apply cost restrictions before response serialization. Omit HPP, purchase-cost history, cost-derived inventory totals/margins, and other scoped values that reveal protected costs. A permitted inventory viewer still receives public inventory fields. A cost-only endpoint returns forbidden to an authenticated user without the grant. Protect write responses and exports as well as GET routes; reject unauthorized cost writes. Permission changes take effect on the next protected request, and logout clears user-specific cached views.

Use the authoritative mapped inventory cost source when available. Null/unavailable is distinct from a real zero cost. Do not retain the current fabricated HPP zero. Existing credential verification needs a documented compatibility path; new/changed credentials use password hashing and legacy credentials are upgraded on successful verification. No secrets belong in browser presets or response payloads.

Alternative: hide columns with a client-side role check. Rejected because data remains accessible in API responses and exports.

### 6. Defer receiving workflow changes as requested

The user will clarify the receiving request later. Do not change posting, stock effects, PO handling, validation semantics, or cost formulas as a receiving workflow revision in this change. Retain source findings for that later discussion. Shared table-layout improvements and HPP authorization still apply to the existing receiving screens because they implement separate active requests.

### 7. Make printing an independent, recoverable action

Treat successful transaction persistence as the boundary between an active sale and its receipt. Check HTTP and application success and retain a durable completed receipt snapshot/transaction reference before resetting the active cart. Persist the completion marker and next cart generation so reload recovery cannot restore a completed cart as an unpaid sale.

Automatically clear only the completed generation's active cart and its saved cart state; reset transaction-specific customer, payment input, voucher, notes, totals, and mode for a new Retail sale. Render the receipt from the saved transaction snapshot rather than live cart props. The receipt remains available for print and reprint after cleanup; closing it returns to an empty ready-to-scan transaction. A later print/close callback must never erase items added to a newer transaction.

If saving fails or its outcome is unknown, keep entered items and payment state, show an error/recovery action, and do not open a success receipt. Resolve uncertain outcomes using the stable checkout key before retrying. Print cancellation or hardware failure after successful saving does not restore the paid items into the active cart.

Print from the saved transaction representation, never a fresh product lookup. Use one asynchronous print-job state per invocation: idle, submitting, submitted, failed, or cancelled/closed where observable. Release serial writers in finally blocks, handle disconnects, and prevent concurrent dispatch from duplicate clicks.

A browser print dialog returning does not prove physical printing succeeded. Distinguish “sent/opened” from confirmed paper output. Cancelling, failing, or reprinting does not resubmit payment or decrement stock. A serial failure with uncertain delivery prompts an explicit retry choice rather than automatically dispatching a second copy.

Validate the reported manual item-clearing problem through successive sales, closing/cancelling the print dialog, reload, and reprint. Record the test printer and Chrome version for reproducibility. No browser notification or OS print-queue suppression is part of this request.

### 8. Use server-generated XLSX for complete inventory export

Provide the user-confirmed XLSX export through Export Excel in inventory. Use the same filter/sort semantics as the list, but fetch all matches using bounded batches in a consistent read snapshot. Choose an XLSX writer supported by the project's Node runtime during implementation; keep it server-only.

Keep barcode/inventory codes and all user-entered strings as literal text cells, including leading zeroes and formula-like text. Write genuine prices/quantities as numeric cells. Use meaningful column headings, a filter summary/export timestamp, and an explicit exported-row count. Export permission and HPP filtering happen before workbook creation; permitted users see real cost data, denied users do not receive cost columns.

Recheck permission before delivering the file. A failed or truncated export reports failure, not a successful partial workbook. Empty results produce an informative empty-result state. Existing CSV export, if retained, must share coverage and authorization checks.

Alternative: rename the current CSV download to Excel. Rejected because it does not provide workbook typing or prove complete server-side coverage.

### 9. Scope layout work to the affected operational screens

Keep the current visual system. Rebalance POS toolbar/table/receipt/payment areas and ERP inventory/receiving tables. Support item-name column resizing with reasonable bounds, keyboard access or an equivalent accessible width control, and reset. Wrap full item names and allow horizontal table scrolling when necessary.

Persist widths per user and table; clear user-specific view state on logout and prevent preferences hiding columns needed by a different user. Verify 1366x768 and 1920x1080 as proposed desktop baselines, plus the actual cashier display when available. Critical controls must remain reachable with long names and many lines.

## Risks / Trade-offs

- [Extra selection-time latency] -> Show per-selection progress, preserve scanner focus, and keep lookups small; do not weaken freshness with stale fallback.
- [Mixed-price lines break old consumers] -> Audit receipt/report/sync consumers and migrate the unique constraint before enabling this behavior.
- [Legacy cart provenance is unavailable] -> Preserve displayed amounts and require an authorized confirmation path, never silently issue a fresh-price replacement.
- [Old reports contain incomplete metadata] -> Use Unknown/unavailable and documented coverage, not invented cash totals.
- [Access changes can lock users out] -> Prepare a named permission bootstrap and verify allowed/denied paths in staging before rollout.
- [Deferred receiving work gets included accidentally] -> Keep F3 marked deferred and exclude workflow edits from this task list.
- [Cleanup erases a newer or unsaved sale] -> Reset by completed transaction generation only, retain a separate saved receipt, and cover failures/reload/late callbacks.
- [Large export consumes resources] -> Use bounded reads, a streaming-capable writer or an explicit capacity error; never silently truncate.
- [Two repositories drift in database expectations] -> One migration owner and coordinated client regeneration/release.

## Migration Plan

1. Verify deployed schema mappings and affected consumers against safe test data. Record both repositories' existing build/lint baseline and read their local Next.js guides.
2. Prepare an additive session/permission and sales-metadata migration, plus removal of the product-pair uniqueness constraint in favor of a non-unique index. Back up and rehearse migration on a representative copy.
3. Introduce compatible readers that handle absent legacy metadata, then deploy server routes for sessions, quotes, transactions, report scope, and protected exports before enabling new UI behavior.
4. Provision the named grant administrator and operating timezone. Require re-login where old mock/browser-only identity is invalid; retain saved carts for explicit migration.
5. Enable selection snapshots, switch, reporting, access-aware tables, export, completed-item cleanup, and print handling. Run the cross-repository acceptance checklist.
6. On failure, disable the affected new entry points and roll forward a fix. Do not restore the old uniqueness constraint after duplicate-product lines exist. Do not roll back to clients that reprice restored carts or expose restricted HPP. Keep additive data intact and do not aggregate distinct historical prices to satisfy an old schema.

## Open Questions

- Printer model/connection and store display dimensions remain to be collected during acceptance. Their outcomes select device settings and visual tuning within the contracts above.
- Receiving workflow requirements will be supplied later by the user and are explicitly outside this implementation scope.
