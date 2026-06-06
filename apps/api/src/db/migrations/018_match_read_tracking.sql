-- Track when each participant last read a conversation
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS user1_last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user2_last_read_at TIMESTAMPTZ;
