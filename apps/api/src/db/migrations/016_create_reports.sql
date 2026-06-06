CREATE TABLE IF NOT EXISTS reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id   UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL DEFAULT 'other',
  details      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, listing_id)
);

CREATE INDEX IF NOT EXISTS reports_listing_id_idx  ON reports(listing_id);
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON reports(reporter_id);
