import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap } from 'lucide-react';

export default function GlobalLoader({ show, message }: { show: boolean, message?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center"
        >
          <div className="relative">
            {/* Pulsing ring */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-[#800000] rounded-full blur-2xl"
            />
            
            {/* Outer spinning ring with glow */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
              className="w-24 h-24 border-4 border-[#800000]/5 border-t-[#800000] rounded-full relative z-10 shadow-[0_0_20px_rgba(128,0,0,0.1)]"
            />
            
            {/* Inner secondary sparkle ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-2 border-2 border-dashed border-[#800000]/10 rounded-full z-5"
            />
            
            {/* Center Icon */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <GraduationCap size={40} className="text-[#800000]" />
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 text-center"
          >
            <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display uppercase tracking-[0.2em]">
              Genius Portal
            </h3>
            <p className="text-slate-400 font-bold text-[10px] mt-2 uppercase tracking-widest animate-pulse">
              {message || 'Synchronizing Neural Modules...'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
