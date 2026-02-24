-- Add personal details columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS telefon TEXT,
ADD COLUMN IF NOT EXISTS kan_grubu TEXT,
ADD COLUMN IF NOT EXISTS ayakkabi_no TEXT,
ADD COLUMN IF NOT EXISTS kislik_bot_no TEXT,
ADD COLUMN IF NOT EXISTS tisort_beden TEXT,
ADD COLUMN IF NOT EXISTS pantolon_beden TEXT,
ADD COLUMN IF NOT EXISTS sweatshirt_beden TEXT,
ADD COLUMN IF NOT EXISTS kislik_pantolon_beden TEXT,
ADD COLUMN IF NOT EXISTS mont_beden TEXT;
