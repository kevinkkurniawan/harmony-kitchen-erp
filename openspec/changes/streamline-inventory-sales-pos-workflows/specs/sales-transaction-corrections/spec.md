## Purpose

Memungkinkan koreksi transaksi penjualan yang terkontrol dari ERP tanpa menghapus histori pembayaran, cetak ulang, void, atau pergerakan stok terkait.

## ADDED Requirements

### Requirement: Sales Monitoring supports operational-day filtering
The system SHALL filter sales by a selected operational date or explicit date range using the `Asia/Bangkok` time zone.

#### Scenario: User selects daily view
- **WHEN** a user selects a calendar date in daily view
- **THEN** the system returns only transactions whose operational timestamp falls within that local day

### Requirement: Payment type can be corrected without changing sale value
The system SHALL allow an authorized user to replace the payment type of a completed sale while preserving the original total, tendered amount, and change.

#### Scenario: Payment type is changed
- **WHEN** an authorized user selects a valid replacement payment type and supplies a reason
- **THEN** the system stores the old and new payment types, actor, reason, and timestamp and updates monitoring summaries

#### Scenario: Invalid payment correction is submitted
- **WHEN** the replacement payment type is inactive or the submitted monetary values differ from the stored sale
- **THEN** the system rejects the correction and keeps the original payment record

### Requirement: Reprint uses the stored transaction snapshot
The system SHALL reproduce the completed transaction from stored line, price, discount, payment, tax, and store snapshots without creating a new sale.

#### Scenario: Receipt is reprinted
- **WHEN** an authorized user requests a reprint
- **THEN** the output matches the stored transaction, is marked as a reprint, and the system records a print audit event

### Requirement: Void and unvoid use auditable reversals
The system SHALL require distinct permissions and a reason for void and unvoid and SHALL apply their stock and reporting effects atomically.

#### Scenario: Completed sale is voided
- **WHEN** an authorized user voids a completed sale
- **THEN** the system marks the sale void, creates compensating stock movements, excludes it from active sales totals, and records an audit event

#### Scenario: Sale is unvoided
- **WHEN** an authorized user unvoids a voided sale and all stock and dependency validations pass
- **THEN** the system reapplies stock effects exactly once, restores the sale to active totals, and records an audit event

#### Scenario: Unvoid validation fails
- **WHEN** unvoid would violate stock or transaction dependencies
- **THEN** the system rejects the operation and leaves the sale and stock unchanged

### Requirement: Correction operations are idempotent
The system MUST prevent retries or concurrent requests from applying the same payment correction, void, or unvoid more than once.

#### Scenario: Identical correction is retried
- **WHEN** an already completed correction request is retried
- **THEN** the system returns the existing result without duplicating audit events or stock movements

