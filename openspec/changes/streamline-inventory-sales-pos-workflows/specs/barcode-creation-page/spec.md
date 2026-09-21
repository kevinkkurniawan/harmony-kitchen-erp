## Purpose

Memisahkan pembuatan label barcode dari Master Barang melalui halaman khusus yang aman, dapat dipreview, dan tidak mengubah data inventory.

## ADDED Requirements

### Requirement: User can build a barcode print batch
The system SHALL allow an authorized user to find inventory by scan, search, or strict filters and add items with a positive label quantity to a page-local print batch.

#### Scenario: Item is added by scan
- **WHEN** a valid unique barcode is scanned
- **THEN** the matching item is added or its label quantity is incremented

#### Scenario: Invalid item is added
- **WHEN** an item has no printable barcode or the requested quantity is invalid
- **THEN** the system rejects that item and explains the validation failure

### Requirement: User can preview label output
The system SHALL provide selectable browser-print presets, defaulting to 50 × 30 mm, and SHALL allow price visibility to be enabled or disabled before printing.

#### Scenario: User opens preview
- **WHEN** the batch contains valid labels and the user selects preview
- **THEN** the system renders each label with barcode, inventory identifier, name, and optional price using the selected preset

### Requirement: Printing is read-only for inventory
The system SHALL NOT create, edit, reserve, or decrement inventory when a barcode batch is previewed or printed.

#### Scenario: Batch is printed
- **WHEN** an authorized user sends the preview to browser print
- **THEN** inventory records and stock balances remain unchanged and a print audit event is recorded

### Requirement: Barcode page replaces the Master Barang queue
The system SHALL keep print-batch state local to the Create Barcode page and SHALL expose no global barcode queue actions in Master Barang.

#### Scenario: User leaves the barcode page
- **WHEN** the user navigates away with an unprinted batch
- **THEN** the batch does not appear in Master Barang or another user's session

### Requirement: Barcode access is authorized
The system MUST require barcode-page view permission to open the page and barcode-print permission to print.

#### Scenario: Unauthorized print is attempted
- **WHEN** a user without barcode-print permission submits a print audit request
- **THEN** the system returns `403` and records no successful print

