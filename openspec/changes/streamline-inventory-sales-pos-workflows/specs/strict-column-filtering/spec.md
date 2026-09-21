## Purpose

Menyediakan filter per kolom yang deterministik dan konsisten antara tabel, pagination, ringkasan, serta ekspor pada halaman operasional ERP.

## ADDED Requirements

### Requirement: Columns expose type-aware filters
The system SHALL provide exact text matching after trim and case normalization, exact selection for enum and boolean values, numeric operators for numeric values, and local-date or range operators for date values.

#### Scenario: Exact text filter is used
- **WHEN** a user filters an inventory number with surrounding spaces or different letter casing
- **THEN** the system normalizes the input and returns exact normalized matches only

#### Scenario: Numeric range is used
- **WHEN** a user supplies valid minimum and maximum values for a numeric column
- **THEN** the system returns rows whose values are within the inclusive range

### Requirement: Multiple filters use AND semantics
The system SHALL combine active column filters with AND and SHALL display an active-filter indicator and a reset-all action.

#### Scenario: Multiple filters are active
- **WHEN** a user filters status and payment type together
- **THEN** every returned row satisfies both filters

#### Scenario: User resets filters
- **WHEN** the user activates reset all
- **THEN** all column filter values and active indicators are cleared and the unfiltered first page is loaded

### Requirement: Server applies a shared filter contract
The system SHALL apply the same validated server-side filters to table data, sorting, pagination totals, summary values, and exports.

#### Scenario: Filtered table is exported
- **WHEN** a user exports or views a summary with active filters
- **THEN** the export or summary represents the same filtered dataset as the table

#### Scenario: Unsupported operator is supplied
- **WHEN** a client submits an operator not allowed for the target column type
- **THEN** the server returns `400` with a field-specific validation error

### Requirement: Global search remains distinct
The system SHALL keep broad contains-based global search separate from strict column filters and SHALL combine both with AND when both are active.

#### Scenario: Search and strict filter are combined
- **WHEN** a user enters global search text and an exact status filter
- **THEN** results satisfy the exact status filter and match the broad search text

