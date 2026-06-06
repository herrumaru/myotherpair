-- Allow direct profile-to-profile conversations with no listing on either side.
ALTER TABLE matches ALTER COLUMN listing_id_2 DROP NOT NULL;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_listing_id_1_listing_id_2_key;

-- Enable realtime for messages table
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
