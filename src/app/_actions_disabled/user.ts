'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';

interface CreateUserData {
    email: string;
    password: string;
    ad_soyad: string;
    unvan: string;
    ilce: string;
}

export async function createUser(data: CreateUserData) {
    try {
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true, // Auto confirm since admin is creating
            user_metadata: {
                full_name: data.ad_soyad
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('User creation failed');

        // 2. Create Profile in public.users
        // We use supabaseAdmin here as well to bypass potential INSERT policies if they are strict (though we set them to public for now, cleaner to use admin)
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert([
                {
                    auth_id: authData.user.id,
                    email: data.email,
                    ad_soyad: data.ad_soyad,
                    unvan: data.unvan,
                    ilce: data.ilce,
                    durum: 'aktif'
                }
            ]);

        if (profileError) {
            // If profile creation fails, we might want to delete the auth user to keep consistency? 
            // For now, let's just return the error.
            console.error('Profile creation error:', profileError);
            // Optional: Delete auth user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Profil oluşturulamadı: ${profileError.message}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Create User Error:', error);

        // Handle Supabase Auth "User already registered" error
        if (error.message?.includes('already registered') || error.message?.includes('unique constraint')) {
            return { success: false, error: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var.' };
        }

        // Handle Postgres Unique Violation (Code 23505)
        if (error.code === '23505' || error?.toString().includes('23505')) {
            return { success: false, error: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var.' };
        }

        return { success: false, error: error.message || 'Bir hata oluştu.' };
    }
}
