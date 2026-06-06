CREATE TABLE IF NOT EXISTS bot_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  upload_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  rate_limited_until TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bot_tokens_last_used ON bot_tokens(last_used_at);
