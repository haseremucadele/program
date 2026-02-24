'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Map, Users, Settings, LogOut, Truck, Layers, X, CalendarCheck, Beaker, BarChart3, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';

const navigation = [
    { name: 'Panel', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Harita', href: '/dashboard/map', icon: Map, permission: 'map:view' },
    { name: 'Görevler', href: '/dashboard/tasks', icon: Layers, permission: 'tasks:view' },
    { name: 'Araçlar', href: '/dashboard/vehicles', icon: Truck, permission: 'vehicles:view' },
    { name: 'Kullanıcılar', href: '/dashboard/users', icon: Users, permission: 'users:view' },
    { name: 'Depo Envanteri', href: '/dashboard/inventory', icon: Beaker, permission: 'inventory:view' },
    { name: 'Raporlar', href: '/dashboard/reports', icon: BarChart3, permission: 'reports:view' },
    { name: 'Yoklama', href: '/dashboard/attendance', icon: CalendarCheck, permission: 'attendance:view' },
    { name: 'Yetkilendirme', href: '/dashboard/permissions', icon: ShieldCheck, permission: 'permissions:manage' },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { profile } = useUserProfile();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className={clsx(
                "fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-64 lg:w-56 bg-white/95 backdrop-blur-md h-full border-r border-gray-200 shadow-xl transition-transform duration-300 transform lg:transform-none",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100">
                    <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Haşere Mücadele Takip Sistemi
                    </h1>
                    <button onClick={onClose} className="lg:hidden p-1 rounded-md hover:bg-gray-100 text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        // Permission Check
                        if (item.permission && !profile?.permissions?.includes(item.permission)) {
                            return null;
                        }

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onClose}
                                className={clsx(
                                    'flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group',
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                )}
                            >
                                <item.icon
                                    className={clsx(
                                        'w-4 h-4 transition-colors',
                                        isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                    )}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-3 border-t border-gray-100">
                    <div className="px-3 py-2 mb-2">
                        <div className="text-sm font-semibold text-gray-900">{profile?.ad_soyad}</div>
                        <div className="text-xs text-gray-500 capitalize">{profile?.unvan?.replace('_', ' ')}</div>
                        {profile?.ilce && (
                            <div className="text-xs text-indigo-600 font-medium mt-0.5">{profile.ilce}</div>
                        )}
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center w-full gap-2.5 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Çıkış Yap
                    </button>
                </div>
            </div>
        </>
    );
}
