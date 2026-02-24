'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Truck, Plus, Trash2, Edit, MoreHorizontal, ChevronRight, X, Printer, MapPin } from 'lucide-react';

import { useForm } from 'react-hook-form';
import { useUserProfile } from '@/hooks/useUserProfile';

interface Vehicle {
    id: number;
    plaka: string;
    marka: string;
    model: string;
    durum: string;
    kilometre?: number;
    ilce?: string;
}

export default function VehiclesPage() {
    const supabase = createClient();
    const { profile: currentUser, hasPermission } = useUserProfile();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [hideInactive, setHideInactive] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    // Form for Adding
    const { register, handleSubmit, reset } = useForm<Vehicle>({
        defaultValues: {
            durum: 'aktif',
            kilometre: 0,
            ilce: ''
        }
    });

    useEffect(() => {
        fetchVehicles();

        // Close menu on click outside
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);

    }, []);

    const fetchVehicles = async () => {
        try {
            const { data, error } = await supabase.from('araclar').select('*').order('id', { ascending: false });
            if (error) throw error;
            setVehicles(data || []);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: Vehicle) => {
        try {
            const { error } = await supabase.from('araclar').insert([data]);
            if (error) throw error;
            await fetchVehicles();
            setIsAdding(false);
            reset();
        } catch (error) {
            console.error('Error adding vehicle:', error);
            alert('Araç eklenirken hata oluştu.');
        }
    };

    const handleUpdateVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVehicle) return;

        try {
            const { error } = await supabase
                .from('araclar')
                .update({
                    plaka: editingVehicle.plaka,
                    marka: editingVehicle.marka,
                    model: editingVehicle.model,
                    durum: editingVehicle.durum,
                    kilometre: editingVehicle.kilometre,
                    ilce: editingVehicle.ilce
                })
                .eq('id', editingVehicle.id);

            if (error) throw error;

            setEditingVehicle(null);
            fetchVehicles();
        } catch (error) {
            console.error('Update error:', error);
            alert('Güncelleme başarısız oldu.');
        }
    };

    const deleteVehicle = async (id: number) => {
        if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return;
        setOpenMenuId(null);
        try {
            const { error } = await supabase.from('araclar').delete().eq('id', id);
            if (error) throw error;
            setVehicles(vehicles.filter(v => v.id !== id));
        } catch (error) {
            console.error('Error deleting vehicle:', error);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedVehicles = [...vehicles].sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'plaka') {
            aValue = a.plaka || '';
            bValue = b.plaka || '';
        } else if (sortConfig.key === 'marka_model') {
            aValue = (a.marka + a.model) || '';
            bValue = (b.marka + b.model) || '';
        } else if (sortConfig.key === 'durum') {
            aValue = a.durum || '';
            bValue = b.durum || '';
        } else if (sortConfig.key === 'ilce') {
            aValue = a.ilce || '';
            bValue = b.ilce || '';
        } else if (sortConfig.key === 'kilometre') {
            const aKm = a.kilometre ?? 0;
            const bKm = b.kilometre ?? 0;
            if (aKm < bKm) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aKm > bKm) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="text-gray-300 ml-1">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
    };

    const handlePrint = () => {
        window.print();
    };

    // List of districts for selection
    const districts = [
        'Altıeylül', 'Ayvalık', 'Balya', 'Bandırma', 'Bigadiç',
        'Burhaniye', 'Dursunbey', 'Edremit', 'Erdek', 'Gömeç',
        'Gönen', 'Havran', 'İvrindi', 'Karesi', 'Kepsut',
        'Manyas', 'Marmara', 'Savaştepe', 'Sındırgı', 'Susurluk'
    ];

    return (
        <div className="space-y-4">
            {/* Print Header */}
            <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold text-gray-900 text-center border-b border-gray-300 pb-2">Güncel Araç Listesi</h1>
                <div className="flex justify-end text-sm text-gray-600 mt-2">
                    <span>Tarih: {new Date().toLocaleDateString('tr-TR')}</span>
                </div>
            </div>

            <div className="flex items-center justify-between no-print">
                <h2 className="text-xl font-bold text-gray-900">Araç Yönetimi</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Yazdır
                    </button>
                    {hasPermission('vehicles:manage') && (
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                        >
                            {isAdding ? 'İptal' : <><Plus className="w-4 h-4" /> Yeni Araç Ekle</>}
                        </button>
                    )}
                </div>
            </div>

            {isAdding && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 animate-in slide-in-from-top-4">
                    <h3 className="text-sm font-semibold mb-3">Yeni Araç Bilgileri</h3>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Plaka</label>
                                <input {...register('plaka', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-1 focus:ring-indigo-500" placeholder="06 ABC 123" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Marka</label>
                                <input {...register('marka')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-1 focus:ring-indigo-500" placeholder="Ford" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                                <input {...register('model')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-1 focus:ring-indigo-500" placeholder="Transit" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">İlçe</label>
                                <select {...register('ilce')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 bg-white">
                                    <option value="">Seçiniz</option>
                                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Aktif KM</label>
                                <input type="number" {...register('kilometre')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                                <select {...register('durum')} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 bg-white">
                                    <option value="aktif">Aktif</option>
                                    <option value="pasif">Pasif</option>
                                    <option value="bakimda">Bakımda</option>
                                    <option value="arizali">Arızalı</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Kaydet</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600 w-6 h-6" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible print-border-none">
                    <div className="overflow-x-auto overflow-y-visible min-h-[300px]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-700 w-12 text-center">No</th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('plaka')}
                                    >
                                        Plaka <SortIcon columnKey="plaka" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('marka_model')}
                                    >
                                        Marka / Model <SortIcon columnKey="marka_model" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('ilce')}
                                    >
                                        İlçe <SortIcon columnKey="ilce" />
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                        onClick={() => handleSort('kilometre')}
                                    >
                                        Aktif KM <SortIcon columnKey="kilometre" />
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
                                {sortedVehicles.filter(v => !hideInactive || v.durum === 'aktif').map((vehicle, index) => (
                                    <tr key={vehicle.id} className="hover:bg-gray-50/50 transition-colors group relative">
                                        <td className="px-4 py-3 text-center text-gray-400 text-xs font-mono">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-gray-900">{vehicle.plaka}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {vehicle.marka} <span className="text-gray-400 mx-1">•</span> {vehicle.model}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {vehicle.ilce || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 font-mono text-sm">
                                            {vehicle.kilometre?.toLocaleString('tr-TR')} km
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${vehicle.durum === 'aktif' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-yellow-50 text-yellow-700 border border-yellow-100'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${vehicle.durum === 'aktif' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                                {vehicle.durum.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === vehicle.id ? null : vehicle.id); }}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openMenuId === vehicle.id && (
                                                <div ref={menuRef} className="absolute right-8 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                    <div className="p-1">
                                                        <Link
                                                            href={`/dashboard/vehicles/${vehicle.id}`}
                                                            className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md transition-colors text-left w-full"
                                                        >
                                                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> Detaylar
                                                        </Link>
                                                        {hasPermission('vehicles:manage') && (
                                                            <>
                                                                <button
                                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md transition-colors text-left"
                                                                    onClick={() => { setOpenMenuId(null); setEditingVehicle(vehicle); }}
                                                                >
                                                                    <Edit className="w-3.5 h-3.5 text-gray-400" /> Düzenle
                                                                </button>
                                                                <button
                                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
                                                                    onClick={() => deleteVehicle(vehicle.id)}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Sil
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {vehicles.length === 0 && (
                        <div className="p-8 text-center text-xs text-gray-400 border-t border-gray-50 bg-gray-50/30">
                            Henüz araç bulunmuyor.
                        </div>
                    )}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-start no-print">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideInactive}
                                onChange={(e) => setHideInactive(e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            Aktif olmayan kayıtları gizle
                        </label>
                    </div>
                </div>
            )}

            {/* Edit Vehicle Modal */}
            {editingVehicle && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-gray-900">Araç Düzenle</h3>
                            <button onClick={() => setEditingVehicle(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateVehicle} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Plaka</label>
                                <input
                                    type="text"
                                    required
                                    value={editingVehicle.plaka || ''}
                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, plaka: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Marka</label>
                                    <input
                                        type="text"
                                        value={editingVehicle.marka || ''}
                                        onChange={(e) => setEditingVehicle({ ...editingVehicle, marka: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                                    <input
                                        type="text"
                                        value={editingVehicle.model || ''}
                                        onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">İlçe</label>
                                <select
                                    value={editingVehicle.ilce || ''}
                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, ilce: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">Seçiniz</option>
                                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Aktif KM</label>
                                <input
                                    type="number"
                                    value={editingVehicle.kilometre || 0}
                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, kilometre: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                                <select
                                    value={editingVehicle.durum}
                                    onChange={(e) => setEditingVehicle({ ...editingVehicle, durum: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="aktif">Aktif</option>
                                    <option value="bakimda">Bakımda</option>
                                    <option value="arizali">Arızalı</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingVehicle(null)}
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
