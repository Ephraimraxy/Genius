import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Check, X, ArrowRightLeft, Sparkles, Loader2, AlertCircle, Bookmark, MessageSquarePlus, Zap } from 'lucide-react';

export default function WritingAssistant({ activePaperId }: { activePaperId: number | null }) {
  const [activeSuggestion, setActiveSuggestion] = useState<number | null>(0);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [textChunk, setTextChunk] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
      setIsLoading(true);
      fetch(`/api/enhance/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then(res => res.json())
        .then(data => {
          setSuggestions(data.suggestions || []);
          setTextChunk(data.textChunk || '');
          if (data.suggestions?.length > 0) setActiveSuggestion(0);
        })
        .catch(err => setError('Neural processing failed. Please retry.'))
        .finally(() => setIsLoading(false));
    }
  }, [activePaperId]);

  if (!activePaperId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-6">
        <div className="p-6 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
          <Wand2 size={48} className="text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800">Writing Assistant Offline</p>
          <p className="text-slate-500 mt-2 font-medium">Upload a manuscript to initiate semantic enhancement.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 h-full flex flex-col pb-10"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-4">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
              <Zap size={28} />
            </div>
            Neural Prose Enhancer
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Deep-learning refinement for optimized academic tone and structural clarity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[700px]">
        {/* Document View - 7 Columns */}
        <div className="lg:col-span-7 bg-white rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col overflow-hidden">
          <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bookmark className="text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800 tracking-tight">Manuscript Preview</h3>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-slate-600">{suggestions.length} Enhancement Points</span>
            </div>
          </div>
          <div className="p-12 overflow-y-auto font-serif text-xl leading-[2] text-slate-700 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-40">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Parsing Semantics</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -left-6 top-0 bottom-0 w-px bg-slate-100"></div>
                {textChunk}
              </div>
            )}
          </div>
        </div>

        {/* AI Suggestions Panel - 5 Columns */}
        <div className="lg:col-span-5 bg-[#0f172a] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1 premium-gradient"></div>

          <div className="px-10 py-8 border-b border-slate-800/50 bg-slate-900/40 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-3 text-lg">
              <MessageSquarePlus size={22} className="text-indigo-400" />
              AI Recommendations
            </h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{suggestions.length} Active</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <AnimatePresence>
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-20 px-10">
                  <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Check className="text-slate-500" size={32} />
                  </div>
                  <h4 className="text-white font-bold text-xl">Perfect Prose Detected</h4>
                  <p className="text-slate-500 mt-2 font-medium">No significant enhancement opportunities identified in this cluster.</p>
                </div>
              ) : suggestions.map((sug, idx) => {
                const isActive = activeSuggestion === idx;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => setActiveSuggestion(idx)}
                    className={`
                      relative p-8 rounded-[2rem] border transition-all duration-300 cursor-pointer
                      ${isActive
                        ? 'bg-slate-800 border-indigo-500 shadow-2xl shadow-indigo-900/40'
                        : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20">
                        {sug.type}
                      </span>
                      {isActive && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-500"></div>}
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-900/60 p-5 rounded-2xl text-sm text-slate-500 font-medium line-through decoration-rose-500/30">
                        {sug.original}
                      </div>

                      <div className="flex justify-center -my-2 relative z-10">
                        <div className="bg-indigo-600 rounded-full p-2 shadow-lg shadow-black">
                          <ArrowRightLeft size={14} className="text-white rotate-90" />
                        </div>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-sm text-emerald-100 font-bold">
                        {sug.improved}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-8 pt-8 border-t border-slate-700/50"
                        >
                          <p className="text-sm text-slate-400 font-medium leading-relaxed italic mb-8">
                            "{sug.explanation}"
                          </p>
                          <div className="flex gap-4">
                            <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-black">
                              <Check size={20} /> Commit Change
                            </button>
                            <button className="p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl transition-all border border-slate-600">
                              <X size={20} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
