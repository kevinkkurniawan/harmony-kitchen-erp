## Why

Currently, database query endpoints across the system execute unbounded indMany() queries or rely on arbitrary and large client limits (e.g. limit=1000), causing excessive memory usage, high database latency, and poor application response times. Introducing standardized, cursor/offset-friendly pagination with structured metadata across all list endpoints improves performance, stability, and scalability while keeping backward compatibility intact.

## What Changes

- Add shared pagination helper utilities (getPaginationParams, createPaginatedResponse) to parse query parameters (page, limit, ll) and structure response metadata (page, limit, 	otal, 	otalPages, hasNextPage, hasPrevPage).
- Standardize database query pagination (skip, 	ake, and total count via concurrent Promise.all) across all listing endpoints in harmony-kitchen-erp:
  - /api/inventory
  - /api/customers
  - /api/employees
  - /api/suppliers
  - /api/banks
  - /api/memos
  - /api/promos
  - /api/promos/items
  - /api/purchasing/orders
  - /api/purchasing/express
  - /api/purchasing/priced
  - /api/purchasing/payments
  - /api/purchasing/requests
  - /api/purchasing/returns
  - /api/inventory/opname
  - /api/inventory/usage
  - /api/sales/monitoring
  - /api/sales/sync
  - /api/users
- Standardize pagination across query endpoints in harmony-kitchen-pos:
  - /api/products
  - /api/customers
  - /api/transactions
- Maintain backward compatibility so that existing clients consuming json.data as an array continue to function seamlessly without breaking.

## Capabilities

### New Capabilities
- pi-query-pagination: Standardized server-side query pagination parameters, total counts, and metadata for all list endpoints.

### Modified Capabilities
<!-- None -->

## Impact

- Affected API routes in harmony-kitchen-erp/src/app/api and harmony-kitchen-pos/src/app/api.
- Client components benefit from significantly faster initial loads and reduced network payload sizes.
- No breaking changes for callers that inspect data directly.
