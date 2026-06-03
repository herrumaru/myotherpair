CREATE TABLE IF NOT EXISTS orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id           UUID        NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_id             UUID        NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  seller_id            UUID        NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  amount_cents         INTEGER     NOT NULL,
  currency             TEXT        NOT NULL DEFAULT 'usd',
  stripe_checkout_id   TEXT        UNIQUE,
  stripe_payment_intent TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','paid','cancelled','refunded')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_listing_id_idx         ON orders(listing_id);
CREATE INDEX IF NOT EXISTS orders_buyer_id_idx           ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_id_idx          ON orders(seller_id);
CREATE INDEX IF NOT EXISTS orders_stripe_checkout_id_idx ON orders(stripe_checkout_id);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
