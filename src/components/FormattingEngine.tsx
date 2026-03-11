import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, FileText, Download, Check, AlertCircle, FileCheck, RefreshCw, Layout } from 'lucide-react';

export default function FormattingEngine({ activePaperId }: { activePaperId: number | null }) {
  const [selectedStyle, setSelectedStyle] = useState('ieee');
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattedHtml, setFormattedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFormatting(false);
    }
  };

  if (!activePaperId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-6">
        <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <Layout size={48} className="text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-slate-900 font-display">Format Architect Offline</p>
          <p className="text-slate-500 mt-2 font-medium">Upload a manuscript to enable neural structural alignment.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Format Architect</h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Neural-powered document restructuring for top-tier journal compliance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Style Selection - 4 Columns */}
        <div className="lg:col-span-4 space-y-6">
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
            </div>
          </div>
        </div>

        {/* Preview Area - 8 Columns */}
        <div className="lg:col-span-8">
          <div className="bg-slate-800 rounded-[3rem] p-6 lg:p-12 min-h-[800px] border border-slate-700 shadow-2xl relative overflow-hidden">
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
              className="bg-white w-full min-h-[1000px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-sm p-12 lg:p-20 relative"
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
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-slate prose-lg max-w-none font-serif"
                  dangerouslySetInnerHTML={{ __html: formattedHtml.replace(/```html|```/g, '') }}
                />
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-12 right-12 z-30"
                >
                  <button className="group bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-black font-bold flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
                    <Download size={22} className="group-hover:translate-y-0.5 transition-transform" />
                    Export Production PDF
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
