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
        <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative">
            {/* Optimized Background Layer - Different tint for student portal */}
            <div className="absolute inset-0 z-0 bg-slate-900">
                <img 
                    src="/Banner/NSUK.jpg" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-60 transition-opacity duration-1000 ease-in-out z-0 filter grayscale-[30%] blur-[2px]"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 to-blue-900/60 z-[5]" />
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] z-20"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-transparent to-white/20 z-25"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full mx-4 z-30"
            >
                {/* Back Button */}
                <button 
                    onClick={onBackToMain}
                    className="mb-6 flex items-center gap-2 text-indigo-200 hover:text-white transition-colors text-sm font-bold bg-white/5 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 w-fit"
                >
                    <ArrowRight size={16} className="rotate-180" />
                    Back to Main Portal
                </button>

                {/* Glassmorphism Container */}
                <div className="bg-indigo-950/40 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -ml-20 -mb-20"></div>
                    
                    <div className="text-center mb-10 relative">
                            <img src="/gmijp-logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-display mb-2 drop-shadow-md">
                            Student Portal
                        </h2>
                        <p className="text-indigo-200/80 font-medium text-sm">
                            Enter your Matric Number and 4-digit PIN to access your assessments.
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-200 rounded-2xl text-xs font-bold flex items-center gap-2"
                            >
                                <ShieldCheck size={16} className="shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-4 relative z-10">


                        <div className="relative group">
                            <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/50 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input
                                type="text"
                                required
                                value={matricNumber}
                                onChange={(e) => formatMatricInput(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-indigo-200/50 font-mono font-bold tracking-wider"
                                placeholder="NSUK/SCI/YYYY/NNNN"
                            />
                        </div>

                        <div className="relative group">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/50 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input
                                type="password"
                                required
                                maxLength={4}
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-indigo-200/50 font-mono text-xl tracking-[0.5em] text-center"
                                placeholder="••••"
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-900/50 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 group border border-indigo-400/30"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <span>Access Portal</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/10 text-center relative z-10">
                        <p className="text-indigo-200/70 font-bold text-[10px] uppercase tracking-[0.2em]">
                            Lost your PIN or need access? Contact your course lecturer to receive a secure activation link via email.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
