## Purpose

Ensure each explicit item selection uses the latest database price while preserving the price of every item already committed to the cart.

## ADDED Requirements

### Requirement: Fetch a fresh price for every selection
The POS SHALL resolve each clicked product or scanned barcode against the database at selection time, independently of the age or contents of search results. Only a successful response for that selection SHALL add an item.

#### Scenario: Master price changes after search
- **WHEN** search results show a price of 30000, the database changes to 32000, and the cashier selects that product
- **THEN** the added item's unit price SHALL be 32000.

#### Scenario: Barcode is outside the loaded search page
- **WHEN** a cashier scans an exact barcode for an existing product not present in loaded search results
- **THEN** the POS SHALL resolve it from the database and apply its current selected-mode price.

#### Scenario: Lookup or price is invalid
- **WHEN** lookup fails, the identity is missing or ambiguous, or the selected price is missing, non-finite, zero, or negative
- **THEN** the POS SHALL leave the cart unchanged and show an actionable error without using a cached price or silently switching price type.

### Requirement: Preserve selected line prices
Once added, a line's unit price and price type SHALL remain unchanged through master-price changes, quantity edits, mode changes, cart restore, checkout, and reprinting. New selections SHALL use their own fresh prices.

#### Scenario: Existing quantity changes across former tier boundaries
- **WHEN** quantity changes to 12 or 60 on a line added at Grosir 1
- **THEN** its saved unit price and Grosir 1 type SHALL remain unchanged.

#### Scenario: Same product is selected at a different price
- **WHEN** a product already in the cart at 30000 is selected again after its database price becomes 32000
- **THEN** the old line SHALL retain 30000 and the new selection SHALL occupy a separate 32000 line through save and reload.

#### Scenario: Matching selection can merge
- **WHEN** a new selection matches an active line's product, unit, unit price, price type, and relevant attributes
- **THEN** the POS SHALL increase that line's quantity without changing its price or affecting voided lines.

### Requirement: Provide an explicit two-position price switch
The POS SHALL offer a visibly labeled Retail / Grosir 1 switch that affects future selections only. A new empty transaction SHALL default to Retail; a restored transaction SHALL retain its saved mode. New selections SHALL NOT automatically use Grosir 2 or Grosir 3.

#### Scenario: Mode changes with existing items
- **WHEN** the cashier switches from Retail to Grosir 1 after adding a retail-priced item
- **THEN** the existing item SHALL retain its price and the next selection SHALL use the database Grosir 1 price.

### Requirement: Isolate pending selection operations
Each selection SHALL retain the mode and transaction identity captured when initiated. Late or duplicate responses SHALL NOT corrupt the cart or a subsequent transaction. Checkout SHALL be unavailable while selections are pending.

#### Scenario: Mode changes during lookup
- **WHEN** a Retail selection is pending and the cashier changes the mode to Grosir 1
- **THEN** that pending selection SHALL still use Retail and later selections SHALL use Grosir 1.

#### Scenario: Old response arrives after transaction reset
- **WHEN** a result from an earlier transaction arrives after that transaction was reset or the cashier logged out
- **THEN** the result SHALL NOT add items to the current transaction.

#### Scenario: Rapid repeated scans and transport retries
- **WHEN** the cashier scans an item twice and one transport response is retried
- **THEN** exactly two selection intents SHALL be applied, without losing a scan or counting the retry as another item.

### Requirement: Validate and persist price snapshots
The server SHALL validate selected prices using their selection provenance, calculate supported totals from the validated snapshots, and persist all distinct lines atomically. It SHALL NOT substitute newer master prices at checkout.

#### Scenario: Price changes before payment
- **WHEN** a valid line quote was issued at 30000 and the database price changes to 32000 before checkout
- **THEN** the saved sale and receipt SHALL retain the quoted 30000 price.

#### Scenario: Price payload is altered
- **WHEN** checkout submits a changed product or unit price inconsistent with its valid selection provenance
- **THEN** the server SHALL reject the transaction without posting any sale or stock movement.

#### Scenario: Restore a legacy cart
- **WHEN** a saved cart has selected prices but lacks current selection provenance
- **THEN** its original prices SHALL remain visible and unchanged, and checkout SHALL require an explicit server-authorized legacy-price confirmation.

### Requirement: Eliminate manual data refresh
The POS SHALL load search and selection data automatically and SHALL NOT expose the Refresh Data action. Error retry SHALL remain available without changing existing cart prices.

#### Scenario: Continue after an inventory update
- **WHEN** inventory changes while the POS remains open
- **THEN** a subsequent search or selection SHALL obtain current data without a page reload or manual Refresh Data action.
