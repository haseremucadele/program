-- 1. Mevcut ilişkiyi (varsa) temizle
ALTER TABLE public.user_permissions
DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

-- 2. İlişkiyi yeniden oluştur
ALTER TABLE public.user_permissions
ADD CONSTRAINT user_permissions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id)
ON DELETE CASCADE;

-- 3. Yetkileri (Permission ID) bağla
ALTER TABLE public.user_permissions
DROP CONSTRAINT IF EXISTS user_permissions_permission_id_fkey;

ALTER TABLE public.user_permissions
ADD CONSTRAINT user_permissions_permission_id_fkey
FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
ON DELETE CASCADE;

-- 4. Supabase Önbelleğini Yenile
NOTIFY pgrst, 'reload config';

-- 5. Kullanıcıya yetkileri tekrar ata (Garanti olsun)
DO $$
DECLARE
    target_user_id BIGINT;
BEGIN
    SELECT id INTO target_user_id FROM public.users WHERE email = 'menevse.cihan@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- Yetkileri ekle
        INSERT INTO public.user_permissions (user_id, permission_id)
        SELECT target_user_id, id FROM public.permissions
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
