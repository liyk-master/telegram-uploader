CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upload_tags (
  upload_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (upload_id, tag_id),
  FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_upload_tags_upload ON upload_tags(upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_tags_tag ON upload_tags(tag_id);
