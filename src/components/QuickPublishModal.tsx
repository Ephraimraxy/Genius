import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ShieldCheck, 
  ArrowRight,
  X,
  Eye
} from 'lucide-react';
import { ToastType } from './ToastSystem';
import FilePreviewModal from './FilePreviewModal';

interface QuickPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperId: number | null;
  token: string | null;
  addToast: (msg: string, type?: ToastType) => void;
  onComplete?: () => void;
}

type Step = 'idle' | 'fetching_meta' | 'formatting' | 'publishing' | 'complete' | 'error';

export default function QuickPublishModal({ 
  isOpen, 
  onClose, 
  paperId, 
  token, 
  addToast,
  onComplete 
}: QuickPublishModalProps) {
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [journalConfig, setJournalConfig] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<'none' | 'certificate' | 'manuscript'>('none');

  useEffect(() => {
    if (isOpen && paperId && token) {
      startAutomation();
    } else if (!isOpen) {
      // Reset state when closed
      setTimeout(() => {
        setStep('idle');
        setProgress(0);
        setError(null);
        setResult(null);
      }, 300);
    }
  }, [isOpen, paperId, token]);

  const startAutomation = async () => {
    setStep('fetching_meta');
    setProgress(10);
    setError(null);
    setPreviewMode('none');

    try {
      // 1. Fetch Journal Config for Defaults
      const configRes = await fetch('/api/admin/config/journal', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!configRes.ok) throw new Error('Failed to fetch journal configuration');
      const config = await configRes.json();
      setJournalConfig(config);
      setProgress(30);

      // 2. Apply High-Fidelity Formatting & Branding
      setStep('formatting');
      const formatRes = await fetch(`/api/format/${paperId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          style: 'ieee', // Default to IEEE for quick publish
          customOptions: { 
            justify: true, 
            alignment: 'justify',
            preservePageCount: true 
          } 
        })
      });
      if (!formatRes.ok) {
        const errData = await formatRes.json().catch(() => ({}));
        console.warn('Quick publish formatting failed, continuing with structural pipeline.', errData);
        addToast('Formatting skipped due to a processing error. Publishing will continue with structural layout.', 'info');
      } else {
        await formatRes.json();
      }
      setProgress(60);

      // 2.5 Mark as accepted before publishing
      const statusRes = await fetch(`/api/papers/${paperId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (!statusRes.ok) throw new Error('Failed to move manuscript to accepted status');

      // 3. Finalize Publication & Dispatch Records
      setStep('publishing');
      const publishRes = await fetch(`/api/publish/${paperId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!publishRes.ok) throw new Error('Publication broadcast failed');
      const publishData = await publishRes.json();
      setProgress(90);

      // 4. Success
      setResult(publishData);
      setStep('complete');
      setProgress(100);
      addToast('Quick Publish successful! Publication & Certificate dispatched to your email.', 'success');
      if (onComplete) onComplete();

    } catch (err: any) {
      console.error('Quick Publish Error:', err);
      setError(err.message || 'An automated processing error occurred');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#800000] rounded-2xl flex items-center justify-center shadow-lg shadow-[#800000]/20">
              <Zap className="text-white" size={24} fill="white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quick Action Hub</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Automated Refining & Publication</p>
            </div>
          </div>
          {step === 'complete' || step === 'error' ? (
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          ) : (
             <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={16} />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Processing...</span>
             </div>
          )}
        </div>

        <div className="p-10">
          <AnimatePresence mode="wait">
            {step === 'error' ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10"
              >
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-100">
                  <AlertCircle size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Automation Interrupted</h3>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto">{error}</p>
                <button 
                  onClick={startAutomation}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={18} /> Retry Process
                </button>
              </motion.div>
            ) : step === 'complete' ? (
              <motion.div 
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="text-center">
                   <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
                      <CheckCircle2 size={40} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight">Publication Finalized!</h3>
                   <p className="text-slate-500 font-medium mt-1">Your manuscript is now live and your certificate has been emailed.</p>
                </div>

                <div className="flex items-center justify-center gap-3 mb-6">
                    <button 
                      onClick={() => setPreviewMode(previewMode === 'certificate' ? 'none' : 'certificate')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${previewMode === 'certificate' ? 'bg-[#800000] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <ShieldCheck size={14} /> {previewMode === 'certificate' ? 'Hide Certificate' : 'Preview Certificate'}
                    </button>
                    <button 
                      onClick={() => setPreviewMode(previewMode === 'manuscript' ? 'none' : 'manuscript')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${previewMode === 'manuscript' ? 'bg-[#800000] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <Eye size={14} /> {previewMode === 'manuscript' ? 'Hide Manuscript' : 'Preview Manuscript'}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {previewMode === 'certificate' && result?.certificateUrl && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-8 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden"
                      >
                        <FilePreviewModal
                          isOpen={true}
                          onClose={() => setPreviewMode('none')}
                          file={result.certificateUrl}
                          fileName={`Publication_Certificate_${result.certificateId || paperId}.pdf`}
                          isInline={true}
                        />
                      </motion.div>
                    )}
                    {previewMode === 'manuscript' && result?.pdfUrl && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-8 border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden"
                      >
                        <FilePreviewModal
                          isOpen={true}
                          onClose={() => setPreviewMode('none')}
                          file={result.pdfUrl}
                          fileName={`Published_Manuscript_${result.doi || paperId}.pdf`}
                          isInline={true}
                        />
                      </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned DOI</p>
                      <p className="text-sm font-mono font-black text-[#800000] break-all">{result?.doi ? (result.doi.startsWith('10.') ? `https://doi.org/${result.doi}` : result.doi) : 'Pending'}</p>
                   </div>
                   <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Journal Stamp</p>
                      <p className="text-sm font-black text-slate-900">
                        Vol {result?.volume || journalConfig?.current_volume} &bull; Issue {result?.issue || journalConfig?.current_issue}
                      </p>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                   <a 
                     href={result?.pdfUrl || '#'} 
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                   >
                     <Download size={18} /> View Full PDF
                   </a>
                   <button 
                     onClick={onClose}
                     className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                   >
                     Complete & Close
                     <ArrowRight size={18} />
                   </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-10"
              >
                {/* Progress Bar */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-[10px] font-black text-[#800000] uppercase tracking-widest block mb-1">Current Task</span>
                      <h4 className="text-lg font-bold text-slate-900">
                        {step === 'fetching_meta' && 'Retrieving Registry Config...'}
                        {step === 'formatting' && 'Applying Neural Alignment...'}
                        {step === 'publishing' && 'Generating DOI & Records...'}
                        {step === 'idle' && 'Initializing Hub...'}
                      </h4>
                    </div>
                    <span className="text-2xl font-black text-slate-900">{progress}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
                    <motion.div 
                      className="h-full premium-gradient"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", damping: 20, stiffness: 100 }}
                    />
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {[
                    { key: 'fetching_meta', label: 'Journal Metadata Sync' },
                    { key: 'formatting', label: 'Branding & Layout Refinement' },
                    { key: 'publishing', label: 'Neural DOI Registration' },
                  ].map((s, idx) => {
                    const stepOrder = ['fetching_meta', 'formatting', 'publishing', 'complete'];
                    const currentIdx = stepOrder.indexOf(step);
                    const itemIdx = stepOrder.indexOf(s.key);
                    const isDone = itemIdx < currentIdx || step === 'complete';
                    const isActive = step === s.key;

                    return (
                      <div 
                        key={s.key}
                        className={`
                          flex items-center justify-between p-5 rounded-2xl border transition-all
                          ${isDone ? 'bg-emerald-50 border-emerald-100' : isActive ? 'bg-indigo-50 border-indigo-100 shadow-md' : 'bg-slate-50/50 border-slate-100'}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`
                            w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs
                            ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}
                          `}>
                            {isDone ? '✓' : idx + 1}
                          </div>
                          <span className={`text-sm font-bold ${isDone ? 'text-emerald-900' : isActive ? 'text-indigo-900' : 'text-slate-400'}`}>
                            {s.label}
                          </span>
                        </div>
                        {isActive && <Loader2 className="animate-spin text-indigo-600" size={18} />}
                        {isDone && <CheckCircle2 className="text-emerald-500" size={18} />}
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                   <ShieldCheck className="text-amber-600 shrink-0" size={20} />
                   <p className="text-xs text-amber-800 font-medium leading-relaxed">
                     Process is automatic. Do not refresh or close this tab while the neural alignment is in progress.
                   </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function RefreshCw({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="lucide lucide-refresh-cw"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
