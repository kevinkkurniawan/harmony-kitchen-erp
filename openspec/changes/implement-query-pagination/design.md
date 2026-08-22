## Context

Multiple API routes in harmony-kitchen-erp and harmony-kitchen-pos execute prisma.<model>.findMany() queries without skip/	ake limits or count calculations. This causes entire tables to be retrieved into memory and serialized. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a standardized, lightweight pagination utility helper in src/lib/pagination.ts across ERP and POS.
- Implement server-side pagination with parallel count() and indMany(skip, take) across all list endpoints.
- Return structured pagination metadata (page, limit, 	otal, 	otalPages, hasNextPage, hasPrevPage).
- Maintain 100% backward compatibility for all existing UI components reading esponse.data.

**Non-Goals:**
- Changing database schemas or creating new database indexes (can be done separately if needed).
- Full UI pagination redesign on components that already perform client-side table filtering.

## Decisions

1. **Decision: Shared Helper Function getPaginationParams and createPaginatedResponse**
   - *Rationale*: Centralizes parsing of page, limit, and ll query flags, prevents code duplication, and ensures consistent metadata shape across 20+ API handlers.
   - *Alternative Considered*: Inlining skip/	ake logic in every single route handler. Rejected due to maintainability and inconsistency risks.

2. **Decision: Parallel Promise.all for Count & Query**
   - *Rationale*: Executing prisma.model.count({ where }) and prisma.model.findMany({ where, skip, take }) concurrently reduces latency compared to sequential queries.
   - *Alternative Considered*: Sequential count followed by query. Rejected because it doubles DB round-trip time.

3. **Decision: Preserving data Array Format**
   - *Rationale*: esponse.data remains an Array of items, with esponse.pagination added as sibling metadata.
   - *Alternative Considered*: Wrapping items in esponse.data.items. Rejected because it would break existing UI components.

## Risks / Trade-offs

- **[Risk]** Large dropdown lists might be clipped if default limit is too small.
  → **Mitigation**: Allow ?all=true or explicit ?limit=1000 for dropdown lookups that require all active items.
- **[Risk]** Count queries on massive tables could add slight overhead.
  → **Mitigation**: Run count in parallel with identical where clauses, and rely on primary key / indexed filters.

## Migration Plan

1. Create src/lib/pagination.ts in ERP and POS.
2. Update ERP API routes systematically.
3. Update POS API routes.
4. Verify TypeScript builds and API response formats.
