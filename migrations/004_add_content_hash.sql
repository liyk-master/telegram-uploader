ALTER TABLE uploads ADD COLUMN content_hash TEXT;
CREATE INDEX idx_uploads_content_hash ON uploads(content_hash);
