import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles, BookOpen, RefreshCw, XCircle } from 'lucide-react';
import WaitingDraftsQueue from './WaitingDraftsQueue';

interface Issue {
  type: string;
  section: string;
  message: string;
  suggestion: string;
  aiRewrite?: string;
  whereToFind?: string;
}

const PHASES = [
  { id: 0, name: "Structure", desc: "Core sections check" },
  { id: 1, name: "Abstract", desc: "APA summary rules" },
  { id: 2, name: "Keywords", desc: "Tagging & labels" },
  { id: 3, name: "Introduction", desc: "Problem & Gap" },
  { id: 4, name: "Methods", desc: "Procedural detail" },
  { id: 5, name: "Results", desc: "Data presentation" },
  { id: 6, name: "Discussion", desc: "Interpretation" },
  { id: 7, name: "Conclusion", desc: "Final takeaways" },
  { id: 8, name: "Citations", desc: "In-text author-date" },
  { id: 9, name: "References", desc: "APA 7th Bibliography" },
  { id: 10, name: "Final Review", desc: "Complete compliance" }
];

export default function APAValidator({ activePaperId, setActivePaperId, onNavigate }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void, onNavigate?: (tab: string) => void }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [isFixing, setIsFixing] = useState<number | null>(null);
  const [isBatchFixing, setIsBatchFixing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [paper, setPaper] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
      setResult(null);
      setError(null);
      setPaper(null);
      setCurrentPhase(0);
      
      fetch(`/api/papers/${activePaperId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => setPaper(data))
        .catch(err => console.error('Failed to fetch paper:', err));
    }
  }, [activePaperId]);

  const runValidation = async (phaseIdx: number) => {
    if (!activePaperId) return;
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/manuscript/validate-apa/${activePaperId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ phase: phaseIdx })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      setResult(data.validation);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const applyFix = async (issue: Issue, index: number, target: string) => {
    if (!activePaperId || !issue.aiRewrite) return;
    setIsFixing(index);
    try {
      const res = await fetch(`/api/manuscript/auto-fix/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ fixes: [{ target, content: issue.aiRewrite }] })
      });
      if (!res.ok) throw new Error('Failed to apply fix');
      await runValidation(currentPhase);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFixing(null);
    }
  };

  const handleNextPhase = async () => {
    if (currentPhase < PHASES.length - 1) {
      const next = currentPhase + 1;
      setCurrentPhase(next);
      setResult(null); // Clear result for next phase validation
      await runValidation(next);
    } else {
      // Final transition to Writing Assistant
      try {
        await fetch(`/api/papers/${activePaperId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ status: 'writing_assistant' })
        });
        onNavigate && onNavigate('writing');
      } catch (err) {
        console.error('Failed to update status:', err);
        onNavigate && onNavigate('writing'); // Navigate anyway
      }
    }
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue 
        expectedStatus="uploading" // Or other status before APA
        onSelect={setActivePaperId} 
        title="APA Protocol Gatekeeper" 
        icon={ShieldCheck} 
        emptyMessage="No manuscripts pending APA validation." 
      />
    );
  }

  const issues = result?.issues || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-8 pb-20 px-4 md:px-6">
      {/* Header with Phase Indicator */}
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
             <div className="flex items-center gap-3 text-indigo-600 mb-2">
                <ShieldCheck size={32} className="premium-glow" />
                <span className="font-black uppercase tracking-[0.3em] text-xs">APA Gatekeeper Phase {currentPhase + 1}</span>
             </div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tight font-display">{PHASES[currentPhase].name}</h2>
             <p className="text-slate-500 font-medium">{PHASES[currentPhase].desc}</p>
          </div>
          <div className="flex items-center gap-2">
             {PHASES.map((p, idx) => (
                <div 
                  key={p.id} 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    idx === currentPhase ? 'w-8 bg-indigo-600 shadow-lg shadow-indigo-600/30' : 
                    idx < currentPhase ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-200'
                  }`}
                />
             ))}
          </div>
        </div>

        {!result && !isValidating && (
          <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden group">
            <div className="absolute inset-0 premium-gradient opacity-0 group-hover:opacity-[0.02] transition-opacity"></div>
            <button 
              onClick={() => runValidation(currentPhase)}
              className="px-10 py-5 bg-slate-900 border-b-4 border-black hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 mx-auto transition-all active:translate-y-1"
            >
              Analyze {PHASES[currentPhase].name} <Sparkles size={18} />
            </button>
          </div>
        )}

        {isValidating && (
          <div className="bg-white p-20 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-200" size={32} />
            </div>
            <p className="font-black text-slate-900 uppercase tracking-widest text-sm mt-8">Neural Compliance Audit In Progress...</p>
          </div>
        )}

        {result && !isValidating && (
          <div className="space-y-8">
            <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl ${
              result.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
               <div className="flex items-start gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    result.isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {result.isValid ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-2xl font-black ${result.isValid ? 'text-emerald-900' : 'text-rose-900'}`}>
                      {result.isValid ? `${PHASES[currentPhase].name} Verified` : `Action Required in ${PHASES[currentPhase].name}`}
                    </h3>
                    <p className={`font-medium mt-2 leading-relaxed ${result.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {result.isValid ? 'No compliance issues found in this phase. You are ready to advance.' : `${issues.length} compliance issue(s) detected that must be resolved.`}
                    </p>

                    <div className="mt-8 flex items-center gap-4">
                      {result.isValid ? (
                        <button 
                          onClick={handleNextPhase}
                          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all shadow-lg shadow-emerald-600/20"
                        >
                          {currentPhase === PHASES.length - 1 ? 'Unlock Writing Assistant' : 'Proceed to Next Step'} <ArrowRight size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => runValidation(currentPhase)}
                          className="px-8 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all"
                        >
                          Re-Analyze <RefreshCw size={18} />
                        </button>
                      )}
                    </div>
                  </div>
               </div>
            </div>

            <AnimatePresence>
              {issues.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                   {issues.map((issue: any, idx: number) => (
                     <div key={idx} className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                        <div className="p-8 space-y-6">
                           <div className="flex items-start gap-4">
                              <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                                <XCircle size={20} />
                              </div>
                              <div className="flex-1">
                                <p className="font-black text-slate-900 uppercase tracking-wider text-xs mb-1">Issue found</p>
                                <p className="text-slate-800 font-bold leading-relaxed">{issue.message}</p>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-50 p-6 rounded-2xl">
                                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-2">Protocol Solution</p>
                                <p className="text-slate-600 text-sm font-medium leading-relaxed">{issue.suggestion}</p>
                              </div>
                              {issue.whereToFind && (
                                <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50">
                                  <p className="font-black text-[10px] uppercase tracking-widest text-amber-500 mb-2">Location Guide</p>
                                  <p className="text-amber-700 text-sm font-medium leading-relaxed italic">{issue.whereToFind}</p>
                                </div>
                              )}
                           </div>

                           {issue.aiRewrite && (
                             <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100 relative group/suggestion">
                                <div className="absolute -top-3 left-8 px-4 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                  <Sparkles size={10} /> Intelligent Fix
                                </div>
                                <p className="text-indigo-900 font-medium italic leading-relaxed text-sm">"{issue.aiRewrite}"</p>
                                <button
                                  onClick={() => applyFix(issue, idx, PHASES[currentPhase].name.toLowerCase())}
                                  disabled={isFixing !== null}
                                  className="mt-6 flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-xs hover:text-indigo-700 transition-colors"
                                >
                                  {isFixing === idx ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                  Inject into active draft
                                </button>
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
