## Purpose

Menetapkan perilaku Master Barang yang ringkas, dapat diandalkan saat menyimpan, dan terpisah dari proses operasional pencetakan barcode.

## ADDED Requirements

### Requirement: Inventory form uses one responsive workspace
The system SHALL present add and edit fields in one responsive form without tab navigation and SHALL keep the primary actions visible at supported desktop and tablet widths.

#### Scenario: User edits an item
- **WHEN** the edit form is opened on a supported viewport
- **THEN** all editable sections are reachable in one workspace without switching tabs

### Requirement: Obsolete item fields are removed from Master Barang
The system SHALL omit item category, minimum stock, and maximum stock from the Master Barang form, table, detail panel, filters, and exports while preserving legacy database values unless a separate migration removes them.

#### Scenario: Existing item has legacy values
- **WHEN** a user views or edits an item that contains category or minimum/maximum stock values
- **THEN** Master Barang does not display or overwrite those legacy values

### Requirement: Barcode queue is removed
The system SHALL expose no barcode queue, queue counter, queue context action, or queue print action in Master Barang.

#### Scenario: User opens Master Barang
- **WHEN** the page and item context menu are rendered
- **THEN** barcode batch creation is available only through the separate Create Barcode page

### Requirement: Status filter includes all states
The system SHALL provide adjacent `Semua`, `Aktif`, and `Nonaktif` status choices.

#### Scenario: User selects Nonaktif
- **WHEN** the Nonaktif status filter is selected
- **THEN** only inactive inventory items are returned and the selection remains visibly active

### Requirement: Inventory save failures preserve user work
The system SHALL prevent duplicate submissions, validate input on client and server, retain entered form data after failure, and display an actionable error derived from a structured response or network condition.

#### Scenario: Server validation fails
- **WHEN** the server rejects a save with field errors
- **THEN** the form remains open with its values intact and displays each relevant field error

#### Scenario: Network request fails
- **WHEN** the save request cannot reach the server or times out
- **THEN** the form remains intact, the user sees a retryable connection message, and no success state is shown

### Requirement: Item detail shows wholesale configuration
The system SHALL show the assigned wholesale category and effective Grosir 1–3 thresholds and prices in the item detail panel.

#### Scenario: Categorized item is viewed
- **WHEN** a user opens the detail panel for an item with an active wholesale category
- **THEN** the panel shows its category and effective threshold-to-price mapping

