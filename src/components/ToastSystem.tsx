import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastSystemProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export default function ToastSystem({ toasts, removeToast }: ToastSystemProps) {
  return (
    <div className="fixed bottom-8 right-8 z-[110] flex flex-col gap-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto"
          >
            <div className={`
              relative overflow-hidden min-w-[320px] max-w-md bg-white border rounded-[2rem] p-6 shadow-2xl flex items-center gap-5
              ${toast.type === 'error' ? 'border-rose-100 shadow-rose-100/30' : 
                toast.type === 'success' ? 'border-emerald-100 shadow-emerald-100/30' : 
                'border-indigo-100 shadow-indigo-100/30'}
            `}>
              {/* Background gradient hint */}
              <div className={`
                absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 opacity-10
                ${toast.type === 'error' ? 'bg-rose-500' : 
                  toast.type === 'success' ? 'bg-emerald-500' : 
                  'bg-indigo-500'}
              `}></div>

              <div className={`
                shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center
                ${toast.type === 'error' ? 'bg-rose-50 text-rose-600' : 
                  toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                  'bg-indigo-50 text-indigo-600'}
              `}>
                {toast.type === 'error' ? <AlertCircle size={24} /> : 
                 toast.type === 'success' ? <CheckCircle2 size={24} /> : 
                 <img src="/gmijp-logo.png" alt="GMIJP" className="w-6 h-6 rounded-full object-contain" />}
              </div>

              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-40">
                  {toast.type === 'error' ? 'System Warning' : toast.type === 'success' ? 'Process Success' : 'Neural Signal'}
                </p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {toast.message}
                </p>
              </div>

              <button 
                onClick={() => removeToast(toast.id)}
                className="p-2 hover:bg-slate-50 text-slate-300 hover:text-slate-900 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Helper hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
