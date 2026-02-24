-- Add kaynak_turu column to kaynaklar table if it does not exist
ALTER TABLE public.kaynaklar ADD COLUMN IF NOT EXISTS kaynak_turu TEXT;
