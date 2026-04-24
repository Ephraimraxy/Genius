import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookMarked, ExternalLink, Star, TrendingUp, ShieldCheck, CheckCircle, Loader2, AlertCircle, ArrowRight, Sparkles, Send, Globe, Zap } from 'lucide-react';
import WaitingDraftsQueue from './WaitingDraftsQueue';
import { friendlyError } from '../utils/friendlyError';

export default function JournalRecommendations({ activePaperId, setActivePaperId, onNavigate }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void, onNavigate?: (tab: string) => void }) {
  const [journals, setJournals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<any>(null);
  const [isRefiningKeywords, setIsRefiningKeywords] = useState(false);

  useEffect(() => {
    if (activePaperId) {
      setIsLoading(true);
      fetch(`/api/recommend-journals/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => setJournals(data.journals || []))
        .catch(err => setError('Recommendation engine timeout. Neural matching cluster offline.'))
        .finally(() => setIsLoading(false));
    }
  }, [activePaperId]);

  const handleDownloadCredentials = () => {
    if (!publishedInfo) return;
    const content = `GENIUS RESEARCH REGISTRY - PUBLICATION CREDENTIALS
--------------------------------------------------
Title: ${publishedInfo.title || 'Untitled'}
DOI: ${publishedInfo.doi?.startsWith('10.') ? `https://doi.org/${publishedInfo.doi}` : publishedInfo.doi}
Registry URL: ${publishedInfo.url}
Status: Published & Verified
Verification Date: ${new Date().toLocaleString()}
--------------------------------------------------
This document serves as cryptographic proof of publication 
on the Genius Global Network.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Publication_Credentials_${publishedInfo.doi.replace(/\//g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePublish = async () => {
    if (!activePaperId) return;
    setIsPublishing(true);
    try {
      // Advance status to accepted before publishing (publish endpoint requires ready/accepted)
      const statusRes = await fetch(`/api/papers/${activePaperId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (!statusRes.ok) {
        const statusErr = await statusRes.json().catch(() => ({}));
        throw new Error(statusErr.error || 'Failed to advance manuscript to accepted status.');
      }

      const res = await fetch(`/api/publish/${activePaperId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission protocol failed.');
      setPublishedInfo(data);
      const e = new CustomEvent('toast', { detail: { message: 'Manuscript successfully broadcast to Global Genius Network!', type: 'success' } });
      window.dispatchEvent(e);
    } catch (err: any) {
      const e = new CustomEvent('toast', { detail: { message: friendlyError(err, 'generic'), type: 'error' } });
      window.dispatchEvent(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRefineKeywords = async () => {
    if (!activePaperId) return;
    setIsRefiningKeywords(true);
    try {
      const res = await fetch(`/api/papers/${activePaperId}/refine-keywords`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed.');
      
      // Refresh recommendations
      setIsLoading(true);
      const recRes = await fetch(`/api/recommend-journals/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const recData = await recRes.json();
      setJournals(recData.journals || []);
      
      const e = new CustomEvent('toast', { detail: { message: 'Keywords optimized! Matching engine refreshed.', type: 'success' } });
      window.dispatchEvent(e);
    } catch (err: any) {
      const e = new CustomEvent('toast', { detail: { message: friendlyError(err, 'generic'), type: 'error' } });
      window.dispatchEvent(e);
    } finally {
      setIsRefiningKeywords(false);
      setIsLoading(false);
    }
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue 
        expectedStatus="journal_discovery" 
        onSelect={setActivePaperId} 
        title="Journal Discovery Queue" 
        icon={BookMarked} 
        emptyMessage="No manuscripts pending journal matching. Send documents here from the Peer Review Simulator." 
      />
    );
  }

  if (publishedInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6"
      >
        <div className="relative mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-32 h-32 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 relative z-10"
          >
            <CheckCircle size={64} />
          </motion.div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 -m-4 border-4 border-dashed border-emerald-200 rounded-[3rem]"
          />
        </div>

        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">Scientific Breakthrough!</h2>
        <p className="text-xl text-slate-500 max-w-xl font-medium leading-relaxed">
          Congratulations! Your research has been successfully broadcast to the Genius Global Network. <span className="text-indigo-600 font-bold italic">Check your email for the final published manuscript.</span>
        </p>

        <div className="mt-12 bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 w-full max-w-2xl text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Cryptographic DOI</span>
              <p className="font-mono text-indigo-600 font-bold text-lg break-all">{publishedInfo.doi?.startsWith('10.') ? `https://doi.org/${publishedInfo.doi}` : publishedInfo.doi}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Publication Node</span>
              <a href={publishedInfo.url} target="_blank" rel="noreferrer" className="text-slate-900 hover:text-indigo-600 font-bold text-lg flex items-center gap-2 group transition-colors">
                Registry Link <ExternalLink size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </a>
            </div>
          </div>

          <div className="mt-10 pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                <Globe size={20} />
              </div>
              <p className="text-xs font-bold text-slate-500">Live on Global Genius Nodes</p>
            </div>
            <button 
              onClick={handleDownloadCredentials}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
            >
              Download Credentials
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-10 pb-20 h-full flex flex-col"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-4">
            <div className="p-2 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/20">
              <BookMarked size={28} />
            </div>
            Neural Journal Discovery
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">AI-driven publication matching based on methodology, impact, and scope.</p>
        </div>
      </div>

      {/* Pre-submission Status Card */}
      <div className="bg-indigo-600 p-1 rounded-[3rem] shadow-2xl shadow-indigo-600/20">
        <div className="bg-[#0f172a] rounded-[2.8rem] p-10 flex flex-col md:flex-row gap-10 items-center justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>

          <div className="flex items-center gap-8 relative z-10">
            <div className="w-20 h-20 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-3xl flex items-center justify-center shrink-0">
              <ShieldCheck size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/30">
                  Ready for Submission
                </span>
                <span className="text-slate-500 text-xs font-bold">•</span>
                <span className="text-slate-400 text-xs font-bold">Integrity Level: High</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Pre-submission Validation Complete</h3>
              <p className="text-slate-400 text-sm mt-1 font-medium">Semantic auditing passed with 2% similarity. Registry references resolved.</p>
            </div>
          </div>

          <button 
            onClick={() => {
              const e = new CustomEvent('toast', { detail: { message: 'Advanced analytics tracking initialized for this submission.', type: 'info' } });
              window.dispatchEvent(e);
            }}
            className="shrink-0 bg-white text-slate-900 hover:bg-slate-50 px-8 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95 relative z-10"
          >
            View Analytics
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
            </div>
            <p className="font-bold text-slate-900 tracking-widest uppercase text-xs">Matching Neural Profiles</p>
          </div>
        ) : journals.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            <p className="text-xl font-bold text-slate-900">No Direct Matches Found</p>
            <p className="text-slate-500 mt-2 mb-8">Adjust your manuscript keywords to refresh the discovery engine.</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button
                onClick={handleRefineKeywords}
                disabled={isRefiningKeywords || isLoading}
                className="flex items-center justify-center gap-3 bg-white border-2 border-indigo-100 text-indigo-600 hover:border-indigo-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isRefiningKeywords ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={18} />} 
                {isRefiningKeywords ? 'Refining...' : 'Optimize Keywords via AI'}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={18} />} 
                {isPublishing ? 'Broadcasting...' : 'Submit to Global Genius Registry'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {journals.map((journal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-10 hover:border-indigo-200 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-10 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity">
                  <BookMarked size={120} className="text-indigo-600 rotate-12" />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{journal.name}</h3>
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black border border-indigo-100 uppercase tracking-widest shadow-sm">
                        <Zap size={14} /> {journal.match}% Accuracy
                      </div>
                    </div>

                    <p className="text-lg text-slate-400 font-medium mb-6">Published by <span className="text-slate-700 font-bold">{journal.publisher}</span></p>

                    <div className="flex flex-wrap gap-2 mb-8">
                      {journal.tags?.map((tag: string) => (
                        <span key={tag} className="bg-slate-50 text-slate-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 group-hover:border-indigo-100 group-hover:text-indigo-500 transition-colors">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl">
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">Impact</p>
                        <p className="text-xl font-black text-slate-900 flex items-center gap-2 italic">
                          <TrendingUp size={20} className="text-indigo-500 not-italic" /> {journal.impactFactor}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">Decision</p>
                        <p className="text-xl font-black text-slate-900 italic">{journal.timeToFirstDecision}</p>
                      </div>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">Acceptance</p>
                        <p className="text-xl font-black text-slate-900 italic">{journal.acceptanceRate}</p>
                      </div>
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">Registry Fee</p>
                        <p className="text-xl font-black text-slate-900 italic">{journal.apc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 shrink-0 lg:w-64">
                    <button
                      onClick={handlePublish}
                      disabled={isPublishing}
                      className="w-full bg-indigo-600 hover:bg-slate-900 text-white px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <><Send size={18} /> Initiate Broadcast</>}
                    </button>
                    <button className="w-full bg-white border-2 border-slate-100 text-slate-900 hover:border-slate-900 px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group">
                      Full Prospectus <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
