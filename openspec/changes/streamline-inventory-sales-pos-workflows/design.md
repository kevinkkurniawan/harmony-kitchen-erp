## Context

See `proposal.md` for motivation and the capability specs for observable behavior.

The ERP and POS are separate Next.js applications that operate on closely related legacy PostgreSQL tables. Inventory currently keeps a mutable balance in `m_inventory.stokupdate`; opname lines in `t_opname` are deleted and recreated before that balance is overwritten. Sales header/detail data exists, but correction endpoints are placeholders, payment reporting uses fallback text, quantity thresholds are hard-coded in POS, and completed lines do not preserve HPP or adjustment metadata. ERP authorization currently uses a module CRUD/print matrix with permissive non-Admin view defaults.

The change must therefore introduce transactional and audit guarantees without destructively removing legacy columns or breaking existing API consumers. The OpenSpec artifacts live in the ERP repository, while the POS portions are implemented in the sibling `harmony-kitchen-pos` repository and must be released against a compatible ERP/database contract.

## Goals / Non-Goals

**Goals:**

- Make stock and sales corrections atomic, idempotent, and auditable.
- Keep historical prices, HPP, discounts, and wholesale decisions reproducible.
- Define one server-authoritative calculation contract used by ERP reports and POS checkout.
- Add granular authorization without weakening existing page permissions.
- Deploy through additive schema and API changes before removing old UI behavior.

**Non-Goals:**

- Physically drop legacy category, minimum-stock, or maximum-stock columns.
- Introduce a full accounting ledger or operating-expense model.
- Replace existing printer drivers or direct hardware integrations.
- Convert the two repositories into a monorepo or shared runtime package.
- Reprice or rewrite completed historical sales automatically.

## Decisions

### 1. Use additive transaction headers, snapshots, and audit events

Add schema through timestamped SQL migrations and reflect it in both Prisma schemas where required. Preserve existing transaction tables and identifiers, adding the minimum columns/tables needed for durable state:

- An opname header stores transaction status (`DRAFT`, `POSTED`, `REVERSED`), warehouse, notes, creator, posted/reversed metadata, and idempotency keys.
- Opname lines preserve `system_qty`, `physical_qty`, and `difference_qty`. Existing `t_opname.qty` remains readable during migration.
- Stock movements use the existing inventory-flow ledger where its semantics are sufficient, with a stable opname/sale reference and signed quantity. A compatibility adapter updates the current balance in the same database transaction.
- Sale lines add HPP and wholesale/price-source snapshots.
- Sale headers or a related adjustment record store the manual-discount and override snapshot.
- A correction/audit table stores typed events, actor, reason, before/after payloads, and idempotency key for payment changes, print events, void, unvoid, permission changes, and opname reversal.

This is preferred over rewriting legacy tables because additive migration limits rollback risk and keeps existing readers functioning. Storing audit information only in application logs was rejected because logs are not a reliable business record and cannot enforce idempotency.

### 2. All material mutations run through server transaction services

Create server-only services for opname posting/reversal and sales payment/void/unvoid. Each service:

1. authenticates and authorizes the actor;
2. validates the current transaction state;
3. locks or conditionally updates the affected record;
4. writes business data, movements, snapshots, and audit event in one database transaction;
5. returns the previously committed result for a repeated idempotency key.

The UI never submits a replacement stock balance as the authoritative mutation. It submits counted quantity or a requested correction, and the server calculates the delta.

This is preferred over coordinating multiple endpoint writes from React because client retries and partial failures would create duplicate stock effects. Database transactions alone without idempotency were rejected because a timed-out client can safely retry only when the server recognizes the original operation.

### 3. Centralize wholesale rules but snapshot every completed decision

Introduce wholesale-category and threshold records with three named tiers. `m_inventory` references an optional category; item-level `grosir1`, `grosir2`, and `grosir3` remain the price source. Updating a category increments a rule version.

ERP product responses expose the category, version, and ordered thresholds. POS uses a pure price-selection function with contract fixtures covering boundary quantities, missing prices, retail fallback, and override. Checkout revalidates the submitted effective price on the server using the same rule contract before persisting the selected category/version/tier/price source.

Because the repositories cannot import one local module reliably, the algorithm and JSON contract fixtures are mirrored and verified in both test suites. Treating the client calculation as authoritative was rejected because a crafted request could choose an unauthorized or stale price.

### 4. Model override and discounts as explicit invoice adjustments

`Override Semua ke Grosir 1` is a cart-level boolean. It changes only eligible active lines; invalid Grosir 1 prices remain retail and are returned as exceptions. Cancelling the override recalculates from normal rules.

Manual discount is stored as mode (`AMOUNT` or `PERCENT`), entered value, calculated amount, reason, actor, and permission decision. The canonical calculation order is:

1. effective line prices;
2. subtotal;
3. member discount;
4. voucher/promo discount;
5. manual invoice discount;
6. tax;
7. service charge;
8. grand total.

Money is calculated in integer Rupiah; percentage results use one documented half-up rounding function. Both UI preview and server checkout use the same ordered fields, but only the server result is committed.

Folding manual discount into an existing aggregate discount field was rejected because it would lose the reason, permission trail, and reconciliation with member/promo discounts.

### 5. Record HPP at sale completion and label legacy estimates

At checkout, the server reads authorized current HPP and stores `unit_hpp` and `total_hpp` on each sale line in the same transaction. Reports aggregate the snapshot and calculate `Net Income = Net Sales - HPP`; margin is zero when Net Sales is zero.

For legacy lines, a migration/backfill command records either a defensible historical value from available data or an explicit `ESTIMATED`/`UNAVAILABLE` provenance. Reports never silently use today's master HPP as though it were historical fact.

Recalculating all reports from `m_inventory.hpp` was rejected because later HPP edits would rewrite historical profitability.

### 6. Use an append-only correction model for payment, void, and unvoid

Payment correction updates the effective payment reference and appends a before/after audit event; it cannot alter the sale total, tendered amount, or change. Reprint renders stored snapshots and appends a print event only.

Void and unvoid are state transitions guarded by separate permissions and conditional current-state checks. Their signed stock movements reference the original sale and correction event. Repeated or concurrent transitions return the existing state rather than duplicating inventory effects. Reports derive the effective state and correction-period adjustments from these records.

Deleting a transaction and recreating it was rejected because it breaks receipt identity, audit continuity, and stock reconciliation.

### 7. Add granular capabilities beside the existing page matrix

Keep `erp_user_permission` for page/module CRUD and introduce a granular capability assignment keyed by user and capability code for the sensitive actions listed in the user-permissions spec. A shared `requireCapability` server helper returns `401` for no session and `403` for denied capability. Admin receives allow-by-default behavior for these new codes; all other users are denied until an explicit assignment exists.

The User Access screen edits both the familiar module matrix and a clearly separated sensitive-actions section. Every capability change creates an audit event.

Overloading generic `canEdit` or `canDelete` to mean unvoid, override, or profit access was rejected because those meanings are neither discoverable nor independently assignable.

### 8. Use a whitelisted typed filter contract

Each participating endpoint declares allowed fields and types, then passes query input through a shared parser that produces validated filter objects. Text equality is trimmed and case-normalized, enum/boolean values are allow-listed, numeric ranges are inclusive, and local date ranges are converted to UTC boundaries for `Asia/Bangkok`. Multiple column filters use AND. Global search remains a separate contains-based OR group that is ANDed with column filters.

The same parsed filter object feeds rows, count, summaries, and exports. Raw field names, raw operators, and raw SQL fragments from the client are never accepted.

A fully generic filtering language was rejected because it expands the attack surface and makes endpoint behavior difficult to test.

### 9. Build report rows from one normalized aggregation pipeline

The report service first selects the authorized, filtered transaction dataset and normalizes monetary/payment/correction fields. Daily and monthly output then differ only by the period-key function. Summary and export consume the same normalized rows.

Operational-day utilities use explicit Bangkok calendar boundaries rather than server-local `setHours`, preventing deployment-host timezone changes from moving transactions between periods.

Maintaining separate daily and monthly loops was rejected because their formulas and payment mapping have already diverged.

### 10. Keep Master Barang removal UI-only and move barcode batches to page state

Master Barang stops rendering or submitting category, minimum/maximum stock, and barcode queue fields. Update handlers use allow-listed input so omitted legacy fields are not overwritten. The single-page editor uses responsive sections rather than tab state and preserves a failed draft in component state.

Create Barcode owns its selection batch locally. Its preview is generated from validated current item data, with a default 50 × 30 mm CSS print preset and optional price. Printing writes only an audit event. Browser print is the baseline transport so no new printer dependency is introduced.

Physically deleting legacy columns and reusing the global Master Barang queue were rejected due to migration risk and cross-page state leakage.

### 11. Keep APIs backward compatible during rollout

Existing response fields remain available while new snapshot, rule, correction, and filter metadata is additive. New mutations use dedicated endpoints or explicit action routes and structured errors with stable codes, field errors, and a retryable flag. Frontends must check `response.ok` and the structured success field before closing forms or clearing carts.

Once both applications use the new contract, legacy fallback paths can be measured and removed under a separate change.

## Risks / Trade-offs

- **[Risk] Existing stock sources disagree (`m_inventory`, stock tables, flow ledger)** → Select and document one authoritative balance path during the schema task, add reconciliation queries, and block posting when the pre-transaction balance is inconsistent.
- **[Risk] POS and ERP calculator implementations drift** → Share versioned contract fixtures, require both suites to pass, and revalidate all checkout prices on the server.
- **[Risk] Legacy HPP is incomplete** → Store provenance, expose estimated/unavailable status, and never silently present an estimate as a snapshot.
- **[Risk] Unvoid can conflict with later stock activity** → Lock affected rows, validate the current effective state and stock policy, and fail atomically with a user-actionable reason.
- **[Risk] Strict filters produce empty results users interpret as missing data** → Keep global contains search visible and show active exact-filter indicators with reset-all.
- **[Risk] Additive tables increase reporting joins** → Add indexes for transaction reference, status, operational timestamp, inventory, capability code, and idempotency key; inspect query plans for report ranges.
- **[Risk] Two-repository deployment is temporarily mismatched** → Deploy additive database/API support first, then ERP UI, then POS UI; keep old response fields until both are verified.

## Migration Plan

1. Add database tables/columns/indexes with nullable or safe defaults; deploy Prisma schema updates without changing current UI behavior.
2. Add capability codes and grant them to Admin; non-Admin remains denied. Verify existing page permissions continue to resolve.
3. Add server services, structured errors, idempotency handling, and read-compatible API fields behind feature flags.
4. Backfill wholesale category defaults needed to preserve current behavior and classify legacy HPP snapshots as exact, estimated, or unavailable.
5. Deploy ERP Master Barang, opname, receiving detail, Sales Monitoring, reporting, filters, permissions, and Create Barcode updates.
6. Deploy POS rule consumption, server-revalidated checkout, override, manual discount, receipt, and reprint changes.
7. Enable features by module after contract, permission, reconciliation, and end-to-end tests pass.
8. Reconcile stock movements against balances and daily totals against monthly totals before removing feature flags.

Rollback disables the new UI/actions first while retaining additive schema and audit data. Database rollback MUST NOT drop populated audit, snapshot, or movement data; a later cleanup migration may remove unused structures only after export and approval.
