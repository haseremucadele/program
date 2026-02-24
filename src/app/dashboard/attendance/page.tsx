
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Calendar, Check, X, Printer, Trash2, ArrowUpDown, ChevronLeft, ChevronRight, Save, Search, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { useUserProfile } from '@/hooks/useUserProfile';

// --- Interfaces ---
interface User {
    id: number;
    ad_soyad: string;
    unvan: string;
    ilce: string;
    durum?: string;
}

interface Attendance {
    id?: number;
    user_id: number;
    tarih: string;
    durum: 'mesai' | 'gelmedi' | 'izin' | 'rapor';
    giris_saati: string;
    cikis_saati: string;
    user?: User; // Joined user data
}

export default function AttendancePage() {
    const supabase = createClient();
    const { profile, hasPermission } = useUserProfile();
    // --- State: General ---
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [saving, setSaving] = useState(false);

    // --- State: Filter ---
    const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0]);
    const [listDistrict, setListDistrict] = useState<string>('Tüm İlçeler');

    // --- State: Single Form ---
    const [singleUser, setSingleUser] = useState<string>(''); // user_id string
    const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
    const [singleStatus, setSingleStatus] = useState<string>('mesai');
    const [singleGiris, setSingleGiris] = useState('08:30');
    const [singleCikis, setSingleCikis] = useState('17:30');
    const [singleIlce, setSingleIlce] = useState(''); // auto-filled

    // --- State: Bulk Form ---
    const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
    const [bulkPersonnelFilter, setBulkPersonnelFilter] = useState('Tüm Personel');
    const [bulkDistrictFilter, setBulkDistrictFilter] = useState('Tüm İlçeler');

    // --- State: Sorting ---
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const componentRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        initData();
    }, []);

    useEffect(() => {
        fetchAttendances();
    }, [listDate, listDistrict]);

    // Auto-select district for Bulk Filter if user has restricted district
    // Auto-select district for Bulk Filter AND List Filter if user has restricted district
    useEffect(() => {
        if (profile?.ilce) {
            setBulkDistrictFilter(profile.ilce);
            setListDistrict(profile.ilce);
        }
    }, [profile]);

    // Auto-fill single form district when user selected
    useEffect(() => {
        if (singleUser) {
            const u = users.find(x => x.id.toString() === singleUser);
            if (u) setSingleIlce(u.ilce || '');
        } else {
            setSingleIlce('');
        }
    }, [singleUser, users]);

    // --- Actions ---
    const initData = async () => {
        try {
            const { data } = await supabase.from('users').select('*').eq('durum', 'aktif').order('ad_soyad');
            setUsers(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendances = async () => {
        setLoading(true);
        try {
            // Need to join users to filter by district manually if not possible directly?
            // Supabase join syntax: select('*, user:users(*)')
            let query = supabase
                .from('yoklama')
                .select('*, user:users(id, ad_soyad, unvan, ilce, durum)')
                .eq('tarih', listDate);

            const { data, error } = await query;
            if (error) throw error;

            let filtered = (data || []) as Attendance[];

            // Filter for ACTIVE users
            filtered = filtered.filter(a => a.user?.durum === 'aktif');

            if (listDistrict !== 'Tüm İlçeler') {
                filtered = filtered.filter(a => a.user?.ilce === listDistrict);
            }

            setAttendances(filtered);
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSingleAdd = async () => {
        if (!hasPermission('attendance:manage')) return alert('Yetkiniz yok.');
        if (!singleUser) return alert('Lütfen personel seçiniz.');
        setSaving(true);
        try {
            const { error } = await supabase.from('yoklama').upsert({
                user_id: parseInt(singleUser),
                tarih: singleDate,
                durum: singleStatus,
                giris_saati: singleGiris,
                cikis_saati: singleCikis
            }, { onConflict: 'user_id, tarih' });

            if (error) throw error;

            // If date matches list view, refresh
            if (singleDate === listDate) fetchAttendances();

            // Reset crucial fields? Maybe keep date/times for speed entry
            alert('Kayıt eklendi/güncellendi.');
        } catch (e: any) {
            alert('Hata: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleBulkAdd = async () => {
        if (!hasPermission('attendance:manage')) return alert('Yetkiniz yok.');
        if (!confirm(`${bulkDate} tarihi için toplu yoklama alınacak.Onaylıyor musunuz ? `)) return;
        setSaving(true);
        try {
            // Filter users based on selections and ACTIVE status
            let targetUsers = users.filter(u => u.durum === 'aktif' || !u.durum);

            // personnel filter logic? dropdown usually implies specific or all...
            // Standard "Tüm Personel"

            if (bulkDistrictFilter !== 'Tüm İlçeler') {
                targetUsers = targetUsers.filter(u => u.ilce === bulkDistrictFilter);
            }

            if (targetUsers.length === 0) {
                alert('Seçilen kriterlere uygun personel bulunamadı.');
                return;
            }

            // Prepare upserts: Default 'mesai', 08:30 - 17:30
            const updates = targetUsers.map(u => ({
                user_id: u.id,
                tarih: bulkDate,
                durum: 'mesai',
                giris_saati: '08:30',
                cikis_saati: '17:30'
            }));

            const { error } = await supabase.from('yoklama').upsert(updates, { onConflict: 'user_id, tarih' });
            if (error) throw error;

            if (bulkDate === listDate) fetchAttendances();
            alert(`${updates.length} kayıt için toplu yoklama tamamlandı.`);

        } catch (e: any) {
            alert('Hata: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!hasPermission('attendance:manage')) return alert('Yetkiniz yok.');
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('yoklama').delete().eq('id', id);
            setAttendances(prev => prev.filter(x => x.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Yoklama_Listesi_${listDate} `,
    });

    // --- Sorting Logic ---
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAttendances = [...attendances].sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'personel') {
            aValue = a.user?.ad_soyad || '';
            bValue = b.user?.ad_soyad || '';
        } else if (sortConfig.key === 'unvan') {
            aValue = a.user?.unvan || '';
            bValue = b.user?.unvan || '';
        } else if (sortConfig.key === 'ilce') {
            aValue = a.user?.ilce || '';
            bValue = b.user?.ilce || '';
        } else if (sortConfig.key === 'durum') {
            aValue = a.durum || '';
            bValue = b.durum || '';
        } else if (sortConfig.key === 'giris') {
            aValue = a.giris_saati || '';
            bValue = b.giris_saati || '';
        } else if (sortConfig.key === 'cikis') {
            aValue = a.cikis_saati || '';
            bValue = b.cikis_saati || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="text-gray-300 ml-1">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
    };

    // Helper: Unique Districts from users
    const districts = Array.from(new Set(users.map(u => u.ilce).filter(Boolean))).sort();

    return (
        <div className="space-y-4">

            {/* Header Area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Yoklama Yönetimi</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Personel devam durumunu yönetin.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* List Filters in Header */}
                    <div className="relative flex-1 sm:flex-none">
                        <input
                            type="date"
                            value={listDate}
                            onChange={e => setListDate(e.target.value)}
                            className="pl-3 pr-3 py-1.5 w-full sm:w-auto border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all bg-gray-50/50 shadow-sm"
                        />
                    </div>
                    <select
                        value={listDistrict}
                        onChange={e => setListDistrict(e.target.value)}
                        disabled={!!profile?.ilce}
                        className={clsx("px-3 py-1.5 w-full sm:w-40 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all bg-gray-50/50 shadow-sm", { "cursor-not-allowed bg-gray-100": !!profile?.ilce })}
                    >
                        {profile?.ilce ? (
                            <option value={profile.ilce}>{profile.ilce}</option>
                        ) : (
                            <>
                                <option>Tüm İlçeler</option>
                                {districts.map(d => <option key={d}>{d}</option>)}
                            </>
                        )}
                    </select>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Yazdır</span>
                    </button>
                    {/* Placeholder for future actions */}
                </div>
            </div>

            {hasPermission('attendance:manage') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
                    {/* 1. Single Entry Form - Compact */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-500" /> Hızlı Ekle (Tek)</h3>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <select
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                value={singleUser}
                                onChange={e => setSingleUser(e.target.value)}
                            >
                                <option value="">Personel Seçiniz</option>
                                {users.filter(u => !profile?.ilce || u.ilce === profile.ilce).map(u => <option key={u.id} value={u.id}>{u.ad_soyad}</option>)}
                            </select>
                            <input
                                type="text"
                                readOnly
                                value={singleIlce}
                                placeholder="İlçe"
                                className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                            />
                            <input
                                type="date"
                                value={singleDate}
                                onChange={e => setSingleDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                            />
                            <select
                                value={singleStatus}
                                onChange={e => setSingleStatus(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="mesai">Mesai</option>
                                <option value="izin">İzin</option>
                                <option value="rapor">Rapor</option>
                                <option value="gelmedi">Gelmedi</option>
                            </select>
                            <div className="col-span-2 flex items-center gap-2">
                                <input type="time" value={singleGiris} onChange={e => setSingleGiris(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono" />
                                <span className="text-gray-400">-</span>
                                <input type="time" value={singleCikis} onChange={e => setSingleCikis(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono" />
                            </div>
                        </div>
                        <button onClick={handleSingleAdd} disabled={saving} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                            Kaydet
                        </button>
                    </div>

                    {/* 2. Bulk Entry Form - Compact */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><div className="w-4 h-4 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">M</div> Toplu İşlem</h3>
                        <div className="space-y-3 mb-3">
                            <input
                                type="date"
                                value={bulkDate}
                                onChange={e => setBulkDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                            />
                            <select
                                value={bulkPersonnelFilter}
                                onChange={e => setBulkPersonnelFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                            >
                                <option>Tüm Personel</option>
                            </select>
                            <select
                                value={bulkDistrictFilter}
                                onChange={e => setBulkDistrictFilter(e.target.value)}
                                disabled={!!profile?.ilce}
                                className={clsx("w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500", { "cursor-not-allowed bg-gray-100": !!profile?.ilce })}
                            >
                                {profile?.ilce ? (
                                    <option value={profile.ilce}>{profile.ilce}</option>
                                ) : (
                                    <>
                                        <option>Tüm İlçeler</option>
                                        {districts.map(d => <option key={d}>{d}</option>)}
                                    </>
                                )}
                            </select>
                        </div>
                        <button onClick={handleBulkAdd} disabled={saving} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mt-auto">
                            Toplu Yoklama Başlat
                        </button>
                    </div>
                </div>
            )}

            {/* 3. List Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible print-border-none" ref={componentRef}>
                <div className="hidden print:block text-center mb-6 pt-4">
                    <h1 className="text-xl font-bold text-gray-900">GÜNLÜK YOKLAMA RAPORU</h1>
                    <p className="text-sm text-gray-500 mt-1">{new Date(listDate).toLocaleDateString('tr-TR')}</p>
                </div>
                <div className="overflow-x-auto min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700 w-12 text-center">NO</th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('personel')}
                                    >
                                        PERSONEL <SortIcon columnKey="personel" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('unvan')}
                                    >
                                        ÜNVAN <SortIcon columnKey="unvan" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('ilce')}
                                    >
                                        İLÇE <SortIcon columnKey="ilce" />
                                    </th>
                                    <th className="px-4 py-3 font-medium text-gray-700">TARİH</th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('durum')}
                                    >
                                        DURUM <SortIcon columnKey="durum" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('giris')}
                                    >
                                        GİRİŞ <SortIcon columnKey="giris" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('cikis')}
                                    >
                                        ÇIKIŞ <SortIcon columnKey="cikis" />
                                    </th>
                                    <th className="px-4 py-3 font-medium text-gray-700 text-right print:hidden">İŞLEM</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sortedAttendances.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-12 text-gray-400 text-xs">
                                            {new Date(listDate).toLocaleDateString('tr-TR')} tarihinde kayıt bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedAttendances.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 text-center text-gray-400 text-xs font-mono w-12">{idx + 1}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{item.user?.ad_soyad}</td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                                                    {item.user?.unvan?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{item.user?.ilce}</td>
                                            <td className="px-4 py-3 text-gray-500">{new Date(item.tarih).toLocaleDateString('tr-TR')}</td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap",
                                                    {
                                                        'bg-green-50 text-green-700 border-green-100': item.durum === 'mesai',
                                                        'bg-red-50 text-red-700 border-red-100': item.durum === 'gelmedi',
                                                        'bg-blue-50 text-blue-700 border-blue-100': item.durum === 'izin',
                                                        'bg-purple-50 text-purple-700 border-purple-100': item.durum === 'rapor',
                                                    }
                                                )}>
                                                    <span className={clsx("w-1.5 h-1.5 rounded-full", {
                                                        'bg-green-500': item.durum === 'mesai',
                                                        'bg-red-500': item.durum === 'gelmedi',
                                                        'bg-blue-500': item.durum === 'izin',
                                                        'bg-purple-500': item.durum === 'rapor',
                                                    })}></span>
                                                    {item.durum}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.giris_saati?.slice(0, 5) || '-'}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.cikis_saati?.slice(0, 5) || '-'}</td>
                                            <td className="px-4 py-3 text-right print:hidden">
                                                {hasPermission('attendance:manage') && (
                                                    <button onClick={() => item.id && handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>


        </div>
    );
}
