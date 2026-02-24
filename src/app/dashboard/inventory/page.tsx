'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { Beaker, Search, Edit2, Trash2, Plus, X, AlertOctagon, MinusCircle, Printer, History, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';
import { generateDeliveryReport, generateInventoryReport, generateHistoryReport } from '@/utils/pdf-generator';
import { useUserProfile } from '@/hooks/useUserProfile';

const DISTRICTS = [
    'Altıeylül', 'Ayvalık', 'Balya', 'Bandırma', 'Bigadiç',
    'Burhaniye', 'Dursunbey', 'Edremit', 'Erdek', 'Gömeç',
    'Gönen', 'Havran', 'İvrindi', 'Karesi', 'Kepsut',
    'Manyas', 'Marmara', 'Savaştepe', 'Sındırgı', 'Susurluk'
];

interface InventoryItem {
    id: number;
    urun_adi: string;
    stok_miktari: number;
    birim: string;
    kritik_limit: number;
    etkili_gun_sayisi: number;
    aciklama: string;
    created_at: string;
    [key: string]: any; // Allow indexing for sort
}

interface User {
    id: number;
    ad_soyad: string;
    unvan: string;
    ilce?: string;
}

interface StockHistory {
    id: number;
    urun_id: number;
    islem_turu: string;
    miktar: number;
    ilce: string;
    teslim_alan_id: number;
    teslim_eden_id: string;
    aciklama: string;
    created_at: string;
    urun: { urun_adi: string; birim: string }; // Join
    teslim_alan: { ad_soyad: string }; // Join
    [key: string]: any;
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

export default function InventoryPage() {
    const supabase = createClient();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [history, setHistory] = useState<StockHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeUsers, setActiveUsers] = useState<User[]>([]);
    const { profile: currentUser, hasPermission } = useUserProfile();

    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [historySortConfig, setHistorySortConfig] = useState<SortConfig>(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false); // For Create/Edit
    const [isOutputModalOpen, setIsOutputModalOpen] = useState(false); // For Product Output

    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Form for Create/Edit
    const { register, handleSubmit, reset: resetCreate, setValue } = useForm({
        defaultValues: {
            urun_adi: '',
            stok_miktari: 0,
            birim: 'adet',
            kritik_limit: 10,
            etkili_gun_sayisi: 0,
            aciklama: ''
        }
    });

    // Form for Output
    interface OutputFormData {
        products: { product_id: string; amount: number }[];
        output_description: string;
        ilce: string;
        teslim_alan: string;
        teslim_eden: string;
    }

    const {
        register: registerOutput,
        handleSubmit: handleSubmitOutput,
        reset: resetOutput,
        setValue: setValueOutput,
        control: controlOutput
    } = useForm<OutputFormData>({
        defaultValues: {
            products: [{ product_id: '', amount: 0 }],
            output_description: '',
            ilce: '',
            teslim_alan: '',
            teslim_eden: ''
        }
    });

    const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
        control: controlOutput,
        name: "products"
    });

    const selectedIlce = useWatch({ control: controlOutput, name: 'ilce' }); // Inserted correctly

    useEffect(() => {
        fetchItems();
        fetchHistory();
        fetchActiveUsers();
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('depo_envanteri')
                .select('*')
                .order('urun_adi', { ascending: true });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('stok_hareketleri')
                .select(`
                    *,
                    urun:urun_id (urun_adi, birim),
                    teslim_alan:teslim_alan_id (ad_soyad)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const fetchActiveUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, ad_soyad, unvan, ilce') // Added 'ilce'
                .eq('durum', 'aktif')
                .order('ad_soyad');

            if (error) throw error;
            setActiveUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };



    const handleSort = (key: string, listType: 'items' | 'history') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (listType === 'items') {
            if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
                direction = 'desc';
            }
            setSortConfig({ key, direction });
        } else {
            if (historySortConfig && historySortConfig.key === key && historySortConfig.direction === 'asc') {
                direction = 'desc';
            }
            setHistorySortConfig({ key, direction });
        }
    };

    const getSortedItems = () => {
        let sorted = [...items];
        if (sortConfig) {
            sorted.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sorted.filter(item =>
            item.urun_adi.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const getSortedHistory = () => {
        let sorted = [...history];

        // Filter by District if user is restricted
        if (currentUser?.ilce) {
            sorted = sorted.filter(h => h.ilce === currentUser.ilce);
        }

        if (historySortConfig) {
            sorted.sort((a, b) => {
                // Handle nested keys manually if needed, or flatten structure
                let valA = a[historySortConfig.key];
                let valB = b[historySortConfig.key];

                // Specific handling for nested objects
                if (historySortConfig.key === 'urun') {
                    valA = a.urun?.urun_adi;
                    valB = b.urun?.urun_adi;
                } else if (historySortConfig.key === 'teslim_alan') {
                    valA = a.teslim_alan?.ad_soyad;
                    valB = b.teslim_alan?.ad_soyad;
                }

                if (valA < valB) return historySortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return historySortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sorted;
    };


    const onSubmit = async (data: any) => {
        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('depo_envanteri')
                    .update(data)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('depo_envanteri')
                    .insert([data]);
                if (error) throw error;
            }
            fetchItems();
            closeModal();
        } catch (error: any) {
            alert('Hata: ' + error.message);
        }
    };

    const processOutput = async (data: OutputFormData, shouldPrint: boolean) => {
        try {
            if (!data.products || data.products.length === 0) return alert('En az bir ürün seçmelisiniz.');
            if (!data.ilce) return alert('Lütfen ilçe seçiniz.');
            if (!data.teslim_alan) return alert('Lütfen teslim alan kişiyi seçiniz.');

            const processedProducts: any[] = [];

            // 1. Validation & Processing Loop
            for (const pItem of data.products) {
                if (!pItem.product_id) continue;
                const product = items.find(i => i.id.toString() === pItem.product_id);
                if (!product) continue;

                const amount = parseFloat(pItem.amount.toString());
                if (amount <= 0) return alert(`${product.urun_adi} için çıkış miktarı 0'dan büyük olmalıdır.`);
                if (amount > product.stok_miktari) return alert(`${product.urun_adi} için yetersiz stok! Mevcut: ${product.stok_miktari} ${product.birim}`);

                processedProducts.push({ product, amount });
            }

            if (processedProducts.length === 0) return alert('Geçerli ürün seçilmedi.');

            // 2. Execution Loop
            for (const item of processedProducts) {
                const { product, amount } = item;
                const newStock = product.stok_miktari - amount;

                // 2.1 Update Main Stock
                const { error: stockError } = await supabase
                    .from('depo_envanteri')
                    .update({ stok_miktari: newStock })
                    .eq('id', product.id);

                if (stockError) throw stockError;

                // 2.2 Transfer/Increase District Stock
                const { data: existingDistrictStock } = await supabase
                    .from('ilce_stoklari')
                    .select('stok_miktari')
                    .eq('urun_id', product.id)
                    .eq('ilce', data.ilce)
                    .single();

                const currentDistrictStock = existingDistrictStock ? existingDistrictStock.stok_miktari : 0;
                const newDistrictStock = currentDistrictStock + amount;

                const { error: districtError } = await supabase
                    .from('ilce_stoklari')
                    .upsert({
                        urun_id: product.id,
                        ilce: data.ilce,
                        stok_miktari: newDistrictStock
                    }, { onConflict: 'urun_id, ilce' });

                if (districtError) {
                    console.error("District stock update failed", districtError);
                }

                // 2.3 Record Transaction
                const { error: historyError } = await supabase
                    .from('stok_hareketleri')
                    .insert([{
                        urun_id: product.id,
                        islem_turu: 'CIKIS',
                        miktar: amount,
                        ilce: data.ilce,
                        teslim_alan_id: parseInt(data.teslim_alan),
                        teslim_eden_id: currentUser?.ad_soyad || 'Sistem',
                        aciklama: data.output_description
                    }]);

                if (historyError) console.error("History record failed", historyError);
            }

            alert(`Stok çıkışı ve transferi başarıyla tamamlandı. (${processedProducts.length} kalem)`);

            if (shouldPrint) {
                const receiver = activeUsers.find(u => u.id.toString() === data.teslim_alan);

                // Map processed products to report format
                const reportItems = processedProducts.map(p => ({
                    productName: p.product.urun_adi,
                    amount: p.amount,
                    unit: p.product.birim
                }));

                generateDeliveryReport({
                    deliveryDate: new Date().toLocaleDateString('tr-TR'),
                    district: data.ilce,
                    items: reportItems, // New Array structure
                    receiverName: receiver ? receiver.ad_soyad : 'Bilinmiyor',
                    delivererName: currentUser?.ad_soyad || 'Sistem',
                    description: data.output_description
                });
            }

            fetchItems();
            fetchHistory();
            closeOutputModal();

        } catch (error: any) {
            alert('Hata: ' + error.message);
        }
    }


    const handleDelete = async (id: number) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('depo_envanteri').delete().eq('id', id);
            if (error) throw error;
            fetchItems();
        } catch (error: any) {
            alert('Hata: ' + error.message);
        }
    };

    const openModal = (item?: InventoryItem) => {
        if (item) {
            setEditingItem(item);
            setValue('urun_adi', item.urun_adi);
            setValue('stok_miktari', item.stok_miktari);
            setValue('birim', item.birim);
            setValue('kritik_limit', item.kritik_limit);
            setValue('etkili_gun_sayisi', item.etkili_gun_sayisi);
            setValue('aciklama', item.aciklama || '');
        } else {
            setEditingItem(null);
            resetCreate({
                urun_adi: '',
                stok_miktari: 0,
                birim: 'adet',
                kritik_limit: 10,
                etkili_gun_sayisi: 0,
                aciklama: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        resetCreate();
    };

    const openOutputModal = () => {
        resetOutput({
            products: [{ product_id: '', amount: 0 }],
            output_description: '',
            ilce: '',
            teslim_alan: '',
            teslim_eden: ''
        });
        if (currentUser) {
            setValueOutput('teslim_eden', currentUser.ad_soyad);
            // Robust Architecture: Auto-select District
            if (currentUser.ilce && DISTRICTS.includes(currentUser.ilce)) {
                setValueOutput('ilce', currentUser.ilce);
            }
        }
        setIsOutputModalOpen(true);
    };

    const closeOutputModal = () => {
        setIsOutputModalOpen(false);
        resetOutput();
    };

    const sortedItems = getSortedItems();
    const sortedHistory = getSortedHistory();

    const SortIcon = () => <ArrowUpDown className="w-3 h-3 ml-1 inline text-gray-400" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Beaker className="w-8 h-8 text-indigo-600" />
                        Depo Envanteri
                    </h1>
                    <p className="text-gray-500 mt-1">Stok takibi ve ürün yönetimi</p>
                </div>
                <div className="flex gap-2">
                    {hasPermission('inventory:output') && (
                        <button
                            onClick={openOutputModal}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                        >
                            <MinusCircle className="w-4 h-4" />
                            Ürün Çıkışı
                        </button>
                    )}
                    {hasPermission('inventory:manage') && (
                        <button
                            onClick={() => openModal()}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Yeni Ürün Ekle
                        </button>
                    )}
                </div>
            </div>

            {/* List Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Beaker className="w-5 h-5 text-gray-400" />
                        Depo Envanteri <span className="text-gray-400 font-normal">({items.length})</span>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder="Ürün Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                        <button
                            onClick={() => generateInventoryReport(sortedItems)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium"
                        >
                            <Printer className="w-4 h-4" />
                            Yazdır
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-medium border-b border-gray-100 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-semibold w-16">SIRA NO</th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('urun_adi', 'items')}>
                                    ÜRÜN ADI <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('stok_miktari', 'items')}>
                                    STOK <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold">BİRİM</th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('kritik_limit', 'items')}>
                                    KRİTİK LİMİT <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('etkili_gun_sayisi', 'items')}>
                                    ETKİLİ GÜN <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold text-right">İŞLEM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sortedItems.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.urun_adi}</td>
                                    <td className="px-6 py-4">
                                        <span className={clsx(
                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                            item.stok_miktari <= item.kritik_limit
                                                ? "bg-red-100 text-red-800"
                                                : "bg-green-100 text-green-800"
                                        )}>
                                            {item.stok_miktari}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{item.birim}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.kritik_limit}</td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">{item.etkili_gun_sayisi > 0 ? `${item.etkili_gun_sayisi} Gün` : '-'}</td>
                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                        {hasPermission('inventory:manage') && (
                                            <>
                                                <button
                                                    onClick={() => openModal(item)}
                                                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-xs font-medium transition-colors"
                                                >
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-xs font-medium transition-colors"
                                                >
                                                    Sil
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {sortedItems.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-700 font-semibold">
                        <History className="w-5 h-5 text-gray-400" />
                        Stok Hareket Geçmişi
                    </div>
                    <button
                        onClick={() => generateHistoryReport(sortedHistory)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Yazdır
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-medium border-b border-gray-100 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('created_at', 'history')}>
                                    TARİH <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('urun', 'history')}>
                                    ÜRÜN <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold">İŞLEM</th>
                                <th className="px-6 py-4 font-semibold">MİKTAR</th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('ilce', 'history')}>
                                    İLÇE <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('teslim_alan', 'history')}>
                                    TESLİM ALAN <SortIcon />
                                </th>
                                <th className="px-6 py-4 font-semibold">TESLİM EDEN</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sortedHistory.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-600">
                                        {new Date(record.created_at).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {record.urun?.urun_adi}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.islem_turu === 'CIKIS' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                            {record.islem_turu}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-medium">
                                        {record.miktar} {record.urun?.birim}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {record.ilce || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {record.teslim_alan?.ad_soyad || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {record.teslim_eden_id || '-'}
                                    </td>
                                </tr>
                            ))}
                            {sortedHistory.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-400">
                                        Henüz işlem yapılmamış.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-semibold text-gray-900">
                                {editingItem ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Adı</label>
                                <input {...register('urun_adi', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Örn: CYPERTOKS 55 EC" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok Miktarı</label>
                                    <input type="number" step="0.01" {...register('stok_miktari', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                                    <select {...register('birim', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white">
                                        <option value="adet">adet</option>
                                        <option value="Lt">Lt</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Kutu">Kutu</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kritik Limit</label>
                                    <input type="number" step="0.01" {...register('kritik_limit')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Etkili Gün Sayısı</label>
                                    <input type="number" {...register('etkili_gun_sayisi')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                                <textarea {...register('aciklama')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Ürün hakkında notlar..." />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Output Modal */}
            {isOutputModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <MinusCircle className="w-5 h-5 text-orange-600" />
                                Ürün Çıkışı / Stok Düş
                            </h3>
                            <button onClick={closeOutputModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form className="p-6 space-y-4">
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                <label className="block text-sm font-medium text-gray-700">Ürünler</label>
                                {productFields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-start">
                                        <div className="flex-1">
                                            <select
                                                {...registerOutput(`products.${index}.product_id` as const, { required: true })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                            >
                                                <option value="">Seçiniz</option>
                                                {items.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.urun_adi} ({item.stok_miktari} {item.birim})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="Miktar"
                                                {...registerOutput(`products.${index}.amount` as const, { required: true })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeProduct(index)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Çıkar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => appendProduct({ product_id: '', amount: 0 })}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                >
                                    <Plus className="w-4 h-4" />
                                    Başka Ürün Ekle
                                </button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İlçe</label>
                                <select
                                    {...registerOutput('ilce', { required: true })}
                                    disabled={!!currentUser?.ilce}
                                    className={clsx("w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white", { "bg-gray-100 cursor-not-allowed": !!currentUser?.ilce })}
                                >
                                    <option value="">İlçe Seçiniz</option>
                                    {DISTRICTS.filter(d => !currentUser?.ilce || d === currentUser.ilce).map(dist => (
                                        <option key={dist} value={dist}>{dist}</option>
                                    ))}
                                </select>
                            </div>


                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Alan</label>
                                    <select {...registerOutput('teslim_alan', { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white">
                                        <option value="">Personel Seçiniz</option>
                                        {activeUsers
                                            .filter(u => {
                                                // 1. If a district is selected (or forced by user profile), filter by it.
                                                // If no district is selected yet and user is admin, they might see everyone or none. 
                                                // Usually better to wait for selection.
                                                if (selectedIlce && u.ilce !== selectedIlce) return false;

                                                // 2. Exclude the sender (current user)
                                                if (currentUser && u.id === currentUser.id) return false;

                                                return true;
                                            })
                                            .map(user => (
                                                <option key={user.id} value={user.id}>{user.ad_soyad} ({user.unvan})</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Eden</label>
                                    <input
                                        type="text"
                                        readOnly
                                        {...registerOutput('teslim_eden')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama / Sebep</label>
                                <textarea {...registerOutput('output_description')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Çıkış nedeni..." />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSubmitOutput((data) => processOutput(data as OutputFormData, false))}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium shadow-sm transition-colors"
                                >
                                    Sadece Stok Düş
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitOutput((data) => processOutput(data as OutputFormData, true))}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium shadow-sm transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    Stok Düş ve Tutanak Yazdır
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    );
}
