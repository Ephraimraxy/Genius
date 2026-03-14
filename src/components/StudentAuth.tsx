import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Key, Loader2, ShieldCheck, ArrowRight, UserCircle, GraduationCap } from 'lucide-react';

import { ToastType } from './ToastSystem';

// Regex for Matriculation Number (e.g., NSUK/SCI/2021/1054)
// Allows NSUK / 3 to 4 uppercase letters / 4 digits / 4 digits
const MATRIC_REGEX = /^NSUK\/[A-Z]{3,4}\/\d{4}\/\d{4}$/;

interface StudentAuthProps {
    onAuthSuccess: (token: string, user: any) => void;
    addToast: (message: string, type?: ToastType) => void;
    onBackToMain: () => void;
}

export default function StudentAuth({ onAuthSuccess, addToast, onBackToMain }: StudentAuthProps) {
    const [matricNumber, setMatricNumber] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const formatMatricInput = (value: string) => {
        // Automatically uppercase and clean input
        let val = value.toUpperCase().replace(/[^A-Z0-9/]/g, '');
        setMatricNumber(val);
        // Clear error if they start typing again
        if (error) setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!MATRIC_REGEX.test(matricNumber)) {
            setError('Invalid Matriculation Format. Expected: NSUK/DEP/YYYY/NNNN');
            return;
        }

        if (!/^\d{4}$/.test(pin)) {
            setError('PIN must be exactly 4 digits.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/student/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricNumber, pin })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            addToast('Login successful', 'success');
            onAuthSuccess(data.token, data.user);

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            addToast(err.message || 'Authentication failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative font-sans">
            {/* Split Screen Layout Container */}
            <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden relative z-10">
                
                {/* Left Side: Branding (Image 1 Format) */}
                <div className="md:w-[45%] bg-[#1a237e] relative overflow-hidden flex flex-col p-12 text-white shadow-2xl z-20">
                   <div className="absolute inset-0 bg-slate-900/30" />
                   <div className="absolute top-0 left-0 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px] -ml-40 -mt-40" />
                   <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -mr-48 -mb-48" />
                   
                   <div className="relative z-10 flex flex-col h-full justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white rounded-full p-2.5 shadow-xl">
                           <img src="/gmijp-logo.png" alt="Genius" className="w-full h-full object-contain" />
                        </div>
                        <div>
                           <h1 className="font-black tracking-[0.2em] text-sm uppercase mb-0.5">Genius Academy</h1>
                           <div className="h-0.5 w-12 bg-[#ff4d4d]" />
                        </div>
                     </div>

                     <div className="py-20">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-10 border border-white/10 p-6 backdrop-blur-sm"
                        >
                           <img src="/gmijp-logo.png" alt="Genius" className="w-full h-full object-contain brightness-0 invert opacity-40" />
                        </motion.div>
                        <h2 className="text-5xl font-black mb-6 tracking-tight leading-[1.1]">Student <br/><span className="text-white/40">Portal</span></h2>
                        <p className="text-blue-100/60 font-medium leading-relaxed max-w-sm text-lg">
                          Welcome to your secure academic gateway. Manage your assessments and academic performance from a single centralized dashboard.
                        </p>
                     </div>

                     <div className="mt-auto border-t border-white/10 pt-10 flex items-center justify-between">
                        <div className="space-y-1">
                           <p className="text-[#ff4d4d] font-black uppercase tracking-[0.4em] text-[10px]">Integrity · Innovation · Excellence</p>
                           <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Digital Learning Ecosystem &copy; 2026</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                              <ShieldCheck size={14} className="text-blue-400" />
                           </div>
                        </div>
                     </div>
                   </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="md:w-[55%] p-8 sm:p-20 flex flex-col justify-center bg-slate-50 relative z-10">
                    <div className="max-w-md w-full mx-auto relative">
                        {/* Static Background Text (Image 1 Aesthetic) */}
                        <div className="absolute -top-32 -right-32 text-slate-100 text-9xl font-black select-none pointer-events-none rotate-12 opacity-50">
                            GENIUS
                        </div>

                        <div className="mb-12 relative">
                             <button 
                                onClick={onBackToMain}
                                className="mb-12 flex items-center gap-2 text-slate-400 hover:text-[#1a237e] transition-all text-xs font-black uppercase tracking-widest group border-b border-transparent hover:border-[#1a237e]/20 pb-1"
                             >
                                <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                                Back to Main Portal
                             </button>

                            <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Welcome back</h3>
                            <p className="text-slate-500 font-medium">Login to your account below to continue to your student dashboard</p>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="mb-8 p-5 bg-red-50 border border-red-100/50 text-red-600 rounded-2xl text-xs font-black flex items-center gap-3 shadow-sm"
                                >
                                    <div className="p-1.5 bg-red-600 rounded-lg text-white"><ShieldCheck size={14} /></div>
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest ml-1">Matriculation Number</label>
                                <div className="relative group">
                                    <GraduationCap className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1a237e] transition-colors" size={20} />
                                    <input
                                        type="text"
                                        required
                                        value={matricNumber}
                                        onChange={(e) => formatMatricInput(e.target.value)}
                                        className="w-full pl-14 pr-4 py-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1a237e] focus:border-[#1a237e] focus:shadow-xl focus:shadow-indigo-900/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 font-mono font-black tracking-widest uppercase text-sm"
                                        placeholder="NSUK/SCI/YYYY/NNNN"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest ml-1">Secure 4-Digit PIN</label>
                                <div className="relative group">
                                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1a237e] transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        maxLength={4}
                                        inputMode="numeric"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-14 pr-4 py-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#1a237e] focus:border-[#1a237e] focus:shadow-xl focus:shadow-indigo-900/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 font-mono text-xl tracking-[0.8em] text-center"
                                        placeholder="••••"
                                    />
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01, boxShadow: '0 20px 25px -5px rgb(26 35 126 / 0.1), 0 8px 10px -6px rgb(26 35 126 / 0.1)' }}
                                whileTap={{ scale: 0.99 }}
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#1a237e] text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-[#121858] transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-3 group uppercase tracking-widest text-xs"
                            >
                                {loading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        <span>Portal Access</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        <div className="mt-12 p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover:bg-indigo-500/10" />
                           <p className="text-slate-500 font-bold text-[11px] leading-relaxed relative z-10 italic">
                             Lost your access PIN? Please contact the department administrator to reset your credentials. Secure academic monitoring is active.
                           </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
