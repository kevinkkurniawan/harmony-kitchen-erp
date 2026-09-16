## Purpose

Make the POS transaction screen and ERP inventory/receiving tables readable and usable with long product names on normal cashier desktop displays.

## ADDED Requirements

### Requirement: Keep operational controls accessible
The POS transaction screen, ERP inventory table, and both existing receiving screens SHALL present readable content without overlapping primary controls. Desktop layouts SHALL support 1366x768 and 1920x1080 with scrolling where necessary.

#### Scenario: Long names and many rows
- **WHEN** a table contains long product names and more rows than fit on screen
- **THEN** the user SHALL still be able to access relevant search, quantity, price, total, and save/payment controls without overlapping content.

### Requirement: Resize item-name columns
The scoped item tables SHALL allow users to enlarge the item-name column within usable bounds and read the full name through wrapping and scrolling. Resizing SHALL offer keyboard access or an equivalent accessible width control and a reset action.

#### Scenario: Enlarge and reset a name column
- **WHEN** a user enlarges the name column and later resets its width
- **THEN** the table SHALL apply each width, retain access to the other columns, and keep the full name readable.

### Requirement: Isolate table preferences by user
Saved table widths SHALL be scoped to the user and table and SHALL NOT override column visibility permissions.

#### Scenario: Another user logs in
- **WHEN** a user without HPP access logs in after an HPP-authorized user resized a table
- **THEN** the new user's table SHALL use their own preferences and SHALL NOT display the previous user's restricted columns or data.
