-- Allow direct contact conversations where the initiator has no listing yet.
-- listing_id_1 becomes nullable; listing_id_2 always holds the listing being discussed.
ALTER TABLE matches
  ALTER COLUMN listing_id_1 DROP NOT NULL;
