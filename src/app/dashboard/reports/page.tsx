'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
    Activity, Printer, Truck, Users, Calendar, Fuel, Wrench, Beaker
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import clsx from 'clsx';

export default function ReportsPage() {
    const supabase = createClient();
    const { profile } = useUserProfile();
    const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
    const [districts, setDistricts] = useState<string[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<string>("");
    const [medicineDistrict, setMedicineDistrict] = useState<string>('');
    const [stats, setStats] = useState({
        totalVehicles: 0,
        totalPersonnel: 0,
        totalKM: 0,
        totalFuel: 0,
        totalCost: 0
    });
    const [taskData, setTaskData] = useState<any[]>([]);
    const [fuelData, setFuelData] = useState<any[]>([]);
    const [medicineData, setMedicineData] = useState<{ name: string; used: number; stock: number; unit: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDistricts();
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [period, selectedDistrict]);

    // Auto-select district for Filters if user has restricted district
    useEffect(() => {
        if (profile?.ilce) {
            setSelectedDistrict(profile.ilce);
            setMedicineDistrict(profile.ilce);
        }
    }, [profile]);

    // Separate effect for medicine data, reacting to its own filter + period
    useEffect(() => {
        fetchMedicineData();
    }, [period, medicineDistrict]);

    const handlePrint = () => {
        window.print();
    };

    const fetchDistricts = async () => {
        const { data } = await supabase.from('araclar').select('ilce');
        if (data) {
            const uniqueDistricts = Array.from(new Set(data.map(d => d.ilce).filter(Boolean)));
            setDistricts(uniqueDistricts);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // Filter helper variables
            let vIds: number[] = [];

            // 1. Vehicles
            let vQuery = supabase.from('araclar').select('id', { count: 'exact', head: false }).eq('durum', 'aktif');
            if (selectedDistrict) vQuery = vQuery.eq('ilce', selectedDistrict);

            const { data: vData } = await vQuery;
            const vCount = vData?.length || 0;
            vIds = vData?.map(v => v.id) || [];

            // 2. Personnel
            let pQuery = supabase.from('users').select('id', { count: 'exact', head: false });
            if (selectedDistrict) pQuery = pQuery.eq('ilce', selectedDistrict);

            const { data: pData } = await pQuery;
            const pCount = pData?.length || 0;

            // 3. Date Filter Logic
            const startDate = getStartDate(period);
            const startStr = startDate.toISOString();

            // 4. Maintenance Cost (Sum)
            // Filter by filtered vIds if vehicle filter is active
            let mQuery = supabase.from('arac_bakim').select('maliyet').gte('tarih', startStr);
            if (selectedDistrict) {
                if (vIds.length > 0) mQuery = mQuery.in('arac_id', vIds);
                else mQuery = mQuery.eq('id', -1); // No vehicles in district -> no maintenance
            }

            const { data: maintData } = await mQuery;
            const totalCost = maintData?.reduce((sum, item) => sum + (item.maliyet || 0), 0) || 0;

            // 5. Fuel & KM (Sum from arac_yakit)
            let fQuery = supabase.from('arac_yakit').select('miktar_litre, km, tarih').gte('tarih', startStr).order('tarih', { ascending: true });
            if (selectedDistrict) {
                if (vIds.length > 0) fQuery = fQuery.in('arac_id', vIds);
                else fQuery = fQuery.eq('id', -1);
            }

            const { data: fuelLogs } = await fQuery;
            const totalFuel = fuelLogs?.reduce((sum, item) => sum + (item.miktar_litre || 0), 0) || 0;

            // 6. Tasks
            let tQuery = supabase
                .from('gorevler')
                .select('tu:tur, dur:durum, cikis_km, donus_km, tarih_saat')
                .gte('tarih_saat', startStr);

            if (selectedDistrict) {
                if (vIds.length > 0) tQuery = tQuery.in('arac_id', vIds);
                else tQuery = tQuery.eq('id', -1);
            }

            const { data: tasks } = await tQuery;

            const totalKM = tasks?.reduce((sum, t) => {
                if (t.donus_km && t.cikis_km) return sum + (t.donus_km - t.cikis_km);
                return sum;
            }, 0) || 0;

            setStats({
                totalVehicles: vCount || 0,
                totalPersonnel: pCount || 0,
                totalKM,
                totalFuel,
                totalCost
            });

            // 5. Chart Data Preparation
            // Task Counts by Type
            const typeCounts: Record<string, number> = {};
            tasks?.forEach(t => {
                const type = (t as any).tu || 'Diğer';
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });
            const tData = Object.keys(typeCounts).map(key => ({ name: key, value: typeCounts[key] }));
            setTaskData(tData);

            // Fuel Consumption Over Time
            const fuelMap: Record<string, number> = {};
            fuelLogs?.forEach(log => {
                const dateKey = new Date(log.tarih).toLocaleDateString('tr-TR', {
                    day: period === 'daily' ? 'numeric' : 'numeric',
                    month: period === 'daily' ? undefined : 'short'
                });
                fuelMap[dateKey] = (fuelMap[dateKey] || 0) + log.miktar_litre;
            });
            const fData = Object.keys(fuelMap).map(key => ({ date: key, miktar: fuelMap[key] }));
            setFuelData(fData);

        } catch (error) {
            console.error('Report Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMedicineData = async () => {
        try {
            const startDate = getStartDate(period);
            const startStr = startDate.toISOString();

            // 1. Determine Scope (Vehicles/District)
            let vIds: number[] = [];
            if (medicineDistrict) {
                const { data: vData } = await supabase.from('araclar').select('id').eq('ilce', medicineDistrict);
                vIds = vData?.map(v => v.id) || [];
                // If filtered by district but found no vehicles, then empty vIds means no tasks from this district
                // EXCEPT: What if tasks are loosely connected? We usually connect via arac_id.
            }

            // 2. Fetch Tasks with Medicine Logic
            let tQuery = supabase
                .from('gorevler')
                .select('ilaclar:gorev_ilaclar(ilac_adi, miktar, birim)')
                .gte('tarih_saat', startStr);

            if (medicineDistrict) {
                if (vIds.length > 0) tQuery = tQuery.in('arac_id', vIds);
                else tQuery = tQuery.eq('id', -1);
            }

            const { data: tasks } = await tQuery;

            // 3. Fetch Inventory
            const { data: inventory } = await supabase.from('depo_envanteri').select('id, urun_adi, stok_miktari, birim');
            const idToNameMap: Record<number, string> = {};
            inventory?.forEach(i => idToNameMap[i.id] = i.urun_adi);

            // 4. Aggregate Usage (Tasks)
            const usageMap: Record<string, number> = {};
            tasks?.forEach((t: any) => {
                if (Array.isArray(t.ilaclar)) {
                    t.ilaclar.forEach((med: any) => {
                        if (med && med.ilac_adi && med.miktar) {
                            const key = med.ilac_adi;
                            usageMap[key] = (usageMap[key] || 0) + (parseFloat(med.miktar) || 0);
                        }
                    });
                }
            });

            // 5. Aggregate Usage (Stock Outputs)
            let sQuery = supabase
                .from('stok_hareketleri')
                .select('urun_id, miktar')
                .eq('islem_turu', 'CIKIS')
                .gte('created_at', startStr);

            if (medicineDistrict) sQuery = sQuery.eq('ilce', medicineDistrict);

            const { data: stockOutputs } = await sQuery;

            stockOutputs?.forEach(out => {
                const name = idToNameMap[out.urun_id];
                if (name) {
                    usageMap[name] = (usageMap[name] || 0) + (out.miktar || 0);
                }
            });

            // 6. Merge
            const allMedicines = new Set([
                ...(inventory?.map(i => i.urun_adi) || []),
                ...Object.keys(usageMap)
            ]);

            const mData = Array.from(allMedicines).map(name => {
                const invItem = inventory?.find(i => i.urun_adi === name);
                const usedAmount = usageMap[name] || 0;
                const currentStock = invItem?.stok_miktari || 0;

                return {
                    name: name,
                    used: usedAmount,
                    stock: currentStock,
                    unit: invItem?.birim || '-'
                };
            }).sort((a, b) => b.used - a.used);

            setMedicineData(mData);

        } catch (error) {
            console.error('Medicine Report Error:', error);
        }
    };

    const getStartDate = (p: string) => {
        const d = new Date();
        if (p === 'daily') d.setHours(0, 0, 0, 0);
        else if (p === 'monthly') { d.setDate(1); d.setHours(0, 0, 0, 0); }
        else if (p === 'yearly') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
        return d;
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div className="space-y-6">
            {/* Print Header */}
            <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold text-gray-900 text-center border-b border-gray-300 pb-2">Raporlar ve Analizler</h1>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>Haşere Mücadele Takip Sistemi</span>
                    <span>Tarih: {new Date().toLocaleDateString('tr-TR')}</span>
                </div>
            </div>

            <div className="flex items-center justify-between no-print">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-8 h-8 text-indigo-600" />
                    Raporlar ve Analizler
                </h1>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Yazdır
                    </button>

                    <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        disabled={!!profile?.ilce}
                        className={clsx("px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm", { "bg-gray-100 cursor-not-allowed": !!profile?.ilce })}
                    >
                        {profile?.ilce ? (
                            <option value={profile.ilce}>{profile.ilce}</option>
                        ) : (
                            <>
                                <option value="">Tüm İlçeler</option>
                                {districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </>
                        )}
                    </select>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {(['daily', 'monthly', 'yearly'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={clsx(
                                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                                    period === p ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {p === 'daily' ? 'Günlük' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatsCard title="Araç Sayısı (Aktif)" value={stats.totalVehicles} icon={Truck} color="blue" />
                <StatsCard title="Personel Sayısı (Aktif)" value={stats.totalPersonnel} icon={Users} color="purple" />
                <StatsCard title="Toplam KM" value={`${stats.totalKM.toLocaleString('tr-TR')} km`} icon={Calendar} color="green" />
                <StatsCard title="Yakıt Tüketimi" value={`${stats.totalFuel.toLocaleString('tr-TR')} Lt`} icon={Fuel} color="orange" />
                <StatsCard title="Bakım Maliyeti" value={`${stats.totalCost.toLocaleString('tr-TR')} ₺`} icon={Wrench} color="red" />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Görev Dağılımı ({period === 'daily' ? 'Bugün' : period === 'monthly' ? 'Bu Ay' : 'Bu Yıl'})</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={taskData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#4F46E5" radius={[0, 4, 4, 0]} name="Görev Sayısı" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fuel Consumption Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Yakıt Tüketim Trendi</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fuelData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="miktar" stroke="#F97316" strokeWidth={2} name="Litre" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>


            {/* Row 2: Medicine Consumption */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Beaker className="w-5 h-5 text-indigo-600" />
                        İlaç Tüketim Raporu
                    </h3>
                    <select
                        value={medicineDistrict}
                        onChange={(e) => setMedicineDistrict(e.target.value)}
                        disabled={!!profile?.ilce}
                        className={clsx("px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 bg-white", { "bg-gray-100 cursor-not-allowed": !!profile?.ilce })}
                    >
                        {profile?.ilce ? (
                            <option value={profile.ilce}>{profile.ilce}</option>
                        ) : (
                            <>
                                <option value="">Tüm İlçeler</option>
                                {districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </>
                        )}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İlaç Adı</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Stok (Tahmini)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kullanılan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalan (Güncel)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Birim</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {medicineData.length > 0 ? (
                                medicineData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(item.stock + item.used).toLocaleString('tr-TR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600 font-semibold">{item.used.toLocaleString('tr-TR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{item.stock.toLocaleString('tr-TR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 italic">Bu dönemde ilaç tüketimi bulunmuyor.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600",
        purple: "bg-purple-50 text-purple-600",
        green: "bg-green-50 text-green-600",
        orange: "bg-orange-50 text-orange-600",
        red: "bg-red-50 text-red-600",
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
            <div className={clsx("p-3 rounded-lg", colorClasses[color] || "bg-gray-50")}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}
