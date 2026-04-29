import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle, AlertCircle, Clock, ArrowRight, UploadCloud, TrendingUp, Users, ShieldCheck, Eye, User, ToggleLeft, ToggleRight, RefreshCw, Loader2, X, Cpu, DollarSign, Activity, Zap, ChevronRight, ExternalLink } from 'lucide-react';
import GeniusPaymentModal from './GeniusPaymentModal';
import { Tab } from '../App';
import { friendlyError } from '../utils/friendlyError';

export default function DashboardOverview({ onNavigate, profile, setActivePaperId }: {
  onNavigate: (tab: Tab) => void,
  profile: any,
  setActivePaperId: (id: number) => void,
}) {
  const papers = profile?.papers || [];
  const role = profile?.user?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isLecturer = role === 'tenant_admin';
  const adminStats = profile?.adminStats;

  // AI usage stats (admin only)
  const [usageStats, setUsageStats] = useState<{
    totalTokens: number; totalCost: number; totalRequests: number; currentBalance: number;
    recentHistory: any[]; byModel: any[]; dailyBreakdown: any[]; perUser: any[];
  } | null>(null);
  const [liveBalance, setLiveBalance] = useState<{ balance: number; source: 'live' | 'estimated'; note?: string } | null>(null);
  const [liveBalanceError, setLiveBalanceError] = useState<string | null>(null);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetail, setUserDetail] = useState<{ user: any; summary: any; history: any[]; byPurpose: any[] } | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchUsageStats = useCallback(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/usage-stats', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) setUsageStats(d); })
      .catch(() => {});
  }, []);

  const fetchLiveBalance = useCallback(async () => {
    setRefreshingBalance(true);
    setLiveBalanceError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/openai-balance', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.balance !== null && data.balance !== undefined) {
        setLiveBalance({ balance: data.balance, source: data.source, note: data.note });
      } else {
        setLiveBalanceError(data.error || 'Unavailable');
      }
    } catch (e: any) {
      setLiveBalanceError('Could not reach server');
    } finally {
      setRefreshingBalance(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsageStats();
    fetchLiveBalance();
  }, [isAdmin, fetchUsageStats, fetchLiveBalance]);

  const openUserDetail = async (user: any) => {
    setSelectedUser(user);
    setUserDetail(null);
    setLoadingUserDetail(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/usage-stats/user/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) setUserDetail(data);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  // Republish state
  const [republishConfig, setRepublishConfig] = useState<{ enabled: boolean; paid: boolean; amount: number } | null>(null);
  const [republishingId, setRepublishingId] = useState<number | null>(null);
  const [republishModal, setRepublishModal] = useState<{ paperId: number; title: string } | null>(null);
  const [republishError, setRepublishError] = useState<string | null>(null);
  // Track papers queued for republication locally so button disappears instantly after success
  const [republishedIds, setRepublishedIds] = useState<Set<number>>(new Set());
  const [showRepublishPayment, setShowRepublishPayment] = useState(false);
  const [pendingRepublishRef, setPendingRepublishRef] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/settings/republish-config', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setRepublishConfig(d); })
      .catch(() => {});
  }, []);

  const handleRepublish = async (paperId: number, paymentReference?: string) => {
    setRepublishingId(paperId);
    setRepublishError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/papers/${paperId}/republish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Republish failed');
      setRepublishModal(null);
      setRepublishedIds((prev: Set<number>) => new Set(prev).add(paperId));
    } catch (err: any) {
      setRepublishError(friendlyError(err, 'generic'));
    } finally {
      setRepublishingId(null);
    }
  };

  const handlePaperClick = (id: number) => {
    setActivePaperId(id);
    onNavigate('quick_publish');
  };


  // ─── ADMIN DASHBOARD ──────────────────────────
  if (isAdmin && adminStats) {
    const platformStats = [
      { label: 'Registered Users', value: adminStats.totalUsers, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-indigo-50', border: 'border-indigo-100' },
      { label: 'Total Manuscripts', value: adminStats.totalPapers, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-blue-50', border: 'border-blue-100' },
      { label: 'Published Papers', value: adminStats.publishedPapers, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-emerald-50', border: 'border-emerald-100' },
      { label: 'Pending Review', value: adminStats.pendingReview, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-amber-50', border: 'border-amber-100' },
    ];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
        {/* Admin Welcome */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] rounded-[1.25rem] md:rounded-[2rem] p-4 md:p-10 text-white shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <img src="/gmijp-logo.png" alt="Branding" className="w-32 h-32 md:w-64 md:h-64 object-contain rounded-full bg-white/5 p-4" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start sm:items-center justify-between gap-8">
            <div className="text-center sm:text-left flex-1 border-r border-white/10 pr-0 sm:pr-8 hidden sm:block">
              <div className="flex items-center gap-3 mb-3 justify-center sm:justify-start">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30">Administrator</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold font-display mb-2 md:mb-3 tracking-tight">
                Platform Control Center
              </h2>
              <p className="text-slate-300 text-base md:text-lg max-w-xl font-medium leading-relaxed">
                Welcome, <span className="text-white font-bold">{profile?.user?.name || 'Admin'}</span>. You have <span className="text-amber-300 font-bold">{adminStats.pendingReview} manuscripts</span> awaiting review.
              </p>
            </div>
            
            <div className="text-center sm:text-left flex-1 sm:hidden">
                <div className="flex items-center gap-3 mb-3 justify-center">
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30">Admin Dashboard</span>
                </div>
            </div>

            <div className="flex flex-col items-center sm:items-end justify-center w-full sm:w-auto shrink-0 gap-6">
              <div className="text-center sm:text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-3xl font-black text-emerald-400">₦{adminStats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Stats Grid */}
        <div className="flex overflow-x-auto pb-4 gap-3 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {platformStats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`min-w-[70vw] md:min-w-0 snap-center bg-white p-4 md:p-7 rounded-2xl md:rounded-[1.5rem] shadow-sm border ${stat.border} hover:shadow-md transition-all group`}
            >
              <div className={`p-3 md:p-4 ${stat.color} rounded-xl md:rounded-2xl w-fit mb-3 md:mb-4 group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight mt-0.5">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Two Column: Recent Users + All Papers */}
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Recent Users */}
          <div className="lg:col-span-2 bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none">
            <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h3 className="text-sm md:text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <Users size={18} className="text-indigo-600" /> Recent Signups
              </h3>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto custom-scrollbar flex-1">
              {adminStats.recentUsers?.map((user: any) => (
                <div key={user.id} className="px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm shrink-0 overflow-hidden ${user.role === 'admin' ? 'premium-gradient' : 'bg-white border border-slate-100'}`}>
                      {user.role === 'admin' ? (
                         <span className="text-white">{(user.name?.[0] || 'U')}</span>
                      ) : (
                         <img src="/gmijp-logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{user.name || 'Unknown'}</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-1 flex-shrink-0 rounded-lg border ${user.role === 'admin' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All Papers Pipeline */}
          <div className="lg:col-span-3 bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none">
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <FileText size={20} className="text-[#800000]" /> Global Pipeline
              </h3>
              <button onClick={() => onNavigate('records')} className="text-indigo-600 text-xs sm:text-sm font-bold hover:underline shrink-0">View All</button>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto custom-scrollbar flex-1">
              {adminStats.allPapers?.slice(0, 8).map((paper: any) => (
                <div key={paper.id} className="px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{paper.title}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                      by {paper.researcher_name || 'Unknown'} · {paper.researcher_email}
                    </p>
                  </div>
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shrink-0 ${
                    paper.status === 'published' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    paper.status === 'ready' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                    paper.status === 'peer_review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-slate-50 text-slate-500 border-slate-100'
                  }`}>
                    {paper.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {(!adminStats.allPapers || adminStats.allPapers.length === 0) && (
                <div className="p-10 sm:p-16 text-center">
                  <FileText className="text-slate-200 mx-auto mb-3" size={32} />
                  <p className="text-xs sm:text-sm font-bold text-slate-400">No manuscripts submitted yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Usage & Balance Panel */}
        {usageStats && (
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 md:px-8 py-4 md:py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm md:text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <Cpu size={18} className="text-violet-600" /> AI Engine — Token Usage & Balance
              </h3>
              <button onClick={fetchUsageStats} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-violet-600 flex items-center gap-1 transition-colors">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>

            <div className="p-5 md:p-8 space-y-6">
              {/* Balance row */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Balance card */}
                <div className={`flex-1 bg-gradient-to-br border rounded-2xl p-5 flex flex-col gap-2 ${liveBalance?.source === 'live' ? 'from-emerald-50 to-teal-50 border-emerald-100' : 'from-violet-50 to-indigo-50 border-violet-100'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${liveBalance?.source === 'live' ? 'text-emerald-600' : 'text-violet-500'}`}>
                      <DollarSign size={11} /> OpenAI Credit Balance
                    </p>
                    {liveBalance && (
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${liveBalance.source === 'live' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                        {liveBalance.source === 'live' ? '● Live' : '~ Estimated'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-3 mt-1">
                    {liveBalance !== null ? (
                      <span className={`text-3xl font-black ${liveBalance.source === 'live' ? 'text-emerald-700' : 'text-violet-700'}`}>
                        ${liveBalance.balance.toFixed(2)}
                      </span>
                    ) : liveBalanceError ? (
                      <span className="text-sm font-bold text-rose-500">{liveBalanceError}</span>
                    ) : (
                      <Loader2 size={20} className="text-slate-300 animate-spin" />
                    )}
                    <button
                      onClick={fetchLiveBalance}
                      disabled={refreshingBalance}
                      className="mb-1 text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-40"
                      title="Refresh balance"
                    >
                      {refreshingBalance ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    {liveBalance?.source === 'live'
                      ? 'Live from OpenAI Admin API'
                      : liveBalance?.note
                        ? liveBalance.note
                        : 'Set OPENAI_ADMIN_KEY in env for live balance'}
                  </p>
                </div>

                {/* Stats cards */}
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Requests', value: usageStats.totalRequests.toLocaleString(), icon: <Activity size={14} className="text-blue-500" />, color: 'bg-blue-50 border-blue-100' },
                    { label: 'Total Tokens', value: usageStats.totalTokens >= 1000 ? `${(usageStats.totalTokens / 1000).toFixed(1)}k` : usageStats.totalTokens.toString(), icon: <Zap size={14} className="text-amber-500" />, color: 'bg-amber-50 border-amber-100' },
                    { label: 'Platform Spend', value: `$${usageStats.totalCost.toFixed(4)}`, icon: <DollarSign size={14} className="text-emerald-500" />, color: 'bg-emerald-50 border-emerald-100' },
                  ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-3 flex flex-col gap-1 ${s.color}`}>
                      <div className="flex items-center gap-1">{s.icon}<p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</p></div>
                      <p className="text-base md:text-xl font-black text-slate-800">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-user breakdown */}
              {usageStats.perUser && usageStats.perUser.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Usage by User — click a row to drill down</p>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                    {usageStats.perUser.map((u: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => openUserDetail(u)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 text-[10px] font-black text-violet-600">
                            {(u.name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 truncate">{u.name || 'Unknown'}</p>
                            <p className="text-[9px] text-slate-400 truncate">{u.email} · <span className="uppercase">{u.role}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-3">
                          <span className="text-[10px] font-bold text-slate-500">{Number(u.requests).toLocaleString()} calls</span>
                          <span className="text-[10px] font-bold text-slate-500">{Number(u.tokens).toLocaleString()} tok</span>
                          <span className="text-[10px] font-bold text-emerald-600 w-16 text-right">${parseFloat(u.cost).toFixed(4)}</span>
                          <ChevronRight size={12} className="text-slate-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-model breakdown */}
              {(usageStats.byModel?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">By Model</p>
                  <div className="space-y-2">
                    {(usageStats.byModel ?? []).map((m: any, i: number) => {
                      const maxCost = Math.max(...(usageStats.byModel ?? []).map((x: any) => parseFloat(x.cost)));
                      const pct = maxCost > 0 ? (parseFloat(m.cost) / maxCost) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-600 w-32 truncate shrink-0">{m.model}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="h-2 rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 w-16 text-right shrink-0">{Number(m.tokens).toLocaleString()} tok</span>
                          <span className="text-[10px] font-bold text-emerald-600 w-16 text-right shrink-0">${parseFloat(m.cost).toFixed(4)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent call log — collapsible */}
              {(usageStats.recentHistory?.length ?? 0) > 0 && (
                <div>
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="w-full flex items-center justify-between group mb-2"
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent API Calls</p>
                    <span className={`text-slate-300 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`}>
                      <ChevronRight size={14} className={`transition-transform duration-200 ${historyOpen ? 'rotate-90' : ''}`} />
                    </span>
                  </button>
                  {historyOpen && (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                      {(usageStats.recentHistory ?? []).slice(0, 8).map((h: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                          <div className="flex items-center gap-3 min-w-0">
                            <Cpu size={12} className="text-violet-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-700 truncate">{h.purpose || 'AI call'}</p>
                              <p className="text-[9px] text-slate-400">
                                {h.model} · {new Date(h.created_at).toLocaleString()}
                                {h.user_name && <span className="ml-1 text-violet-400">· {h.user_name}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 ml-4">
                            <span className="text-[10px] font-bold text-slate-500">{Number(h.total_tokens).toLocaleString()} tok</span>
                            <span className="text-[10px] font-bold text-emerald-600">${parseFloat(h.estimated_cost_usd).toFixed(5)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {usageStats.totalRequests === 0 && (
                <div className="text-center py-8">
                  <Cpu size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">No AI calls recorded yet. Usage will appear here as the system processes manuscripts.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User AI Usage Detail Modal */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
              onClick={() => setSelectedUser(null)}
            >
              <motion.div
                initial={{ scale: 0.93, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.93, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center font-black text-violet-600">
                      {(selectedUser.name || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{selectedUser.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{selectedUser.email} · <span className="uppercase">{selectedUser.role}</span></p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="overflow-y-auto custom-scrollbar flex-1 p-7 space-y-6">
                  {loadingUserDetail && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={24} className="animate-spin text-violet-400" />
                    </div>
                  )}

                  {userDetail && (
                    <>
                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total Calls', value: Number(userDetail.summary.requests).toLocaleString(), color: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
                          { label: 'Total Tokens', value: Number(userDetail.summary.tokens) >= 1000 ? `${(Number(userDetail.summary.tokens)/1000).toFixed(1)}k` : String(userDetail.summary.tokens), color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                          { label: 'Total Cost', value: `$${parseFloat(userDetail.summary.cost).toFixed(4)}`, color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                        ].map((s, i) => (
                          <div key={i} className={`rounded-xl border p-4 ${s.color}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
                            <p className={`text-xl font-black ${s.text}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* By pipeline phase */}
                      {userDetail.byPurpose.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">By Pipeline Phase</p>
                          <div className="space-y-2">
                            {userDetail.byPurpose.map((p: any, i: number) => {
                              const maxC = Math.max(...userDetail.byPurpose.map((x: any) => parseFloat(x.cost)));
                              const pct = maxC > 0 ? (parseFloat(p.cost) / maxC) * 100 : 0;
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-slate-600 w-36 truncate shrink-0 capitalize">{(p.purpose || 'ai_call').replace(/_/g, ' ')}</span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-1.5 rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-400 w-10 text-right shrink-0">{p.calls}×</span>
                                  <span className="text-[10px] font-bold text-emerald-600 w-16 text-right shrink-0">${parseFloat(p.cost).toFixed(4)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Call history */}
                      {userDetail.history.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Call History (last 50)</p>
                          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                            {userDetail.history.map((h: any, i: number) => (
                              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-slate-700 capitalize">{(h.purpose || 'ai_call').replace(/_/g, ' ')}</p>
                                  <p className="text-[9px] text-slate-400">{h.model} · {new Date(h.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-4 shrink-0 ml-3">
                                  <span className="text-[10px] font-bold text-slate-500">{Number(h.total_tokens).toLocaleString()} tok</span>
                                  <span className="text-[10px] font-bold text-emerald-600">${parseFloat(h.estimated_cost_usd).toFixed(5)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'User Management', desc: 'View and manage all registered users', icon: <Users className="text-indigo-600" size={24} />, tab: 'users' as const, color: 'bg-indigo-50', border: 'border-indigo-100', hover: 'hover:border-indigo-300' },
            { label: 'Review Queue', desc: 'Approve or reject pending manuscripts', icon: <FileText className="text-amber-600" size={24} />, tab: 'reviewQueue' as const, color: 'bg-amber-50', border: 'border-amber-100', hover: 'hover:border-amber-300' },
            { label: 'Platform Settings', desc: 'Configure pricing and system parameters', icon: <Eye className="text-emerald-600" size={24} />, tab: 'settings' as const, color: 'bg-emerald-50', border: 'border-emerald-100', hover: 'hover:border-emerald-300' },
          ].map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => onNavigate(action.tab)}
              className={`bg-white p-7 rounded-[1.5rem] shadow-sm border ${action.border} ${action.hover} transition-all text-left group`}
            >
              <div className={`p-4 ${action.color} rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
              <p className="text-sm font-bold text-slate-800">{action.label}</p>
              <p className="text-xs text-slate-400 mt-1">{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  // ─── LECTURER / ACADEMIC DASHBOARD ─────────────────────────────────────────────
  if (isLecturer) {
    const lecturerStats = [
      { label: 'Active Students', value: profile?.lecturerStats?.totalStudents || 0, icon: <Users size={20} className="text-indigo-600" />, color: 'bg-indigo-50' },
      { label: 'Assessments Set', value: profile?.lecturerStats?.totalExams || 0, icon: <FileText size={20} className="text-blue-600" />, color: 'bg-blue-50' },
      { label: 'Materials Uploaded', value: profile?.lecturerStats?.totalMaterials || 0, icon: <CheckCircle size={20} className="text-emerald-600" />, color: 'bg-emerald-50' },
    ];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
             <img src="/gmijp-logo.png" className="w-64 h-64 object-contain rounded-full bg-white/5 p-4" alt="" />
           </div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/30 mb-3 inline-block">Lecturer Workspace</span>
                <h2 className="text-4xl font-bold font-display mb-2">Academic Dashboard</h2>
                <p className="text-indigo-200 text-lg font-medium">Manage your courses, students, exams and attendance with AI.</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {lecturerStats.map((stat, i) => (
             <div key={i} className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>{stat.icon}</div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
             </div>
           ))}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 text-center">
            <img src="/gmijp-logo.png" className="w-16 h-16 mx-auto mb-4 opacity-50 bg-slate-50 rounded-full p-2 shadow-sm" alt="Logo" />
            <h3 className="text-xl font-bold text-slate-900">Workspace Active</h3>
            <p className="text-slate-500 mt-2">Use the navigation menu to manage students or create new assessments.</p>
        </div>
      </motion.div>
    );
  }

  // ─── RESEARCHER DASHBOARD ────────────────────────────────────────
  const researcherStats = [
    { label: 'My Papers', value: papers.length.toString(), icon: <FileText className="text-blue-600" size={24} />, color: 'bg-blue-50' },
    { label: 'Published', value: papers.filter((p: any) => p.status === 'published').length.toString(), icon: <CheckCircle className="text-emerald-600" size={24} />, color: 'bg-emerald-50' },
    { label: 'In Progress', value: papers.filter((p: any) => p.status !== 'published').length.toString(), icon: <AlertCircle className="text-amber-600" size={24} />, color: 'bg-amber-50' },
    { label: 'Total Citations', value: profile?.profile?.metrics?.citations?.toString() || '0', icon: <TrendingUp className="text-indigo-600" size={24} />, color: 'bg-indigo-50' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-8 pb-12"
    >
      {/* Welcome Section */}
      <div className="relative overflow-hidden premium-gradient rounded-[1.25rem] md:rounded-[2rem] p-5 md:p-10 text-white shadow-2xl shadow-indigo-900/20">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-white flex items-center justify-center p-8 shadow-2xl border border-dashed border-slate-200 overflow-hidden opacity-40">
            <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center sm:items-center justify-between gap-4 md:gap-8 text-center sm:text-left">
          <div className="flex-1 md:border-r border-white/10 md:pr-8">
            <h2 className="text-xl md:text-4xl font-bold font-display mb-1 md:mb-3 tracking-tight">
              Welcome back, {profile?.profile?.name || profile?.user?.name?.split(' ')[0] || 'Researcher'}
            </h2>
            <p className="text-indigo-100/80 text-xs md:text-lg max-w-xl font-medium leading-relaxed">
              Factory running: <span className="text-white font-bold">{papers.filter((p: any) => p.status !== 'published').length} manuscripts</span> pending.
            </p>
          </div>
          <div className="flex flex-col items-center sm:items-end justify-center w-full sm:w-auto shrink-0 gap-3 md:gap-6">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('upload')}
                className="shrink-0 bg-white text-indigo-600 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 hover:bg-indigo-50 text-sm"
            >
                <UploadCloud size={20} strokeWidth={2.5} />
                Elevate Manuscript
            </motion.button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {researcherStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-4 md:p-7 rounded-2xl md:rounded-[1.5rem] shadow-sm border border-slate-200 hover:shadow-md transition-all group"
          >
            <div className={`p-3 md:p-4 ${stat.color} rounded-xl md:rounded-2xl w-fit mb-2 md:mb-4 group-hover:scale-110 transition-transform`}>
              <div className="scale-75 md:scale-100">{stat.icon}</div>
            </div>
            <div>
              <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight mt-0.5">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Papers */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg md:text-xl font-bold text-slate-800 font-display">My Research Pipeline</h3>
          <button onClick={() => onNavigate('records')} className="text-indigo-600 text-xs md:text-sm font-bold hover:underline">View History</button>
        </div>
        <div className="divide-y divide-slate-100">
          {papers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-slate-300" size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-800">No manuscripts found</h4>
              <p className="text-slate-500 mt-1">Start by uploading your first paper to our AI engine.</p>
            </div>
          ) : papers.map((paper: any, idx: number) => (
            <motion.div
              key={paper.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className="p-5 md:p-8 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="text-slate-500" size={24} />
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-slate-900 text-lg truncate">{paper.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                        ${paper.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          paper.status === 'ready' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse' :
                          'bg-slate-50 text-slate-500 border-slate-100'}
                      `}>
                        {paper.status}
                      </span>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Clock size={12} /> {new Date(paper.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {paper.status !== 'published' && (
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {paper.status === 'ready' ? (
                    <button
                      onClick={() => {
                        setActivePaperId(paper.id);
                        onNavigate('transactions');
                      }}
                      className="flex items-center gap-2 premium-gradient text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#800000]/20 hover:scale-105"
                    >
                      Pay & Distribute
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePaperClick(paper.id)}
                      className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-slate-200 group"
                    >
                      Continue
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              )}

              {/* Republish button — published papers only, when admin has enabled it */}
              {paper.status === 'published' && republishConfig?.enabled && (
                <div className="flex flex-col items-end gap-1 self-end sm:self-center">
                  {republishedIds.has(paper.id) ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100">
                        <CheckCircle size={14} /> Queued for republication
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Re-entering publication pipeline…</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRepublishModal({ paperId: paper.id, title: paper.title })}
                      disabled={republishingId === paper.id}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    >
                      {republishingId === paper.id
                        ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                        : <><RefreshCw size={15} /> Republish</>}
                    </button>
                  )}
                  {!republishedIds.has(paper.id) && republishConfig.paid && republishConfig.amount > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">Fee: ₦{republishConfig.amount.toLocaleString()}</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Republish Confirmation Modal */}
      <AnimatePresence>
        {republishModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <RefreshCw size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Republish Manuscript</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">This will re-enter the publication pipeline</p>
                  </div>
                </div>
                <button onClick={() => { setRepublishModal(null); setRepublishError(null); }} className="p-2 rounded-xl hover:bg-slate-100">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                You are about to republish <strong className="text-slate-800">"{republishModal.title}"</strong>.
                The manuscript will go through formatting and publication again with the latest journal settings.
              </p>

              {republishConfig?.paid && republishConfig.amount > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 font-medium space-y-1">
                  <p className="font-black">Payment Required</p>
                  <p>A fee of <strong>₦{republishConfig.amount.toLocaleString()}</strong> is required to republish.</p>
                  <p className="text-xs text-amber-600 mt-1">Choose your preferred payment method in the next step. Republishing starts automatically after payment.</p>
                </div>
              )}

              {republishError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {republishError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setRepublishModal(null); setRepublishError(null); }}
                  disabled={republishingId === republishModal?.paperId}
                  className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {republishConfig?.paid && republishConfig.amount > 0 ? (
                  <button
                    onClick={() => setShowRepublishPayment(true)}
                    disabled={republishingId === republishModal?.paperId}
                    className="flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {republishingId === republishModal?.paperId
                      ? <><Loader2 size={15} className="animate-spin" /> Republishing…</>
                      : <>Pay ₦{republishConfig.amount.toLocaleString()} & Republish <ArrowRight size={14} /></>}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRepublish(republishModal!.paperId)}
                    disabled={republishingId === republishModal?.paperId}
                    className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {republishingId === republishModal?.paperId
                      ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                      : <><RefreshCw size={15} /> Confirm Republish</>}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GeniusPaymentModal for paid republish — supports both Paystack and Kora */}
      {showRepublishPayment && republishModal && republishConfig && (
        <GeniusPaymentModal
          amount={republishConfig.amount}
          courseName={`Republish: ${republishModal.title}`}
          courseId={String(republishModal.paperId)}
          token={localStorage.getItem('token')}
          type="republish"
          addToast={(msg, type) => {
            if (type === 'error') setRepublishError(msg);
          }}
          onPaymentReference={(ref) => setPendingRepublishRef(ref)}
          onSuccess={() => {
            setShowRepublishPayment(false);
            handleRepublish(republishModal.paperId, pendingRepublishRef || undefined);
          }}
          onClose={() => {
            setShowRepublishPayment(false);
            setPendingRepublishRef(null);
          }}
        />
      )}
    </motion.div>
  );
}
