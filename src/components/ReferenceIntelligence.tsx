import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Library, CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink, AlertCircle, Search, Microscope, Database, FileSearch, Sparkles } from 'lucide-react';

export default function ReferenceIntelligence({ activePaperId }: { activePaperId: number | null }) {
  const [references, setReferences] = useState<any[]>([]);
  const [inTextCitations, setInTextCitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
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
          setInTextCitations(data.inTextCitations || []);
        })
        .catch(err => setError('Bibliographic validation failed. External API connectivity issue.'))
        .finally(() => setIsLoading(false));
    }
  }, [activePaperId]);

  if (!activePaperId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-6">
        <div className="p-6 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
          <Library size={48} className="text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800">Reference Engine Standby</p>
          <p className="text-slate-500 mt-2 font-medium">Ingest a manuscript to initiate Crossref citation validation.</p>
        </div>
      </div>
    );
  }

  const verifiedCount = references.filter(r => r.status === 'verified').length;
  const issueCount = references.length - verifiedCount;

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
            Bibliographic Intelligence
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Global citation auditing via Crossref with real-time DOI resolution.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-40 text-slate-400">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
          </div>
          <p className="font-bold text-slate-900 mt-8 tracking-widest uppercase text-xs">Crossref Sync in Progress</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 text-rose-600 p-6 rounded-[2rem] border border-rose-100 flex items-center gap-4">
          <AlertCircle size={24} />
          <span className="font-bold">{error}</span>
        </div>
      ) : (
        <div className="flex-1 space-y-10">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6 group hover:border-indigo-200 transition-all">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Database size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Citations</p>
                <p className="text-3xl font-bold text-slate-900">{references.length}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6 group hover:border-emerald-200 transition-all">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verified (DOI)</p>
                <p className="text-3xl font-bold text-slate-900">{verifiedCount}</p>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6 group hover:border-amber-200 transition-all">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={32} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Resolution Issues</p>
                <p className="text-3xl font-bold text-slate-900">{issueCount}</p>
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
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Sort: Status
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {references.length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-medium">No citations detected in document architecture.</div>
              ) : references.map((ref, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="p-10 hover:bg-slate-50/50 transition-colors group"
                >
                  <div className="flex items-start gap-8">
                    <div className="shrink-0 mt-1">
                      {ref.status === 'verified' ? (
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                          <CheckCircle size={24} />
                        </div>
                      ) : ref.status === 'not_found' ? (
                        <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                          <AlertTriangle size={24} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                          <XCircle size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 text-lg leading-relaxed font-medium group-hover:text-slate-900 transition-colors">{ref.original}</p>

                      <AnimatePresence>
                        {ref.status === 'verified' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-6 bg-slate-900 rounded-2xl p-6 text-slate-300 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 block">System Resolution</span>
                                <p className="text-white font-bold leading-tight">{ref.title}</p>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 block">DOI Identifier</span>
                                <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-2 font-mono font-bold">
                                  {ref.doi} <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {ref.status === 'not_found' && (
                        <div className="mt-4 flex items-center gap-3 text-amber-600 bg-amber-50/50 px-4 py-2 rounded-xl border border-amber-100 w-fit">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">Reference not found in global registries</span>
                        </div>
                      )}

                      {ref.status === 'error' && (
                        <div className="mt-4 flex items-center gap-3 text-rose-600 bg-rose-50/50 px-4 py-2 rounded-xl border border-rose-100 w-fit">
                          <AlertCircle size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">Bibliographic service timeout</span>
                        </div>
                      )}

                      {ref.isCited === false && (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mt-4 flex items-center gap-3 text-amber-700 bg-amber-100/50 px-5 py-3 rounded-2xl border border-amber-200/50 w-fit shadow-lg shadow-amber-900/5"
                        >
                          <Database size={18} />
                          <span className="text-xs font-bold uppercase tracking-widest">Unreferenced Entry: No in-text citation detected</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* In-Text Citations Cluster */}
          {inTextCitations.length > 0 && (
            <div className="bg-[#0f172a] rounded-[3rem] shadow-2xl p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

              <div className="flex items-center justify-between mb-10 border-b border-slate-800 pb-8">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Sparkles size={24} className="text-indigo-400" />
                    Semantic Citation Map
                  </h3>
                  <p className="text-slate-400 text-sm mt-2 font-medium">Neural extraction of in-text cross-references within the document body.</p>
                </div>
                <div className="bg-slate-800 px-6 py-3 rounded-2xl border border-slate-700 font-bold text-indigo-400 shadow-xl">
                  {inTextCitations.length} Nodes Found
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {inTextCitations.slice(0, 30).map((cit, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    className="bg-slate-800/50 text-slate-300 px-4 py-2 rounded-xl text-xs font-mono font-bold border border-slate-700 hover:border-indigo-500 hover:text-white transition-all cursor-default"
                  >
                    {cit.text}
                  </motion.span>
                ))}
                {inTextCitations.length > 30 && (
                  <span className="bg-slate-900 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 border-dashed">
                    +{inTextCitations.length - 30} Neural Nodes
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
