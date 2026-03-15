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
      text: 'text-rose-600',
      button: 'bg-rose-600 hover:bg-rose-700',
      icon: <Trash2 size={20} />,
      light: 'bg-rose-100'
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700',
      icon: <AlertTriangle size={20} />,
      light: 'bg-amber-100'
    },
    info: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      icon: <Info size={20} />,
      light: 'bg-indigo-100'
    }
  };

  const style = colors[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="relative w-full max-w-[340px] bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden border border-slate-100"
          >
            {/* Minimal Header */}
            <div className="pt-8 pb-4 px-6 text-center">
               <div className="relative inline-block mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${style.bg} ${style.text} shadow-sm border border-white`}>
                    {style.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center p-1 border border-slate-50">
                    <img src="/gmijp-logo.png" alt="G" className="w-full h-full object-contain" />
                  </div>
               </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {title}
              </h3>
              
              <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                {message}
              </p>
            </div>

            <div className="p-5 bg-slate-50/50 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-95"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-[1.2] px-4 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${style.button}`}
              >
                <Check size={14} />
                {confirmLabel}
              </button>
            </div>

            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
