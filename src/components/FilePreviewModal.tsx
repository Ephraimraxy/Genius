import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson, 
  Loader2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  ShieldCheck,
  Globe,
  Star
} from 'lucide-react';
import * as docx from 'docx-preview';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface FilePreviewModalProps {
  file: File | string; // Can be a File object or a URL string
  fileName?: string;
  isOpen: boolean;
  onClose: () => void;
  publicationDetails?: {
    issn?: string;
    doi?: string;
    volume?: string;
    issue?: string;
    title?: string;
    authors?: string;
  };
}

export default function FilePreviewModal({ file, fileName, isOpen, onClose, publicationDetails }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('');
  const [excelData, setExcelData] = useState<{name: string, data: any[]}[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';

  useEffect(() => {
    if (!isOpen) return;
    
    const name = typeof file === 'string' ? (fileName || file.split('/').pop() || 'file') : file.name;
    const ext = getExtension(name);
    setFileType(ext);
    setLoading(true);
    setError(null);
    setExcelData([]);

    const processFile = async () => {
      try {
        let blob: Blob;
        if (typeof file === 'string') {
          const response = await fetch(file, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (!response.ok) throw new Error('Unauthorized or file missing');
          blob = await response.blob();
        } else {
          blob = file;
        }
        
        const blobUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(blobUrl);

        if (ext === 'docx') {
          if (docxRef.current) {
            docxRef.current.innerHTML = '';
            await docx.renderAsync(blob, docxRef.current);
          }
        } else if (ext === 'xlsx' || ext === 'xls') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheets = workbook.SheetNames.map(name => ({
              name,
              data: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 })
            }));
            setExcelData(sheets);
            setLoading(false);
          };
          reader.readAsArrayBuffer(blob);
        } else if (ext === 'csv') {
          Papa.parse(blob as any, {
            complete: (results) => {
              setExcelData([{ name: 'CSV Data', data: results.data }]);
              setLoading(false);
            },
            error: (err) => {
              setError(`CSV Parsing Error: ${err.message}`);
              setLoading(false);
            }
          });
        } else {
          // Other types (PDF, images) will be handled by iframe/embed/img
          setLoading(false);
        }
      } catch (err: any) {
        setError(`Failed to load preview: ${err.message}`);
        setLoading(false);
      }
    };

    processFile();
  }, [file, isOpen, fileName]);

  const handleDownload = () => {
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = typeof file === 'string' ? (fileName || 'download') : file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    if (loading && fileType !== 'pdf') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Neural Rendering...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-10">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full">
            <AlertCircle size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Preview Failed</h3>
          <p className="text-slate-500 max-w-xs">{error}</p>
          <button 
            onClick={handleDownload}
            className="mt-4 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Download to View
          </button>
        </div>
      );
    }

    switch (fileType) {
      case 'pdf':
        return (
          <iframe 
            src={previewBlobUrl || ''} 
            className="w-full h-full border-none rounded-b-2xl"
            title="PDF Preview"
            onLoad={() => setLoading(false)}
          />
        );
      case 'docx':
        return (
          <div className="w-full h-full overflow-auto bg-slate-100 p-8 flex justify-center">
            <div ref={docxRef} className="bg-white shadow-2xl p-10 max-w-4xl w-full min-h-full docx-preview-container" />
          </div>
        );
      case 'xlsx':
      case 'xls':
      case 'csv':
        return (
          <div className="w-full h-full flex flex-col bg-white">
            {excelData.length > 1 && (
              <div className="flex items-center gap-2 p-4 border-b bg-slate-50 overflow-x-auto shrink-0">
                {excelData.map((sheet, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSheet(index)}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      activeSheet === index 
                        ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {(excelData[activeSheet]?.data[0] as any[])?.map((cell, i) => (
                      <th key={i} className="px-4 py-3 font-bold text-slate-900 border-r border-slate-200 last:border-0 uppercase tracking-wider text-[10px]">
                        {cell || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelData[activeSheet]?.data.slice(1).map((row: any[], ri) => (
                    <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-slate-600 border-r border-slate-100 last:border-0 font-medium whitespace-nowrap">
                          {cell?.toString() || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'm4a':
      case 'aac':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-slate-50">
            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
              {/* Decorative background pulse */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-50 rounded-full animate-pulse opacity-20 pointer-events-none" />
              
              <div className="w-32 h-32 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center shadow-inner relative z-10">
                <Volume2 size={64} />
              </div>

              <div className="text-center relative z-10">
                <h4 className="text-xl font-black text-slate-900 mb-1 uppercase tracking-tight">Audio Record Analysis</h4>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Live Monitoring System</p>
              </div>

              <div className="w-full space-y-2 relative z-10">
                <audio 
                  src={typeof file === 'string' ? file : URL.createObjectURL(file as Blob)} 
                  controls 
                  className="w-full h-14 rounded-2xl"
                  onLoadedMetadata={() => setLoading(false)}
                />
              </div>

              <div className="flex gap-4 relative z-10">
                <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audio Stream Ready</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'mp4':
      case 'mov':
      case 'webm':
      case 'mkv':
      case 'avi':
        return (
          <div className="w-full h-full flex items-center justify-center bg-black p-4">
            <video 
              src={typeof file === 'string' ? file : URL.createObjectURL(file as Blob)} 
              controls 
              className="max-w-full max-h-full rounded-xl"
              onLoadedMetadata={() => setLoading(false)}
            />
          </div>
        );
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return (
          <div className="w-full h-full flex items-center justify-center p-10 bg-slate-900/5 backdrop-blur-sm">
            <img 
              src={previewBlobUrl || ''} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onLoad={() => setLoading(false)}
            />
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center opacity-50">
            <FileText size={64} />
            <p className="font-bold uppercase tracking-widest text-xs">No visual data for {fileType.toUpperCase()}</p>
            <button onClick={handleDownload} className="text-indigo-600 font-bold hover:underline">Download instead</button>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-10 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md pointer-events-auto"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`
              relative bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden pointer-events-auto flex flex-col
              ${isFullScreen ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[85vh] rounded-[2.5rem]'}
            `}
          >
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b bg-white relative z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${
                  fileType === 'pdf' ? 'bg-rose-50 text-rose-600' : 
                  (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') ? 'bg-emerald-50 text-emerald-600' :
                  'bg-indigo-50 text-indigo-600'
                }`}>
                  {fileType === 'pdf' ? <FileText size={20} /> : 
                   (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') ? <FileSpreadsheet size={20} /> : 
                   <FileJson size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 truncate max-w-[200px] sm:max-w-md uppercase tracking-tight">
                    {typeof file === 'string' ? (fileName || file.split('/').pop()) : file.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                    {fileType} Document &bull; Neural Intelligent Preview
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`p-2.5 rounded-xl ${
                  ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileType) ? 'bg-rose-50 text-rose-600' : 'hidden'
                } flex items-center gap-2 mr-4`}>
                   <div className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Live Playback</span>
                </div>
                <button 
                  onClick={handleDownload}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                  title="Download File"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                  title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button 
                  onClick={onClose}
                  className="p-3 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition-all"
                  title="Close Preview"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-slate-100 flex flex-col">
              {publicationDetails && (
                <div className="shrink-0 bg-white text-slate-900 border-b-4 border-[#800000] relative overflow-hidden print:block shadow-md">
                  <div className="px-6 md:px-10 py-8 relative z-10">
                      {/* Top Row: Dual Logos and Journal Name */}
                      <div className="flex items-center justify-between gap-4 w-full mb-6">
                        {/* Left: Journal Logo */}
                        <div className="flex items-center gap-3 shrink-0">
                          <img src="/journal-logo.png" alt="GMIJP Logo" className="h-12 md:h-16 w-auto object-contain" />
                          <div className="hidden md:block">
                            <p className="text-[#800000] font-black text-[10px] uppercase tracking-wider leading-tight">Genius Multidisciplinary</p>
                            <p className="text-slate-900 font-black text-sm md:text-base tracking-tighter">INTERNATIONAL JOURNAL</p>
                          </div>
                        </div>

                        {/* Middle: Professional Metadata (Always visible but compact) */}
                        <div className="flex flex-col items-center justify-center text-center px-4 flex-1">
                          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                            <span className="text-[#800000] font-black text-[10px] md:text-[11px] uppercase tracking-wider whitespace-nowrap">ISSN: {publicationDetails.issn || '2971-7760'}</span>
                            <span className="text-slate-300 hidden sm:inline">|</span>
                            <span className="text-slate-600 font-bold text-[10px] md:text-[11px] uppercase tracking-wider whitespace-nowrap">Vol: {publicationDetails.volume || '4'}</span>
                            <span className="text-slate-300 hidden sm:inline">|</span>
                            <span className="text-slate-600 font-bold text-[10px] md:text-[11px] uppercase tracking-wider whitespace-nowrap">No: {publicationDetails.issue || '1'}</span>
                          </div>
                          <p className="hidden md:block text-slate-400 font-bold text-[8px] uppercase tracking-[0.3em] mt-1">Verified Academic Record</p>
                        </div>

                        {/* Right: University Logo */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden md:block text-right">
                             <p className="text-slate-900 font-black text-[10px] uppercase tracking-tight whitespace-nowrap">Nasarawa State University</p>
                             <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Keffi, Nigeria</p>
                          </div>
                          <img src="/university-logo.jpg" alt="NSUK Logo" className="h-12 md:h-16 w-auto object-contain" />
                        </div>
                      </div>

                      {/* DOI & Site Info Line (Clean horizontal bar) */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 w-full mb-8">
                        <div className="flex items-center gap-2 text-indigo-600 font-mono font-bold text-[10px] md:text-xs">
                          <Globe size={12} className="shrink-0" /> {publicationDetails.doi || '10.GMIJ/RES.2026.01'}
                        </div>
                        <div className="text-[#800000] font-black text-[9px] md:text-[10px] uppercase tracking-widest italic opacity-70">
                          Official Publication Copy &bull; www.gmijp-edu.com
                        </div>
                      </div>

                      {/* Title & Authors Section */}
                      <div className="max-w-6xl mx-auto text-center md:text-left">
                         <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase mb-3">
                           {publicationDetails.title || fileName || 'Untitled Research'}
                         </h2>
                         <p className="text-slate-500 font-bold text-sm md:text-base italic">
                           By {publicationDetails.authors || 'Genius Research Network'}
                         </p>
                      </div>
                  </div>

                  {/* Aesthetic backgrounds */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#800000]/5 rounded-full blur-3xl -mr-32 -mt-32" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -ml-16 -mb-16" />
                </div>
              )}
              
              <div className="flex-1 overflow-hidden relative preview-scrollbar">
                {/* Watermark for Published Papers */}
                {publicationDetails && (
                  <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden flex items-center justify-center select-none opacity-[0.03]">
                    <div className="text-[200px] font-black text-slate-900 -rotate-45 whitespace-nowrap">
                      GMIJP &bull; GMIJP &bull; GMIJP
                    </div>
                  </div>
                )}
                {renderContent()}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
