## Purpose

Ensure each user's permitted ERP/POS view is enforced by verified server identity, with explicit protection of HPP and related cost data across all affected outputs.

## ADDED Requirements

### Requirement: Verify identity before protected operations
The system SHALL authenticate protected requests using a server-verifiable, expiring and revocable session. Browser login flags, local user objects, supplied user IDs, and role labels SHALL NOT establish authority.

#### Scenario: Forge browser state
- **WHEN** a client marks itself logged in or changes its local role without a valid server session
- **THEN** protected APIs SHALL reject the request and return no protected data.

#### Scenario: Expire or revoke a session
- **WHEN** a session expires or is revoked
- **THEN** its next protected request SHALL require authentication and the UI SHALL clear user-specific protected view state.

### Requirement: Grant HPP access explicitly
HPP visibility SHALL require a persisted explicit permission. It SHALL be denied by default, including for an Admin role label. Managing ordinary users SHALL NOT itself permit granting HPP access or self-escalation.

#### Scenario: Admin without cost permission
- **WHEN** an authenticated Admin without the HPP grant views inventory
- **THEN** public inventory data SHALL remain available according to their module permissions, but HPP and protected cost-derived fields SHALL be absent.

#### Scenario: Attempt unauthorized grant
- **WHEN** a user without grant-administration authority tries to assign themselves or another user HPP access
- **THEN** the server SHALL reject the change and preserve the existing grants.

#### Scenario: Revoke cost permission
- **WHEN** an authorized grant administrator revokes a user's HPP grant
- **THEN** the user's next protected read or export SHALL apply the revoked access without relying on an old browser role.

### Requirement: Protect cost fields on every affected output
The system SHALL enforce HPP permission before returning inventory cost, purchase-cost history, cost-derived totals or margins, and protected receiving cost data through lists, details, reports, write responses, downloads, or direct APIs. Unauthorized cost writes SHALL be rejected.

#### Scenario: Direct history or export request
- **WHEN** a user without HPP permission requests cost history or exports inventory
- **THEN** a cost-only request SHALL be forbidden and an otherwise permitted export SHALL omit protected cost columns and values.

#### Scenario: Authorized cost access
- **WHEN** a permitted user accesses a cost-bearing view
- **THEN** the system SHALL return the authoritative available cost value and distinguish unavailable data from an actual zero cost.

#### Scenario: Restricted write response
- **WHEN** a user allowed to edit public inventory fields completes an update without HPP permission
- **THEN** its response SHALL contain no protected cost values and SHALL NOT authorize a cost-field update.

### Requirement: Reflect server permissions in the interface
Menus, fields, and actions SHALL reflect server-resolved module and field permissions. A user SHALL NOT see a protected field merely because a broader module is available.

#### Scenario: Quantity-only receiving access
- **WHEN** a user may access receiving but has no HPP permission
- **THEN** permitted quantity-related views SHALL remain usable while protected cost values remain inaccessible.
