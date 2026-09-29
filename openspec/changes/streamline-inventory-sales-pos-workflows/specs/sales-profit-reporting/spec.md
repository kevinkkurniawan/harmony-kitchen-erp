## Purpose

Menyediakan laporan profitabilitas berbasis snapshot HPP agar hasil historis konsisten dan data biaya hanya terlihat oleh pengguna yang berwenang.

## ADDED Requirements

### Requirement: Sale lines capture HPP at completion
The system SHALL store the effective unit HPP and total HPP on each sale line when the sale is completed.

#### Scenario: Sale is completed
- **WHEN** checkout commits a sale line
- **THEN** the system stores the current authorized HPP snapshot multiplied by the sold quantity

#### Scenario: Master HPP changes later
- **WHEN** the item master HPP is changed after a sale
- **THEN** historical report HPP remains based on the stored sale-line snapshot

### Requirement: Report calculates net income consistently
The system SHALL calculate `Net Income = Net Sales - Cost of Goods Sold` and margin as `Net Income / Net Sales`, with a zero-safe margin when Net Sales is zero.

#### Scenario: Report contains active sales
- **WHEN** an authorized user loads a daily or monthly report
- **THEN** each period and the report total include Net Sales, HPP, Net Income, and margin from the same underlying transactions

### Requirement: Void state affects profit totals
The system SHALL exclude currently void sales from active report totals and SHALL reflect a void or unvoid in the effective correction period and audit data.

#### Scenario: Sale is voided in a later period
- **WHEN** a completed sale is voided after its original period
- **THEN** the correction period shows the reversal and the report provides traceability to the original transaction

### Requirement: HPP and profit are permission protected
The system MUST omit HPP, Net Income, and margin from interfaces, exports, and API responses for users without View HPP/Profit permission.

#### Scenario: Unauthorized user requests profit fields
- **WHEN** a user without View HPP/Profit permission requests a report or export
- **THEN** the response contains no HPP-derived values and no recoverable hidden fields

### Requirement: Legacy transactions are identified
The system SHALL distinguish transactions with a stored HPP snapshot from legacy transactions whose HPP must be estimated or is unavailable.

#### Scenario: Historical line lacks HPP snapshot
- **WHEN** a report includes a legacy line without a reliable snapshot
- **THEN** the system follows the configured backfill policy and marks the affected result as estimated or unavailable

