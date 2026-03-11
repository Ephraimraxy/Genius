import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertTriangle, Search, FileSearch, CheckCircle, Loader2, AlertCircle, Fingerprint, Zap, ExternalLink, ArrowRight } from 'lucide-react';

export default function IntegrityChecks({ activePaperId }: { activePaperId: number | null }) {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
      setIsLoading(true);
      fetch(`/api/integrity/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => setReport(data.report))
        .catch(err => setError('Neural integrity scan failed. Connection to plagiarism database interrupted.'))
        .finally(() => setIsLoading(false));
    }
  }, [activePaperId]);

  if (!activePaperId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-6">
        <div className="p-6 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
          <Fingerprint size={48} className="text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800">Integrity Scanning Offline</p>
          <p className="text-slate-500 mt-2 font-medium">Link a manuscript to initiate deep-tissue similarity auditing.</p>
        </div>
      </div>
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
              <ShieldCheck size={28} />
            </div>
            Research Integrity Audit
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Neural scans for similarity indexing, citation fidelity, and registry conflicts.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-1 py-40 text-slate-400">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Fingerprint className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
          </div>
          <p className="font-bold text-slate-900 mt-8 tracking-widest uppercase text-xs">Deep Tissue Scanning in Progress</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 text-rose-600 p-8 rounded-[2rem] border border-rose-100 flex items-center gap-4">
          <AlertCircle size={28} />
          <span className="text-lg font-bold">{error}</span>
        </div>
      ) : report ? (
        <div className="flex-1 space-y-10">
          {/* Hero Section: Similarity Index */}
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
              <div className="relative shrink-0">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor" strokeWidth="12" fill="transparent"
                    className="text-slate-100"
                  />
                  <motion.circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={552.92}
                    initial={{ strokeDashoffset: 552.92 }}
                    animate={{ strokeDashoffset: 552.92 - (552.92 * report.plagiarismScore) / 100 }}
                    className={`${report.plagiarismScore < 15 ? 'text-emerald-500' : 'text-amber-500'}`}
                    strokeLinecap="round"
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-slate-900">{report.plagiarismScore}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Similarity</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-bold uppercase tracking-widest mb-6 shadow-xl">
                  <Zap size={14} className="text-indigo-400" /> Integrity Quotient
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
                  {report.plagiarismScore < 15 
                    ? 'Excellent Originality Profile' 
                    : 'Similarity Threshold Warning'}
                </h3>
                <p className="text-lg text-slate-500 leading-relaxed max-w-2xl font-medium">
                  {report.plagiarismScore < 15
                    ? 'Your manuscript demonstrates a high degree of originality with minimal overlap with existing literature. The detected similarities are primarily standard terminology and technical definitions.'
                    : 'The analysis has identified significant overlap with existing datasets. We recommend reviewing the detailed report to ensure proper paraphrasing and attribution of technical concepts.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Detailed Report Table */}
            <div className="lg:col-span-2 bg-white rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <Search size={22} className="text-indigo-600" />
                  External Source Identification
                </h3>
              </div>
              <div className="p-2 overflow-x-auto">
                {report.detailedReport && report.detailedReport.length > 0 ? (
                  <table className="w-full text-left border-separate border-spacing-2">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        <th className="px-6 py-4">Source Origin</th>
                        <th className="px-6 py-4">Match Strength</th>
                        <th className="px-6 py-4">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.detailedReport.map((item: any, idx: number) => (
                        <motion.tr 
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="group hover:bg-slate-50/80 transition-all cursor-default"
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{item.source}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Digital Object Identifier Trace</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.similarity}%` }}
                                  className={`h-full ${item.similarity > 20 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                                  transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                                />
                              </div>
                              <span className="text-sm font-bold text-slate-900">{item.similarity}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                              item.type === 'Direct Copy' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                              item.type === 'Paraphrasing' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-20 text-center">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <CheckCircle size={40} />
                    </div>
                    <p className="text-xl font-bold text-slate-900">Zero Flags Detected</p>
                    <p className="text-slate-500 mt-2">No significant similarities found in global databases.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Side Intelligence */}
            <div className="space-y-8">
              {/* Citation Mismatches */}
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <FileSearch className="text-indigo-600" size={20} />
                  <h3 className="font-bold text-slate-900">Structural Citation Audit</h3>
                </div>
                <div className="p-8">
                  {report.citationMismatches.length === 0 ? (
                    <div className="flex flex-col items-center text-center">
                      <CheckCircle className="text-emerald-500 mb-4" size={32} />
                      <p className="text-sm font-bold text-slate-800 tracking-tight">Referencing Fidelity Verified</p>
                      <p className="text-xs text-slate-400 mt-2">All citations correctly indexed.</p>
                    </div>
                  ) : (
                    <ul className="space-y-6">
                      {report.citationMismatches.map((mismatch: any, i: number) => (
                        <li key={i} className="flex items-start gap-4">
                          <div className="shrink-0 w-8 h-8 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center">
                            <AlertTriangle size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{mismatch.issue}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mismatch.details}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Duplicate Scan */}
              <div className={`rounded-[2.5rem] shadow-xl p-8 border transition-all ${
                report.duplicateFound 
                  ? 'bg-rose-50 border-rose-100' 
                  : 'bg-white border-slate-100 shadow-slate-200/40'
              }`}>
                <div className="flex items-center gap-3 mb-6">
                  <Search className={report.duplicateFound ? 'text-rose-600' : 'text-indigo-600'} size={24} />
                  <h3 className="font-bold text-slate-900">Registry Conflict Scan</h3>
                </div>
                
                {report.duplicateFound ? (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-rose-700">Warning: Potential Duplicate Detected</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{report.duplicateDetails}</p>
                    <button className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 transition-colors pt-2">
                      Review Conflict Case <ArrowRight size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-emerald-700">No Parallel Submissions Detected</p>
                    <p className="text-xs text-slate-500 leading-relaxed">Manuscript architecture is unique across the ScholarSync network and external registries.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
