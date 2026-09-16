## Purpose

Provide an accessible daily sales recap whose totals accurately reflect the selected business date, authorized cashier scope, and available persisted transaction data.

## ADDED Requirements

### Requirement: Open daily recap from the toolbar
The POS SHALL expose the daily recap through a toolbar icon labeled or described as Rekap Harian and retain keyboard access through F10. It SHALL default to today and the authenticated cashier, with a date selector and explicit loading, empty, and error states.

#### Scenario: Open the report
- **WHEN** an authenticated cashier activates the report icon or F10
- **THEN** the POS SHALL fetch the current recap and show its date, timezone, cashier scope, transaction count, and sales total.

#### Scenario: Report request fails
- **WHEN** the recap cannot be loaded
- **THEN** the POS SHALL show an error and retry action rather than present stale or zero-valued data as a successful result.

### Requirement: Enforce cashier scope on the server
The system SHALL limit ordinary users to their own transactions. Viewing all cashiers or another cashier SHALL require an explicit report permission and SHALL NOT depend on a caller-supplied display name.

#### Scenario: Unauthorized cashier override
- **WHEN** a cashier without cross-cashier permission requests another cashier or all cashiers
- **THEN** the server SHALL reject that requested scope without returning those transactions.

#### Scenario: Authorized aggregate
- **WHEN** a user with cross-cashier permission selects all cashiers
- **THEN** the report SHALL aggregate all eligible records and identify the all-cashier scope.

### Requirement: Use explicit business-day and status rules
Daily sales SHALL include completed, non-void transactions in the selected date's start-inclusive, next-day-start-exclusive interval in the configured operating timezone. The default timezone SHALL be Asia/Jakarta. Ambiguous legacy completion/cashier attribution SHALL be disclosed instead of silently assigned.

#### Scenario: Boundary and void records
- **WHEN** completed sales exist just before the selected day, at its start, at the next day's start, and a voided sale exists within the day
- **THEN** only the completed non-void sale within the selected interval SHALL contribute to that day's sales total.

### Requirement: Report only supported financial data
Payment breakdowns SHALL derive from persisted payment attribution, with an Unknown category for missing historical metadata. Unsupported tax, discount, return, or drawer metrics SHALL be omitted or marked unavailable instead of shown as factual zeroes.

#### Scenario: Mixed historical payment coverage
- **WHEN** the selected sales contain known cash and non-cash payments and a sale without payment metadata
- **THEN** amounts SHALL appear in their actual categories and Unknown, without classifying every sale as cash.

#### Scenario: Reconcile the minimum recap
- **WHEN** the report is compared with eligible persisted sales
- **THEN** the transaction count and sales total SHALL match those sales, and any displayed payment allocation SHALL reconcile to the same included total or explicitly report inconsistent source data.
