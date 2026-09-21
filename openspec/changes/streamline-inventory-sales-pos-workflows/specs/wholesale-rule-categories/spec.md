## Purpose

Menyediakan aturan quantity grosir terpusat per kategori barang agar ERP dan POS memilih tier harga yang sama tanpa ambang hard-coded.

## ADDED Requirements

### Requirement: Inventory can reference a wholesale category
The system SHALL allow an inventory item to reference one active positive-integer wholesale category and SHALL display that category in the item detail panel.

#### Scenario: User assigns a category
- **WHEN** an authorized user saves an item with an active wholesale category
- **THEN** the system persists the category and returns it in inventory detail and POS product data

#### Scenario: Item has no category
- **WHEN** an item has no active wholesale category
- **THEN** automatic quantity-based wholesale pricing is not applied to that item

### Requirement: Category defines three quantity thresholds
The system SHALL maintain quantity thresholds for Grosir 1, Grosir 2, and Grosir 3 per category, while wholesale prices remain stored on each inventory item.

#### Scenario: Valid thresholds are saved
- **WHEN** an authorized user saves three positive thresholds in strictly ascending order
- **THEN** the system activates those thresholds for the category

#### Scenario: Invalid thresholds are saved
- **WHEN** thresholds are missing, duplicated, non-positive, or not strictly ascending
- **THEN** the system rejects the configuration with field-specific errors

### Requirement: POS selects the highest eligible tier
The system SHALL select the highest wholesale tier whose configured minimum quantity is met and whose item price is valid.

#### Scenario: Quantity reaches the second threshold
- **WHEN** an item quantity meets Grosir 2 but not Grosir 3
- **THEN** POS applies the item's Grosir 2 price and records the selected tier

#### Scenario: Eligible price is unavailable
- **WHEN** a quantity meets a tier whose item price is zero, null, or negative
- **THEN** POS falls back to the next valid lower tier or retail price and identifies the fallback to the cashier

### Requirement: Completed sales preserve the applied rule
The system SHALL store the category, threshold version, selected tier, and effective unit price used for every completed wholesale sale line.

#### Scenario: Rules change after a sale
- **WHEN** a completed sale is viewed or reprinted after wholesale rules change
- **THEN** the system uses the stored sale snapshot rather than recalculating the historical price

