'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, Truck, ClipboardList, Loader2, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
    const supabase = createClient();
    const [stats, setStats] = useState({
        users: 0,
        vehicles: 0,
        tempVehicles: 0, // Placeholder for specific statuses if needed
        tasks: 0,
        completedTasks: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                // Users count
                const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

                // Vehicles count
                const { count: vehicleCount } = await supabase.from('araclar').select('*', { count: 'exact', head: true });

                // Tasks count (Total)
                const { count: taskCount } = await supabase.from('gorevler').select('*', { count: 'exact', head: true });

                // Completed Tasks count
                const { count: completedTaskCount } = await supabase.from('gorevler').select('*', { count: 'exact', head: true }).eq('durum', 'tamamlandi');

                setStats({
                    users: userCount || 0,
                    vehicles: vehicleCount || 0,
                    tempVehicles: 0,
                    tasks: taskCount || 0,
                    completedTasks: completedTaskCount || 0
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    const statCards = [
        {
            title: 'Toplam Personel',
            value: stats.users,
            icon: Users,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50'
        },
        {
            title: 'Kayıtlı Araç',
            value: stats.vehicles,
            icon: Truck,
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        },
        {
            title: 'Toplam Görev',
            value: stats.tasks,
            icon: ClipboardList,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            title: 'Tamamlanan',
            value: stats.completedTasks,
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
    ];

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Genel Bakış</h2>
                <p className="text-sm text-gray-500">Sistem durum özeti.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.title}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-gray-50 rounded-full mb-3">
                        <TrendingUp className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-900">Aylık Aktivite</h3>
                    <p className="text-xs text-gray-500 mt-1">Veri akışı başladığında burada grafikler görünecek.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-gray-50 rounded-full mb-3">
                        <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-900">Son Eklenenler</h3>
                    <p className="text-xs text-gray-500 mt-1">Son kayıt olan personeller listelenecek.</p>
                </div>
            </div>
        </div>
    );
}
