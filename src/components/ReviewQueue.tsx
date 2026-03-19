import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle, XCircle, Clock, User, AlertTriangle, Filter, RefreshCw, Eye, ChevronDown, ArrowUpRight, Edit2 } from 'lucide-react';

interface Paper {
  id: number;
  title: string;
  status: string;
  doi: string;
  volume: string;
  issue: string;
  created_at: string;
  researcher_name: string;
  researcher_email: string;
}

export default function ReviewQueue({ profile, initialStatusFilter = 'pending' }: { profile: any, initialStatusFilter?: string }) {
  const adminStats = profile?.adminStats;
  const allPapers: Paper[] = adminStats?.allPapers || [];
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [papers, setPapers] = useState<Paper[]>(allPapers);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPapers(allPapers);
  }, [allPapers]);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

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

  const handleUpdateMetadata = async () => {
    if (!editingPaper) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/papers/${editingPaper.id}/metadata`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: editingPaper.doi,
          volume: editingPaper.volume,
          issue: editingPaper.issue
        })
      });
      if (res.ok) {
        setPapers(prev => prev.map(p => p.id === editingPaper.id ? editingPaper : p));
        setEditingPaper(null);
      }
    } catch (err) {
      console.error('Failed to update paper metadata', err);
    }
    setIsSaving(false);
  };

  const pendingStatuses = ['uploaded', 'formatting', 'peer_review', 'integrity_check'];
  const filteredPapers = papers.filter(p => {
    if (statusFilter === 'pending') return pendingStatuses.includes(p.status);
    if (statusFilter === 'ready') return p.status === 'ready';
    if (statusFilter === 'published') return p.status === 'published';
    if (statusFilter === 'rejected') return p.status === 'rejected';
    if (statusFilter === 'all') return true;
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

        {/* Table Header Row */}
        <div className="hidden lg:grid grid-cols-[1fr,120px,100px,100px,140px,180px] gap-4 px-8 py-3 bg-slate-100/50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <div>Manuscript</div>
          <div className="text-center">Vol / Issue</div>
          <div className="text-center">Status</div>
          <div className="text-center">Date</div>
          <div className="text-center">DOI / ISSN</div>
          <div className="text-right">Actions</div>
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
                    </div>
                  </div>

                  {/* Volume / Issue */}
                  <div className="hidden lg:flex items-center justify-center w-[120px] shrink-0">
                    <span className="text-xs font-bold text-slate-600">
                      {paper.volume ? `Vol ${paper.volume}` : '—'} / {paper.issue ? `No ${paper.issue}` : '—'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-center w-[100px] shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="hidden lg:flex items-center justify-center w-[100px] shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(paper.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* DOI / ISSN */}
                  <div className="hidden lg:flex flex-col items-center justify-center w-[140px] shrink-0 text-center">
                    <span className="text-[10px] font-bold text-indigo-600 truncate max-w-full">
                      {paper.doi || 'No DOI'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">
                      ISSN: 2476-892X
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {paper.status !== 'published' && paper.status !== 'rejected' && (
                      <>
                        <button
                          onClick={() => setEditingPaper(paper)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                          <Edit2 size={16} />
                        </button>
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

      <AnimatePresence>
        {editingPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
              <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold font-display">Edit Journal Metadata</h3>
                  <p className="text-slate-400 text-xs mt-1">Update Volume, Issue, and DOI for this manuscript.</p>
                </div>
                <button onClick={() => setEditingPaper(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Volume</label>
                    <input type="text" value={editingPaper.volume || ''}
                      onChange={e => setEditingPaper({ ...editingPaper, volume: e.target.value })}
                      placeholder="e.g. 1"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Issue / Number</label>
                    <input type="text" value={editingPaper.issue || ''}
                      onChange={e => setEditingPaper({ ...editingPaper, issue: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">DOI (Digital Object Identifier)</label>
                  <input type="text" value={editingPaper.doi || ''}
                    onChange={e => setEditingPaper({ ...editingPaper, doi: e.target.value })}
                    placeholder="e.g. 10.5555/genius.123"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                </div>

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setEditingPaper(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleUpdateMetadata} disabled={isSaving}
                    className="flex-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                    Save Metadata
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
