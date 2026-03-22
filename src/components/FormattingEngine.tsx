import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, FileText, Check, AlertCircle, FileCheck, RefreshCw, Layout, Loader2, ArrowRight, Download } from 'lucide-react'; // UI Icons
import WaitingDraftsQueue from './WaitingDraftsQueue';

export default function FormattingEngine({ activePaperId, setActivePaperId, onNavigate }: { activePaperId: number | null, setActivePaperId: (id: number | null) => void, onNavigate?: (tab: string) => void }) {
  const [selectedStyle, setSelectedStyle] = useState('ieee');
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattedHtml, setFormattedHtml] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleSendToNext = async () => {
    setIsSending(true);
    try {
      if (formattedHtml) {
        await fetch(`/api/format/${activePaperId}/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ formattedHtml })
        });
      }

      await fetch(`/api/papers/${activePaperId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'reference_intel' })
      });
      if (onNavigate) {
        onNavigate('references');
      } else {
        setActivePaperId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
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
        emptyMessage="No manuscripts pending formatting. Send documents here from the AI Writing Assistant." 
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
          body * { visibility: hidden !important; }
          #production-paper-preview, #production-paper-preview * { visibility: visible !important; }
          #production-paper-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .header-sheet-full {
             page-break-after: avoid !important;
             margin-top: 0 !important;
             box-shadow: none !important;
             border: none !important;
          }
          .paper-sheet {
            margin: 0 auto !important;
            padding: 4rem !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            width: 100% !important;
            max-width: 850px !important;
          }
          .no-print, button, header, nav, footer { display: none !important; }
        }
        
        .academic-content {
          font-family: serif;
          line-height: 1.6;
          text-align: justify;
        }
        .academic-content p {
          text-align: justify;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .academic-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-family: sans-serif;
          font-size: 0.75rem;
          table-layout: auto;
        }
        .table-wrapper {
          width: 100%;
          overflow-x: auto;
          margin: 2rem 0;
          background: #fcfcfc;
          border: 1px solid #f1f5f9;
          border-radius: 4px;
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
        .paper-sheet {
          background: white;
          width: 100%;
          max-width: 850px;
          margin: 0 auto 2rem;
          padding: 3rem 4rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          position: relative;
          min-height: 1100px;
        }
        .header-sheet {
          background: white;
          width: 100%;
          max-width: 850px;
          margin: 2rem auto 0;
          padding: 2rem 4rem 1rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          border-bottom: none;
          border-radius: 4px 4px 0 0;
          position: relative;
          z-index: 10;
        }
        /* Glue the first paper sheet to the header */
        .paper-sheet:first-of-type {
          margin-top: 0;
          border-radius: 0 0 4px 4px;
          border-top: 1px dashed #f1f5f9;
        }
        .sheet-header-full {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
          padding-bottom: 1rem;
          user-select: none;
          border-bottom: 2px solid #800000;
        }
        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .header-logo-left, .header-logo-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-logo-left img, .header-logo-right img {
          height: 32px;
          min-width: 32px;
          width: auto;
          object-fit: contain;
        }
        .header-title-stack, .partner-stack {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        .journal-red-small { color: #800000; font-weight: 900; font-size: 6px; text-transform: uppercase; }
        .journal-red-med { color: #800000; font-weight: 900; font-size: 8px; text-transform: uppercase; }
        .journal-black-large { color: #0f172a; font-weight: 900; font-size: 10px; text-transform: uppercase; }
        .journal-gray-type { color: #64748b; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.15em; }
        
        .header-meta-center {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .meta-row { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-doi { font-size: 7px; font-weight: 700; color: #4f46e5; font-family: monospace; }
        
        .partner-name { color: #0f172a; font-weight: 900; font-size: 8px; text-transform: uppercase; text-align: right; }
        .partner-status { color: #94a3b8; font-weight: 700; font-size: 7px; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
        .page-footer {
          position: absolute;
          bottom: 1.5rem;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        @media (max-width: 640px) {
          .paper-sheet {
            padding: 1.5rem;
            margin: 1rem 0;
          }
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

              {/* PDF & Navigation Controls */}
              {formattedHtml && (
                <div className="mt-8 flex flex-col gap-3">
                  <button 
                    onClick={handleDownloadPdf}
                    className="group w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-slate-200"
                  >
                    <Download size={18} className="group-hover:-translate-y-1 transition-transform" />
                    Download Formatted PDF
                  </button>

                  <div className="pt-6 border-t border-slate-100">
                    <button 
                      onClick={handleSendToNext}
                      disabled={isSending}
                      className="group w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl shadow-2xl shadow-emerald-900/20 font-black tracking-widest uppercase text-xs flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Confirm & Move to Reference Intel'}
                      {!isSending && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </div>
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
              className="bg-slate-50/50 w-full rounded-sm p-4 relative print:bg-white print:p-0 overflow-y-auto preview-scrollbar flex-1"
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
                  {/* Production Branding Header - Now Styled as the top of the first page */}
                  {branding && (
                    <div className="header-sheet flex flex-col gap-6 select-none export-only">
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
                              <span>Vol {branding.volume}, Iss {branding.issue}</span>
                              <span className="opacity-20">|</span>
                              <span className="text-indigo-600">Published: {branding.date}</span>
                            </div>
                            <p className="text-indigo-600 font-mono text-[8px] md:text-[9px] mt-1 font-bold">{branding.doi}</p>
                         </div>

                        <div className="flex items-center gap-3">
                           <div className="hidden sm:block text-right">
                              <p className="text-slate-900 font-black text-[9px] uppercase tracking-tight">Nasarawa State University Keffi</p>
                              <p className="text-slate-400 font-bold text-[8px] uppercase tracking-widest">Global Partner</p>
                           </div>
                           <img src="/Nasarawa-State-University.jpg" alt="NSUK" className="h-10 md:h-14 w-auto object-contain" />
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


          </div>
        </div>
      </div>
    </motion.div>
  );
}
