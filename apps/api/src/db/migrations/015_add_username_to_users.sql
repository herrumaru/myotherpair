ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
  ON users (LOWER(username));
