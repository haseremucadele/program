'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Search, MoreHorizontal, Briefcase, MapPin, Edit, Trash2, X, Printer, UserPlus } from 'lucide-react';
import clsx from 'clsx';
// import { createUser } from '@/app/actions/user';
import { useUserProfile } from '@/hooks/useUserProfile';

interface UserProfile {
    id: number;
    auth_id: string;
    email: string;
    ad_soyad: string;
    unvan: string;
    ilce: string;
    durum?: string;
    created_at?: string;
    telefon?: string;
    kan_grubu?: string;
    ayakkabi_no?: string;
    kislik_bot_no?: string;
    tisort_beden?: string;
    pantolon_beden?: string;
    sweatshirt_beden?: string;
    kislik_pantolon_beden?: string;
    mont_beden?: string;
}

export default function UsersPage() {
    const supabase = createClient();
    const { profile: currentUser, hasPermission } = useUserProfile();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        ad_soyad: '',
        email: '',
        password: '',
        unvan: '',
        ilce: '',
    });
    const [editingDetailsUser, setEditingDetailsUser] = useState<UserProfile | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchUsers();

        // Close menu on click outside
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);

    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('id', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        setOpenMenuId(null);
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (!error) fetchUsers();
        else alert('Silme başarısız. Yetkiniz olmayabilir veya ilişkili kayıtlar var.');
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        try {
            // Static export için Server Actions devre dışı - doğrudan Supabase kullan
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newUser.email,
                password: newUser.password,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('User creation failed');

            const { error: profileError } = await supabase
                .from('users')
                .insert([{
                    auth_id: authData.user.id,
                    email: newUser.email,
                    ad_soyad: newUser.ad_soyad,
                    unvan: newUser.unvan,
                    ilce: newUser.ilce,
                    durum: 'aktif'
                }]);

            if (profileError) throw profileError;

            alert('Kullanıcı başarıyla oluşturuldu.');
            setIsCreateModalOpen(false);
            setNewUser({ ad_soyad: '', email: '', password: '', unvan: '', ilce: '' });
            fetchUsers();
        } catch (error: any) {
            console.error('Create user error:', error);
            alert('Kullanıcı oluşturulurken hata: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    ad_soyad: editingUser.ad_soyad,
                    unvan: editingUser.unvan,
                    ilce: editingUser.ilce,
                    durum: editingUser.durum // Added durum
                })
                .eq('id', editingUser.id);

            if (error) throw error;

            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Update error:', error);
            alert('Güncelleme başarısız oldu. (Veritabanında "durum" kolonu olduğundan emin olun)');
        }
    };

    const handleUpdateDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDetailsUser) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    telefon: editingDetailsUser.telefon,
                    kan_grubu: editingDetailsUser.kan_grubu,
                    ayakkabi_no: editingDetailsUser.ayakkabi_no,
                    kislik_bot_no: editingDetailsUser.kislik_bot_no,
                    tisort_beden: editingDetailsUser.tisort_beden,
                    pantolon_beden: editingDetailsUser.pantolon_beden,
                    sweatshirt_beden: editingDetailsUser.sweatshirt_beden,
                    kislik_pantolon_beden: editingDetailsUser.kislik_pantolon_beden,
                    mont_beden: editingDetailsUser.mont_beden
                })
                .eq('id', editingDetailsUser.id);

            if (error) throw error;

            setEditingDetailsUser(null);
            fetchUsers();
            alert('Kullanıcı detayları güncellendi.');
        } catch (error) {
            console.error('Update details error:', error);
            alert('Detay güncelleme başarısız.');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handlePrintClothing = async () => {
        const { generateClothingReport } = await import('@/utils/pdf-generator');
        generateClothingReport(filteredUsers);
    };


    const [hideInactive, setHideInactive] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.ad_soyad || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.unvan || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = hideInactive ? (user.durum === 'aktif' || !user.durum) : true;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'ad_soyad') {
            aValue = a.ad_soyad || '';
            bValue = b.ad_soyad || '';
        } else if (sortConfig.key === 'unvan') {
            aValue = a.unvan || '';
            bValue = b.unvan || '';
        } else if (sortConfig.key === 'ilce') {
            aValue = a.ilce || '';
            bValue = b.ilce || '';
        } else if (sortConfig.key === 'durum') {
            aValue = a.durum || 'aktif';
            bValue = b.durum || 'aktif';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="text-gray-300 ml-1">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Kullanıcı Yönetimi</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Sistemdeki kayıtlı personeller.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Kullanıcı ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 w-full sm:w-56 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all bg-gray-50/50 shadow-sm"
                        />
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Yazdır</span>
                    </button>

                    <button
                        onClick={handlePrintClothing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm shadow-sm"
                        title="Kıyafet Listesi"
                    >
                        <Briefcase className="w-4 h-4" />
                        <span className="hidden sm:inline">Kıyafet Listesi</span>
                    </button>

                    {hasPermission('users:manage') && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-sm font-medium"
                        >
                            <span className="text-lg leading-none">+</span>
                            <span className="hidden sm:inline">Yeni Kullanıcı</span>
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible print-border-none">
                    <div className="hidden print:block text-2xl font-bold mb-4 text-center text-gray-900 pt-4">Aktif Kullanıcı Listesi</div>
                    <div className="overflow-x-auto overflow-y-visible min-h-[300px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700 w-12 text-center">No</th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('ad_soyad')}
                                    >
                                        Ad Soyad / E-posta <SortIcon columnKey="ad_soyad" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('unvan')}
                                    >
                                        Ünvan <SortIcon columnKey="unvan" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('ilce')}
                                    >
                                        İlçe <SortIcon columnKey="ilce" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 w-24 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('durum')}
                                    >
                                        Durum <SortIcon columnKey="durum" />
                                    </th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-right w-16">Eylemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredUsers.map((user, index) => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group relative">
                                        <td className="px-4 py-3 text-center text-gray-400 text-xs font-mono">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{user.ad_soyad || 'İsimsiz'}</p>
                                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100 whitespace-nowrap">
                                                <Briefcase className="w-3 h-3 text-gray-400" />
                                                {user.unvan?.replace('_', ' ') || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-gray-600 whitespace-nowrap">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {user.ilce || 'Merkez'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(!user.durum || user.durum === 'aktif') ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 whitespace-nowrap">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100 whitespace-nowrap">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                                    Pasif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === user.id ? null : user.id); }}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openMenuId === user.id && (
                                                <div ref={menuRef} className="absolute right-8 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                    <div className="p-1">
                                                        {hasPermission('users:manage') && (
                                                            <>
                                                                <button
                                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md transition-colors text-left"
                                                                    onClick={() => { setOpenMenuId(null); setEditingUser(user); }}
                                                                >
                                                                    <Edit className="w-3.5 h-3.5 text-gray-400" /> Düzenle
                                                                </button>
                                                                <button
                                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
                                                                    onClick={() => deleteUser(user.id)}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Sil
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors text-left"
                                                            onClick={() => { setOpenMenuId(null); setEditingDetailsUser(user); }}
                                                        >
                                                            <div className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px] border border-indigo-600 rounded-sm">i</div> Detaylar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer for Checkbox only */}
                    <div className="p-4 border-t border-gray-100 flex flex-row items-center justify-between no-print">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none hover:text-gray-900">
                            <input
                                type="checkbox"
                                checked={hideInactive}
                                onChange={(e) => setHideInactive(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            Aktif olmayan kayıtları gizle
                        </label>
                    </div>

                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-xs text-gray-400 border-t border-gray-50 bg-gray-50/30">
                            Kullanıcı bulunamadı.
                        </div>
                    )}
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">Kullanıcı Düzenle</h3>
                            <button onClick={() => setEditingUser(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ad Soyad</label>
                                <input
                                    type="text"
                                    required
                                    value={editingUser.ad_soyad || ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, ad_soyad: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ünvan</label>
                                <select
                                    value={editingUser.unvan || ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, unvan: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
                                    <option value="mudur">Müdür</option>
                                    <option value="sef">Şef</option>
                                    <option value="bolge_sorumlusu">Bölge Sorumlusu</option>
                                    <option value="ekipbasi">Ekipbaşı</option>
                                    <option value="beden_iscisi">Beden İşçisi</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">İlçe</label>
                                <select
                                    value={editingUser.ilce || ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, ilce: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
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

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                                <select
                                    value={editingUser.durum || 'aktif'}
                                    onChange={(e) => setEditingUser({ ...editingUser, durum: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="aktif">Aktif</option>
                                    <option value="pasif">Pasif</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">Yeni Kullanıcı Oluştur</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ad Soyad</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.ad_soyad}
                                    onChange={(e) => setNewUser({ ...newUser, ad_soyad: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">E-posta</label>
                                <input
                                    type="email"
                                    required
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Şifre</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ünvan</label>
                                <select
                                    value={newUser.unvan}
                                    onChange={(e) => setNewUser({ ...newUser, unvan: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
                                    <option value="mudur">Müdür</option>
                                    <option value="sef">Şef</option>
                                    <option value="bolge_sorumlusu">Bölge Sorumlusu</option>
                                    <option value="ekipbasi">Ekipbaşı</option>
                                    <option value="beden_iscisi">Beden İşçisi</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">İlçe</label>
                                <select
                                    value={newUser.ilce}
                                    onChange={(e) => setNewUser({ ...newUser, ilce: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
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

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isCreating ? 'Oluşturuluyor...' : 'Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Details Modal */}
            {editingDetailsUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Personel Detayları</h3>
                                <p className="text-sm text-gray-500">{editingDetailsUser.ad_soyad}</p>
                            </div>
                            <button onClick={() => setEditingDetailsUser(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateDetails} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.telefon || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, telefon: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                    placeholder="05XX XXX XX XX"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Kan Grubu</label>
                                <select
                                    value={editingDetailsUser.kan_grubu || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, kan_grubu: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
                                    <option value="A Rh+">A Rh+</option>
                                    <option value="A Rh-">A Rh-</option>
                                    <option value="B Rh+">B Rh+</option>
                                    <option value="B Rh-">B Rh-</option>
                                    <option value="AB Rh+">AB Rh+</option>
                                    <option value="AB Rh-">AB Rh-</option>
                                    <option value="0 Rh+">0 Rh+</option>
                                    <option value="0 Rh-">0 Rh-</option>
                                </select>
                            </div>

                            <div className="col-span-1 sm:col-span-2 border-t border-gray-100 my-2 pt-2">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Kıyafet & Ayakkabı Ölçüleri</h4>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Ayakkabı No</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.ayakkabi_no || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, ayakkabi_no: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Kışlık Bot No</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.kislik_bot_no || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, kislik_bot_no: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Tişört Beden</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.tisort_beden || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, tisort_beden: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Pantolon Beden</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.pantolon_beden || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, pantolon_beden: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Sweatshirt Beden</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.sweatshirt_beden || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, sweatshirt_beden: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Kışlık Pantolon</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.kislik_pantolon_beden || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, kislik_pantolon_beden: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mont Beden</label>
                                <input
                                    type="text"
                                    value={editingDetailsUser.mont_beden || ''}
                                    onChange={(e) => setEditingDetailsUser({ ...editingDetailsUser, mont_beden: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingDetailsUser(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
