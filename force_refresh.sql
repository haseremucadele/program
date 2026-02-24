-- Tablo yapısında ufak bir değişiklik yaparak önbelleği tetikle
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS _cache_buster text;
ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS _cache_buster;

-- Tekrar yapılandırmayı yükle
NOTIFY pgrst, 'reload config';
