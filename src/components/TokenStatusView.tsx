import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Users, BookOpen, TrendingUp, Search, RefreshCw,
  DollarSign, Volume2, ClipboardList, GraduationCap, FileText, Video, BarChart3,
  ChevronDown, ChevronUp, Eye
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
  video_count: number;
  material_revenue: number;
  assessment_revenue: number;
  access_fee_revenue: number;
}

interface MyStat {
  material_count: number;
  active_materials: number;
  audio_count: number;
  test_count: number;
  assignment_count: number;
  exam_count: number;
  video_count: number;
  material_revenue: number;
  assessment_revenue: number;
  access_fee_revenue: number;
  free_material_count: number;
  free_audio_count: number;
  free_test_count: number;
  free_assignment_count: number;
  free_exam_count: number;
  free_video_count: number;
}

interface TokenStatusViewProps {
  token: string | null;
  addToast: (msg: string, type: ToastType) => void;
  profile?: any;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color, border, delay }: {
  label: string; value: string; icon: React.ReactNode;
  color: string; border: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white p-5 rounded-2xl border ${border} shadow-sm`}
    >
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
    </motion.div>
  );
}

function ContentBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (!Number(count)) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${color}`}>
      {count} {label}
    </span>
  );
}

// ─── Admin view: full table of all lecturers ─────────────────────────────────

function AdminView({ token, addToast }: { token: string | null; addToast: (m: string, t: ToastType) => void }) {
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
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sum = (key: keyof LecturerStat) => stats.reduce((a, s) => a + Number(s[key]), 0);
  const totalRevenue = sum('material_revenue') + sum('assessment_revenue') + sum('access_fee_revenue');

  const summaryCards = [
    { label: 'Total Revenue',       value: `₦${totalRevenue.toLocaleString()}`,                         icon: <DollarSign size={20} />, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
    { label: 'Access Fee Income',   value: `₦${sum('access_fee_revenue').toLocaleString()}`,            icon: <CreditCard size={20} />, color: 'bg-violet-50 text-violet-600',   border: 'border-violet-100' },
    { label: 'Materials Revenue',   value: `₦${sum('material_revenue').toLocaleString()}`,              icon: <BookOpen size={20} />,   color: 'bg-blue-50 text-blue-600',      border: 'border-blue-100' },
    { label: 'Assessment Revenue',  value: `₦${sum('assessment_revenue').toLocaleString()}`,            icon: <FileText size={20} />,   color: 'bg-amber-50 text-amber-600',    border: 'border-amber-100' },
    { label: 'Active Lecturers',    value: String(stats.length),                                        icon: <Users size={20} />,      color: 'bg-rose-50 text-rose-600',      border: 'border-rose-100' },
    { label: 'Paid Materials',      value: String(sum('material_count')),                               icon: <BookOpen size={20} />,   color: 'bg-sky-50 text-sky-600',        border: 'border-sky-100' },
    { label: 'Paid Audio',          value: String(sum('audio_count')),                                  icon: <Volume2 size={20} />,    color: 'bg-teal-50 text-teal-600',      border: 'border-teal-100' },
    { label: 'Paid Videos',         value: String(sum('video_count')),                                  icon: <Video size={20} />,      color: 'bg-purple-50 text-purple-600',  border: 'border-purple-100' },
    { label: 'Paid Tests',          value: String(sum('test_count')),                                   icon: <ClipboardList size={20} />, color: 'bg-orange-50 text-orange-600', border: 'border-orange-100' },
    { label: 'Paid Exams',          value: String(sum('exam_count')),                                   icon: <GraduationCap size={20} />, color: 'bg-pink-50 text-pink-600',   border: 'border-pink-100' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <header className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Token Status Tracking</h2>
          </div>
          <p className="text-slate-400 max-w-xl font-medium text-sm">
            Paid content and revenue across all academic tenants — free items are excluded.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={160} /></div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((c, i) => (
          <SummaryCard key={i} {...c} delay={i * 0.04} />
        ))}
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
          <table className="w-full text-left min-w-[960px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Lecturer', 'Paid Content', 'Materials Rev.', 'Assessments Rev.', 'Access Fees', 'Total Earned'].map(h => (
                  <th key={h} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400 font-bold">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400 font-bold">No lecturers found.</td></tr>}
              {filtered.map((s) => {
                const total = Number(s.material_revenue) + Number(s.assessment_revenue) + Number(s.access_fee_revenue);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
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
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        <ContentBadge label="materials" count={s.material_count}   color="bg-blue-50 text-blue-700" />
                        <ContentBadge label="audio"     count={s.audio_count}      color="bg-teal-50 text-teal-700" />
                        <ContentBadge label="videos"    count={s.video_count}      color="bg-purple-50 text-purple-700" />
                        <ContentBadge label="tests"     count={s.test_count}       color="bg-orange-50 text-orange-700" />
                        <ContentBadge label="assignments" count={s.assignment_count} color="bg-indigo-50 text-indigo-700" />
                        <ContentBadge label="exams"     count={s.exam_count}       color="bg-pink-50 text-pink-700" />
                        {Number(s.active_materials) > 0 && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{s.active_materials} live</span>
                        )}
                        {[s.material_count, s.audio_count, s.video_count, s.test_count, s.assignment_count, s.exam_count].every(v => !Number(v)) && (
                          <span className="text-[10px] text-slate-300 font-bold">No paid content</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-600 text-sm">₦{Number(s.material_revenue).toLocaleString()}</td>
                    <td className="px-6 py-5 font-bold text-slate-600 text-sm">₦{Number(s.assessment_revenue).toLocaleString()}</td>
                    <td className="px-6 py-5 font-bold text-violet-600 text-sm">₦{Number(s.access_fee_revenue).toLocaleString()}</td>
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

// ─── Lecturer view: own paid stats only ──────────────────────────────────────

function LecturerView({ token, addToast, profile }: { token: string | null; addToast: (m: string, t: ToastType) => void; profile?: any }) {
  const [stats, setStats] = useState<MyStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFree, setShowFree] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lecturer/my-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {
      addToast('Failed to fetch your stats', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-slate-400" size={28} />
    </div>
  );

  if (!stats) return null;

  const totalRevenue = Number(stats.material_revenue) + Number(stats.assessment_revenue) + Number(stats.access_fee_revenue);

  const revenueCards = [
    { label: 'Total Revenue',      value: `₦${totalRevenue.toLocaleString()}`,                          icon: <DollarSign size={20} />, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
    { label: 'Materials Revenue',  value: `₦${Number(stats.material_revenue).toLocaleString()}`,         icon: <BookOpen size={20} />,   color: 'bg-blue-50 text-blue-600',      border: 'border-blue-100' },
    { label: 'Assessment Revenue', value: `₦${Number(stats.assessment_revenue).toLocaleString()}`,       icon: <FileText size={20} />,   color: 'bg-amber-50 text-amber-600',    border: 'border-amber-100' },
    { label: 'Access Fees Earned', value: `₦${Number(stats.access_fee_revenue).toLocaleString()}`,       icon: <CreditCard size={20} />, color: 'bg-violet-50 text-violet-600',  border: 'border-violet-100' },
  ];

  const contentCards = [
    { label: 'Paid Materials',    value: String(stats.material_count),   icon: <BookOpen size={20} />,      color: 'bg-sky-50 text-sky-600',        border: 'border-sky-100' },
    { label: 'Paid Audio',        value: String(stats.audio_count),      icon: <Volume2 size={20} />,       color: 'bg-teal-50 text-teal-600',      border: 'border-teal-100' },
    { label: 'Paid Videos',       value: String(stats.video_count),      icon: <Video size={20} />,         color: 'bg-purple-50 text-purple-600',  border: 'border-purple-100' },
    { label: 'Paid Tests',        value: String(stats.test_count),       icon: <ClipboardList size={20} />, color: 'bg-orange-50 text-orange-600',  border: 'border-orange-100' },
    { label: 'Paid Assignments',  value: String(stats.assignment_count), icon: <FileText size={20} />,      color: 'bg-indigo-50 text-indigo-600',  border: 'border-indigo-100' },
    { label: 'Paid Exams',        value: String(stats.exam_count),       icon: <GraduationCap size={20} />, color: 'bg-pink-50 text-pink-600',      border: 'border-pink-100' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <header className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <BarChart3 size={24} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Revenue Tracking</h2>
          </div>
          <p className="text-slate-400 max-w-xl font-medium text-sm">
            Your paid content performance — free items are not counted here.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={160} /></div>
        <button
          onClick={fetchStats}
          className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
        >
          <RefreshCw size={18} className="text-white" />
        </button>
      </header>

      {/* Revenue breakdown */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Revenue Breakdown</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {revenueCards.map((c, i) => <SummaryCard key={i} {...c} delay={i * 0.05} />)}
        </div>
      </div>

      {/* Paid content counts */}
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Paid Content Items</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {contentCards.map((c, i) => <SummaryCard key={i} {...c} delay={0.2 + i * 0.05} />)}
        </div>
      </div>

      {/* Note + expandable free content */}
      <div className="border border-amber-100 rounded-2xl overflow-hidden">
        {/* Note bar + toggle button */}
        <div className="bg-amber-50 px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-700 font-medium">
            Only <strong>paid</strong> content appears above. Free items are excluded.
          </p>
          <button
            onClick={() => setShowFree(v => !v)}
            className="flex items-center gap-2 shrink-0 text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-xl transition-all border border-amber-200"
          >
            <Eye size={14} />
            {showFree ? 'Hide Free Content' : 'View Free Content'}
            {showFree ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expandable free content section */}
        <AnimatePresence>
          {showFree && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white px-6 py-6 space-y-4 border-t border-amber-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Free Content Items</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Free Materials',   value: stats.free_material_count,   icon: <BookOpen size={18} />,      color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                    { label: 'Free Audio',        value: stats.free_audio_count,      icon: <Volume2 size={18} />,       color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                    { label: 'Free Videos',       value: stats.free_video_count,      icon: <Video size={18} />,         color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                    { label: 'Free Tests',        value: stats.free_test_count,       icon: <ClipboardList size={18} />, color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                    { label: 'Free Assignments',  value: stats.free_assignment_count, icon: <FileText size={18} />,      color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                    { label: 'Free Exams',        value: stats.free_exam_count,       icon: <GraduationCap size={18} />, color: 'bg-slate-50 text-slate-500',  border: 'border-slate-100' },
                  ].map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-white p-4 rounded-2xl border ${c.border} shadow-sm`}
                    >
                      <div className={`w-9 h-9 ${c.color} rounded-xl flex items-center justify-center mb-3`}>
                        {c.icon}
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{c.label}</p>
                      <p className="text-lg font-black text-slate-600 mt-1">{Number(c.value)}</p>
                    </motion.div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Free content generates no revenue and is shown here for reference only.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Root: pick view by role ─────────────────────────────────────────────────

export default function TokenStatusView({ token, addToast, profile }: TokenStatusViewProps) {
  const role = profile?.user?.role;
  if (role === 'tenant_admin') {
    return <LecturerView token={token} addToast={addToast} profile={profile} />;
  }
  return <AdminView token={token} addToast={addToast} />;
}
