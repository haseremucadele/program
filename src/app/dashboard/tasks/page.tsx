'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Plus, Calendar, CheckCircle2, Clock, XCircle, Printer, Car, Users, Beaker, Trash2, ArrowUpDown, MapPin, AlertTriangle } from 'lucide-react';
// ... imports
// Since I can't match huge blocks easily with imports potentially changing order or being long, I'll just target the import line.
import { useForm, useFieldArray, useWatch, Control } from 'react-hook-form';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { useUserProfile } from '@/hooks/useUserProfile';
import dynamic from 'next/dynamic';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadFonts } from '@/utils/pdf-generator';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="w-full h-64 bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center text-gray-400">Harita Yükleniyor...</div>
});

// --- Interfaces ---

interface Task {
    id: number;
    baslik: string;
    aciklama: string;
    durum: string;
    tarih_saat: string;
    islem_turu?: string;
    arac_id?: number;
    tur?: string;
    cikis_km?: number;
    donus_km?: number;
    created_at: string;
    arac?: { plaka: string; marka: string; model: string };
    personel?: { user_id: number; user: { ad_soyad: string; unvan?: string } }[];
    ilaclar?: { ilac_adi: string; miktar: number; birim: string }[];
    kaynaklar?: { kaynak_id: number; kaynak: Source }[];
}

interface Source {
    id: number;
    baslik: string;
    tur: string;
    lat: number;
    lng: number;
    ilce: string;
    kaynak_turu?: string;
    status?: 'active' | 'expiring' | 'expired' | 'new';
    last_action_date?: string;
}

interface Vehicle {
    id: number;
    plaka: string;
    marka: string;
    model: string;
    kilometre: number;
    ilce: string;
    durum?: string;
}

interface User {
    id: number;
    auth_id: string;
    ad_soyad: string;
    ilce: string;
    unvan?: string;
}

interface Chemical {
    ilac_adi: string;
    miktar: number;
    birim: string;
}

interface InventoryItem {
    id: number;
    urun_adi: string;
    birim: string;
    stok_miktari: number;
    etkili_gun_sayisi: number;
}

interface FormValues {
    tarih_saat: string;
    arac_id: string;
    cikis_km: number;
    donus_km: number;
    personel_ids: string[];
    tur: string;
    islem_turu: string;
    aciklama: string;
    durum: string;
    ilaclar: Chemical[];
    kaynak_ids: number[];
    skip_stock_update?: boolean;
}

const TASK_TYPES = [
    "Sivrisinek Kaynağı",
    "Sivrisinek Larva Uygulaması",
    "Karasinek Kaynağı",
    "Karasinek Uygulaması",
    "ULV Uygulaması",
    "Yeşil Alan Uygulaması",
    "Kapalı Alan Uygulaması",
    "Hamamböceği Uygulaması",
    "Rodentisit Uygulaması",
    "Kışlak Mücadele Uygulaması",
    "Drone Uygulaması(ha)"
];

const TASK_STATUSES = [
    { value: 'bekliyor', label: 'İşlem Bekler' },
    { value: 'devam_ediyor', label: 'Devam Ediyor' },
    { value: 'olumlu', label: 'Olumlu Sonuçlandı' },
    { value: 'olumsuz', label: 'Olumsuz Sonuçlandı' },
    { value: 'iptal', label: 'İptal' }
];

const ISLEM_TYPES = [
    'Arıza Bakım/Onarım',
    'Kaynak Tespiti',
    'İlaçlama Faaliyetleri',
    'Malzeme Tedarik',
    'Yakıt İkmali',
    'Resmi İş ve İşlemler'
];

export default function TasksPage() {
    const supabase = createClient();
    const { profile: currentUser, hasPermission } = useUserProfile();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
    const componentRef = useRef(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const { register, control, handleSubmit, reset, setValue, watch, getValues, formState: { errors } } = useForm<FormValues>({
        defaultValues: {
            tarih_saat: new Date().toISOString().slice(0, 16),
            ilaclar: [{ ilac_adi: '', miktar: 0, birim: 'Lt' }],
            islem_turu: '',
            durum: 'bekliyor',
            kaynak_ids: [],
            skip_stock_update: true
        }
    });

    const { fields: chemicalFields, append: appendChemical, remove: removeChemical } = useFieldArray({
        control,
        name: "ilaclar"
    });

    const selectedVehicleId = watch('arac_id');
    const selectedDate = watch('tarih_saat');
    const selectedIslemTuru = watch('islem_turu');
    const selectedTur = watch('tur');

    const fetchInventory = async () => {
        const targetIlce = currentUser?.ilce;
        const { data: mainProducts } = await supabase.from('depo_envanteri').select('*').order('urun_adi');
        if (!mainProducts) { setInventory([]); return; }

        if (targetIlce) {
            const { data: districtStocks } = await supabase.from('ilce_stoklari').select('*').eq('ilce', targetIlce);
            const merged = mainProducts.map(prod => {
                const ds = districtStocks?.find(d => d.urun_id === prod.id);
                return { ...prod, stok_miktari: ds ? ds.stok_miktari : 0 };
            });
            setInventory(merged);
        } else {
            setInventory(mainProducts);
        }
    };

    const fetchTasks = async () => {
        try {
            const { data, error } = await supabase.from('gorevler').select('*, arac:araclar(plaka, marka, model), personel:gorev_personel(user_id, user:users(ad_soyad, unvan)), ilaclar:gorev_ilaclar(ilac_adi, miktar, birim), kaynaklar:gorev_kaynaklar(kaynak_id, kaynak:kaynaklar(*))').order('id', { ascending: false });
            if (error) throw error;
            setTasks(data || []);
        } catch (error) { console.error('Error fetching tasks:', error); }
    };

    const fetchSourcesAndHistory = async () => {
        try {
            let query = supabase.from('kaynaklar').select('*');
            if (currentUser?.ilce) {
                const ilce = currentUser.ilce.trim();
                query = query.or(`ilce.eq.${ilce},ilce.eq.${ilce.toLowerCase()},ilce.eq.${ilce.toUpperCase()},ilce.eq."${ilce} ",ilce.eq." ${ilce}"`);
            }
            const { data: sourcesData } = await query;
            if (!sourcesData) return;

            const computedSources = sourcesData.map((source: Source) => {
                const sourceTasks = (tasks || []).filter((t: any) =>
                    (String(t.durum).toLowerCase() === 'olumlu' || String(t.durum) === 'Olumlu Sonuçlandı') &&
                    t.kaynaklar?.some((k: any) => String(k.kaynak_id) === String(source.id))
                );

                if (sourceTasks.length === 0) return { ...source, status: 'expired' as const, last_action_date: '-' };

                sourceTasks.sort((a, b) => new Date(b.tarih_saat).getTime() - new Date(a.tarih_saat).getTime());

                // Latest Action (regardless of medicine)
                const latestAction = sourceTasks[0];
                const formattedDate = new Date(latestAction.tarih_saat).toLocaleDateString('tr-TR');

                // Latest Treatment (must have medicine)
                const treatmentTasks = sourceTasks.filter(t => (t.ilaclar?.length || 0) > 0);
                const latestTreatment = treatmentTasks[0];

                let status: Source['status'] = 'expired';

                if (latestTreatment) {
                    let maxEffectiveDays = 0;
                    latestTreatment.ilaclar?.forEach((ilac: any) => {
                        const invItem = inventory.find(i => i.urun_adi === ilac.ilac_adi);
                        if (invItem && invItem.etkili_gun_sayisi > maxEffectiveDays) maxEffectiveDays = invItem.etkili_gun_sayisi;
                    });
                    if (maxEffectiveDays === 0) maxEffectiveDays = 7;

                    const taskDate = new Date(latestTreatment.tarih_saat);
                    const expiryDate = new Date(taskDate);
                    expiryDate.setDate(taskDate.getDate() + maxEffectiveDays);
                    const diffDays = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) status = 'expired';
                    else if (diffDays <= 3) status = 'expiring';
                    else status = 'active';
                }

                return { ...source, status, last_action_date: formattedDate };
            });
            setSources(computedSources);
        } catch (error) {
            console.error('Error fetching sources:', error);
        }
    };

    const initData = async () => {
        setLoading(true);
        try {
            let vQuery = supabase.from('araclar').select('*');
            let uQuery = supabase.from('users').select('*');
            if (currentUser?.ilce) {
                vQuery = vQuery.eq('ilce', currentUser.ilce);
                uQuery = uQuery.eq('ilce', currentUser.ilce);
            }
            const [{ data: vData }, { data: uData }] = await Promise.all([vQuery, uQuery]);
            setVehicles((vData || []).filter(v => !v.durum || v.durum === 'aktif'));
            setAllUsers(uData || []);
            await fetchTasks();
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };


    useEffect(() => {
        if (currentUser) {
            initData();
            fetchInventory();
        }
    }, [currentUser]);

    useEffect(() => {
        if (!loading && currentUser) {
            fetchSourcesAndHistory();
        }
    }, [tasks, inventory, loading, currentUser]);

    // Real-time subscription for kaynaklar table
    useEffect(() => {
        if (!currentUser?.ilce) return;

        const channel = supabase
            .channel('kaynaklar-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'kaynaklar',
                    filter: `ilce=eq.${currentUser.ilce}`
                },
                () => {
                    fetchSourcesAndHistory();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.ilce]);

    useEffect(() => {
        if (!editingTaskId && selectedVehicleId && vehicles.length > 0) {
            const v = vehicles.find(veh => veh.id.toString() === selectedVehicleId);
            if (v) setValue('cikis_km', v.kilometre);
        }
    }, [selectedVehicleId, vehicles, setValue, editingTaskId]);

    useEffect(() => {
        const updatePersonnel = async () => {
            if (!selectedDate || allUsers.length === 0) return;
            const dateStr = new Date(selectedDate).toISOString().split('T')[0];
            const { data: att } = await supabase.from('yoklama').select('user_id').eq('tarih', dateStr).eq('durum', 'mesai');
            const presentIds = (att || []).map(a => a.user_id);
            setUsers(allUsers.filter(u => presentIds.includes(u.id)));
        };
        updatePersonnel();
    }, [selectedDate, allUsers]);

    const handleEdit = (task: Task) => {
        setEditingTaskId(task.id);
        setIsAdding(true);
        setValue('tarih_saat', new Date(task.tarih_saat).toISOString().slice(0, 16));
        setValue('tur', task.tur || '');
        setValue('islem_turu', task.islem_turu || '');
        setValue('aciklama', task.aciklama || '');
        setValue('durum', task.durum || 'bekliyor');
        setValue('arac_id', task.arac_id?.toString() || '');
        setValue('cikis_km', task.cikis_km || 0);
        setValue('donus_km', task.donus_km || 0);
        if (task.ilaclar) setValue('ilaclar', task.ilaclar.map(i => ({ ilac_adi: i.ilac_adi, miktar: i.miktar, birim: i.birim })));
        if (task.personel) setValue('personel_ids', task.personel.map(p => p.user_id.toString()));
        if (task.kaynaklar) {
            const sIds = task.kaynaklar.map(k => k.kaynak_id);
            setSelectedSourceIds(sIds);
            setValue('kaynak_ids', sIds);
        } else {
            setSelectedSourceIds([]);
            setValue('kaynak_ids', []);
        }
    };

    const toggleSourceSelection = (id: number) => {
        const next = selectedSourceIds.includes(id) ? selectedSourceIds.filter(x => x !== id) : [...selectedSourceIds, id];
        setSelectedSourceIds(next);
        setValue('kaynak_ids', next);
    };

    const onSubmit = async (data: FormValues) => {
        try {
            const pIdsRaw = data.personel_ids || [];
            const pIds = Array.isArray(pIdsRaw) ? pIdsRaw : [pIdsRaw];
            if (pIds.length === 0 || (pIds.length === 1 && !pIds[0])) { alert('Lütfen personel seçiniz.'); return; }

            const payload = {
                baslik: data.tur, aciklama: data.aciklama, durum: data.durum, tarih_saat: data.tarih_saat,
                arac_id: data.arac_id ? parseInt(data.arac_id) : null, tur: data.tur, islem_turu: data.islem_turu,
                cikis_km: data.cikis_km || 0, donus_km: data.donus_km || 0
            };

            let taskId = editingTaskId;
            if (editingTaskId) {
                await supabase.from('gorevler').update(payload).eq('id', editingTaskId);
                await Promise.all([
                    supabase.from('gorev_personel').delete().eq('gorev_id', editingTaskId),
                    supabase.from('gorev_ilaclar').delete().eq('gorev_id', editingTaskId),
                    supabase.from('gorev_kaynaklar').delete().eq('gorev_id', editingTaskId)
                ]);
            } else {
                const { data: res } = await supabase.from('gorevler').insert([payload]).select().single();
                taskId = res.id;
            }

            if (taskId) {
                const pInserts = pIds.map(uid => ({ gorev_id: taskId, user_id: parseInt(uid) }));
                await supabase.from('gorev_personel').insert(pInserts);

                const validIlaclar = data.ilaclar.filter(i => i.ilac_adi && i.miktar > 0);
                if (validIlaclar.length > 0) {
                    const iInserts = validIlaclar.map(i => ({ gorev_id: taskId, ilac_adi: i.ilac_adi, miktar: i.miktar, birim: i.birim }));
                    await supabase.from('gorev_ilaclar').insert(iInserts);

                    if (!data.skip_stock_update) {
                        for (const ilac of validIlaclar) {
                            const invItem = inventory.find(i => i.urun_adi === ilac.ilac_adi);
                            if (invItem && currentUser?.ilce) {
                                const newStock = invItem.stok_miktari - ilac.miktar;
                                await supabase.from('ilce_stoklari').update({ stok_miktari: newStock }).eq('urun_id', invItem.id).eq('ilce', currentUser.ilce);
                                await supabase.from('stok_hareketleri').insert([{ urun_id: invItem.id, islem_turu: 'CIKIS', miktar: ilac.miktar, ilce: currentUser.ilce, teslim_alan_id: currentUser?.id, teslim_eden_id: 'Sistem', aciklama: `Görev: ${taskId}` }]);
                            }
                        }
                    }
                }

                if (selectedSourceIds.length > 0) {
                    const sInserts = selectedSourceIds.map(sid => ({ gorev_id: taskId, kaynak_id: sid }));
                    await supabase.from('gorev_kaynaklar').insert(sInserts);
                }
            }

            if (data.donus_km > 0 && data.arac_id) {
                await supabase.from('araclar').update({ kilometre: data.donus_km }).eq('id', parseInt(data.arac_id));
            }

            await fetchTasks();
            setIsAdding(false); setEditingTaskId(null); reset(); setSelectedSourceIds([]);
            alert('Başarıyla kaydedildi.');
        } catch (err: any) { alert(err.message); }
    };

    const generateTaskPDF = async () => {
        const doc = new jsPDF();
        await loadFonts(doc);
        doc.setFont('Roboto', 'normal');
        doc.text("Görev Detay Formu", 14, 20);
        const form = getValues();
        const vehicle = vehicles.find(v => v.id.toString() === form.arac_id);
        const selS = sources.filter(s => selectedSourceIds.includes(s.id));
        const chems = form.ilaclar?.filter(i => i.ilac_adi).map(i => `${i.ilac_adi} (${i.miktar}${i.birim})`).join(', ');

        autoTable(doc, {
            startY: 40,
            body: [
                ['Tarih', new Date(form.tarih_saat).toLocaleString('tr-TR')],
                ['Uygulama', form.tur],
                ['Araç', vehicle ? vehicle.plaka : '-'],
                ['KM', `${form.cikis_km} / ${form.donus_km}`],
                ['Durum', TASK_STATUSES.find(s => s.value === form.durum)?.label || form.durum],
                ['İlaçlar', chems || '-'],
                ['Kaynaklar', selS.map(s => s.baslik).join(', ') || '-'],
                ['Açıklama', form.aciklama || '-']
            ],
            styles: { font: 'Roboto' }
        });
        doc.save(`gorev-${editingTaskId || 'yeni'}.pdf`);
    };

    const handleListPrint = useReactToPrint({ contentRef: componentRef, documentTitle: 'Görev Listesi' });
    const handlePrint = () => isAdding ? generateTaskPDF() : handleListPrint();

    const sortedTasks = useMemo(() => {
        if (!sortConfig) return tasks;
        return [...tasks].sort((a, b) => {
            const valA = a[sortConfig.key as keyof Task] || '';
            const valB = b[sortConfig.key as keyof Task] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [tasks, sortConfig]);

    const getStatusBadge = (s: string) => {
        const map: Record<string, { label: string; color: string }> = {
            'olumlu': { label: 'Olumlu', color: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm' },
            'olumsuz': { label: 'Olumsuz', color: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm' },
            'devam': { label: 'Devam Ediyor', color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm' },
            'iptal': { label: 'İptal', color: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-sm' }
        };
        const st = map[s] || { label: s, color: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-sm' };
        return <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${st.color}`}>{st.label}</span>;
    };

    const filteredSources = useMemo(() => {
        return sources.filter(s => {
            if (selectedSourceIds.includes(s.id)) return true;
            if (!selectedTur) return true;

            const pinTur = (s.tur || '').toLowerCase();
            const selectedTurLower = selectedTur.toLowerCase();

            // Permissive matching: exact match OR one contains the other
            return pinTur === selectedTurLower ||
                pinTur.includes(selectedTurLower) ||
                selectedTurLower.includes(pinTur);
        });
    }, [sources, selectedSourceIds, selectedTur]);

    const mapLocations = useMemo(() => filteredSources.map(s => ({
        ...s, title: s.baslik + (s.last_action_date !== '-' ? ` (${s.last_action_date})` : ''), type: s.tur
    })), [filteredSources]);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between no-print">
                <h2 className="text-xl font-bold text-gray-900">Görev Takibi <span className="text-sm font-normal text-gray-500 ml-2">({currentUser?.ilce || 'Bölge Belirtilmedi'})</span></h2>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm"><Printer className="w-4 h-4" /> Yazdır</button>
                    {(isAdding || hasPermission('tasks:create')) && (
                        <button onClick={() => { setIsAdding(!isAdding); setEditingTaskId(null); reset(); setSelectedSourceIds([]); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
                            {isAdding ? 'İptal' : <><Plus className="w-4 h-4" /> Yeni Görev</>}
                        </button>
                    )}
                </div>
            </div>

            {isAdding && (
                <div className="bg-white rounded-xl shadow-2xl border border-indigo-100 animate-in slide-in-from-top-4 relative z-10 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-600 px-6 py-4">
                        <h3 className="text-xl font-bold text-white">{editingTaskId ? '📝 Görev Detayları & Güncelleme' : '📋 Yeni Görev Kaydı'}</h3>
                        <p className="text-gray-200 text-sm mt-1">Görev detaylarını eksiksiz doldurun</p>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="mb-4">
                                <h4 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wide">📅 Genel Bilgiler</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarih - Saat</label>
                                    <input type="datetime-local" {...register('tarih_saat', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">İşlem</label>
                                    <select {...register('islem_turu', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                                        <option value="">Seçiniz</option>
                                        {ISLEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Uygulama</label>
                                    <select {...register('tur', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                                        <option value="">Seçiniz</option>
                                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {selectedIslemTuru === 'İlaçlama Faaliyetleri' && (
                                <>
                                    <div className="mb-4 mt-6 flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">🗺️ Saha ve Uygulama</h4>
                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                                            {selectedSourceIds.length} Kaynak Seçildi
                                        </span>
                                    </div>
                                    <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-96">
                                            <div className="md:col-span-2 rounded-xl overflow-hidden border border-gray-200">
                                                <Map locations={mapLocations} onMarkerClick={(loc) => toggleSourceSelection(Number(loc.id))} selectedIds={selectedSourceIds} />
                                            </div>
                                            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                                                <div className="p-2 bg-gray-50 border-b text-xs font-bold text-gray-600">Kaynak Listesi ({filteredSources.length})</div>
                                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                    {filteredSources.length === 0 ? (
                                                        <div className="text-[10px] text-gray-400 text-center py-4 italic">
                                                            {selectedTur ? `${selectedTur} türünde kayıt bulunamadı.` : 'Bu bölgede henüz kaynak kaydı yok.'}
                                                        </div>
                                                    ) : filteredSources.map(s => {
                                                        const sel = selectedSourceIds.includes(s.id);
                                                        const isActive = s.status === 'active';

                                                        let color = "bg-red-50 text-red-700 border-red-200";
                                                        if (sel) color = "bg-green-600 text-white border-green-700 shadow-md transform scale-[1.02]";
                                                        else if (isActive) color = "bg-gray-50 text-gray-500 border-gray-200 opacity-70";
                                                        else if (s.status === 'expiring') color = "bg-orange-50 text-orange-700 border-orange-200";

                                                        return (
                                                            <div
                                                                key={s.id}
                                                                onClick={() => toggleSourceSelection(s.id)}
                                                                className={`p-2 rounded-lg text-[11px] border cursor-pointer transition-all flex items-center justify-between group ${color}`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <div className="font-bold flex items-center gap-1">
                                                                        {s.baslik}
                                                                        {isActive && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                                                    </div>
                                                                    <div className="opacity-80 italic">
                                                                        {isActive ? `Uygulandı: ${s.last_action_date}` : (sel ? 'Seçildi' : `Son: ${s.last_action_date}`)}
                                                                    </div>
                                                                </div>
                                                                {sel && <div className="text-[10px] font-bold">✓</div>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="mb-4 mt-6">
                                <h4 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wide">🚗 Araç ve Personel</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Araç</label>
                                    <select {...register('arac_id')} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white">
                                        <option value="">Seçiniz</option>
                                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plaka}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 font-mono">Çıkış KM</label>
                                    <input type="number" {...register('cikis_km')} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 font-mono">Dönüş KM</label>
                                    <input type="number" {...register('donus_km')} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-mono" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Personel</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {users.map(u => (
                                        <label key={u.id} className="flex flex-col gap-1 p-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-indigo-50">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" value={u.id} {...register('personel_ids')} className="rounded text-indigo-600" />
                                                <span className="text-xs font-medium">{u.ad_soyad}</span>
                                            </div>
                                            {u.unvan && (
                                                <span className="ml-5 px-1.5 py-0.5 text-[9px] font-medium rounded border border-gray-200 bg-white text-gray-600 w-fit">
                                                    {u.unvan === 'mudur' ? 'Müdür' :
                                                        u.unvan === 'sef' ? 'Şef' :
                                                            u.unvan === 'bolge_sorumlusu' ? 'Bölge Sorumlusu' :
                                                                u.unvan === 'ekipbasi' ? 'Ekipbaşı' :
                                                                    u.unvan === 'beden_iscisi' ? 'Beden İşçisi' :
                                                                        u.unvan}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-4 mt-6">
                                <h4 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wide">💊 İlaç ve Malzeme</h4>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                                {chemicalFields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-end">
                                        <select {...register(`ilaclar.${index}.ilac_adi` as const)} className="flex-1 px-2 py-1.5 border border-orange-200 rounded text-xs bg-white">
                                            <option value="">İlaç Seçiniz</option>
                                            {inventory.map(i => <option key={i.id} value={i.urun_adi}>{i.urun_adi} ({i.stok_miktari}{i.birim})</option>)}
                                        </select>
                                        <input type="number" step="0.1" placeholder="Miktar" {...register(`ilaclar.${index}.miktar` as const)} className="w-20 px-2 py-1.5 border border-orange-200 rounded text-xs" />
                                        <button type="button" onClick={() => removeChemical(index)} className="p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => appendChemical({ ilac_adi: '', miktar: 0, birim: 'Lt' })} className="text-xs text-orange-700 font-bold flex items-center gap-1">+ İlaç Ekle</button>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer border-t pt-2 border-orange-200">
                                    <input type="checkbox" {...register('skip_stock_update')} className="w-4 h-4 rounded text-orange-600" />
                                    <span className="text-xs text-orange-800 font-medium">Stoktan düşme</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                                <textarea {...register('aciklama')} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <select {...register('durum')} className="px-3 py-2 border rounded-lg text-sm font-bold bg-gray-50 text-indigo-900 border-indigo-200">
                                    {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                {(editingTaskId ? hasPermission('tasks:manage') : hasPermission('tasks:create')) && (
                                    <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all">
                                        {editingTaskId ? 'GÜNCELLE' : 'KAYDET'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" ref={componentRef}>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-600 font-bold uppercase border-b">
                            <tr>
                                <th className="px-4 py-3">Tarih</th>
                                <th className="px-4 py-3">Uygulama</th>
                                <th className="px-4 py-3">Araç</th>
                                <th className="px-4 py-3">KM Bilgisi</th>
                                <th className="px-4 py-3">Personel</th>
                                <th className="px-4 py-3">İlaçlar</th>
                                <th className="px-4 py-3">Durum</th>
                                <th className="px-4 py-3 no-print">Eylem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sortedTasks.map(t => {
                                const kmDiff = (t.donus_km || 0) - (t.cikis_km || 0);
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{new Date(t.tarih_saat).toLocaleString('tr-TR')}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-indigo-800">{t.tur}</div>
                                            <div className="text-[10px] text-gray-400">{t.islem_turu}</div>
                                            {(t.kaynaklar?.length || 0) > 0 && (
                                                <div className="text-[10px] text-red-600 mt-0.5">{t.kaynaklar?.length} Kaynak</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-bold">{t.arac?.plaka || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 border border-blue-200">Ç: {t.cikis_km || 0}</span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-green-100 text-green-800 border border-green-200">D: {t.donus_km || 0}</span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800 border border-purple-200">F: {kmDiff}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-1">
                                                {t.personel?.slice(0, 3).map((p, idx) => (
                                                    <div key={idx} className="text-xs text-gray-700">{p.user?.ad_soyad}</div>
                                                ))}
                                                {(t.personel?.length || 0) > 3 && (
                                                    <div className="text-[10px] text-gray-400 italic">+{(t.personel?.length || 0) - 3} diğer</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{t.ilaclar?.map((i, idx) => <div key={idx} className="text-xs font-mono">{i.ilac_adi} ({i.miktar}{i.birim})</div>)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(t.durum)}</td>
                                        <td className="px-4 py-3 no-print"><button onClick={() => handleEdit(t)} className="text-indigo-600 font-bold hover:underline">DETAY</button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <style jsx global>{` @media print { .no-print { display: none !important; } .print-block { display: block !important; } } `}</style>
        </div>
    );
}
