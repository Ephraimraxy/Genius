import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, FileText, Check, AlertCircle, FileCheck, RefreshCw, Layout, Loader2, ArrowRight, Download, BookOpen, ShieldCheck, List, Hash, Mail } from 'lucide-react'; // UI Icons
// @ts-ignore
import html2pdf from 'html2pdf.js';
import WaitingDraftsQueue from './WaitingDraftsQueue';

import { ToastType } from './ToastSystem';

export default function FormattingEngine({ 
  activePaperId, 
  setActivePaperId, 
  onNavigate,
  addToast
}: { 
  activePaperId: number | null, 
  setActivePaperId: (id: number | null) => void, 
  onNavigate?: (tab: string) => void,
  addToast: (message: string, type?: ToastType) => void
}) {
  const [selectedStyle, setSelectedStyle] = useState('ieee');
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattedHtml, setFormattedHtml] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!activePaperId || !formattedHtml) return;
    
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. Sync the latest formatted content to the server to ensure high-fidelity export
      const saveRes = await fetch(`/api/format/${activePaperId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ formattedHtml })
      });

      if (!saveRes.ok) throw new Error('Failed to synchronize content for export');

      // 2. Trigger the High-Fidelity Server-Side PDF Export
      window.open(`/api/format/${activePaperId}/pdf?token=${token}`, '_blank');
      
      addToast('High-fidelity PDF generation started on server...', 'info');

    } catch (err: any) {
      console.error('PDF Export Error:', err);
      setError('Server-side PDF generation failed. Please ensure your browser setup is correct.');
    } finally {
      setIsDownloading(false);
    }
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
    { id: 'ieee', name: 'IEEE Standards', desc: 'Double-column, strictly numbered citations.', icon: Layout },
    { id: 'apa', name: 'APA (7th Ed.)', desc: 'Author-date system for social sciences.', icon: FileText },
    { id: 'mla', name: 'MLA (9th Ed.)', desc: 'Author-page system for humanities.', icon: BookOpen },
    { id: 'chicago', name: 'Chicago/Turabian', desc: 'Note-bibliography style for history.', icon: Settings },
    { id: 'nature', name: 'Nature Portfolio', desc: 'Compact citations and specific figure legends.', icon: FileCheck },
    { id: 'elsevier', name: 'Elsevier Standard', desc: 'Versatile structured format for deep hierarchies.', icon: Settings },
    { id: 'ama', name: 'AMA Standard', desc: 'Numerical superscript system for medicine.', icon: ShieldCheck },
    { id: 'harvard', name: 'Harvard Style', desc: 'Author-date system common globally.', icon: FileText },
    { id: 'vancouver', name: 'Vancouver Style', desc: 'Numbered system for biomedical research.', icon: List },
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

  const handleEmailPDF = async () => {
    if (!activePaperId) return;
    setIsEmailing(true);
    try {
      const res = await fetch(`/api/format/${activePaperId}/email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Email delivery failed');
      addToast("Manuscript sent to your portal email address.", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsEmailing(false);
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
        .academic-content {
          font-family: serif;
          font-size: 10.5pt;
          line-height: 1.3;
          text-align: justify;
          color: #1e293b;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.1em;
          margin-bottom: 0.3em;
          font-weight: 600 !important;
          line-height: 1.2;
          text-align: left !important;
        }
        .academic-content h1 { font-size: 1.5em; margin-bottom: 0.8em; }
        .academic-content h2 { font-size: 1.25em; }
        .academic-content h3 { font-size: 1.1em; }
        .academic-content p {
          text-align: justify;
          margin-bottom: 0.4rem;
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
          margin: 0 auto;
          padding: 1.5rem 2.5rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          position: relative;
          min-height: auto;
        }
        .header-sheet {
          background: white;
          width: 100%;
          max-width: 850px;
          margin: 1.5rem auto 0;
          padding: 1rem 2.5rem 0.5rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          border-bottom: none;
          border-radius: 8px 8px 0 0;
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
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          user-select: none;
          border-bottom: 2px solid #800000;
          width: 100%;
        }
        .header-top-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 1rem;
          width: 100%;
        }
        .header-logo-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          justify-content: flex-start;
          min-width: 0;
        }
        .header-logo-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          justify-content: flex-end;
          min-width: 0;
        }
        .header-logo-left img, .header-logo-right img {
          height: 38px;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
        }
        .header-title-stack {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          min-width: 0;
        }
        .partner-stack {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          text-align: right;
          min-width: 0;
        }
        .journal-red-small { color: #800000; font-weight: 900; font-size: 7px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .journal-black-large { color: #0f172a; font-weight: 900; font-size: 10px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;}
        
        .header-meta-center {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 160px;
        }
        .meta-row { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .meta-doi { font-size: 8px; font-weight: 700; color: #4f46e5; font-family: monospace; white-space: nowrap; }
        
        .partner-name { color: #0f172a; font-weight: 900; font-size: 9px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
        .partner-status { color: #94a3b8; font-weight: 700; font-size: 7px; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap;}

        /* PDF Export Color Sanitization (Fixes oklch error in html2canvas) */
        #formatted-manuscript-content, 
        #formatted-manuscript-content * {
          --tw-text-opacity: 1 !important;
          --tw-bg-opacity: 1 !important;
          --tw-border-opacity: 1 !important;
        }
        #formatted-manuscript-content .text-slate-900 { color: #0f172a !important; }
        #formatted-manuscript-content .text-slate-700 { color: #334155 !important; }
        #formatted-manuscript-content .text-slate-500 { color: #64748b !important; }
        #formatted-manuscript-content .text-slate-400 { color: #94a3b8 !important; }
        #formatted-manuscript-content .text-indigo-600 { color: #4f46e5 !important; }
        #formatted-manuscript-content .bg-slate-50\/50 { background-color: #f8fafc !important; }
        #formatted-manuscript-content .border-slate-100 { border-color: #f1f5f9 !important; }
        #formatted-manuscript-content .border-slate-200 { border-color: #e2e8f0 !important; }

        .page-number { position: absolute; font-size: 10px; font-weight: bold; color: #94a3b8; z-index: 100; user-select: none; }
        .page-number.top-right { top: 3rem; right: 5rem; }
        .page-number.bottom-center { bottom: 1.5rem; left: 50%; transform: translateX(-50%); }
        .page-number.bottom-right { bottom: 1.5rem; right: 5rem; }
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
        /* Atomic stylesheet-disabling fix for oklch errors in html2canvas */
        /* This ensures all custom properties are explicitly set to avoid parsing issues */
        * {
          --tw-bg-opacity: 1 !important;
          --tw-text-opacity: 1 !important;
          --tw-border-opacity: 1 !important;
          --tw-shadow: 0 0 #0000 !important;
          --tw-ring-offset-shadow: 0 0 #0000 !important;
          --tw-ring-shadow: 0 0 #0000 !important;
          --tw-gradient-stops: var(--tw-gradient-from, #0000), var(--tw-gradient-to, #0000) !important;
          --tw-backdrop-blur: blur(0) !important;
          --tw-backdrop-brightness: brightness(1) !important;
          --tw-backdrop-contrast: contrast(1) !important;
          --tw-backdrop-grayscale: grayscale(0) !important;
          --tw-backdrop-hue-rotate: hue-rotate(0deg) !important;
          --tw-backdrop-invert: invert(0) !important;
          --tw-backdrop-opacity: opacity(1) !important;
          --tw-backdrop-saturate: saturate(1) !important;
          --tw-backdrop-sepia: sepia(0) !important;
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

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 preview-scrollbar">
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
                  <div className="pt-6 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleEmailPDF}
                        disabled={isEmailing}
                        className="group bg-slate-100 hover:bg-slate-200 text-slate-700 py-5 rounded-2xl font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isEmailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                        Email PDF
                      </button>
                      
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/format/${activePaperId}/pdf`;
                          link.download = `Formatted_Manuscript.pdf`;
                          link.click();
                        }}
                        className="group bg-slate-100 hover:bg-slate-200 text-slate-700 py-5 rounded-2xl font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-2 transition-all"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </div>

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
                <div id="formatted-manuscript-content" className="flex flex-col">
                  {/* Production Branding Header */}
                  {branding && (
                    <div className="header-sheet sticky top-0 z-50 select-none export-only shadow-sm border-b-2 border-slate-100 mb-6 !max-w-none !w-full !rounded-none !margin-0">
                      <div className="header-top-row">
                        <div className="header-logo-left">
                          <img src="/journal-logo.png" alt="Genius" className="h-8 w-auto" />
                          <div className="header-title-stack">
                            <p className="journal-red-small">Genius Multidisciplinary</p>
                            <p className="journal-black-large">INTERNATIONAL JOURNAL</p>
                          </div>
                        </div>

                        <div className="header-meta-center">
                          <div className="meta-row">
                            ISSN: {branding.issn} | VOL {branding.volume}, ISS {branding.issue} | {branding.date}
                          </div>
                          <div className="meta-doi">{branding.doi}</div>
                        </div>

                        <div className="header-logo-right">
                          <div className="partner-stack">
                            <p className="partner-name">Nasarawa State University Keffi</p>
                            <p className="partner-status">Global Partner</p>
                          </div>
                          <img src="/Nasarawa-State-University.jpg" alt="NSUK" className="h-8 w-auto" />
                        </div>
                      </div>
                    </div>
                  )}

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-slate prose-sm max-w-none font-serif academic-content leading-snug"
                    style={{ fontSize: '10.5pt', lineHeight: '1.3' }}
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
