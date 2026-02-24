-- 1. GRANT komutlari ile API erisimini garantile
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_permissions TO anon, authenticated, service_role;

-- 2. Supabase API Onbellegini Yenile
NOTIFY pgrst, 'reload config';
