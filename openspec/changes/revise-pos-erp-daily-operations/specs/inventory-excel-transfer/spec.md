## Purpose

Allow authorized users to export the complete filtered inventory to a genuine Excel workbook with correct data types and permission-aware cost visibility.

## ADDED Requirements

### Requirement: Export all matching inventory to XLSX
The inventory screen SHALL provide an Export Excel action that downloads a valid .xlsx workbook containing all records matching the current filters and sort order, independent of pagination. The export SHALL identify its filters, creation time, and exported record count.

#### Scenario: Filter spans multiple pages
- **WHEN** the current filter matches more records than the visible or loaded page
- **THEN** the workbook SHALL include every matching record exactly once in the requested order and report the correct row count.

#### Scenario: No results or export failure
- **WHEN** no inventory matches or workbook generation fails
- **THEN** the application SHALL show an informative empty-result or error state and SHALL NOT report a truncated or failed file as a successful export.

### Requirement: Preserve inventory data types
Inventory codes, barcodes, names, and other user-entered text SHALL be literal text cells. Genuine numeric price and quantity values SHALL remain numeric. Missing values SHALL NOT be fabricated.

#### Scenario: Leading zeroes and formula-like text
- **WHEN** a record includes barcode 001234 and a name beginning with an equals sign
- **THEN** Excel SHALL preserve the barcode's leading zeroes and display the name as literal text rather than execute it as a formula.

### Requirement: Enforce export and HPP permissions
Export SHALL require authorized inventory access and SHALL enforce current HPP permissions before workbook creation and delivery. Any retained CSV export SHALL enforce the same coverage and field restrictions.

#### Scenario: Export without HPP access
- **WHEN** an authorized inventory user lacking HPP permission exports records
- **THEN** the delivered file SHALL omit HPP, protected purchase costs, and cost-derived fields, including hidden sheets or metadata.

#### Scenario: Permission changes during generation
- **WHEN** export permission or HPP permission is revoked before delivery
- **THEN** the system SHALL withhold a workbook inconsistent with the current permissions and provide a retry or access-denied response.
