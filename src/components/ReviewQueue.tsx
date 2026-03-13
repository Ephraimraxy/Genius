import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle, XCircle, Clock, User, AlertTriangle, Filter, RefreshCw, Eye, ChevronDown, ArrowUpRight } from 'lucide-react';

interface Paper {
  id: number;
  title: string;
  status: string;
  doi: string;
  created_at: string;
  researcher_name: string;
  researcher_email: string;
}

export default function ReviewQueue({ profile }: { profile: any }) {
  const adminStats = profile?.adminStats;
  const allPapers: Paper[] = adminStats?.allPapers || [];
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [papers, setPapers] = useState<Paper[]>(allPapers);

  useEffect(() => {
    setPapers(allPapers);
  }, [allPapers]);

  const handleStatusChange = async (paperId: number, newStatus: string) => {
    setUpdatingId(paperId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/papers/${paperId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status: newStatus } : p));
      }
    } catch (err) {
      console.error('Failed to update paper status', err);
    }
    setUpdatingId(null);
  };

  const pendingStatuses = ['uploaded', 'formatting', 'peer_review', 'integrity_check'];
  const filteredPapers = papers.filter(p => {
    if (statusFilter === 'pending') return pendingStatuses.includes(p.status);
    if (statusFilter === 'ready') return p.status === 'ready';
    if (statusFilter === 'published') return p.status === 'published';
    if (statusFilter === 'rejected') return p.status === 'rejected';
    return true;
  });

  const stats = {
    pending: papers.filter(p => pendingStatuses.includes(p.status)).length,
    ready: papers.filter(p => p.status === 'ready').length,
    published: papers.filter(p => p.status === 'published').length,
    rejected: papers.filter(p => p.status === 'rejected').length,
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    uploaded: { label: 'Uploaded', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
    formatting: { label: 'Formatting', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    peer_review: { label: 'Peer Review', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    integrity_check: { label: 'Integrity Check', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    ready: { label: 'Ready', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    published: { label: 'Published', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] rounded-[2rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10"><FileText size={180} /></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30">Admin Only</span>
          </div>
          <h2 className="text-4xl font-bold font-display mb-3 tracking-tight">Review Queue</h2>
          <p className="text-slate-300 text-lg max-w-xl font-medium">
            <span className="text-amber-300 font-bold">{stats.pending} manuscripts</span> pending review, <span className="text-emerald-300 font-bold">{stats.published} published</span>.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, icon: <Clock className="text-amber-600" size={20} />, color: 'bg-amber-50', border: 'border-amber-100', filter: 'pending' },
          { label: 'Ready', value: stats.ready, icon: <AlertTriangle className="text-indigo-600" size={20} />, color: 'bg-indigo-50', border: 'border-indigo-100', filter: 'ready' },
          { label: 'Published', value: stats.published, icon: <CheckCircle className="text-emerald-600" size={20} />, color: 'bg-emerald-50', border: 'border-emerald-100', filter: 'published' },
          { label: 'Rejected', value: stats.rejected, icon: <XCircle className="text-red-600" size={20} />, color: 'bg-red-50', border: 'border-red-100', filter: 'rejected' },
        ].map((stat, i) => (
          <motion.button key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => setStatusFilter(stat.filter)}
            className={`bg-white p-5 rounded-[1.5rem] shadow-sm border hover:shadow-md transition-all text-left ${statusFilter === stat.filter ? 'ring-2 ring-amber-500/30 ' + stat.border : stat.border}`}>
            <div className={`p-2.5 ${stat.color} rounded-xl w-fit mb-2`}>{stat.icon}</div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stat.value}</p>
          </motion.button>
        ))}
      </div>

      {/* Papers List */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
            <FileText size={20} className="text-[#800000]" />
            {statusFilter === 'pending' ? 'Pending Review' : statusFilter === 'ready' ? 'Ready for Publication' : statusFilter === 'published' ? 'Published Papers' : 'Rejected Papers'}
          </h3>
          <span className="text-xs font-bold text-slate-400">{filteredPapers.length} manuscripts</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredPapers.length === 0 ? (
            <div className="p-16 text-center">
              <FileText className="text-slate-200 mx-auto mb-3" size={40} />
              <p className="text-sm font-bold text-slate-400">No manuscripts in this category.</p>
            </div>
          ) : filteredPapers.map((paper) => {
            const cfg = statusConfig[paper.status] || statusConfig.uploaded;
            return (
              <motion.div key={paper.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="px-8 py-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate mb-1">{paper.title}</h4>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User size={12} /> {paper.researcher_name || 'Unknown'} · {paper.researcher_email}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock size={12} /> {new Date(paper.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {paper.status !== 'published' && paper.status !== 'rejected' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(paper.id, 'ready')}
                          disabled={updatingId === paper.id || paper.status === 'ready'}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-40">
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(paper.id, 'rejected')}
                          disabled={updatingId === paper.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200 hover:bg-red-100 transition-all disabled:opacity-40">
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}
                    {paper.status === 'rejected' && (
                      <button
                        onClick={() => handleStatusChange(paper.id, 'uploaded')}
                        disabled={updatingId === paper.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-40">
                        <RefreshCw size={14} /> Restore
                      </button>
                    )}
                    {updatingId === paper.id && (
                      <RefreshCw size={16} className="animate-spin text-slate-400" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
