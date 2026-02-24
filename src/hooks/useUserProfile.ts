import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface UserProfile {
    id: number;
    ad_soyad: string;
    unvan: string;
    ilce?: string;
    email?: string;
    auth_id?: string;
    permissions: string[];
}

export function useUserProfile() {
    const supabase = createClient();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        let mounted = true;

        const fetchProfile = async (sessionUser: any) => {
            try {
                // Priority 1: Match by auth_id (Robust Link)
                let { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id, ad_soyad, unvan, ilce, email, auth_id')
                    .eq('auth_id', sessionUser.id)
                    .maybeSingle();

                if (userError) {
                    console.error('Fetch by auth_id failed!', userError.message, '| Code:', userError.code);
                    throw userError;
                }

                // Priority 2: Match by email (Legacy / First Login Link)
                if (!user && sessionUser.email) {
                    const { data: emailData, error: emailError } = await supabase
                        .from('users')
                        .select('id, ad_soyad, unvan, ilce, email, auth_id')
                        .eq('email', sessionUser.email)
                        .maybeSingle();

                    if (emailError) {
                        console.error('Fetch by email failed!', emailError.message, '| Code:', emailError.code);
                        throw emailError;
                    }

                    if (emailData) {
                        user = emailData;
                        // Architecture Fix: Self-heal the link
                        if (mounted) {
                            const { error: updateError } = await supabase
                                .from('users')
                                .update({ auth_id: sessionUser.id })
                                .eq('id', emailData.id);

                            if (updateError) {
                                console.error('Self-healing auth_id update failed:', updateError);
                            }
                        }
                    }
                }

                if (mounted && user) {
                    // Step 2: Fetch permissions separately to avoid PGRST200 (schema cache errors)
                    const { data: permsData, error: permsError } = await supabase
                        .from('user_permissions')
                        .select('permission_id')
                        .eq('user_id', user.id);

                    if (permsError) {
                        console.error('Permission fetch failed:', permsError);
                    }

                    const formattedProfile: UserProfile = {
                        ...user,
                        permissions: permsData?.map(p => p.permission_id) || []
                    };
                    setProfile(formattedProfile);
                }
            } catch (err: any) {
                console.error('Profile fetch error details:', {
                    message: err.message,
                    code: err.code,
                    details: err.details,
                    hint: err.hint,
                    fullError: err
                });
                if (mounted) setError(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const hasPermission = (permission: string) => {
        return profile?.permissions?.includes(permission) || false;
    };

    return { profile, loading, error, hasPermission };
}
