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
    const [isLogin, setIsLogin] = useState(true);
    const [matricNumber, setMatricNumber] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
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
            setError('Invalid Matriculation Format. Expected: NSUK/DEP/YYYY/NNNN (e.g., NSUK/SCI/2021/1054)');
            return;
        }

        setLoading(true);

        const endpoint = isLogin ? '/api/student/login' : '/api/student/register';
        const body = isLogin
            ? { matricNumber, password }
            : { matricNumber, password, name: fullName };

        try {
            // NOTE: In a real environment, you'd call your actual backend here.
            // For now, we simulate a successful login/registration for the student flow.
            // Simulating API call
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            // Artificial check if "registering" just to show it works
            if (!isLogin && password.length < 6) {
                throw new Error("Password must be at least 6 characters.");
            }

            // Mock Response
            const mockData = {
                token: 'mock-student-token-123',
                user: {
                    id: 999,
                    name: isLogin ? 'Student' : fullName,
                    email: `${matricNumber.toLowerCase().replace(/\//g, '')}@student.nsuk.edu.ng`,
                    role: 'student',
                    matricNumber: matricNumber
                }
            };
            
            localStorage.setItem('token', mockData.token);
            localStorage.setItem('user', JSON.stringify(mockData.user));
            
            addToast(isLogin ? `Welcome back, ${matricNumber}!` : 'Student account activated successfully!', 'success');
            onAuthSuccess(mockData.token, mockData.user);

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
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex p-4 rounded-2xl bg-indigo-500/20 mb-6 items-center justify-center border border-white/20 shadow-inner"
                        >
                            <GraduationCap size={32} className="text-indigo-300" />
                        </motion.div>
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-display mb-2 drop-shadow-md">
                            Student Portal
                        </h2>
                        <p className="text-indigo-200/80 font-medium text-sm">
                            {isLogin
                                ? 'Enter your Matric Number to access tests'
                                : 'Activate your account with your Matric Number'}
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
                        <AnimatePresence mode="popLayout">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-4"
                                >
                                    <div className="relative group">
                                        <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300/50 group-focus-within:text-indigo-400 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-indigo-200/50 font-medium"
                                            placeholder="Full Name as on School Record"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-indigo-200/50 font-medium"
                                placeholder={isLogin ? "Password" : "Create Password (min 6 chars)"}
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
                                    <span>{isLogin ? 'Access Portal' : 'Activate Account'}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/10 text-center relative z-10">
                        <p className="text-indigo-200/70 font-bold text-[10px] uppercase tracking-[0.2em]">
                            {isLogin ? "First time logging in?" : "Already activated?"}{' '}
                            <button
                                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                className="text-white hover:text-indigo-300 transition-colors ml-1 font-black underline underline-offset-4"
                            >
                                {isLogin ? 'Activate Account' : 'Log In'}
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
