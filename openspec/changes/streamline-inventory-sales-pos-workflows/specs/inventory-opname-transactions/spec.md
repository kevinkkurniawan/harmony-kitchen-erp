## Purpose

Menjamin setiap hasil stok opname mengubah persediaan melalui transaksi selisih yang atomik, dapat ditelusuri, dan aman dari posting berulang.

## ADDED Requirements

### Requirement: Opname records the counted state
The system SHALL store an opname transaction number, warehouse, count date, creator, notes, and one line per inventory item containing the system quantity captured at counting time, physical quantity, and calculated difference.

#### Scenario: User prepares an opname
- **WHEN** an authorized user saves an opname draft
- **THEN** the system stores the captured system quantity and physical quantity without changing inventory balances

#### Scenario: Duplicate item is submitted
- **WHEN** an opname contains the same inventory item more than once for the same warehouse
- **THEN** the system rejects the transaction with a validation error

### Requirement: Posting creates stock movements
The system SHALL post an opname atomically by recording an inventory movement equal to `physical quantity - captured system quantity` and updating the affected warehouse balance from that movement.

#### Scenario: Physical stock differs from the system
- **WHEN** an authorized user posts an opname with a non-zero difference
- **THEN** the system records a referenced stock movement and the resulting balance equals the counted physical quantity

#### Scenario: One line cannot be posted
- **WHEN** any opname line fails validation or persistence
- **THEN** the system rolls back every balance and movement change for that posting attempt

### Requirement: Posted opname is immutable
The system SHALL prevent direct editing or deletion of a posted opname and SHALL correct it only through a reversal followed by an optional replacement transaction.

#### Scenario: User attempts to edit a posted opname
- **WHEN** a user submits changes to a posted opname
- **THEN** the system rejects the request and leaves the transaction and balances unchanged

#### Scenario: Authorized user reverses an opname
- **WHEN** an authorized user supplies a reason and reverses a posted opname
- **THEN** the system creates compensating movements, records the actor and reason, and marks the original transaction as reversed

### Requirement: Posting is idempotent and authorized
The system MUST require the opname-post permission and an idempotency key or equivalent transaction-state guard for posting and reversal.

#### Scenario: Posting request is retried
- **WHEN** the same posting request is received more than once
- **THEN** the system returns the original result without creating duplicate movements

#### Scenario: Unauthorized user posts an opname
- **WHEN** a user without opname-post permission attempts to post
- **THEN** the system returns `403` and creates no movement

