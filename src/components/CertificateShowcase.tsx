import React, { useState } from 'react';
import PublicationCertificate from './PublicationCertificate';
import { Download, Printer, RefreshCw, Layers } from 'lucide-react';

export default function CertificateShowcase() {
  const [title, setTitle] = useState("Impact of Artificial Intelligence on Modern Academic Publishing: A Neural Approach to Metadata Extraction");
  const [authors, setAuthors] = useState("Ephraim Raxy, Danjuma Namo, Genius AI");
  const [date, setDate] = useState(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display flex items-center gap-3">
            <Layers className="text-[#800000]" size={32} />
            Certificate Showcase
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Preview and refine the SVG certificate design. Match the system's premium aesthetic.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paper Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#800000]/20 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Author(s)</label>
              <input 
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#800000]/20 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer size={18} />
            Print
          </button>
          <button 
            className="flex items-center gap-2 px-6 py-3 premium-gradient text-white rounded-2xl font-bold shadow-lg shadow-[#800000]/20 hover:scale-105 transition-all"
          >
            <Download size={18} />
            Download SVG
          </button>
        </div>
      </div>

      <div className="border-4 border-dashed border-slate-200 rounded-[3rem] p-4 md:p-8 bg-slate-50/50 flex justify-center overflow-auto">
        <div className="scale-[0.6] sm:scale-[0.8] md:scale-100 origin-top">
          <PublicationCertificate 
            title={title}
            authors={authors}
            date={date}
          />
        </div>
      </div>
      
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
          <RefreshCw size={20} className="animate-spin-slow" />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider">Design Note</h4>
          <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
            This certificate is rendered entirely as a responsive SVG asset. It uses the system's core design tokens 
            (Horse Blood Red `#800000`, Playfair Display, and Outfit) to ensure 100% brand consistency. 
            The design includes a digital watermark, decorative guilloche borders, and a diagonal "Verified" banner.
          </p>
        </div>
      </div>
    </div>
  );
}
