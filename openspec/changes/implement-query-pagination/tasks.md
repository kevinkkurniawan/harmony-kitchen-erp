## 1. Core Pagination Helpers

- [x] 1.1 Create src/lib/pagination.ts helper in harmony-kitchen-erp with parameter parser and paginated response builder and verify file compiles
- [x] 1.2 Create src/lib/pagination.ts helper in harmony-kitchen-pos and verify file compiles

## 2. ERP API Routes Pagination

- [x] 2.1 Implement pagination in ERP /api/inventory and verify GET returns paginated records with total count
- [x] 2.2 Implement pagination in ERP /api/customers, /api/employees, and /api/suppliers
- [x] 2.3 Implement pagination in ERP /api/banks, /api/memos, /api/promos, and /api/promos/items
- [x] 2.4 Implement pagination in ERP purchasing routes (/api/purchasing/orders, /express, /priced, /payments, /requests, /returns)
- [x] 2.5 Implement pagination in ERP inventory operations (/api/inventory/opname, /api/inventory/usage)
- [x] 2.6 Implement pagination in ERP sales routes (/api/sales/monitoring, /api/sales/sync) and /api/users

## 3. POS API Routes Pagination

- [x] 3.1 Implement pagination in POS /api/products and verify GET returns paginated results
- [x] 3.2 Implement pagination in POS /api/customers and /api/transactions

## 4. Verification & Testing

- [x] 4.1 Run TypeScript and Next.js build validation in harmony-kitchen-erp (
pm run build)
- [x] 4.2 Run TypeScript and Next.js build validation in harmony-kitchen-pos (
pm run build)
- [x] 4.3 Verify API responses for backward compatibility with existing UI components
