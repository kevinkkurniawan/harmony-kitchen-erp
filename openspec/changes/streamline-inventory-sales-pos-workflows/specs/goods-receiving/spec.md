## Purpose

Memungkinkan pengguna memeriksa transaksi penerimaan secara cepat melalui detail read-only yang konsisten pada kedua alur penerimaan barang.

## ADDED Requirements

### Requirement: Receiving row opens a detail dialog
The system SHALL open the matching read-only transaction detail when a user double-clicks a row in either Express Receiving or Priced Receiving.

#### Scenario: User double-clicks a receiving row
- **WHEN** a user double-clicks a loaded transaction row
- **THEN** the system opens a dialog for that transaction and does not enter edit mode

### Requirement: Detail dialog has accessible alternatives
The system SHALL provide a visible Detail action and keyboard activation for users who do not use double-click.

#### Scenario: Keyboard user opens detail
- **WHEN** a focused receiving row is activated with Enter or its Detail action
- **THEN** the same detail dialog opens and focus moves into it

### Requirement: Receiving detail is complete and status aware
The system SHALL display the transaction number, receiving type, supplier, warehouse, status, creator, timestamps, notes, and all item lines with quantities and permitted price data.

#### Scenario: User without price permission opens detail
- **WHEN** the user lacks the relevant price-view permission
- **THEN** the detail dialog omits cost and other protected price values from both UI and API response

#### Scenario: Void receipt is opened
- **WHEN** the selected receiving transaction is void
- **THEN** the dialog prominently identifies the void status and remains read-only

### Requirement: Missing detail is handled without stale data
The system SHALL clear prior dialog data before loading a new transaction and SHALL show loading, not-found, and retryable error states.

#### Scenario: Detail request fails
- **WHEN** the selected transaction cannot be loaded
- **THEN** the dialog shows the failure and never displays lines from a previously selected transaction

