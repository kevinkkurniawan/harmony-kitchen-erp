## Purpose

Memberi kasir kontrol harga Grosir 1 dan diskon manual per nota dengan kalkulasi konsisten, otorisasi, serta snapshot transaksi yang dapat diaudit.

## ADDED Requirements

### Requirement: Cashier can override all eligible lines to Grosir 1
The system SHALL provide an authorized `Override Semua ke Grosir 1` action that applies each active cart item's valid Grosir 1 price regardless of quantity.

#### Scenario: Override is enabled
- **WHEN** an authorized cashier enables the override on a non-empty cart
- **THEN** every eligible active line uses Grosir 1 and visibly identifies the override

#### Scenario: An item has no valid Grosir 1 price
- **WHEN** override is enabled and an active line has no positive Grosir 1 price
- **THEN** that line retains its retail price and the system presents it in an exception summary

#### Scenario: Override is cancelled
- **WHEN** the cashier disables the override before payment
- **THEN** prices are recalculated from the normal retail or configured quantity-based wholesale rules

### Requirement: Cashier can enter a manual invoice discount
The system SHALL provide a bottom-right invoice discount input with explicit Rupiah and percentage modes, and SHALL require permission and a non-empty reason for every manual discount.

#### Scenario: Rupiah discount is entered
- **WHEN** an authorized cashier enters a positive Rupiah amount and reason
- **THEN** the system applies that amount to the invoice and displays it separately from other discount components

#### Scenario: Percentage discount is entered
- **WHEN** an authorized cashier enters a percentage from greater than zero through 100 and a reason
- **THEN** the system calculates the manual amount from the price-adjusted subtotal using deterministic rounding

#### Scenario: Discount exceeds the subtotal
- **WHEN** the calculated manual discount would reduce the payable base below zero
- **THEN** the system caps the payable base at zero and prevents a negative invoice total

### Requirement: Invoice adjustments follow one calculation order
The system SHALL calculate each invoice in this order: effective line prices, subtotal, member discount, voucher/promo discount, manual invoice discount, tax, service charge, and grand total.

#### Scenario: Multiple discounts apply
- **WHEN** a sale has member, voucher, and manual discounts
- **THEN** the displayed totals, checkout payload, receipt, reprint, and reports use the same ordered calculation

### Requirement: Completed sale stores adjustment snapshots
The system SHALL store the override flag, effective price and price source per line, manual discount mode, entered value, calculated amount, reason, and authorizing user.

#### Scenario: Adjusted sale is completed
- **WHEN** checkout succeeds with an override or manual discount
- **THEN** later detail views and reprints reproduce the stored values without recalculation from current master data

### Requirement: Unauthorized adjustments are rejected
The system MUST enforce override and manual-discount permissions at checkout as well as in the POS interface.

#### Scenario: Crafted checkout includes an unauthorized discount
- **WHEN** a user without manual-discount permission submits a checkout payload containing a manual discount
- **THEN** the system returns `403` and creates no completed sale

