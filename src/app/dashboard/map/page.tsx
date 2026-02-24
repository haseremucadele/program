'use client';

import dynamic from 'next/dynamic';
import { Flame, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center text-gray-400">Harita Yükleniyor...</div>
});

// ... (keep interfaces as they are not shown here but the replacement chunk must match exactly)
// Actually I need to match the block around lines 5-6 and then insert supabase inside the function.
// The file has imports at top.



interface Source {
    id: number;
    baslik: string;
    tur: string; // Application Type
    kaynak_turu?: string; // Physical Source Type
    lat: number;
    lng: number;
    ilce: string;
    status?: 'active' | 'expiring' | 'expired' | 'new';
    last_action_date?: string;
}



const BALIKESIR_ILCELERI = [
    "Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye",
    "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran",
    "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe",
    "Sındırgı", "Susurluk"
];

const SOURCE_TYPES = [
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

const PHYSICAL_SOURCE_TYPES = [
    "Dere Yatağı",
    "Foseptik",
    "Rögar",
    "Çöp Konteyneri",
    "Durgun Su",
    "Pazar Yeri",
    "Park/Bahçe",
    "Hayvan Barınağı",
    "Diğer"
];

// Combine types logic or keep separate? 
// SOURCE_TYPES above is technically 'Islem/Uygulama Turu' as per user request.

export default function MapPage() {
    const supabase = createClient();
    const { profile: currentUser, loading: userLoading, hasPermission } = useUserProfile();
    const [locations, setLocations] = useState<Source[]>([]);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [loading, setLoading] = useState(true);

    // Source Creation State
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [newSourceCoords, setNewSourceCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [newSourceAppType, setNewSourceAppType] = useState(''); // Was newSourceType
    const [newSourcePhysType, setNewSourcePhysType] = useState(''); // New
    const [selectedIlce, setSelectedIlce] = useState('');

    useEffect(() => {
        if (userLoading) return;
        fetchSourcesAndAttributes(currentUser?.ilce);
    }, [currentUser, userLoading]);

    const fetchSourcesAndAttributes = async (userIlce?: string, includeId?: number) => {
        setLoading(true);

        try {
            let sourceQuery = supabase.from('kaynaklar').select('*');

            if (userIlce) {
                const ilce = userIlce.trim();
                const filter = `ilce.eq.${ilce},ilce.eq.${ilce.toLowerCase()},ilce.eq.${ilce.toUpperCase()}`;

                if (includeId) {
                    sourceQuery = sourceQuery.or(`${filter},id.eq.${includeId}`);
                } else {
                    sourceQuery = sourceQuery.or(filter);
                }
            } else if (includeId) {
                sourceQuery = sourceQuery.eq('id', includeId);
            } else {
                // If no district and no specific ID, we might want to restrict or allow all.
                // For now, if no district is provided, we'll keep it as is (select *).
            }

            const { data: sourcesData, error: sourcesError } = await sourceQuery;
            if (sourcesError) throw sourcesError;

            // 2. Fetch Inventory (for effective days)
            const { data: inventoryData, error: invError } = await supabase
                .from('depo_envanteri')
                .select('urun_adi, etkili_gun_sayisi');
            if (invError) throw invError;

            // 3. Fetch Tasks (for history)
            // Ideally we filter tasks by userIlce too if possible, to optimize.
            // But getting all 'olumlu' tasks is fine for now as we filter in memory.
            const { data: tasksData, error: tasksError } = await supabase
                .from('gorevler')
                .select(`
                    id,
                    tarih_saat,
                    durum,
                    ilaclar:gorev_ilaclar(ilac_adi),
                    kaynaklar:gorev_kaynaklar(kaynak_id)
                `)
                .or('durum.eq.olumlu,durum.eq.Olumlu Sonuçlandı')
                .order('tarih_saat', { ascending: false }); // Latest first

            if (tasksError) throw tasksError;

            // 4. Compute Status
            const computedSources = (sourcesData || []).map((source: Source) => {
                // Find tasks for this source
                const sourceTasks = (tasksData || []).filter((t: any) =>
                    (String(t.durum).toLowerCase() === 'olumlu' || String(t.durum) === 'Olumlu Sonuçlandı') &&
                    t.kaynaklar?.some((k: any) => String(k.kaynak_id) === String(source.id))
                );

                const latestTask = sourceTasks[0]; // Already sorted by date desc
                let status: Source['status'] = 'expired';
                let formattedDate = '-';

                if (latestTask) {
                    formattedDate = new Date(latestTask.tarih_saat).toLocaleDateString('tr-TR');

                    // Calculate effective duration based on chemicals used
                    let maxEffectiveDays = 0;
                    if (latestTask.ilaclar) {
                        latestTask.ilaclar.forEach((ilac: any) => {
                            const invItem = inventoryData?.find(i => i.urun_adi === ilac.ilac_adi);
                            if (invItem && invItem.etkili_gun_sayisi > maxEffectiveDays) {
                                maxEffectiveDays = invItem.etkili_gun_sayisi;
                            }
                        });
                    }

                    // FALLBACK: If status is positive but no duration set in inventory, default to 7 days
                    if (maxEffectiveDays === 0) {
                        maxEffectiveDays = 7;
                    }

                    if (maxEffectiveDays > 0) {
                        const taskDate = new Date(latestTask.tarih_saat);
                        const expiryDate = new Date(taskDate);
                        expiryDate.setDate(taskDate.getDate() + maxEffectiveDays);

                        const now = new Date();
                        const diffTime = expiryDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays < 0) {
                            status = 'expired';
                        } else if (diffDays <= 3) {
                            status = 'expiring';
                        } else {
                            status = 'active';
                        }
                    }
                } else {
                    // Start as 'new' if created recently? Or just 'expired' (red) default.
                    // User wanted 'new' pins to be red too, so 'expired' (red) is safe default.
                    // But if it's REALLY new (created today) maybe we track that? 
                    // For now, let's stick to 'expired' (red) effectively.
                    // Actually user asked for 'new' to be Red. Expired is Red. So same thing.
                    status = 'new';
                }

                return {
                    ...source,
                    status,
                    last_action_date: formattedDate
                };
            });

            setLocations(computedSources);

        } catch (err) {
            console.error('Error fetching map data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMapClick = (latlng: { lat: number, lng: number }) => {
        if (!hasPermission('map:manage')) return;
        setNewSourceCoords(latlng);
        setShowSourceModal(true);
        // Reset selected ilce, default to user's ilce if available
        setSelectedIlce(currentUser?.ilce || '');
    };

    const handleSaveSource = async () => {
        if (!newSourceCoords) return;

        if (!newSourceAppType) {
            alert('Lütfen uygulama türünü seçiniz.');
            return;
        }

        if (!newSourcePhysType) {
            alert('Lütfen kaynak türünü seçiniz.');
            return;
        }

        const ilceToSave = currentUser?.ilce || selectedIlce;

        if (!ilceToSave) {
            alert('Lütfen bir ilçe seçiniz.');
            return;
        }

        try {
            const { data, error } = await supabase.from('kaynaklar').insert([{
                baslik: `${newSourceAppType} - ${new Date().toLocaleDateString('tr-TR')}`,
                tur: newSourceAppType, // Application Type
                kaynak_turu: newSourcePhysType, // Physical Source Type
                lat: newSourceCoords.lat,
                lng: newSourceCoords.lng,
                ilce: ilceToSave
            }]).select().single();

            if (error) throw error;

            // Add locally with 'new' status (which renders as Red per user request)
            setLocations(prev => [...prev, { ...data, status: 'new' }]);

            // Explicitly re-fetch to ensure server state is synced and prevent disappearing
            await fetchSourcesAndAttributes(currentUser?.ilce, data.id);

            setShowSourceModal(false);
            setNewSourceCoords(null);
            setNewSourceAppType('');
            setNewSourcePhysType('');
            setSelectedIlce('');
            alert('Kaynak başarıyla eklendi.');
        } catch (err: any) {
            console.error('Error adding source:', err);
            alert('Kaynak eklenirken hata oluştu: ' + err.message);
        }
    };

    const handleDeleteSource = async (id: number | string) => {
        if (!hasPermission('map:manage')) return alert('Yetkiniz yok.');
        if (!confirm('Bu kaynağı silmek istediğinize emin misiniz?')) return;

        try {
            const { error } = await supabase
                .from('kaynaklar')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setLocations(locations.filter(l => l.id !== id));
            // alert('Kaynak silindi.'); // Optional feedback
        } catch (err: any) {
            console.error('Error deleting source:', err);
            alert('Kaynak silinirken hata oluştu: ' + err.message);
        }
    };

    // Prepare locations for Map component
    const mapLocations = locations.map(l => ({
        ...l,
        title: l.baslik,
        type: l.ilce, // Display District as requested
        subType: l.kaynak_turu // Pass physical type
    }));

    return (
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)] -mt-2 -mx-2 md:mx-0 flex flex-col relative group">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                <Map
                    locations={mapLocations}
                    showHeatmap={showHeatmap}
                    onMapClick={hasPermission('map:manage') ? handleMapClick : undefined}
                    onDeleteClick={hasPermission('map:manage') ? handleDeleteSource : undefined}
                />

                {/* Bottom Panel Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm text-white p-4 border-t border-slate-700 z-[400]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-indigo-400" /> Kaynak Yönetim Paneli
                                {currentUser?.ilce && <span className="text-sm font-normal text-slate-400">({currentUser.ilce})</span>}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {loading ? 'Yükleniyor...' : `Toplam ${locations.length} kaynak kayıtlı. Yeni eklemek için haritaya tıklayın.`}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowHeatmap(!showHeatmap)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${showHeatmap ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                <Flame className="w-4 h-4" />
                                {showHeatmap ? 'Pin Görünümü' : 'Isı Haritası'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Source Creation Modal */}
            {showSourceModal && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">Yeni Kaynak Ekle</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Konum: {newSourceCoords?.lat.toFixed(6)}, {newSourceCoords?.lng.toFixed(6)}
                        </p>

                        {!currentUser?.ilce && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 text-red-600">İlçe Seçimi (Profilinizde eksik)</label>
                                <select
                                    value={selectedIlce}
                                    onChange={(e) => setSelectedIlce(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">İlçe Seçiniz</option>
                                    {BALIKESIR_ILCELERI.map(ilce => (
                                        <option key={ilce} value={ilce}>{ilce}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Uygulama Türü</label>
                            <select
                                autoFocus
                                value={newSourceAppType}
                                onChange={e => setNewSourceAppType(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Uygulama Türü Seçiniz</option>
                                {SOURCE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Kaynak Türü</label>
                            <select
                                value={newSourcePhysType}
                                onChange={e => setNewSourcePhysType(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Kaynak Türü Seçiniz</option>
                                {PHYSICAL_SOURCE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSourceModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">İptal</button>
                            <button onClick={handleSaveSource} disabled={!newSourceAppType || !newSourcePhysType || (!currentUser?.ilce && !selectedIlce)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
