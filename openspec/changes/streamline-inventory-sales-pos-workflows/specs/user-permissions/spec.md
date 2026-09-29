## Purpose

Menetapkan otorisasi server-side yang dapat dikonfigurasi untuk seluruh aksi sensitif baru tanpa mengandalkan penyembunyian kontrol di antarmuka.

## ADDED Requirements

### Requirement: Sensitive actions have explicit permissions
The system SHALL define separate permissions for opname post, opname reversal, inventory edit, payment correction, reprint, void, unvoid, Grosir 1 override, manual invoice discount, barcode page view, barcode print, and View HPP/Profit.

#### Scenario: Permission administrator views a user
- **WHEN** an authorized administrator opens that user's access settings
- **THEN** every sensitive permission is independently visible and configurable

### Requirement: Permissions are enforced on the server
The system MUST validate the authenticated user and required permission on every protected mutation and protected-data read regardless of UI state.

#### Scenario: Hidden action is called directly
- **WHEN** an authenticated user without permission calls a protected endpoint directly
- **THEN** the endpoint returns `403`, makes no state change, and reveals no protected data

#### Scenario: User is unauthenticated
- **WHEN** an unauthenticated request calls a protected endpoint
- **THEN** the endpoint returns `401` and makes no state change

### Requirement: Defaults follow least privilege
The system SHALL grant all new sensitive permissions to Admin by default and SHALL deny them to non-Admin users until explicitly assigned.

#### Scenario: Existing non-Admin has no saved value
- **WHEN** the new permission migration is deployed
- **THEN** the effective permission is denied for that user

### Requirement: Permission changes are audited
The system SHALL record the target user, permission, previous value, new value, actor, and timestamp whenever access is changed.

#### Scenario: Administrator grants unvoid permission
- **WHEN** an administrator saves that permission change
- **THEN** the new access takes effect and an immutable audit event is recorded

### Requirement: Protected fields are omitted rather than masked
The system MUST omit HPP and profit-derived fields from API responses, exports, and print data when View HPP/Profit permission is absent.

#### Scenario: Unauthorized report is inspected
- **WHEN** a user without View HPP/Profit accesses report data
- **THEN** the payload contains no HPP, Net Income, margin, or source values from which HPP can be reconstructed

