import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, CheckCircle, AlertCircle, Clock, ArrowRight, UploadCloud, TrendingUp, Users, ShieldCheck, Eye, User, ToggleLeft, ToggleRight } from 'lucide-react';
import { Tab } from '../App';

export default function DashboardOverview({ onNavigate, profile, setActivePaperId }: { onNavigate: (tab: Tab) => void, profile: any, setActivePaperId: (id: number) => void }) {
  const papers = profile?.papers || [];
  const isAdmin = profile?.user?.role === 'admin';
  const adminStats = profile?.adminStats;

  // Added toggle for Admin to view User Dashboard
  const [viewMode, setViewMode] = useState<'admin' | 'user'>(isAdmin ? 'admin' : 'user');

  const handlePaperClick = (id: number) => {
    setActivePaperId(id);
    onNavigate('formatting');
  };

  const TopRightToggle = () => {
    if (!isAdmin) return null;
    return (
      <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 mt-4 sm:mt-0 shadow-inner">
        <span className={`text-xs font-bold ${viewMode === 'user' ? 'text-white' : 'text-slate-400'}`}>Researcher View</span>
        <button 
          onClick={() => setViewMode(viewMode === 'admin' ? 'user' : 'admin')}
          className="text-white hover:text-amber-300 transition-colors"
        >
          {viewMode === 'admin' ? <ToggleRight size={28} className="text-amber-400" /> : <ToggleLeft size={28} />}
        </button>
        <span className={`text-xs font-bold ${viewMode === 'admin' ? 'text-amber-400' : 'text-slate-400'}`}>Admin View</span>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD ─────────────────────────────────────────────
  if (isAdmin && adminStats && viewMode === 'admin') {
    const platformStats = [
      { label: 'Registered Users', value: adminStats.totalUsers, icon: <Users className="text-indigo-600" size={24} />, color: 'bg-indigo-50', border: 'border-indigo-100' },
      { label: 'Total Manuscripts', value: adminStats.totalPapers, icon: <FileText className="text-blue-600" size={24} />, color: 'bg-blue-50', border: 'border-blue-100' },
      { label: 'Published Papers', value: adminStats.publishedPapers, icon: <CheckCircle className="text-emerald-600" size={24} />, color: 'bg-emerald-50', border: 'border-emerald-100' },
      { label: 'Pending Review', value: adminStats.pendingReview, icon: <AlertCircle className="text-amber-600" size={24} />, color: 'bg-amber-50', border: 'border-amber-100' },
    ];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
        {/* Admin Welcome */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 text-white shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={180} /></div>
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
              <TopRightToggle />
            </div>
          </div>
        </div>

        {/* Platform Stats Grid */}
        <div className="flex overflow-x-auto pb-4 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 snap-x snap-mandatory hide-scrollbar">
          {platformStats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`min-w-[80vw] sm:min-w-0 snap-center bg-white p-5 md:p-7 rounded-[1.25rem] md:rounded-[1.5rem] shadow-sm border ${stat.border} hover:shadow-md transition-all group`}
            >
              <div className={`p-4 ${stat.color} rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">{stat.value}</p>
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
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm shrink-0 ${user.role === 'admin' ? 'premium-gradient text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {user.name?.[0] || 'U'}
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
      className="space-y-8 pb-12"
    >
      {/* Welcome Section */}
      <div className="relative overflow-hidden premium-gradient rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 text-white shadow-2xl shadow-indigo-900/20">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <div className="w-44 h-44 rounded-full bg-white flex items-center justify-center p-8 shadow-2xl border border-dashed border-slate-200 overflow-hidden opacity-40">
            <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start sm:items-center justify-between gap-8">
          <div className="text-center sm:text-left flex-1 border-r border-white/10 pr-0 sm:pr-8">
            <h2 className="text-2xl md:text-4xl font-bold font-display mb-2 md:mb-3 tracking-tight">
              Welcome back, {profile?.profile?.name || profile?.user?.name?.split(' ')[0] || 'Researcher'}
            </h2>
            <p className="text-indigo-100 text-base md:text-lg max-w-xl font-medium leading-relaxed">
              Your research factory is running. You have <span className="text-white font-bold">{papers.filter((p: any) => p.status !== 'published').length} manuscripts</span> waiting.
            </p>
          </div>
          <div className="flex flex-col items-center sm:items-end justify-center w-full sm:w-auto shrink-0 gap-6">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('upload')}
                className="shrink-0 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 hover:bg-indigo-50"
            >
                <UploadCloud size={22} strokeWidth={2.5} />
                Elevate Manuscript
            </motion.button>
            <TopRightToggle />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {researcherStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 md:p-7 rounded-[1.25rem] md:rounded-[1.5rem] shadow-sm border border-slate-200 hover:shadow-md transition-all group"
          >
            <div className={`p-4 ${stat.color} rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">{stat.value}</p>
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
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
