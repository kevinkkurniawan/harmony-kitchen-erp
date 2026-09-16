## Purpose

Automatically remove completed-sale items from active transaction state while preserving an accurate saved receipt for recoverable printing and reprinting.

## ADDED Requirements

### Requirement: Clear active items only after confirmed sale persistence
The POS SHALL preserve a completed receipt representation and automatically reset that completed transaction's active cart and transaction-specific payment/customer/discount input after the server confirms a successful sale. It SHALL NOT require manual removal of paid items.

#### Scenario: Successful sale is ready for printing
- **WHEN** checkout is confirmed saved
- **THEN** the active transaction SHALL reset to an empty Retail sale, while the receipt SHALL still show the saved items, prices, totals, payment, invoice identity, and transaction timestamp.

#### Scenario: Failed checkout
- **WHEN** the server rejects checkout or returns an application failure
- **THEN** the POS SHALL keep all entered transaction state, show the failure, and SHALL NOT display a success receipt or clear the items.

#### Scenario: Uncertain checkout response
- **WHEN** a connection fails after a checkout submission and its save outcome is unknown
- **THEN** the POS SHALL preserve the transaction and resolve the existing submission before retrying, without posting a duplicate sale.

### Requirement: Preserve receipt identity independently of the next cart
Receipts and reprints SHALL use the saved transaction rather than the current cart, current master prices, or current time. Completion cleanup and late print callbacks SHALL affect only their own transaction.

#### Scenario: Reprint after new items are added
- **WHEN** a cashier begins a new cart and then reprints or closes the previous receipt
- **THEN** the old receipt SHALL retain its saved data and the new cart SHALL remain unchanged.

#### Scenario: Reload after completion
- **WHEN** the POS reloads after a successful sale and automatic cleanup
- **THEN** it SHALL NOT restore that completed sale as an unpaid cart, and its saved receipt SHALL remain recoverable.

### Requirement: Print without repeating the sale
Printing, cancellation, failure, and reprinting SHALL NOT create another transaction, repeat payment, decrement stock again, or restore paid items into the active cart.

#### Scenario: Cancel or fail a print
- **WHEN** the cashier cancels the browser print dialog or the printer fails after the sale was saved
- **THEN** the sale SHALL remain saved once, active completed items SHALL remain cleared, and its receipt SHALL be available for an explicit print retry.

### Requirement: Provide recoverable print-job feedback
The POS SHALL prevent concurrent duplicate dispatch for one print invocation, release print resources after success or failure, and show an actionable error when dispatch fails. Browser dialog closure or transport submission SHALL NOT be reported as proof of physical printing.

#### Scenario: Rapid print clicks
- **WHEN** a user repeatedly clicks Print while the current invocation is dispatching
- **THEN** the POS SHALL dispatch at most one job for that invocation.

#### Scenario: Disconnect during serial dispatch
- **WHEN** a serial printer disconnects during dispatch
- **THEN** the POS SHALL release acquired resources, report the failed or uncertain delivery, and offer an explicit retry without automatically sending another copy.
