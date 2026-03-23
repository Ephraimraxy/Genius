import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Library, CheckCircle, XCircle, AlertTriangle, Loader2, Search, Microscope, Database, FileSearch, Sparkles, ArrowRight, Activity, Zap } from 'lucide-react';
import WaitingDraftsQueue from './WaitingDraftsQueue';

export default function ReferenceIntelligence({ activePaperId, setActivePaperId, onNavigate }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void, onNavigate?: (tab: string) => void }) {
  const [references, setReferences] = useState<any[]>([]);
  const [summary, setSummary] = useState({ averageScore: 0, weakReferences: 0, strongReferences: 0 });
  const [inTextCitations, setInTextCitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [fixingRefId, setFixingRefId] = useState<number | null>(null);

  const handleSendToNext = async () => {
    setIsSending(true);
    try {
      await fetch(`/api/papers/${activePaperId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'integrity_check' })
      });
      if (onNavigate) {
        onNavigate('integrity');
      } else {
        setActivePaperId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const fetchReferences = () => {
    setIsLoading(true);
    fetch(`/api/references/${activePaperId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setReferences(data.references || []);
        if (data.summary) setSummary(data.summary);
        setInTextCitations(data.inTextCitations || []);
      })
      .catch(err => setError('Bibliographic validation failed. AI Engine connectivity issue.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (activePaperId) {
      fetchReferences();
    }
  }, [activePaperId]);

  const handleFixReference = async (ref: any) => {
    setFixingRefId(ref.id);
    try {
      const res = await fetch(`/api/references/fix/${ref.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ aiRewrite: ref.aiRewrite })
      });

      if (res.ok) {
        // Update local state to reflect perfect rewrite
        setReferences(prev => prev.map(r => {
          if (r.id === ref.id) {
            return {
              ...r,
              reference: ref.aiRewrite,
              status: 'strong',
              score: 100,
              issues: [],
              suggestion: 'Corrected by AI directly to APA 7th format.',
              aiRewrite: ''
            };
          }
          return r;
        }));
        
        // Update summary scores locally 
        setSummary(prev => ({
          ...prev,
          weakReferences: ref.status === 'weak' ? Math.max(0, prev.weakReferences - 1) : prev.weakReferences,
          strongReferences: ref.status !== 'strong' ? prev.strongReferences + 1 : prev.strongReferences
        }));
      }
    } catch(err) {
      console.error('Failed to fix reference', err);
    } finally {
      setFixingRefId(null);
    }
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue 
        expectedStatus="reference_intel" 
        onSelect={setActivePaperId} 
        title="Reference Intelligence Queue" 
        icon={Library} 
        emptyMessage="No manuscripts pending bibliographic verification. Send documents here from the Format Architect." 
      />
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
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
              <Microscope size={28} />
            </div>
            Reference Intelligence 2.0
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">AI-powered citation auditing, APA 7th scoring, and intelligent auto-correction.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-40 text-slate-400">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
          </div>
          <p className="font-bold text-slate-900 mt-8 tracking-widest uppercase text-xs">AI Auditing in Progress</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 text-rose-600 p-6 rounded-[2rem] border border-rose-100 flex items-center gap-4">
          <AlertTriangle size={24} />
          <span className="font-bold">{error}</span>
        </div>
      ) : (
        <div className="flex-1 space-y-10">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center">
                <Database size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Citations</p>
                <p className="text-3xl font-bold text-slate-900">{references.length}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Strong References</p>
                <p className="text-3xl font-bold text-slate-900">{summary.strongReferences}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                <Activity size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg APA Score</p>
                <p className="text-3xl font-bold text-slate-900">{summary.averageScore}%</p>
              </div>
            </div>
          </div>

          {/* Reference List */}
          <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <FileSearch size={22} className="text-indigo-600" />
                Validation Ledger
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {references.length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-medium">No citations detected in document architecture.</div>
              ) : references.map((ref, idx) => (
                <motion.div
                  key={ref.id || idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="p-10 hover:bg-slate-50/50 transition-colors group"
                >
                  <div className="flex items-start gap-8">
                    <div className="shrink-0 mt-1">
                      {ref.status === 'strong' ? (
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold shadow-inner border border-emerald-100/50">
                          {ref.score}%
                        </div>
                      ) : ref.status === 'moderate' ? (
                        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold shadow-inner border border-amber-100/50">
                          {ref.score}%
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold shadow-inner border border-rose-100/50">
                          {ref.score}%
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                         <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${ref.status === 'strong' ? 'bg-emerald-100 text-emerald-800' : ref.status === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                           {ref.status === 'strong' ? 'Compliant' : ref.status === 'moderate' ? 'Minor Issues' : 'Weak Reference'}
                         </span>
                      </div>
                      <p className="text-slate-700 text-lg leading-relaxed font-serif group-hover:text-slate-900 transition-colors">
                        {ref.reference}
                      </p>

                      <AnimatePresence>
                        {ref.issues && ref.issues.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 bg-rose-50 rounded-2xl p-6 text-rose-900 border border-rose-100/50"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider block mb-3 text-rose-500">Missing Elements Detected</span>
                            <ul className="space-y-2">
                              {ref.issues.map((issue: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  <XCircle size={14} className="text-rose-400" />
                                  {issue}
                                </li>
                              ))}
                            </ul>
                            
                            {ref.suggestion && (
                               <div className="mt-4 pt-4 border-t border-rose-100">
                                 <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 block">AI Editor Suggestion</span>
                                 <p className="text-sm italic">{ref.suggestion}</p>
                               </div>
                            )}

                            {ref.aiRewrite && (
                              <div className="mt-6 p-5 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-indigo-100 relative overflow-hidden group/rewrite">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                  <Sparkles size={120} />
                                </div>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Zap size={12} /> Auto-Formatted APA 7th Fix
                                </span>
                                <p className="text-slate-800 font-serif leading-relaxed mb-4">{ref.aiRewrite}</p>
                                <button
                                  onClick={() => handleFixReference(ref)}
                                  disabled={fixingRefId === ref.id}
                                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                  {fixingRefId === ref.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                  {fixingRefId === ref.id ? 'Applying...' : 'Apply AI Rewrite'}
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                        
                        {ref.status === 'strong' && ref.suggestion && (
                           <div className="mt-4 flex items-center gap-3 text-emerald-600 bg-emerald-50/50 px-5 py-3 rounded-2xl border border-emerald-100 w-fit">
                             <CheckCircle size={18} />
                             <span className="text-xs font-bold uppercase tracking-wider">{ref.suggestion}</span>
                           </div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6">
            <button
              onClick={handleSendToNext}
              disabled={isSending}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-emerald-900/20"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Complete & Send to Integrity Check'}
              {!isSending && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
