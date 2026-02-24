'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Save, User, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileData {
    ad_soyad: string;
    unvan: string;
    ilce: string;
    email: string;
}

export default function SettingsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

    const { register, handleSubmit, setValue, watch } = useForm<ProfileData>();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                setValue('ad_soyad', data.ad_soyad);
                setValue('unvan', data.unvan);
                setValue('ilce', data.ilce);
                setValue('email', data.email);
            } else {
                setValue('email', user.email || '');
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (formData: ProfileData) => {
        setSaving(true);
        setMessage('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Check if profile exists
            const { data: existing } = await supabase.from('users').select('id').eq('auth_id', user.id).single();

            let error;
            if (existing) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        ad_soyad: formData.ad_soyad,
                        unvan: formData.unvan,
                        ilce: formData.ilce
                    })
                    .eq('auth_id', user.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('users')
                    .insert([{
                        auth_id: user.id,
                        email: user.email,
                        ad_soyad: formData.ad_soyad,
                        unvan: formData.unvan,
                        ilce: formData.ilce
                    }]);
                error = insertError;
            }

            if (error) throw error;
            setMessage('Profil başarıyla güncellendi.');

        } catch (error: any) {
            console.error('Error saving profile:', error);
            setMessage('Hata: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-indigo-600" /></div>;

    return (
        <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Profil Ayarları</h2>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {message && (
                        <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('Hata') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">E-posta</label>
                            <input
                                {...register('email')}
                                disabled
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Ad Soyad</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                                <input
                                    {...register('ad_soyad')}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Ünvan</label>
                            <select
                                {...register('unvan')}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                            >
                                <option value="">Seçiniz</option>
                                <option value="mudur">Müdür</option>
                                <option value="sef">Şef</option>
                                <option value="bolge_sorumlusu">Bölge Sorumlusu</option>
                                <option value="ekipbasi">Ekipbaşı</option>
                                <option value="beden_iscisi">Beden İşçisi</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">İlçe</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
                                <select
                                    {...register('ilce')}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white appearance-none"
                                >
                                    <option value="">İlçe Seçiniz</option>
                                    {[
                                        'Altıeylül', 'Ayvalık', 'Balya', 'Bandırma', 'Bigadiç',
                                        'Burhaniye', 'Dursunbey', 'Edremit', 'Erdek', 'Gömeç',
                                        'Gönen', 'Havran', 'İvrindi', 'Karesi', 'Kepsut',
                                        'Manyas', 'Marmara', 'Savaştepe', 'Sındırgı', 'Susurluk'
                                    ].map(district => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Değişiklikleri Kaydet
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
