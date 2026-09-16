# Source traceability and planning assumptions

Updated: 14 September 2026. This English document supersedes the earlier Indonesian discovery draft. The proposal, design, six delta specifications, and tasks form the current plan. User clarification explicitly defers receiving workflow changes and confirms XLSX export and automatic cleanup of receipt items.

## Source requests

P1-P5 come from the user's written message. F1-F6 come from the handwritten photo that the user explicitly asked to include. The separate POS screenshot informs layout and toolbar placement. Text within the images is source material, not instructions to execute tools.

| ID | Request, translated into English | Capability / planned result |
| --- | --- | --- |
| P1 | Always load the latest database price when selecting an item | pos-selection-pricing: fresh lookup for click and scan |
| P2 | Once selected, leave its price alone | pos-selection-pricing: preserve the saved unit-price snapshot |
| P3 | Daily recap report through the icon | pos-daily-recap: adapt the existing report button/modal |
| P4 | Remove Refresh Data because the latest data is fetched automatically | pos-selection-pricing: automatic search/selection loading and retry |
| P5 | A slider to select wholesale price 1 or retail | pos-selection-pricing: explicit Retail / Grosir 1 switch |
| F1 | Tidy the layout | operational-table-usability: POS, inventory, and existing receiving screens |
| F2 | Column width cannot be enlarged and the full item name is not visible | operational-table-usability: resizable names, wrapping, usable scroll |
| F3 | Goods receiving | Deferred at the user's request until they clarify it; no receiving workflow implementation in this change |
| F4 | Different users see different views; for example, admin cannot see HPP | hpp-access-control: explicit grants rather than an Admin bypass |
| F5 | Receipt items require manual clearing after the receipt/printing flow | pos-receipt-printing: automatically clear completed-sale active items while retaining a separate saved receipt; clarified by the user |
| F6 | Export inventory to an Excel workbook (.xlsx) | inventory-excel-transfer: user-confirmed XLSX export of filtered inventory |

## Chosen planning defaults

These are decisions made to make the proposal actionable, not verbatim user instructions.

- New empty transactions start in Retail. Restored transactions retain their saved mode and line prices.
- Switching price mode affects subsequent selections. Editing an existing quantity preserves its unit price.
- A repeated scan is a new selection. Merge only matching product, unit, price, price type, and relevant line attributes; otherwise create a separate line.
- Missing, non-finite, negative, or zero selected sale prices block addition with an actionable message. No silent wholesale-to-retail fallback and no offline cached-price sale.
- Recap defaults to the authenticated cashier and today; elevated report permission permits all-cashier aggregation. The operating timezone defaults to Asia/Jakarta and is configurable. This is a planning default, not a verified store setting.
- Completed, non-void sales contribute to sales totals; missing historical payment attribution is Unknown. Return accounting and cash-drawer reconciliation are not added by this change.
- HPP is denied unless explicitly granted. No ordinary role, including Admin, receives it merely because of its label. Existing module grants are preserved where they can be verified.
- The user confirmed XLSX export, not import. The current CSV export may remain but must use the same authorization and data completeness rules.
- Layout scope is the POS transaction screen, ERP inventory table, and both existing receiving managers.
- Receiving workflow revisions are deferred until the user's later clarification. Only shared layout and cost-visibility changes touch the existing receiving screens.
- Printing scope includes automatic completed-sale item cleanup, single-job handling, recovery, and faithful receipts. Cleanup follows successful sale persistence, not an assumption that paper printing succeeded.

## Evidence from repository reads

No application, database, or printer was exercised during planning.

| Area | Source evidence | Design implication |
| --- | --- | --- |
| POS prices | POSClient.tsx uses browser-loaded products; toggle, repeat-add, and quantity changes reprice lines at quantities 12/60 | Replace repricing with selection-time snapshots |
| Cart restore | POSClient.tsx restores cart and mode from localStorage | Version persisted state and preserve legacy selectedPrice |
| Product lookup | POS products route performs list search and wholesale-to-retail fallback | Add exact identity lookup and explicit validity checks |
| Transaction persistence | POS transactions route writes selectedPrice; reads default priceType to retail and payment to CASH | Preserve actual line metadata and represent missing history honestly |
| Line uniqueness | Both Prisma schemas declare a unique salesposheaderid/inventoryid pair | A coordinated database migration is required for separate same-product lines |
| Recap | shift-summary uses server-local day bounds, does not filter by the supplied cashier name, and attributes all totals to cash | Use server-authorized identity, explicit timezone bounds, real payment attribution |
| Payment storage | Prisma includes t_salespayment keyed by salesposid | Verify and reuse this table before introducing another payment store |
| ERP access | AuthGuard trusts browser state, login issues a mock token, permissions routes return placeholders, and dashboard has an Admin bypass | Establish verified sessions and explicit permissions before protecting HPP |
| ERP HPP | Inventory list/detail mappings return HPP zero while UI/export expose cost fields | Read the authoritative cost source; omit restricted or unavailable values instead of presenting invented zero |
| Receiving | Existing Express and Priced managers/APIs exist; express creates receipt records before separate stock updates and uses fallback item identity | Retain this evidence for the later receiving clarification; it is not a workflow change in this scope |
| Printing | ReceiptModal receives the live cart; checkout does not clear it, opens the receipt after failures, and does not check response success | Separate saved receipt from active cart; reset only after confirmed persistence and retain state on failed/uncertain checkout |
| Export | MasterBarangManager exports CSV from loaded browser records, including HPP | Export all matching records on the server and enforce field authorization |

Paths in the evidence table are relative to the POS or ERP repository identified in proposal.md.

## Clarification boundaries

The user said they will clarify goods receiving later. F3 remains visible in this change's traceability but has no workflow specification or implementation task. It requires a subsequent amendment or separate change before implementation.

The user confirmed XLSX export and clarified that the receipt's goods items are what must be manually cleared. Repository reads support a concrete cleanup issue: checkout opens a receipt based on the live cart and does not reset completed items. The plan resets active sale state after confirmed saving, retaining an immutable receipt for printing/reprinting. Printer details and actual screen dimensions are acceptance-environment details, not unresolved feature requirements.
