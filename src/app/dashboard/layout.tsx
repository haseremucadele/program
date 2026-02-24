'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <header className="flex lg:hidden items-center justify-between p-3 bg-white border-b border-gray-200 z-30 shadow-sm">
                    <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Haşere Mücadele Takip Sistemi
                    </h1>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
                    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-300">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
