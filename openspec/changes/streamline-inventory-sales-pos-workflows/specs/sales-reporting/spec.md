## Purpose

Menyeragamkan laporan penjualan harian dan bulanan agar memakai dataset, dimensi pembayaran, koreksi, dan rumus agregasi yang sama.

## ADDED Requirements

### Requirement: Daily and monthly reports share one metric contract
The system SHALL expose the same metric fields and definitions for daily and monthly reports, with only the grouping period changing.

#### Scenario: User compares report types
- **WHEN** daily rows for a calendar month are summed and compared with that month's monthly row
- **THEN** transaction count, item quantity, gross sales, discounts, Net Sales, HPP, Net Income, and payment totals reconcile subject to the same rounding rules

### Requirement: Reports use authoritative payment records
The system SHALL group payment totals from stored payment records and SHALL reflect audited payment-type corrections.

#### Scenario: Payment type is corrected
- **WHEN** a sale payment changes from CASH to QRIS
- **THEN** subsequent reports remove the amount from CASH, add it to QRIS, and keep total Net Sales unchanged

### Requirement: Reports use operational dates consistently
The system SHALL interpret date boundaries using `Asia/Bangkok` and SHALL use inclusive local calendar periods converted to unambiguous server query boundaries.

#### Scenario: Sale occurs near midnight
- **WHEN** a transaction timestamp falls near a UTC day boundary but within a Bangkok local day
- **THEN** both daily and monthly reports place it in the same Bangkok calendar period

### Requirement: Corrections remain traceable
The system SHALL exclude void sales from active totals, include unvoided sales once, and provide correction metadata sufficient to reconcile period changes.

#### Scenario: Transaction is voided and unvoided
- **WHEN** authorized corrections change a transaction state
- **THEN** report totals reflect the current effective state exactly once and audit detail identifies both correction events

### Requirement: Report summary matches filtered detail
The system SHALL compute report summaries, exports, and displayed detail from the same authorized and filtered dataset.

#### Scenario: User applies report filters
- **WHEN** date, payment, status, or other supported column filters are active
- **THEN** the summary and export reconcile with the filtered detail rows

