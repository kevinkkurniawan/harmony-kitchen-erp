## Why

The ERP Master Barang workflow has usability and control gaps: long item names are truncated in a rigid table, naming is inconsistent, HPP is exposed too broadly, and inventory data cannot be exported to Excel for offline review.

## What Changes

### 1. Flexible Master Barang table

- Give important columns sensible default and minimum widths.
- Allow users to resize relevant columns, keep horizontal scrolling, and persist preferences per browser.
- Show complete item names through wider defaults, truncation, and hover/focus text without growing rows.

### 2. Consistent item naming

- Normalize manual names by requiring a value, trimming it, and collapsing repeated internal spaces.
- Preserve intentional capitalization and punctuation.
- Warn about normalized, case-insensitive near-duplicates while retaining Inventory No and barcode as primary uniqueness controls.

### 3. Permission-controlled HPP

- Add a dedicated View HPP permission, granted to Admin by default.
- Hide HPP columns, cards, fields, history, totals, and exports without the permission.
- Enforce this on the server for inventory reads, HPP history, and HPP writes.

### 4. Excel inventory export

- Provide an `Export Excel` action in Master Barang.
- Export the current filtered and sorted rows as an `.xlsx` workbook.
- Keep IDs and descriptive data as text; prices and stock as numeric cells.
- Include HPP only for users with View HPP permission.
- Keep the operation read-only: no inventory record is created or updated by an export.

### 5. Master Barang dialog layout

- Standardize the add/edit, HPP history, and stock report dialogs for desktop and tablet viewports.

## Capabilities

### New Capabilities

- `inventory-excel-export`: Permission-aware `.xlsx` export of the filtered and sorted inventory list.
- `inventory-hpp-access`: Server-enforced permission for viewing and changing HPP.
- `master-barang-table-preferences`: Resizable, locally persisted table-column widths.

### Modified Capabilities

- `master-barang`: Normalized item names, full-name discoverability, and consistent responsive dialogs.
- `user-permissions`: Persistent permission data including View HPP.

## Acceptance Criteria

- A long item name can be read in full without opening the edit form.
- A user can resize relevant table columns and reload without losing their preferences.
- A user without View HPP cannot obtain HPP from the interface, API, history endpoint, crafted write request, or Excel export.
- An Excel workbook opens successfully and contains the current filtered and sorted inventory rows.
- Manual item entry applies the same name normalization consistently.

## Non-goals

- Spreadsheet import or bulk inventory creation/updates.
- POS receipt or Chrome print-dialog behavior.
- Automatic merging of existing duplicate inventory records.

## Recommended Delivery Order

1. Implement persistent permissions and server-side HPP protection.
2. Add naming normalization and shared validation.
3. Add permission-aware Excel export.
4. Improve table columns and dialog layouts.

## Impact

- Frontend: `MasterBarangManager`, `UserAccessManager`, and dashboard permission context.
- API: inventory list/create/update, HPP history, and user permissions.
- Database: persistent View HPP permission mapping.
- Dependency: client-side `xlsx` workbook generation.
