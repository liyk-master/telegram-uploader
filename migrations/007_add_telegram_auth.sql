ALTER TABLE users ADD COLUMN telegram_id INTEGER;
ALTER TABLE users ADD COLUMN telegram_username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
