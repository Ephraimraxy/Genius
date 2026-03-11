import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, Sparkles } from 'lucide-react';

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
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/Banner/NSUK.jpg" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent"></div>
            </div>

            <div className="max-w-6xl w-full mx-auto px-4 z-10 grid lg:grid-cols-2 items-center gap-12">
                {/* Brand Side */}
                <motion.div 
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="hidden lg:block space-y-6"
                >
                    <div className="inline-flex p-4 rounded-3xl bg-rose-50 items-center justify-center shadow-xl shadow-rose-100">
                        <Sparkles size={48} className="text-rose-600" />
                    </div>
                    <h1 className="text-6xl font-black text-slate-900 leading-[1.1] font-display">
                        Neural Process <br />
                        <span className="text-rose-600">Made Genius</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-md leading-relaxed">
                        All the tools to empower researchers to quickly validate, format, and publish with complex neural rules and effortless DOIs.
                    </p>
                </motion.div>

                {/* Form Side */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full justify-self-center lg:justify-self-end"
                >
                    <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(244,63,94,0.15)] p-10 border border-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/50 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        
                        <div className="text-center lg:text-left mb-10 relative">
                            <div className="lg:hidden inline-flex p-3 rounded-2xl bg-rose-50 mb-4 items-center justify-center">
                                <Sparkles size={32} className="text-rose-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-display">
                                {isLogin ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <p className="text-slate-500 mt-2 font-medium">
                                {isLogin
                                    ? 'Sign in to access your genius portal'
                                    : 'Join Genius App to manage your publications'}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-semibold"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {!isLogin && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="space-y-4"
                                    >
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
                                                placeholder="Full Name"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={affiliation}
                                                onChange={(e) => setAffiliation(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
                                                placeholder="Affiliation"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="Email address"
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="Password"
                                />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading}
                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-rose-200 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 group"
                            >
                                {loading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Sign In' : 'Get Started'}</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                            <p className="text-slate-500 font-semibold text-sm uppercase tracking-wide">
                                {isLogin ? "New to Genius?" : "Joined us before?"}{' '}
                                <button
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-rose-600 font-black hover:text-rose-700 transition-colors ml-1"
                                >
                                    {isLogin ? 'Join Genius' : 'Sign in'}
                                </button>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
