ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS reg_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  used_by INTEGER DEFAULT NULL,
  used_at TEXT DEFAULT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (used_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reg_codes_code ON reg_codes(code);
