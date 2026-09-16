-- Migration for revise-pos-erp-daily-operations

-- 1. Extend t_sales_pos_detail
ALTER TABLE t_sales_pos_detail
  ADD COLUMN IF NOT EXISTS price_type TEXT,
  ADD COLUMN IF NOT EXISTS quote_ref TEXT,
  ADD COLUMN IF NOT EXISTS uom_name TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_pos_detail_header_barcode 
  ON t_sales_pos_detail (header_id, barcode);

-- 2. Extend t_sales_pos_header
ALTER TABLE t_sales_pos_header
  ADD COLUMN IF NOT EXISTS checkout_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cashier_id INTEGER,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS cash_paid DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_amount DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS is_grosir_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Create t_auth_session for server-side revocable session management
CREATE TABLE IF NOT EXISTS t_auth_session (
  id SERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES t_access_user(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_session_user_token 
  ON t_auth_session (user_id, token_hash);

-- 4. Create t_user_grant for explicit permission management (HPP, reports, grant admin)
CREATE TABLE IF NOT EXISTS t_user_grant (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_access_user(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_grant_user_key 
  ON t_user_grant (user_id, permission_key);
