
-- Add attendance:view permission to all users
INSERT INTO public.user_permissions (user_id, permission_id)
SELECT id, 'attendance:view'
FROM public.users
ON CONFLICT DO NOTHING;
