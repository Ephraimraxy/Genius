import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, GraduationCap, ShieldCheck } from 'lucide-react';

interface AuthProps {
    onAuthSuccess: (token: string, user: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const body = isLogin
            ? { email, password }
            : { email, password, name, affiliation };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onAuthSuccess(data.token, data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative">
            {/* Optimized Background Layer */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/Banner/NSUK.jpg" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] z-20"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white z-25"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full mx-4 z-10"
            >
                {/* Glassmorphism Container */}
                <div className="glass-morph-dark rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#800000]/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    
                    <div className="text-center mb-10 relative">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex p-4 rounded-2xl bg-[#800000]/20 mb-6 items-center justify-center border border-white/10"
                        >
                            <GraduationCap size={32} className="text-[#ff4d4d]" />
                        </motion.div>
                        <h2 className="text-4xl font-black text-white tracking-tight font-display mb-2 drop-shadow-lg">
                            {isLogin ? 'Genius Login' : 'Join Genius'}
                        </h2>
                        <p className="text-slate-300 font-medium text-sm">
                            {isLogin
                                ? 'Authorize to access your publication portal'
                                : 'Scale your research with neural intelligence'}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-[#800000]/20 border border-[#800000]/30 text-[#ff4d4d] rounded-2xl text-xs font-bold flex items-center gap-2"
                            >
                                <ShieldCheck size={16} />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-4"
                                >
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ff4d4d] transition-colors" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white/10 outline-none transition-all text-white placeholder:text-slate-500"
                                            placeholder="Full Name"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ff4d4d] transition-colors" size={18} />
                                        <input
                                            type="text"
                                            value={affiliation}
                                            onChange={(e) => setAffiliation(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white/10 outline-none transition-all text-white placeholder:text-slate-500"
                                            placeholder="Affiliation"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ff4d4d] transition-colors" size={18} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white/10 outline-none transition-all text-white placeholder:text-slate-500"
                                placeholder="Email address"
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ff4d4d] transition-colors" size={18} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white/10 outline-none transition-all text-white placeholder:text-slate-500"
                                placeholder="Password"
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: '#a52a2a' }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#800000] text-white font-bold py-4 rounded-2xl shadow-2xl shadow-[#800000]/20 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 group border border-white/10"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">
                            {isLogin ? "New to Genius?" : "Already Joined?"}{' '}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-[#ff4d4d] hover:text-white transition-colors ml-1 font-black underline underline-offset-4"
                            >
                                {isLogin ? 'Join Team' : 'Log In'}
                            </button>
                        </p>
                    </div>
                </div>
                
                {/* Branding Footer */}
                <div className="mt-8 text-center">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">
                        GMIJ Publication Portal &copy; 2026
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
