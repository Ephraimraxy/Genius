import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Check, Trash2, Info } from 'lucide-react';

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'info' | 'warning';
}

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel', 
  onConfirm, 
  onCancel,
  type = 'warning'
}: ConfirmConfig) {
  
  const colors = {
    danger: {
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      text: 'text-rose-700',
      button: 'bg-rose-600 hover:bg-rose-700',
      icon: <Trash2 size={24} className="text-rose-600" />,
      accent: 'bg-rose-500/10'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-700',
      button: 'bg-amber-600 hover:bg-amber-700',
      icon: <AlertTriangle size={24} className="text-amber-600" />,
      accent: 'bg-amber-500/10'
    },
    info: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      text: 'text-indigo-700',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      icon: <Info size={24} className="text-indigo-600" />,
      accent: 'bg-indigo-500/10'
    }
  };

  const style = colors[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden"
          >
            {/* Header / Logo Design */}
            <div className={`h-24 md:h-28 flex items-center justify-center relative overflow-hidden ${style.bg} border-b ${style.border}`}>
               <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl ${style.accent}`} />
               <div className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-3xl ${style.accent}`} />
               
               <div className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center p-4">
                  <img src="/gmijp-logo.png" alt="Genius" className="w-full h-full object-contain" />
               </div>
            </div>

            <div className="p-8 md:p-10 text-center">
              <div className={`inline-flex items-center justify-center p-3 rounded-xl mb-4 ${style.bg}`}>
                {style.icon}
              </div>
              
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-2">
                {title}
              </h3>
              
              <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
                {message}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-6 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-black/5 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${style.button}`}
                >
                  <Check size={16} />
                  {confirmLabel}
                </button>
              </div>
            </div>

            <button
              onClick={onCancel}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
