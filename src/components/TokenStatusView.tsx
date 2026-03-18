import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Users, BookOpen, TrendingUp, Search, RefreshCw, GraduationCap, DollarSign } from 'lucide-react';
import { ToastType } from './ToastSystem';

interface LecturerStat {
    id: number;
    name: string;
    email: string;
    tenant_id: number;
    material_count: number;
    active_materials: number;
    material_revenue: number;
    assessment_revenue: number;
}

interface TokenStatusViewProps {
    token: string | null;
    addToast: (msg: string, type: ToastType) => void;
}

export default function TokenStatusView({ token, addToast }: TokenStatusViewProps) {
    const [stats, setStats] = useState<LecturerStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/lecturer-material-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setStats(data);
        } catch (err) {
            addToast('Failed to fetch material stats', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [token]);

    const filteredStats = stats.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalRevenue = stats.reduce((sum, s) => sum + Number(s.material_revenue) + Number(s.assessment_revenue), 0);
    const totalMaterials = stats.reduce((sum, s) => sum + Number(s.material_count), 0);

    return (
        <div className="space-y-8 pb-12">
            <header className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                            <CreditCard size={24} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Token Status Tracking</h2>
                    </div>
                    <p className="text-slate-400 max-w-xl font-medium">Monitor lecture material distribution and revenue generation across all academic tenants.</p>
                </div>
                
                {/* Decoration */}
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <TrendingUp size={160} />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                        <DollarSign size={24} />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Total Revenue</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">₦{totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                        <BookOpen size={24} />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Global Materials</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">{totalMaterials.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                        <Users size={24} />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Lecturers</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">{stats.length}</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by lecturer name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>
                <button onClick={fetchStats} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all">
                    <RefreshCw size={20} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lecturer</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Materials</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Revenue (Materials)</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Revenue (Assessments)</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Earned</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStats.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xs uppercase">
                                                {s.name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{s.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{s.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-900">{s.material_count}</span>
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                                                {s.active_materials} Live
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-slate-600">
                                        ₦{Number(s.material_revenue).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6 font-bold text-slate-600">
                                        ₦{Number(s.assessment_revenue).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-lg font-black text-blue-600 tracking-tight">
                                            ₦{(Number(s.material_revenue) + Number(s.assessment_revenue)).toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
