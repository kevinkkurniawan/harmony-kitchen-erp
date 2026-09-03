## Purpose

Provides a standardized query pagination mechanism for all list and search endpoints across the ERP and POS systems to ensure optimal database performance, lower memory usage, and predictable payload sizing.

## ADDED Requirements

### Requirement: Standard Pagination Query Parameters
The system SHALL parse pagination parameters from query strings for all list endpoints, supporting page, limit, and ll.

#### Scenario: Request with page and limit
- **WHEN** client sends a GET request with ?page=2&limit=25
- **THEN** system SHALL calculate skip=25 and 	ake=25, returning the second page of 25 records.

#### Scenario: Request with default parameters
- **WHEN** client sends a GET request with no pagination parameters
- **THEN** system SHALL default page to 1 and limit to 50 records.

#### Scenario: Request all records for dropdown selections
- **WHEN** client sends a GET request with ?all=true
- **THEN** system SHALL return all matching records without pagination truncation.

### Requirement: Standard Pagination Response Structure
The system SHALL return pagination metadata alongside the data array in response to GET queries.

#### Scenario: Response metadata format
- **WHEN** a list query is successfully executed
- **THEN** system SHALL return JSON containing success: true, data: [...], and pagination: { page, limit, total, totalPages, hasNextPage, hasPrevPage }.

### Requirement: Backward Compatibility for Existing Clients
The system SHALL maintain backward compatibility by providing the list results in the data array property.

#### Scenario: Existing client reading array data
- **WHEN** an existing frontend component reads esponse.data
- **THEN** the data field SHALL contain the items array matching the expected interface.
