import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowRight } from 'lucide-react';

export default function WaitingDraftsQueue({ 
  expectedStatus, 
  onSelect, 
  title, 
  icon: Icon, 
  emptyMessage 
}: { 
  expectedStatus: string, 
  onSelect: (id: number) => void, 
  title: string, 
  icon: any, 
  emptyMessage: string 
}) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/papers/queue/${expectedStatus}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => setDrafts(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load drafts', err))
      .finally(() => setIsLoading(false));
  }, [expectedStatus]);

  return (
    <div className="flex flex-col min-h-[60vh] items-center justify-center p-4 sm:p-8 text-center max-w-2xl mx-auto w-full">
      <div className="w-20 h-20 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] flex items-center justify-center text-indigo-500 mb-6 shadow-inner">
        <Icon size={40} />
      </div>
      <h2 className="text-3xl font-black text-slate-900 font-display mb-3 tracking-tight">{title}</h2>
      
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 mt-10">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scanning Storage...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-8 mt-6 w-full max-w-md">
          <p className="text-slate-500 font-medium text-lg leading-relaxed">{emptyMessage}</p>
        </div>
      ) : (
        <div className="w-full mt-8 flex flex-col gap-4 text-left px-2 sm:px-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Queue</p>
            <span className="text-xs font-black text-white bg-indigo-600 px-3 py-1 rounded-full shadow-sm">{drafts.length} Documents</span>
          </div>
          <AnimatePresence>
            {drafts.map((draft, idx) => (
              <motion.div
                key={draft.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <button
                  onClick={() => onSelect(draft.id)}
                  className="w-full p-5 sm:p-6 bg-white border border-slate-200 rounded-[2rem] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.3)] hover:border-indigo-300 hover:scale-[1.01] transition-all flex flex-col sm:flex-row sm:items-center justify-between group relative overflow-hidden gap-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 text-left min-w-0 pr-4">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">{draft.title || 'Untitled Manuscript'}</h3>
                    <div className="flex items-center gap-3 mt-1.5 opacity-80">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        ID: #{draft.id}
                      </p>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      <p className="text-xs font-bold text-slate-500">
                        {new Date(draft.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {(draft.researcher_name || draft.researcher_email) && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          <p className="text-xs font-bold text-slate-500 truncate">
                            {draft.researcher_name || draft.researcher_email}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:w-14 h-12 sm:h-14 bg-slate-50 group-hover:bg-indigo-600 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-white transition-colors relative z-10 shadow-sm shrink-0">
                    <span className="sm:hidden font-bold mr-2 text-sm">Process</span>
                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
