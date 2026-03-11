import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle, Trash2, ArrowRight, DollarSign } from 'lucide-react';

export default function SmartUpload({ onUploadComplete }: { onUploadComplete: (id: number) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [isPaying, setIsPaying] = useState(false);
  const [paperId, setPaperId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useState(() => {
    fetch('/api/settings/price').then(res => res.json()).then(data => setPrice(data.price));
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setMetadata(data.metadata);
      setPaperId(data.id);
      onUploadComplete(data.id);

      // Now validate structure
      setIsUploading(false);
      setIsValidating(true);

      const valRes = await fetch(`/api/validate/${data.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (valRes.ok) {
        const valData = await valRes.json();
        setValidation(valData.validation);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  };

  const handlePayment = async () => {
    setIsPaying(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount: price })
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('Could not initialize payment');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-10 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Manuscript Ingestion</h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Upload research documents for neural metadata extraction and structural auditing.</p>
        </div>
        {metadata && (
          <button
            onClick={() => { setMetadata(null); setValidation(null); }}
            className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-bold border border-rose-100 hover:bg-rose-100 transition-all shadow-sm shadow-rose-100/50"
          >
            <Trash2 size={18} />
            Reset Session
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!metadata ? (
          <motion.div
            key="upload-zone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`
              relative group border-2 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center text-center transition-all duration-500
              ${isUploading
                ? 'border-indigo-400 bg-indigo-50/30'
                : 'border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/50 cursor-pointer shadow-xl shadow-slate-200/20'}
            `}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />

            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Neural Analysis in Progress</h3>
                <p className="text-slate-500 max-w-sm font-medium leading-relaxed">
                  Extracting semantic entities, mapping citations, and validating document architecture...
                </p>
              </div>
            ) : (
              <>
                <div className="w-28 h-28 premium-gradient rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-500">
                  <UploadCloud className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Drop manuscript here</h3>
                <p className="text-slate-500 mb-10 text-lg font-medium">Supports .docx and .pdf up to 50MB</p>
                <button className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl shadow-slate-900/20 hover:bg-indigo-600 transition-all group/btn flex items-center gap-3">
                  Browse Workstation
                  <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-6 py-3 rounded-xl border border-rose-100"
                  >
                    <AlertCircle size={20} />
                    {error}
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analysis-results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Extracted Metadata Card */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-10 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-30"></div>

                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <FileText size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Extracted Intelligence</h3>
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated Extraction Results</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2 text-sm font-bold">
                    <CheckCircle2 size={18} /> Verified Analysis
                  </div>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Manuscript Title</label>
                    <div className="text-2xl font-bold text-slate-900 p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all leading-snug">
                      {metadata.title || 'Untitled Research'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Corresponding Authors</label>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-800 font-bold">
                        {metadata.authors?.join(', ') || 'Anonymous Researcher'}
                      </div>
                    </div>
                    <div className="group">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Professional Affiliations</label>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-600 font-medium italic">
                        {metadata.affiliations?.join('; ') || 'Not specified'}
                      </div>
                    </div>
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Abstract Summary</label>
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-600 text-lg leading-relaxed font-serif">
                      {metadata.abstract || 'No abstract content detected in the manuscript.'}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Neural Keywords</label>
                    <div className="flex flex-wrap gap-2">
                      {metadata.keywords?.map((kw: string) => (
                        <span key={kw} className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-default">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Structural Validation Panel */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl">
                    <CheckCircle2 size={20} className="text-indigo-600" />
                  </div>
                  Structural Audit
                </h3>

                {isValidating ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                    <p className="font-bold uppercase tracking-widest text-xs">Checking Consistency</p>
                  </div>
                ) : validation ? (
                  <div className="space-y-4">
                    {validation.map((section: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group"
                      >
                        <div className={`
                          flex items-center justify-between p-4 rounded-2xl border transition-all
                          ${section.status === 'ok' ? 'bg-emerald-50/30 border-emerald-100 group-hover:bg-emerald-50' :
                            section.status === 'warning' ? 'bg-amber-50/30 border-amber-100 group-hover:bg-amber-50' :
                              'bg-rose-50/30 border-rose-100 group-hover:bg-rose-50'}
                        `}>
                          <span className="text-sm font-bold text-slate-700">{section.name}</span>
                          {section.status === 'ok' && <CheckCircle2 className="text-emerald-500" size={20} />}
                          {section.status === 'warning' && <AlertCircle className="text-amber-500" size={20} />}
                          {section.status === 'error' && <AlertCircle className="text-rose-500" size={20} />}
                        </div>
                        {section.msg && (
                          <div className={`
                            mt-2 ml-4 p-3 rounded-xl text-xs font-bold border-l-4
                            ${section.status === 'error' ? 'bg-rose-50 text-rose-600 border-rose-500' : 'bg-amber-50 text-amber-600 border-amber-500'}
                          `}>
                            {section.msg}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                    <p className="text-sm font-medium">Audit Results Unavailable</p>
                  </div>
                )}

                <div className="mt-10 pt-8 border-t border-slate-100">
                  <div className="bg-slate-900 rounded-2xl p-6 text-white text-center mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Readiness Score</p>
                    <p className="text-4xl font-bold tracking-tight">84<span className="text-indigo-400">%</span></p>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-indigo-500 h-full w-[84%]"></div>
                    </div>
                  </div>

                  <button 
                    onClick={handlePayment}
                    disabled={isPaying}
                    className="w-full py-4 premium-gradient text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#800000]/20 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isPaying ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <DollarSign size={20} />
                        Pay ₦{price.toLocaleString()} & Publish
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-wider">Secure Payment via Paystack</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
