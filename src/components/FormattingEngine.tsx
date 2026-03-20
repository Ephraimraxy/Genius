import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, FileText, Download, Check, AlertCircle, FileCheck, RefreshCw, Layout, Loader2, ArrowRight } from 'lucide-react'; // UI Icons
import WaitingDraftsQueue from './WaitingDraftsQueue';

// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function FormattingEngine({ activePaperId, setActivePaperId }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void }) {
  const [selectedStyle, setSelectedStyle] = useState('ieee');
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattedHtml, setFormattedHtml] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendToNext = async () => {
    setIsSending(true);
    try {
      await fetch(`/api/papers/${activePaperId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'writing_assistant' })
      });
      setActivePaperId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('production-paper-preview');
    if (!element) return;
    
    setIsDownloading(true);
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
      filename:     `GMIJP_Publication_${activePaperId}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        onclone: (clonedDoc: Document) => {
          // Robustly strip oklch from the cloned document before html2canvas parses it
          const elements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            
            try {
              const styles = window.getComputedStyle(el);
              // Traverse ALL physical style properties that might contain colors
              const props = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke', 'boxShadow', 'textShadow'];
              
              props.forEach(prop => {
                // Check both inline and computed (computed is what html2canvas usually reads)
                const val = el.style.getPropertyValue(prop) || styles.getPropertyValue(prop);
                
                if (val && val.toString().includes('oklch')) {
                  // Fallback mapping
                  if (prop === 'backgroundColor') el.style.setProperty(prop, '#ffffff', 'important');
                  else if (prop.toLowerCase().includes('border') || prop.toLowerCase().includes('shadow')) el.style.setProperty(prop, '#e2e8f0', 'important');
                  else el.style.setProperty(prop, '#000000', 'important');
                }
              });

              // Also check for background-image which might contain oklch gradients
              const bgImg = el.style.backgroundImage || styles.backgroundImage;
              if (bgImg && bgImg.includes('oklch')) {
                el.style.setProperty('background-image', 'none', 'important');
              }
            } catch (e) {
              // Silently skip if style access fails
            }
          }
        }
      },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      setIsDownloading(false);
    }).catch((err: any) => {
      console.error('PDF generation failed:', err);
      setIsDownloading(false);
    });
  };

  const styles = [
    { id: 'ieee', name: 'IEEE Standards', desc: 'Double-column, strictly numbered citations for engineering and tech.', icon: Layout },
    { id: 'apa', name: 'APA (7th Ed.)', desc: 'Author-date system optimized for social and behavioral sciences.', icon: FileText },
    { id: 'nature', name: 'Nature Portfolio', desc: 'Prestige format with specific figure legends and compact citations.', icon: FileCheck },
    { id: 'elsevier', name: 'Elsevier Standard', desc: 'Versatile structured format supporting deep section hierarchies.', icon: Settings },
  ];

  const handleFormat = async () => {
    if (!activePaperId) return;
    setIsFormatting(true);
    setError(null);
    try {
      const res = await fetch(`/api/format/${activePaperId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ style: selectedStyle })
      });
      if (!res.ok) throw new Error('Document reconstruction failed');
      const data = await res.json();
      setFormattedHtml(data.formattedHtml);
      setBranding(data.branding);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFormatting(false);
    }
  };

  if (!activePaperId) {
    return (
      <WaitingDraftsQueue 
        expectedStatus="formatting" 
        onSelect={setActivePaperId} 
        title="Format Architect Queue" 
        icon={Layout} 
        emptyMessage="No manuscripts pending formatting. Upload a new document or send one from the previous stage to begin." 
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-20"
    >
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden, header, nav, aside, button { display: none !important; }
          #production-paper-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .export-only { display: block !important; }
        }
        
        .academic-content {
          font-family: serif;
          line-height: 1.6;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .academic-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
          font-family: sans-serif;
          font-size: 0.875rem;
        }
        .academic-content th, .academic-content td {
          border: 1px solid #cbd5e1;
          padding: 0.75rem;
          text-align: left;
        }
        .academic-content th {
          background-color: #f8fafc;
          font-weight: bold;
        }
        .academic-content .academic-figure {
          margin: 2.5rem 0;
          text-align: center;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          border: 1px dashed #cbd5e1;
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Format Architect</h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Neural-powered document restructuring for top-tier journal compliance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start relative">
        {/* Style Selection - 4 Columns - Sticky */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-10">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Layout size={20} className="text-indigo-600" />
              </div>
              Schema Selection
            </h3>

            <div className="space-y-4">
              {styles.map((style) => (
                <motion.div
                  key={style.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`relative p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-300
                    ${selectedStyle === style.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100'
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedStyle === style.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <style.icon size={16} />
                      </div>
                      <h4 className={`font-bold ${selectedStyle === style.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {style.name}
                      </h4>
                    </div>
                    {selectedStyle === style.id && (
                      <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                        <Check className="text-white" size={12} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{style.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100">
              <button
                onClick={handleFormat}
                disabled={isFormatting || !activePaperId}
                className="w-full relative overflow-hidden group bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-2xl shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {isFormatting ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                  )}
                  {isFormatting ? 'Neural Alignment...' : formattedHtml ? 'Re-align Styles' : 'Apply Journal Style'}
                </div>
              </button>

              {!activePaperId && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
                  <AlertCircle size={18} className="text-amber-500" />
                  <p className="text-amber-700 text-xs font-bold uppercase tracking-wider">Awaiting Manuscript</p>
                </div>
              )}
              {error && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3">
                  <AlertCircle size={18} className="text-rose-500" />
                  <p className="text-rose-700 text-xs font-bold">{error}</p>
                </div>
              )}

              {/* Next Step Button Relocated Here */}
              {formattedHtml && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <button 
                    onClick={handleSendToNext}
                    disabled={isDownloading || isSending}
                    className="group w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl shadow-2xl shadow-emerald-900/20 font-black tracking-widest uppercase text-xs flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Confirm & Move to Assistant'}
                    {!isSending && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Area - 8 Columns - Scrollable Internal */}
        <div className="lg:col-span-8 flex flex-col h-[85vh]">
          <div className="bg-slate-800 rounded-[3rem] p-6 lg:p-12 border border-slate-700 shadow-2xl relative flex flex-col overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-full h-1 premium-gradient opacity-50"></div>

            <div className="flex items-center justify-between mb-8">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
              </div>
              <div className="px-4 py-1.5 bg-slate-900 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border border-slate-700">
                Synchronized Preview Engine
              </div>
              <div className="w-10"></div>
            </div>

            <motion.div
              layout
              id="production-paper-preview"
              className="bg-white w-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-sm p-8 lg:p-16 relative print:shadow-none print:p-0 overflow-y-auto preview-scrollbar flex-1"
              animate={isFormatting ? { scale: 0.98, opacity: 0.7 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "circOut" }}
            >
              <AnimatePresence>
                {isFormatting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex flex-col items-center justify-center"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <Settings className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
                    </div>
                    <p className="font-bold text-slate-900 mt-8 tracking-widest uppercase text-xs">Architectural Re-mapping</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {formattedHtml ? (
                <div className="flex flex-col">
                  {/* Production Branding Header */}
                  {branding && (
                    <div className="mb-10 pb-8 border-b-2 border-[#800000] flex flex-col gap-6 select-none export-only">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img src="/journal-logo.png" alt="Genius" className="h-10 md:h-14 w-auto object-contain" />
                          <div className="hidden sm:block">
                            <p className="text-[#800000] font-black text-[9px] uppercase tracking-wider leading-none">Genius Multidisciplinary</p>
                            <p className="text-slate-900 font-black text-xs md:text-sm tracking-tighter">INTERNATIONAL JOURNAL</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-center text-center px-2">
                           <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                             <span>ISSN: {branding.issn}</span>
                             <span className="opacity-20">|</span>
                             <span>Volume {branding.volume}, issue {branding.issue}</span>
                           </div>
                           <p className="text-indigo-600 font-mono text-[8px] md:text-[9px] mt-1 font-bold">{branding.doi}</p>
                        </div>

                        <div className="flex items-center gap-3">
                           <div className="hidden sm:block text-right">
                              <p className="text-slate-900 font-black text-[9px] uppercase tracking-tight">Nasarawa State University Keffi</p>
                              <p className="text-slate-400 font-bold text-[8px] uppercase tracking-widest">Global Partner</p>
                           </div>
                           <img src="/university-logo.jpg" alt="NSUK" className="h-10 md:h-14 w-auto object-contain" />
                        </div>
                      </div>
                      <div className="h-px bg-slate-100 w-full" />
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-slate prose-lg max-w-none font-serif academic-content"
                    dangerouslySetInnerHTML={{ __html: formattedHtml.replace(/```html|```/g, '') }}
                  />
                </div>
              ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-slate-300 gap-6">
                  <div className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center">
                    <FileText size={40} className="text-slate-200" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-400">Preview Standby</p>
                    <p className="text-sm text-slate-400 mt-2 font-medium">Apply a schema to initiate document rendering</p>
                  </div>
                </div>
              )}
            </motion.div>

            <AnimatePresence>
              {formattedHtml && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute bottom-10 right-10 z-30 print:hidden"
                >
                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isDownloading || isSending}
                    className="group bg-slate-900/90 backdrop-blur-md hover:bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl border border-white/10 font-bold flex items-center justify-center gap-3 transition-all hover:scale-110 active:scale-90 disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                    )}
                    {isDownloading ? 'Processing...' : 'Export'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
