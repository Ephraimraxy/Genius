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

interface ValidationResult {
  title: { isTitleCase: boolean };
  abstract: { wordCount: number; isValid: boolean; issues?: Issue[] };
  keywords: { count: number; isValid: boolean };
  wordCount: { total: number; isValid: boolean };
  sections: { found: string[]; missing: string[] };
  score: number;
  rejectionReason?: string;
  recoveryFix?: string;
  finalDecision: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
}

export default function APAValidator({ activePaperId, setActivePaperId, onNavigate }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void, onNavigate?: (tab: string) => void }) {
  const [isValidating, setIsValidating] = useState(false);
  const [isFixing, setIsFixing] = useState<number | null>(null);
  const [isBatchFixing, setIsBatchFixing] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [paper, setPaper] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
      setResult(null);
      setError(null);
      setPaper(null);
      
      // Fetch paper details for preview
      fetch(`/api/papers/${activePaperId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => setPaper(data))
        .catch(err => console.error('Failed to fetch paper for preview:', err));
    }
  }, [activePaperId]);

  const runValidation = async () => {
    if (!activePaperId) return;
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/manuscript/validate-apa/${activePaperId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
      // Re-run validation after fix
      await runValidation();
    } catch (err) {
      console.error(err);
    } finally {
      setIsFixing(null);
    }
  };

  const applyBatchFix = async () => {
    if (!activePaperId) return;
    const itemsToFix = allIssues.filter(item => item.issue.aiRewrite);
    if (itemsToFix.length === 0) return;

    setIsBatchFixing(true);
    try {
      const res = await fetch(`/api/manuscript/auto-fix/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          fixes: itemsToFix.map(item => ({ target: item.target, content: item.issue.aiRewrite })) 
        })
      });
      if (!res.ok) throw new Error('Failed to apply batch fixes');
      await runValidation();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchFixing(false);
    }
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue 
        expectedStatus="writing_assistant" 
        onSelect={setActivePaperId} 
        title="APA Protocol Gatekeeper" 
        icon={ShieldCheck} 
        emptyMessage="No manuscripts pending APA validation." 
      />
    );
  }

  // Aggregate issues
  const allIssues: { issue: Issue, target: string }[] = [];
  if (result?.abstract?.issues) {
    result.abstract.issues.forEach(i => allIssues.push({ issue: i, target: 'abstract' }));
  }
  if (result?.sections?.missing?.length) {
    allIssues.push({
      issue: {
        type: 'missing_section',
        section: 'Document Body',
        message: `Missing mandatory sections: ${result.sections.missing.join(', ')}`,
        suggestion: 'Please revise the manuscript to include these distinct headings.',
        whereToFind: 'Ensure Introduction, Methods, Results, Discussion, and Conclusion are explicitly written as headers.'
      },
      target: 'sections'
    });
  }
  if (result?.wordCount && result.wordCount.total > 4500) {
    allIssues.push({
      issue: {
        type: 'word_count',
        section: 'Total Word Count',
        message: `Manuscript exceeds 4500 words (Current: ${result.wordCount.total}).`,
        suggestion: 'Condense your manuscript before proceeding.',
      },
      target: 'word_count'
    });
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-8 pb-10 px-4 md:px-6">
      <div className="max-w-4xl mx-auto items-start">
        {/* Main Column: Validation Info */}
        <div className="space-y-8">
          <div className="text-center md:text-left space-y-4">
            <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 mb-4">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display">APA Rule Engine</h2>
            <p className="text-base text-slate-500 font-medium leading-relaxed">
              Intelligent Gatekeeper enforcing strict APA 7th Edition compliance.
            </p>
          </div>

          {!result && !isValidating && (
            <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-100 text-center">
              <button 
                onClick={runValidation}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 mx-auto shadow-lg shadow-indigo-600/20 transition-all hover:scale-105"
              >
                <Sparkles size={18} /> Run Deep Analysis
              </button>
            </div>
          )}

          {isValidating && (
            <div className="bg-white p-16 rounded-[2rem] shadow-xl border border-slate-100 text-center flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
              <p className="font-black text-indigo-900 uppercase tracking-widest text-sm">Enforcing Journal Standards...</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl font-bold flex flex-col items-center justify-center">
              <p>{error}</p>
              <button onClick={runValidation} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs uppercase tracking-widest hover:bg-rose-500">Retry</button>
            </div>
          )}

          {result && !isValidating && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-8 rounded-[2rem] text-center shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[160px]">
                    <div className="absolute inset-0 premium-gradient opacity-10"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2 relative z-10">Validation Score</p>
                    <div className={`text-6xl font-black ${getScoreColor(result.score)} tracking-tighter relative z-10 drop-shadow-md`}>
                      {result.score}<span className="text-2xl text-slate-600">%</span>
                    </div>
                </div>
                <div className={`col-span-1 md:col-span-2 p-8 rounded-[2rem] border-2 flex flex-col justify-center ${
                  result.finalDecision === 'PASS' ? 'bg-emerald-50 border-emerald-200' : 
                  result.finalDecision === 'NEEDS_REVIEW' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="flex items-center gap-4">
                    {result.finalDecision === 'PASS' ? <CheckCircle2 size={40} className="text-emerald-600" /> : 
                    result.finalDecision === 'NEEDS_REVIEW' ? <AlertTriangle size={40} className="text-amber-600" /> : 
                    <XCircle size={40} className="text-rose-600" />}
                    <div>
                      <h3 className={`text-2xl font-black ${
                        result.finalDecision === 'PASS' ? 'text-emerald-900' : 
                        result.finalDecision === 'NEEDS_REVIEW' ? 'text-amber-900' : 'text-rose-900'
                      }`}>
                        {result.finalDecision === 'PASS' ? 'Approved for Formatting' : 
                        result.finalDecision === 'NEEDS_REVIEW' ? 'Editorial Review Required' : 'Compliance Failure Detected'}
                      </h3>
                      <p className={`font-medium mt-1 ${
                        result.finalDecision === 'PASS' ? 'text-emerald-700' : 
                        result.finalDecision === 'NEEDS_REVIEW' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {result.rejectionReason || (result.finalDecision === 'PASS' ? 'The manuscript meets all structural rules.' : 'The manuscript must be corrected before proceeding.')}
                      </p>
                      {result.recoveryFix && (
                        <div className="mt-3 text-xs font-bold uppercase tracking-wider px-3 py-1 bg-white/50 rounded-lg w-fit">
                          💡 Fix: {result.recoveryFix}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {allIssues.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <AlertTriangle className="text-amber-500" /> Required Corrections
                      </h3>
                      {allIssues.some(i => i.issue.aiRewrite) && (
                        <button
                          onClick={applyBatchFix}
                          disabled={isBatchFixing || isFixing !== null}
                          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/20"
                        >
                          {isBatchFixing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          Bulk Inject All Fixes
                        </button>
                      )}
                    </div>
                    
                    {allIssues.map((item, idx) => (
                      <div key={idx} className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:border-indigo-300 transition-colors">
                        <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                              <AlertTriangle size={20} />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-lg mb-1">Issue: {item.issue.section || 'General'}</p>
                              <p className="text-slate-600 font-medium">{item.issue.message}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-6 md:p-8 space-y-6">
                          <div className="flex gap-3">
                            <RefreshCw className="text-indigo-500 shrink-0 mt-1" size={18} />
                            <div>
                              <p className="font-bold text-slate-900 text-sm">Suggested Action</p>
                              <p className="text-slate-600 text-sm mt-1">{item.issue.suggestion}</p>
                            </div>
                          </div>

                          {item.issue.whereToFind && (
                            <div className="flex gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                              <BookOpen className="text-amber-600 shrink-0 mt-1" size={18} />
                              <div>
                                <p className="font-bold text-amber-900 text-sm uppercase tracking-wider text-[10px]">Where to look</p>
                                <p className="text-amber-800 text-sm mt-1">{item.issue.whereToFind}</p>
                              </div>
                            </div>
                          )}

                          {item.issue.aiRewrite && (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                              <p className="font-bold text-indigo-900 text-sm uppercase tracking-wider text-[10px] mb-3 flex items-center gap-2">
                                <Sparkles size={14} className="text-indigo-500" /> AI Rewrite Suggestion
                              </p>
                              <div className="bg-indigo-50 p-5 rounded-2xl text-indigo-900 text-sm leading-relaxed border border-indigo-100 italic">
                                "{item.issue.aiRewrite}"
                              </div>
                              <button
                                onClick={() => applyFix(item.issue, idx, item.target)}
                                disabled={isFixing !== null}
                                className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                              >
                                {isFixing === idx ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                Select & Inject Fix
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {result.finalDecision === 'PASS' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pt-8">
                  <button
                    onClick={() => onNavigate && onNavigate('writing')}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-xl shadow-emerald-900/20"
                  >
                    Proceed to Writing Assistant <ArrowRight size={20} />
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
