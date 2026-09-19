CREATE TABLE IF NOT EXISTS erp_user_permission (
  user_id INTEGER NOT NULL REFERENCES m_user(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_add BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  can_print BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module_code)
);

CREATE INDEX IF NOT EXISTS erp_user_permission_user_id_idx ON erp_user_permission(user_id);
