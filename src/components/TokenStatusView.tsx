import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard, Users, BookOpen, TrendingUp, Search, RefreshCw,
  DollarSign, Mic, ClipboardList, GraduationCap, FileText, Volume2
} from 'lucide-react';
import { ToastType } from './ToastSystem';

interface LecturerStat {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  material_count: number;
  active_materials: number;
  audio_count: number;
  test_count: number;
  assignment_count: number;
  exam_count: number;
  material_revenue: number;
  assessment_revenue: number;
  access_fee_revenue: number;
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
    } catch {
      addToast('Failed to fetch stats', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [token]);

  const filtered = stats.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue   = stats.reduce((sum, s) => sum + Number(s.material_revenue) + Number(s.assessment_revenue) + Number(s.access_fee_revenue), 0);
  const totalMaterials = stats.reduce((sum, s) => sum + Number(s.material_count), 0);
  const totalAudio     = stats.reduce((sum, s) => sum + Number(s.audio_count), 0);
  const totalTests     = stats.reduce((sum, s) => sum + Number(s.test_count), 0);
  const totalAssignments = stats.reduce((sum, s) => sum + Number(s.assignment_count), 0);
  const totalExams     = stats.reduce((sum, s) => sum + Number(s.exam_count), 0);
  const totalAccessFee = stats.reduce((sum, s) => sum + Number(s.access_fee_revenue), 0);
  const totalMatRev    = stats.reduce((sum, s) => sum + Number(s.material_revenue), 0);
  const totalAssessRev = stats.reduce((sum, s) => sum + Number(s.assessment_revenue), 0);

  const summaryCards = [
    { label: 'Total Revenue',       value: `₦${totalRevenue.toLocaleString()}`,     icon: <DollarSign size={22} />,    color: 'bg-emerald-50 text-emerald-600',  border: 'border-emerald-100' },
    { label: 'Access Fee Income',   value: `₦${totalAccessFee.toLocaleString()}`,   icon: <CreditCard size={22} />,    color: 'bg-violet-50 text-violet-600',    border: 'border-violet-100' },
    { label: 'Materials Revenue',   value: `₦${totalMatRev.toLocaleString()}`,      icon: <BookOpen size={22} />,      color: 'bg-blue-50 text-blue-600',        border: 'border-blue-100' },
    { label: 'Assessments Revenue', value: `₦${totalAssessRev.toLocaleString()}`,   icon: <FileText size={22} />,      color: 'bg-amber-50 text-amber-600',      border: 'border-amber-100' },
    { label: 'Active Lecturers',    value: String(stats.length),                    icon: <Users size={22} />,         color: 'bg-rose-50 text-rose-600',        border: 'border-rose-100' },
    { label: 'Lecture Materials',   value: String(totalMaterials),                  icon: <BookOpen size={22} />,      color: 'bg-sky-50 text-sky-600',          border: 'border-sky-100' },
    { label: 'Audio Records',       value: String(totalAudio),                      icon: <Volume2 size={22} />,       color: 'bg-teal-50 text-teal-600',        border: 'border-teal-100' },
    { label: 'Tests',               value: String(totalTests),                      icon: <ClipboardList size={22} />, color: 'bg-orange-50 text-orange-600',    border: 'border-orange-100' },
    { label: 'Assignments',         value: String(totalAssignments),                icon: <FileText size={22} />,      color: 'bg-indigo-50 text-indigo-600',    border: 'border-indigo-100' },
    { label: 'Exams',               value: String(totalExams),                      icon: <GraduationCap size={22} />, color: 'bg-pink-50 text-pink-600',        border: 'border-pink-100' },
  ];

  const contentBadge = (label: string, count: number, color: string) =>
    Number(count) > 0 ? (
      <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${color}`}>
        {count} {label}
      </span>
    ) : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Token Status Tracking</h2>
          </div>
          <p className="text-slate-400 max-w-xl font-medium text-sm md:text-base">
            Full breakdown of every lecturer's content, revenue streams — materials, audio, tests, exams, assignments and portal access fees.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <TrendingUp size={160} />
        </div>
      </header>

      {/* Summary Cards — 5 cols on wide, 2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white p-5 rounded-2xl border ${card.border} shadow-sm`}
          >
            <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
              {card.icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{card.label}</p>
            <p className="text-xl font-black text-slate-900 mt-1">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search + Refresh */}
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

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lecturer</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Content</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Materials Rev.</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assessments Rev.</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Access Fees</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400 font-bold">Loading...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400 font-bold">No lecturers found.</td>
                </tr>
              )}
              {filtered.map((s) => {
                const total = Number(s.material_revenue) + Number(s.assessment_revenue) + Number(s.access_fee_revenue);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                    {/* Lecturer */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {(s.name || '?')[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium truncate">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Content badges */}
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {contentBadge('materials', s.material_count, 'bg-blue-50 text-blue-700')}
                        {contentBadge('audio', s.audio_count, 'bg-teal-50 text-teal-700')}
                        {contentBadge('tests', s.test_count, 'bg-orange-50 text-orange-700')}
                        {contentBadge('assignments', s.assignment_count, 'bg-indigo-50 text-indigo-700')}
                        {contentBadge('exams', s.exam_count, 'bg-pink-50 text-pink-700')}
                        {Number(s.material_count) + Number(s.audio_count) + Number(s.test_count) + Number(s.assignment_count) + Number(s.exam_count) === 0 && (
                          <span className="text-[10px] text-slate-300 font-bold">—</span>
                        )}
                        {Number(s.active_materials) > 0 && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {s.active_materials} live
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Revenues */}
                    <td className="px-6 py-5 font-bold text-slate-600 text-sm">
                      ₦{Number(s.material_revenue).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-600 text-sm">
                      ₦{Number(s.assessment_revenue).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 font-bold text-violet-600 text-sm">
                      ₦{Number(s.access_fee_revenue).toLocaleString()}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-base font-black tracking-tight ${total > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        ₦{total.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
