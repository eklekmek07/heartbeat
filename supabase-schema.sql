-- HeartBeat Supabase Schema
-- Run this in the Supabase SQL Editor to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pairs table: stores linked device pairs
CREATE TABLE IF NOT EXISTS pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table: stores push subscriptions linked to pairs
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  expiration_time TIMESTAMP WITH TIME ZONE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_pair_id ON subscriptions(pair_id);
CREATE INDEX IF NOT EXISTS idx_pairs_pair_code ON pairs(pair_code);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the app (using anon key)
CREATE POLICY "Allow anonymous insert on pairs" ON pairs
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select on pairs" ON pairs
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert on subscriptions" ON subscriptions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select on subscriptions" ON subscriptions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anonymous update on subscriptions" ON subscriptions
  FOR UPDATE TO anon
  USING (true);

CREATE POLICY "Allow anonymous delete on subscriptions" ON subscriptions
  FOR DELETE TO anon
  USING (true);

-- Add background_url column to pairs table
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS background_url TEXT;

-- User preferences table: stores display names per endpoint
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_pair_id ON user_preferences(pair_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_endpoint ON user_preferences(endpoint);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_preferences
CREATE POLICY "Allow anonymous insert on user_preferences" ON user_preferences
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select on user_preferences" ON user_preferences
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anonymous update on user_preferences" ON user_preferences
  FOR UPDATE TO anon
  USING (true);

CREATE POLICY "Allow anonymous delete on user_preferences" ON user_preferences
  FOR DELETE TO anon
  USING (true);

-- Messages table: stores message history (emotions and images)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_endpoint TEXT NOT NULL,
  message_type TEXT NOT NULL,  -- 'emotion' or 'image'
  emotion TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_pair_id ON messages(pair_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Allow anonymous insert on messages" ON messages
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select on messages" ON messages
  FOR SELECT TO anon
  USING (true);

-- Allow update for pairs background_url
CREATE POLICY "Allow anonymous update on pairs" ON pairs
  FOR UPDATE TO anon
  USING (true);
