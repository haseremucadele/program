'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Shield, Loader2, Search, Check, X, Info } from 'lucide-react';
import clsx from 'clsx';

interface Permission {
    id: string;
    name: string;
    category: string;
    description: string;
}

interface UserWithPerms {
    id: number;
    ad_soyad: string;
    unvan: string;
    email: string;
    permissions: string[];
}

export default function PermissionsPage() {
    const supabase = createClient();
    const { profile: currentUser, hasPermission } = useUserProfile();
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [users, setUsers] = useState<UserWithPerms[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch all available permissions
            const { data: permsData, error: permsError } = await supabase
                .from('permissions')
                .select('*')
                .order('category', { ascending: true });

            if (permsError) throw permsError;
            setPermissions(permsData || []);

            // Fetch all users with their permissions
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select(`
                    id, ad_soyad, unvan, email,
                    user_permissions(permission_id)
                `)
                .eq('durum', 'aktif')
                .order('ad_soyad');

            if (usersError) throw usersError;

            const formattedUsers = usersData?.map((u: any) => ({
                id: u.id,
                ad_soyad: u.ad_soyad,
                unvan: u.unvan,
                email: u.email,
                permissions: u.user_permissions?.map((p: any) => p.permission_id) || []
            })) || [];

            setUsers(formattedUsers);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (userId: number, permId: string, hasIt: boolean) => {
        const updateKey = `${userId}-${permId}`;
        setUpdating(updateKey);

        try {
            if (hasIt) {
                // Remove permission
                const { error } = await supabase
                    .from('user_permissions')
                    .delete()
                    .eq('user_id', userId)
                    .eq('permission_id', permId);

                if (error) throw error;
            } else {
                // Add permission
                const { error } = await supabase
                    .from('user_permissions')
                    .insert({ user_id: userId, permission_id: permId });

                if (error) throw error;
            }

            // Update local state
            setUsers(prev => prev.map(u => {
                if (u.id === userId) {
                    return {
                        ...u,
                        permissions: hasIt
                            ? u.permissions.filter(p => p !== permId)
                            : [...u.permissions, permId]
                    };
                }
                return u;
            }));

        } catch (error: any) {
            alert('Hata: ' + error.message);
        } finally {
            setUpdating(null);
        }
    };

    const filteredUsers = users.filter(u =>
        u.ad_soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group permissions by category
    const categories = Array.from(new Set(permissions.map(p => p.category)));

    if (!hasPermission('permissions:manage')) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Shield className="w-16 h-16 text-red-500" />
                <h1 className="text-xl font-bold text-gray-900">Yetkiniz Yok</h1>
                <p className="text-gray-500 text-center max-w-md">Bu sayfayı görüntülemek için "Yetki Yönetimi" yetkisine sahip olmanız gerekmektedir.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-8 h-8 text-indigo-600" />
                        Yetkilendirme Kontrol Paneli
                    </h1>
                    <p className="text-gray-500 mt-1">Kullanıcıların sistemdeki yetkilerini yönetin.</p>
                </div>
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Kullanıcı ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* User List Sidebar */}
                    <div className="lg:col-span-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredUsers.map(user => (
                            <div key={user.id} className="p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 transition-all shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                                        {user.ad_soyad.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{user.ad_soyad}</p>
                                        <p className="text-xs text-gray-500 capitalize">{user.unvan.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 w-full">AKTİF YETKİLER</span>
                                    {user.permissions.length === 0 ? (
                                        <span className="text-xs text-gray-400 italic">Yetki verilmemiş</span>
                                    ) : (
                                        user.permissions.slice(0, 5).map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded-full border border-green-100">
                                                {p.split(':')[1]}
                                            </span>
                                        ))
                                    )}
                                    {user.permissions.length > 5 && (
                                        <span className="text-[10px] text-gray-400 font-medium">+{user.permissions.length - 5} daha</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Permissions Matrix */}
                    <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[70vh]">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h2 className="font-bold text-gray-900">Yetki Detayları Matrisi</h2>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Yetkili</span>
                                <span className="flex items-center gap-1"><X className="w-3 h-3 text-red-500" /> Yetkisiz</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0 scrollbar-thin">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-gray-100">
                                    <tr>
                                        <th className="p-4 font-semibold text-gray-500 w-48 bg-gray-50/30">Üye</th>
                                        {permissions.map(p => (
                                            <th key={p.id} className="p-3 font-semibold text-gray-500 min-w-[120px] text-center border-l border-gray-50 group relative">
                                                <div className="truncate w-24 mx-auto">{p.name}</div>
                                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl w-40 pointer-events-none transition-opacity z-50">
                                                    {p.description}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-indigo-50/20 transition-colors border-b border-gray-50">
                                            <td className="p-4 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white bg-opacity-95 z-2">
                                                <p className="truncate w-40">{user.ad_soyad}</p>
                                                <p className="text-[10px] text-gray-400 truncate w-40">{user.email}</p>
                                            </td>
                                            {permissions.map(p => {
                                                const hasIt = user.permissions.includes(p.id);
                                                const isUpdating = updating === `${user.id}-${p.id}`;

                                                return (
                                                    <td key={p.id} className="p-3 border-l border-gray-50">
                                                        <button
                                                            onClick={() => togglePermission(user.id, p.id, hasIt)}
                                                            disabled={isUpdating}
                                                            className={clsx(
                                                                "mx-auto flex items-center justify-center w-8 h-8 rounded-lg transition-all border",
                                                                hasIt
                                                                    ? "bg-green-100 border-green-200 text-green-600"
                                                                    : "bg-gray-50 border-gray-100 text-gray-300 hover:bg-red-50 hover:border-red-100 hover:text-red-400"
                                                            )}
                                                        >
                                                            {isUpdating ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : hasIt ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <X className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-indigo-50 border-t border-indigo-100 flex items-start gap-2">
                            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-indigo-700">
                                <b>İpucu:</b> Bir yetkiyi vermek veya geri almak için kutucuklara tıklayın. Değişiklikler anında kaydedilir.
                                Ünvan değişikliği yapıldığında (Müdür, Şef vb.) varsayılan yetkiler otomatik olarak tekrar tanımlanır.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
