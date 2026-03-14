import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, ShieldCheck, ArrowLeft, KeyRound, CheckCircle, MessageSquare, Send } from 'lucide-react';

import { ToastType } from './ToastSystem';

interface AuthProps {
    onAuthSuccess: (token: string, user: any) => void;
    addToast: (message: string, type?: ToastType) => void;
    onBackToLanding?: () => void;
}

export default function Auth({ onAuthSuccess, addToast, onBackToLanding }: AuthProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLecturerRegister, setIsLecturerRegister] = useState(false);
    const [tenantName, setTenantName] = useState('');

    // Forgot password states
    const [forgotMode, setForgotMode] = useState<'off' | 'choose' | 'email' | 'code' | 'admin' | 'adminSent' | 'success'>('off');
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState('');
    const [contactMessage, setContactMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin 
            ? '/api/auth/login' 
            : (isLecturerRegister ? '/api/auth/lecturer/register' : '/api/auth/register');
        
        const body = isLogin
            ? { email, password }
            : (isLecturerRegister 
                ? { email, password, name, tenantName }
                : { email, password, name, affiliation });

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
            addToast(isLogin ? `Welcome back, ${data.user.name}!` : 'Account created successfully!', 'success');
            onAuthSuccess(data.token, data.user);
        } catch (err: any) {
            setError(err.message);
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCode = async () => {
        setResetLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });
            const data = await res.json();
            if (data.success) {
                setForgotMode('code');
                setResetMessage('A 6-digit code has been sent to your email. Check your inbox (and spam folder).');
            } else {
                setError(data.error || 'Failed to send reset code');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
        setResetLoading(false);
    };

    const handleVerifyCode = async () => {
        setResetLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                setForgotMode('success');
                setResetMessage('Password reset successfully! You can now log in with your new password.');
            } else {
                setError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
        setResetLoading(false);
    };

    const exitForgotMode = () => {
        setForgotMode('off');
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
        setResetMessage('');
        setContactMessage('');
        setError('');
    };

    const handleContactAdmin = async () => {
        if (!resetEmail || !contactMessage) return;
        setResetLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/contact-admin-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail, message: contactMessage })
            });
            const data = await res.json();
            if (data.success) {
                setForgotMode('adminSent');
            } else {
                setError(data.error || 'Failed to send request');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
        setResetLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative">
            {/* Optimized Background Layer */}
            <div className="absolute inset-0 z-0 bg-slate-900">
                <img 
                    src="/Banner/NSUK.jpg" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-1000 ease-in-out z-0"
                    onLoad={(e) => {
                        (e.target as HTMLImageElement).classList.remove('opacity-0');
                        (e.target as HTMLImageElement).classList.add('opacity-60');
                    }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-[#800000]/40 z-[5] -z-10" />
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] z-20"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white z-25"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full mx-4 z-10"
            >
                {/* Glassmorphism Container */}
                {onBackToLanding && (
                    <button 
                        onClick={onBackToLanding}
                        className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold bg-white/5 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 w-fit"
                    >
                        <ArrowLeft size={16} />
                        Back to Home
                    </button>
                )}
                <div className="glass-morph-dark rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#800000]/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    
                    <div className="text-center mb-10 relative">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex p-4 rounded-2xl bg-[#800000]/20 mb-6 items-center justify-center border border-white/10"
                        >
                            <img src="/gmijp-logo.png" alt="GMIJP" className="w-8 h-8 rounded-full object-contain" />
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
                                            value={isLecturerRegister ? tenantName : affiliation}
                                            onChange={(e) => isLecturerRegister ? setTenantName(e.target.value) : setAffiliation(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white/10 outline-none transition-all text-white placeholder:text-slate-500"
                                            placeholder={isLecturerRegister ? "Workspace/Organization Name" : "Affiliation"}
                                            required={isLecturerRegister}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 px-1 pb-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsLecturerRegister(!isLecturerRegister)}
                                            className={`p-1.5 rounded-lg border transition-all ${isLecturerRegister ? 'bg-[#800000]/20 border-[#800000] text-white' : 'border-white/10 text-slate-500'}`}
                                        >
                                            <ShieldCheck size={16} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-300">Create Lecturer/Workspace Account</span>
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

                    {/* Forgot Password Link (Login mode only) */}
                    {isLogin && forgotMode === 'off' && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setForgotMode('choose')}
                                className="text-slate-400 hover:text-[#ff4d4d] text-xs font-bold transition-colors underline underline-offset-4"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}

                    {/* ─── FORGOT PASSWORD FLOW ─── */}
                    <AnimatePresence mode="wait">
                        {forgotMode === 'choose' && (
                            <motion.div
                                key="choose"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-sm">Reset Your Password</h3>
                                    <button onClick={exitForgotMode} className="text-slate-400 hover:text-white transition-colors">
                                        <ArrowLeft size={16} />
                                    </button>
                                </div>
                                <p className="text-slate-400 text-xs">Choose how you'd like to reset your password:</p>
                                <button
                                    onClick={() => setForgotMode('email')}
                                    className="w-full flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left group"
                                >
                                    <div className="p-2 bg-[#800000]/20 rounded-lg"><Mail size={18} className="text-[#ff4d4d]" /></div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Email Reset Code</p>
                                        <p className="text-slate-500 text-[10px] font-medium">Receive a 6-digit code in your inbox</p>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-500 ml-auto group-hover:text-white transition-colors" />
                                </button>
                                <button
                                    onClick={() => setForgotMode('admin')}
                                    className="w-full flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left group"
                                >
                                    <div className="p-2 bg-amber-500/20 rounded-lg"><ShieldCheck size={18} className="text-amber-400" /></div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Contact Admin</p>
                                        <p className="text-slate-500 text-[10px] font-medium">Lost email access? Admin can reset it for you</p>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-500 ml-auto group-hover:text-white transition-colors" />
                                </button>
                            </motion.div>
                        )}

                        {forgotMode === 'email' && (
                            <motion.div
                                key="email"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><KeyRound size={16} className="text-[#ff4d4d]" /> Email Reset</h3>
                                    <button onClick={() => setForgotMode('choose')} className="text-slate-400 hover:text-white transition-colors">
                                        <ArrowLeft size={16} />
                                    </button>
                                </div>
                                <p className="text-slate-400 text-xs">Enter your registered email to receive a 6-digit reset code.</p>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#800000] outline-none text-white text-sm placeholder:text-slate-500"
                                        placeholder="Your email address"
                                    />
                                </div>
                                <button
                                    onClick={handleRequestCode}
                                    disabled={resetLoading || !resetEmail}
                                    className="w-full bg-[#800000] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                    Send Reset Code
                                </button>
                            </motion.div>
                        )}

                        {forgotMode === 'code' && (
                            <motion.div
                                key="code"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><KeyRound size={16} className="text-[#ff4d4d]" /> Enter Reset Code</h3>
                                    <button onClick={() => setForgotMode('email')} className="text-slate-400 hover:text-white transition-colors">
                                        <ArrowLeft size={16} />
                                    </button>
                                </div>
                                {resetMessage && <p className="text-emerald-400 text-xs font-medium bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">{resetMessage}</p>}
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={resetCode}
                                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#800000] outline-none text-white text-sm placeholder:text-slate-500 tracking-[0.3em] text-center font-bold text-lg"
                                        placeholder="000000"
                                        maxLength={6}
                                    />
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#800000] outline-none text-white text-sm placeholder:text-slate-500"
                                        placeholder="New password (min 6 characters)"
                                    />
                                </div>
                                <button
                                    onClick={handleVerifyCode}
                                    disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 6}
                                    className="w-full bg-[#800000] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    Reset Password
                                </button>
                            </motion.div>
                        )}

                        {forgotMode === 'admin' && (
                            <motion.div
                                key="admin"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-sm flex items-center gap-2"><ShieldCheck size={16} className="text-amber-400" /> Contact Admin</h3>
                                    <button onClick={() => setForgotMode('choose')} className="text-slate-400 hover:text-white transition-colors">
                                        <ArrowLeft size={16} />
                                    </button>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Lost access to your email? Send a message to the platform administrator. They will verify your identity and set a temporary password for you.
                                </p>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#800000] outline-none text-white text-sm placeholder:text-slate-500"
                                        placeholder="Your registered email"
                                    />
                                </div>
                                <div className="relative group">
                                    <MessageSquare className="absolute left-4 top-3 text-slate-400" size={16} />
                                    <textarea
                                        value={contactMessage}
                                        onChange={(e) => setContactMessage(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#800000] outline-none text-white text-sm placeholder:text-slate-500 resize-none"
                                        placeholder="Describe your situation (e.g. I lost access to my email and need a password reset)"
                                        rows={3}
                                    />
                                </div>
                                <button
                                    onClick={handleContactAdmin}
                                    disabled={resetLoading || !resetEmail || !contactMessage}
                                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                                >
                                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Send Request to Admin
                                </button>
                            </motion.div>
                        )}

                        {forgotMode === 'adminSent' && (
                            <motion.div
                                key="adminSent"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-6 p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-3"
                            >
                                <CheckCircle size={36} className="text-amber-400 mx-auto" />
                                <p className="text-amber-300 font-bold text-sm">Request Sent!</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Your password reset request has been sent to the platform administrator. They will review it and set a temporary password for you. Check back and try logging in soon.
                                </p>
                                <button
                                    onClick={exitForgotMode}
                                    className="text-white bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded-xl text-sm font-bold transition-colors"
                                >
                                    Back to Login
                                </button>
                            </motion.div>
                        )}

                        {forgotMode === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-6 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-3"
                            >
                                <CheckCircle size={36} className="text-emerald-400 mx-auto" />
                                <p className="text-emerald-300 font-bold text-sm">{resetMessage}</p>
                                <button
                                    onClick={exitForgotMode}
                                    className="text-white bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl text-sm font-bold transition-colors"
                                >
                                    Back to Login
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">
                            {isLogin ? "New to Genius?" : "Already Joined?"}{' '}
                            <button
                                onClick={() => { setIsLogin(!isLogin); exitForgotMode(); }}
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
