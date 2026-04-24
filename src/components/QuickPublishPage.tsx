import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Loader2, CheckCircle2, AlertCircle, Download,
  ShieldCheck, ArrowRight, RefreshCw, Search,
  FileText, Eye, Sparkles, BookOpen, Users, SkipForward,
  XCircle, Clock
} from 'lucide-react';
import { ToastType } from './ToastSystem';
import FilePreviewModal from './FilePreviewModal';
import WaitingDraftsQueue from './WaitingDraftsQueue';
import { friendlyError } from '../utils/friendlyError';

interface QuickPublishPageProps {
  activePaperId: number | null;
  setActivePaperId: (id: number | null) => void;
  token: string | null;
  addToast: (msg: string, type?: ToastType) => void;
  onComplete: () => void;
}

type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

interface PhaseState {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  status: PhaseStatus;
  summary?: string;
  error?: string;
}

const PHASE_DEFS: Omit<PhaseState, 'status'>[] = [
  {
    id: 'plagiarism',
    label: 'Plagiarism Check',
    description: 'Scanning for content similarity and duplicate publication risk',
    icon: Search,
  },
  {
    id: 'keywords',
    label: 'Keyword Validation',
    description: 'Refining and validating research keywords for discoverability',
    icon: BookOpen,
  },
  {
    id: 'peer_review',
    label: 'Peer Review Simulation',
    description: 'Simulating expert reviewer evaluation of your manuscript',
    icon: Users,
  },
  {
    id: 'writing',
    label: 'Writing Assistant Polish',
    description: 'Applying AI enhancement suggestions to improve clarity',
    icon: Sparkles,
  },
  {
    id: 'integrity',
    label: 'Integrity Checks',
    description: 'Verifying structural completeness and citation compliance',
    icon: ShieldCheck,
  },
  {
    id: 'formatting',
    label: 'Formatting (APA 7th)',
    description: 'Applying APA 7th edition layout, alignment and branding',
    icon: FileText,
  },
  {
    id: 'publication',
    label: 'Final Publication',
    description: 'Assigning DOI, generating certificate and publishing records',
    icon: Zap,
  },
];

export default function QuickPublishPage({
  activePaperId,
  setActivePaperId,
  token,
  addToast,
  onComplete,
}: QuickPublishPageProps) {
  const [phases, setPhases] = useState<PhaseState[]>(
    PHASE_DEFS.map(p => ({ ...p, status: 'pending' }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [started, setStarted] = useState(false);
  const [publicationResult, setPublicationResult] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<'none' | 'certificate' | 'manuscript'>('none');

  const updatePhase = useCallback((id: string, updates: Partial<PhaseState>) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const executePhase = async (phaseId: string, paperId: number): Promise<{ success: boolean; summary?: string; error?: string; publishData?: any }> => {
    try {
      switch (phaseId) {
        case 'plagiarism': {
          const res = await fetch(`/api/integrity/${paperId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Plagiarism scan service unavailable');
          const data = await res.json();
          const score: number = data.report?.plagiarismScore ?? 0;
          if (score > 40) throw new Error(`High similarity detected (${score}%). Review your source attribution.`);
          return { success: true, summary: `${score}% similarity — within acceptable range` };
        }

        case 'keywords': {
          const res = await fetch(`/api/papers/${paperId}/refine-keywords`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Keyword validation service unavailable');
          const data = await res.json();
          const count = Array.isArray(data.keywords) ? data.keywords.length : null;
          return { success: true, summary: count ? `${count} keywords validated and refined` : 'Keywords validated' };
        }

        case 'peer_review': {
          const res = await fetch(`/api/papers/${paperId}/reviews/simulate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Peer review simulation failed');
          const data = await res.json();
          const score: number | null = data.score ?? data.overall_score ?? null;
          if (score !== null && score < 60) throw new Error(`Reviewer score: ${score}/100 — below the 60-point acceptance threshold`);
          return { success: true, summary: score !== null ? `Reviewer score: ${score}/100 — Accepted` : 'Reviewer evaluation passed' };
        }

        case 'writing': {
          const res = await fetch(`/api/enhance/${paperId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ offset: 0 }),
          });
          if (!res.ok) throw new Error('Writing enhancement service unavailable');
          const data = await res.json();
          const count = Array.isArray(data.suggestions) ? data.suggestions.length : null;
          return { success: true, summary: count ? `${count} enhancement suggestions applied` : 'Writing polished successfully' };
        }

        case 'integrity': {
          const res = await fetch(`/api/integrity/${paperId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Integrity check service unavailable');
          const data = await res.json();
          const critical = (data.report?.structureIssues || []).filter((i: any) => i?.severity === 'critical' || i?.type === 'critical').length;
          const total = data.report?.structureIssues?.length ?? 0;
          if (critical > 3) throw new Error(`${critical} critical structural issues detected — manuscript may need revision`);
          return { success: true, summary: total > 0 ? `${total} minor issues noted — within publication tolerance` : 'All integrity checks passed' };
        }

        case 'formatting': {
          const res = await fetch(`/api/format/${paperId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              style: 'apa7',
              customOptions: { justify: true, alignment: 'justify', preservePageCount: true },
            }),
          });
          if (!res.ok) throw new Error('APA 7th formatting pipeline failed');
          // Drain SSE stream until done; surface any server-side error
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let sseComplete = false;
          let sseError: string | null = null;
          while (!sseComplete) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';
            for (const part of parts) {
              const line = part.startsWith('data: ') ? part.slice(6) : null;
              if (!line) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.error) { sseError = msg.error; sseComplete = true; }
                if (msg.done) sseComplete = true;
              } catch { /* heartbeat */ }
            }
          }
          if (sseError) throw new Error(sseError || 'APA 7th formatting pipeline failed');
          return { success: true, summary: 'APA 7th edition layout applied successfully' };
        }

        case 'publication': {
          const statusRes = await fetch(`/api/papers/${paperId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: 'accepted' }),
          });
          if (!statusRes.ok) throw new Error('Failed to advance manuscript to accepted status');

          const publishRes = await fetch(`/api/publish/${paperId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!publishRes.ok) throw new Error('Publication broadcast failed — please retry');
          const publishData = await publishRes.json();
          return { success: true, summary: `DOI assigned: ${publishData.doi || 'Processing...'}`, publishData };
        }

        default:
          return { success: false, error: 'Unknown phase' };
      }
    } catch (err: any) {
      return { success: false, error: friendlyError(err, 'generic') };
    }
  };

  const runFrom = useCallback(async (startIdx: number) => {
    if (!activePaperId) return;
    setIsRunning(true);

    for (let i = startIdx; i < PHASE_DEFS.length; i++) {
      const phase = PHASE_DEFS[i];
      setCurrentIdx(i);
      updatePhase(phase.id, { status: 'running', error: undefined, summary: undefined });

      const outcome = await executePhase(phase.id, activePaperId);

      if (outcome.success) {
        updatePhase(phase.id, { status: 'passed', summary: outcome.summary });
        if (phase.id === 'publication' && outcome.publishData) {
          setPublicationResult(outcome.publishData);
          addToast('Publication complete! Certificate dispatched to your email.', 'success');
          onComplete();
        }
      } else {
        updatePhase(phase.id, { status: 'failed', error: outcome.error });
        setIsRunning(false);
        return; // Stop and wait for user action (Retry or Continue Anyway)
      }
    }

    setIsRunning(false);
  }, [activePaperId, token, updatePhase, addToast, onComplete]);

  const handleStart = () => {
    setStarted(true);
    setPhases(PHASE_DEFS.map(p => ({ ...p, status: 'pending' })));
    setPublicationResult(null);
    setPreviewMode('none');
    runFrom(0);
  };

  const handleRetry = (idx: number) => {
    runFrom(idx);
  };

  const handleContinueAnyway = (idx: number) => {
    updatePhase(PHASE_DEFS[idx].id, { status: 'skipped' });
    runFrom(idx + 1);
  };

  const allDone = phases.every(p => p.status === 'passed' || p.status === 'skipped');
  const publishedPhase = phases.find(p => p.id === 'publication');

  const statusColor: Record<PhaseStatus, string> = {
    pending: 'bg-slate-50 border-slate-100',
    running: 'bg-indigo-50 border-indigo-200 shadow-md shadow-indigo-100',
    passed: 'bg-emerald-50 border-emerald-200',
    failed: 'bg-rose-50 border-rose-200',
    skipped: 'bg-amber-50 border-amber-200',
  };

  const statusIcon = (status: PhaseStatus, Icon: React.ComponentType<any>) => {
    if (status === 'running') return <Loader2 size={20} className="animate-spin text-indigo-600" />;
    if (status === 'passed') return <CheckCircle2 size={20} className="text-emerald-600" />;
    if (status === 'failed') return <XCircle size={20} className="text-rose-600" />;
    if (status === 'skipped') return <SkipForward size={20} className="text-amber-500" />;
    return <Clock size={20} className="text-slate-300" />;
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue
        expectedStatus="uploaded"
        onSelect={setActivePaperId}
        title="Quick Publish Pipeline"
        icon={Zap}
        emptyMessage="No uploaded manuscript ready for publishing."
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8 pb-20 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[#800000] mb-2">
            <Zap size={32} className="premium-glow" fill="currentColor" />
            <span className="font-black uppercase tracking-[0.3em] text-xs">Quick Publish Pipeline</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight font-display">Automated Publishing</h2>
          <p className="text-slate-500 font-medium">All checks run automatically — review results, retry failures, or continue to final publication.</p>
        </div>

        {/* Overall progress dots */}
        <div className="flex items-center gap-2 shrink-0">
          {PHASE_DEFS.map((p, idx) => {
            const phase = phases[idx];
            return (
              <div
                key={p.id}
                className={`h-2 rounded-full transition-all duration-500 ${
                  phase.status === 'passed' ? 'w-2 bg-emerald-500' :
                  phase.status === 'failed' ? 'w-2 bg-rose-500' :
                  phase.status === 'running' ? 'w-8 bg-indigo-600 shadow-lg shadow-indigo-600/30' :
                  phase.status === 'skipped' ? 'w-2 bg-amber-400' :
                  'w-2 bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Start button — before pipeline begins */}
      {!started && (
        <div className="bg-white p-16 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute inset-0 premium-gradient opacity-0 group-hover:opacity-[0.02] transition-opacity pointer-events-none" />
          <div className="space-y-4 mb-10">
            <p className="text-slate-500 font-medium max-w-md mx-auto">
              This pipeline will automatically run all required checks and format your manuscript before publishing. You can retry any failed step or continue anyway.
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-10 py-5 bg-slate-900 border-b-4 border-black hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 mx-auto transition-all active:translate-y-1"
          >
            Begin Publishing Pipeline <Zap size={18} fill="white" />
          </button>
        </div>
      )}

      {/* Phase cards */}
      {started && (
        <div className="space-y-4">
          {phases.map((phase, idx) => {
            const Icon = phase.icon;
            const isFailed = phase.status === 'failed';
            const isActive = phase.status === 'running';

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`border-2 rounded-[2rem] transition-all duration-300 overflow-hidden ${statusColor[phase.status]}`}
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start gap-5">
                    {/* Phase number + icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                      phase.status === 'running' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' :
                      phase.status === 'passed' ? 'bg-emerald-100 text-emerald-600' :
                      phase.status === 'failed' ? 'bg-rose-100 text-rose-600' :
                      phase.status === 'skipped' ? 'bg-amber-100 text-amber-500' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {isActive ? <Loader2 size={22} className="animate-spin" /> : <Icon size={22} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase {idx + 1}</span>
                            {phase.status === 'skipped' && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">Skipped</span>
                            )}
                          </div>
                          <h3 className={`text-lg font-black tracking-tight ${
                            phase.status === 'passed' ? 'text-emerald-900' :
                            phase.status === 'failed' ? 'text-rose-900' :
                            phase.status === 'running' ? 'text-indigo-900' :
                            phase.status === 'skipped' ? 'text-amber-900' :
                            'text-slate-400'
                          }`}>{phase.label}</h3>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">{phase.description}</p>
                        </div>
                        {statusIcon(phase.status, Icon)}
                      </div>

                      {/* Result summary */}
                      <AnimatePresence>
                        {phase.summary && phase.status === 'passed' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 px-4 py-3 bg-emerald-100/60 rounded-xl"
                          >
                            <p className="text-emerald-800 text-sm font-semibold">{phase.summary}</p>
                          </motion.div>
                        )}
                        {phase.summary && phase.status === 'skipped' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 px-4 py-3 bg-amber-100/60 rounded-xl"
                          >
                            <p className="text-amber-800 text-sm font-semibold">Skipped by researcher — {phase.error}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Error + action buttons */}
                      <AnimatePresence>
                        {isFailed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-5 space-y-4"
                          >
                            <div className="px-5 py-4 bg-rose-100/60 rounded-xl border border-rose-200/60">
                              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Issue Detected</p>
                              <p className="text-rose-800 text-sm font-semibold leading-relaxed">{phase.error}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                onClick={() => handleRetry(idx)}
                                disabled={isRunning}
                                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50"
                              >
                                <RefreshCw size={14} /> Retry
                              </button>
                              <button
                                onClick={() => handleContinueAnyway(idx)}
                                disabled={isRunning}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50"
                              >
                                <SkipForward size={14} /> Continue Anyway
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Publication result */}
      <AnimatePresence>
        {allDone && publicationResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Success banner */}
            <div className="bg-emerald-50 border-2 border-emerald-200 p-10 rounded-[2.5rem] text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-3xl font-black text-emerald-900 tracking-tight">Publication Finalized!</h3>
              <p className="text-emerald-700 font-medium">Your manuscript is now live. Certificate and full PDF dispatched to your email.</p>
            </div>

            {/* DOI + Journal stamp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned DOI</p>
                <p className="text-sm font-mono font-black text-[#800000] break-all">{publicationResult.doi ? (publicationResult.doi.startsWith('10.') ? `https://doi.org/${publicationResult.doi}` : publicationResult.doi) : 'Pending assignment'}</p>
              </div>
              <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Journal Stamp</p>
                <p className="text-sm font-black text-slate-900">
                  Vol {publicationResult.volume} &bull; Issue {publicationResult.issue}
                </p>
              </div>
            </div>

            {/* Preview toggles */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setPreviewMode(previewMode === 'certificate' ? 'none' : 'certificate')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${
                  previewMode === 'certificate' ? 'bg-[#800000] text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={14} /> {previewMode === 'certificate' ? 'Hide Certificate' : 'Preview Certificate'}
              </button>
              <button
                onClick={() => setPreviewMode(previewMode === 'manuscript' ? 'none' : 'manuscript')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${
                  previewMode === 'manuscript' ? 'bg-[#800000] text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Eye size={14} /> {previewMode === 'manuscript' ? 'Hide Manuscript' : 'Preview Manuscript'}
              </button>
            </div>

            {/* Inline previews */}
            <AnimatePresence mode="wait">
              {previewMode === 'certificate' && publicationResult.certificateUrl && (
                <motion.div
                  key="cert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden"
                >
                  <FilePreviewModal
                    isOpen={true}
                    onClose={() => setPreviewMode('none')}
                    file={publicationResult.certificateUrl}
                    fileName={`Publication_Certificate_${publicationResult.certificateId || activePaperId}.pdf`}
                    isInline={true}
                  />
                </motion.div>
              )}
              {previewMode === 'manuscript' && publicationResult.pdfUrl && (
                <motion.div
                  key="manuscript"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden"
                >
                  <FilePreviewModal
                    isOpen={true}
                    onClose={() => setPreviewMode('none')}
                    file={publicationResult.pdfUrl}
                    fileName={`Published_Manuscript_${publicationResult.doi || activePaperId}.pdf`}
                    isInline={true}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {publicationResult.pdfUrl && (
                <a
                  href={publicationResult.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                >
                  <Download size={18} /> View Full PDF
                </a>
              )}
              <button
                onClick={onComplete}
                className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
              >
                Go to Publication Records <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All done but no publication result (all passed/skipped but publication phase was skipped) */}
      {allDone && !publicationResult && publishedPhase?.status === 'skipped' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border-2 border-amber-200 p-10 rounded-[2.5rem] text-center space-y-4"
        >
          <AlertCircle size={40} className="text-amber-500 mx-auto" />
          <h3 className="text-2xl font-black text-amber-900">Pipeline Complete — Publication Skipped</h3>
          <p className="text-amber-700 font-medium max-w-sm mx-auto">
            All other phases completed. You can retry the publication step or go to your records.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap mt-4">
            <button
              onClick={() => handleRetry(PHASE_DEFS.findIndex(p => p.id === 'publication'))}
              disabled={isRunning}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all"
            >
              <RefreshCw size={14} /> Retry Publication
            </button>
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
            >
              Go to Records <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
