'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Wrench, Fuel, Calendar, Plus, Trash2,
    DollarSign, FileText, Loader2, Gauge, Printer
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import clsx from 'clsx';

interface VehicleDetailClientProps {
    id: string;
}

export default function VehicleDetailClient({ id }: VehicleDetailClientProps) {
    const supabase = createClient();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'info' | 'maintenance' | 'fuel'>('info');
    const [vehicle, setVehicle] = useState<any>(null);
    const [maintenances, setMaintenances] = useState<any[]>([]);
    const [fuels, setFuels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingMod, setIsAddingMod] = useState(false);
    const [maintSortConfig, setMaintSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [fuelSortConfig, setFuelSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const { register: regMaint, handleSubmit: subMaint, reset: resetMaint } = useForm({
        defaultValues: {
            tarih: new Date().toISOString().split('T')[0],
            bakim_tipi: '',
            maliyet: 0,
            km: 0
        }
    });
    const { register: regFuel, handleSubmit: subFuel, reset: resetFuel } = useForm({
        defaultValues: {
            tarih: new Date().toISOString().split('T')[0],
            miktar_litre: 0,
            toplam_tutar: 0,
            fis_no: '',
            birim_fiyat: 0
        }
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { data: v, error: vErr } = await supabase.from('araclar').select('*').eq('id', id).single();
            if (vErr) throw vErr;
            setVehicle(v);

            const { data: m, error: mErr } = await supabase.from('arac_bakim').select('*').eq('arac_id', id).order('tarih', { ascending: false });
            if (mErr) throw mErr;
            setMaintenances(m || []);

            const { data: f, error: fErr } = await supabase.from('arac_yakit').select('*').eq('arac_id', id).order('tarih', { ascending: false });
            if (fErr) throw fErr;
            setFuels(f || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onAddMaintenance = async (data: any) => {
        try {
            const payload = { ...data, arac_id: id, km: vehicle?.kilometre || 0 };
            const { error } = await supabase.from('arac_bakim').insert([payload]);
            if (error) throw error;
            resetMaint({ tarih: new Date().toISOString().split('T')[0] });
            setIsAddingMod(false);
            fetchData();
        } catch (e) { alert('Hata oluştu'); console.error(e); }
    };

    const onAddFuel = async (data: any) => {
        try {
            const { error } = await supabase.from('arac_yakit').insert([{ ...data, arac_id: id }]);
            if (error) throw error;
            resetFuel({ tarih: new Date().toISOString().split('T')[0] });
            setIsAddingMod(false);
            fetchData();
        } catch (e) { alert('Hata oluştu'); console.error(e); }
    };

    const deleteItem = async (table: string, itemId: number) => {
        if (!confirm('Silmek istiyor musunuz?')) return;
        await supabase.from(table).delete().eq('id', itemId);
        fetchData();
    };

    const handleMaintSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (maintSortConfig && maintSortConfig.key === key && maintSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setMaintSortConfig({ key, direction });
    };

    const handleFuelSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (fuelSortConfig && fuelSortConfig.key === key && fuelSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setFuelSortConfig({ key, direction });
    };

    const sortedMaintenances = [...maintenances].sort((a, b) => {
        if (!maintSortConfig) return 0;
        let aVal = a[maintSortConfig.key] || '';
        let bVal = b[maintSortConfig.key] || '';
        if (aVal < bVal) return maintSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return maintSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const sortedFuels = [...fuels].sort((a, b) => {
        if (!fuelSortConfig) return 0;
        let aVal = a[fuelSortConfig.key] || '';
        let bVal = b[fuelSortConfig.key] || '';
        if (fuelSortConfig.key === 'birim_fiyat') {
            aVal = (a.toplam_tutar && a.miktar_litre) ? (a.toplam_tutar / a.miktar_litre) : 0;
            bVal = (b.toplam_tutar && b.miktar_litre) ? (b.toplam_tutar / b.miktar_litre) : 0;
        }
        if (aVal < bVal) return fuelSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return fuelSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ config, columnKey }: { config: any, columnKey: string }) => {
        if (config?.key !== columnKey) return <span className="text-gray-300 ml-1">↕</span>;
        return config.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
    };

    const handlePrint = () => window.print();

    if (loading && !vehicle) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 no-print">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{vehicle?.plaka}</h1>
                        <p className="text-gray-500 text-sm">{vehicle?.marka} {vehicle?.model}</p>
                    </div>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm no-print">
                    <Printer className="w-4 h-4" /> Yazdır
                </button>
            </div>

            <div className="flex gap-2 border-b border-gray-200">
                <button onClick={() => setActiveTab('info')} className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                    Genel Bilgiler
                </button>
                <button onClick={() => setActiveTab('maintenance')} className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'maintenance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                    <Wrench className="w-4 h-4" /> Bakım Geçmişi
                </button>
                <button onClick={() => setActiveTab('fuel')} className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'fuel' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                    <Fuel className="w-4 h-4" /> Yakıt Kayıtları
                </button>
            </div>

            <div className="min-h-[300px]">
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-left-4">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-4">Araç Durumu</h3>
                            <div className="text-3xl font-bold text-gray-900">{vehicle?.durum}</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-4">Toplam Bakım</h3>
                            <div className="text-3xl font-bold text-indigo-600">{maintenances.length} <span className="text-sm font-normal text-gray-400">Kayıt</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-4">Toplam Yakıt Fişi</h3>
                            <div className="text-3xl font-bold text-orange-600">{fuels.length} <span className="text-sm font-normal text-gray-400">Fiş</span></div>
                        </div>
                    </div>
                )}

                {activeTab === 'maintenance' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                        <div className="flex justify-end">
                            <button onClick={() => setIsAddingMod(!isAddingMod)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                                {isAddingMod ? 'Vazgeç' : <><Plus className="w-4 h-4" /> Bakım Ekle</>}
                            </button>
                        </div>

                        {isAddingMod && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <form onSubmit={subMaint(onAddMaintenance)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Bakım Tipi</label>
                                        <input {...regMaint('bakim_tipi', { required: true })} placeholder="Yağ Değişimi" className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Tarih</label>
                                        <input type="date" {...regMaint('tarih', { required: true })} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Maliyet (TL)</label>
                                        <input type="number" step="0.01" {...regMaint('maliyet')} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <button type="submit" className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm">Kaydet</button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden print-border-none">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleMaintSort('tarih')}>Tarih <SortIcon config={maintSortConfig} columnKey="tarih" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleMaintSort('bakim_tipi')}>İşlem <SortIcon config={maintSortConfig} columnKey="bakim_tipi" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleMaintSort('maliyet')}>Maliyet <SortIcon config={maintSortConfig} columnKey="maliyet" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleMaintSort('km')}>KM <SortIcon config={maintSortConfig} columnKey="km" /></th>
                                        <th className="px-4 py-3 text-right">Eylemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sortedMaintenances.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {new Date(m.tarih).toLocaleDateString('tr-TR')}</td>
                                            <td className="px-4 py-3 font-medium">{m.bakim_tipi}</td>
                                            <td className="px-4 py-3">{m.maliyet} ₺</td>
                                            <td className="px-4 py-3 text-gray-500">{m.km || '-'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => deleteItem('arac_bakim', m.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {maintenances.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Kayıt bulunamadı.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        <div className="total-panel bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between mt-4">
                            <div className="text-sm text-gray-500">Toplam <span className="font-medium text-gray-900">{maintenances.length}</span> bakım kaydı listeleniyor.</div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Toplam Maliyet</div>
                                    <div className="text-xl font-bold text-indigo-600">{maintenances.reduce((acc, curr) => acc + (curr.maliyet || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'fuel' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                        <div className="flex justify-end">
                            <button onClick={() => setIsAddingMod(!isAddingMod)} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                                {isAddingMod ? 'Vazgeç' : <><Plus className="w-4 h-4" /> Yakıt Fişi Ekle</>}
                            </button>
                        </div>

                        {isAddingMod && (
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <form onSubmit={subFuel(onAddFuel)} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Tarih</label>
                                        <input type="date" {...regFuel('tarih', { required: true })} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Miktar (Lt)</label>
                                        <input type="number" step="0.01" {...regFuel('miktar_litre', { required: true })} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Tutar (TL)</label>
                                        <input type="number" step="0.01" {...regFuel('toplam_tutar', { required: true })} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Fiş No</label>
                                        <input type="text" {...regFuel('fis_no')} className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <button type="submit" className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-sm">Kaydet</button>
                                </form>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden print-border-none">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleFuelSort('tarih')}>Tarih <SortIcon config={fuelSortConfig} columnKey="tarih" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleFuelSort('miktar_litre')}>Miktar <SortIcon config={fuelSortConfig} columnKey="miktar_litre" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleFuelSort('toplam_tutar')}>Tutar <SortIcon config={fuelSortConfig} columnKey="toplam_tutar" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleFuelSort('birim_fiyat')}>Birim Fiyat <SortIcon config={fuelSortConfig} columnKey="birim_fiyat" /></th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleFuelSort('fis_no')}>Fiş No <SortIcon config={fuelSortConfig} columnKey="fis_no" /></th>
                                        <th className="px-4 py-3 text-right">Eylemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sortedFuels.map(f => {
                                        const unitPrice = f.toplam_tutar && f.miktar_litre ? (f.toplam_tutar / f.miktar_litre).toFixed(2) : '-';
                                        return (
                                            <tr key={f.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {new Date(f.tarih).toLocaleDateString('tr-TR')}</td>
                                                <td className="px-4 py-3">{f.miktar_litre} Lt</td>
                                                <td className="px-4 py-3 font-medium">{f.toplam_tutar} ₺</td>
                                                <td className="px-4 py-3 text-gray-500">{unitPrice} ₺/Lt</td>
                                                <td className="px-4 py-3 text-gray-500">{f.fis_no || '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => deleteItem('arac_yakit', f.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {fuels.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Yakıt fişi bulunamadı.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        <div className="total-panel bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between mt-4">
                            <div className="text-sm text-gray-500">Toplam <span className="font-medium text-gray-900">{fuels.length}</span> fiş kaydı listeleniyor.</div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Toplam Miktar</div>
                                    <div className="text-lg font-bold text-gray-900">{fuels.reduce((acc, curr) => acc + (curr.miktar_litre || 0), 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Lt</div>
                                </div>
                                <div className="w-px h-8 bg-gray-200"></div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Toplam Tutar</div>
                                    <div className="text-xl font-bold text-indigo-600">{fuels.reduce((acc, curr) => acc + (curr.toplam_tutar || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
