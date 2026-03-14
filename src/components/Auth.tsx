import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, ShieldCheck, ArrowLeft, KeyRound, CheckCircle, MessageSquare, Send } from 'lucide-react';

import { ToastType } from './ToastSystem';

interface AuthProps {
    onAuthSuccess: (token: string, user: any) => void;
    addToast: (message: string, type?: ToastType) => void;
    onBackToLanding?: () => void;
    role?: 'researcher' | 'lecturer';
    initialIsLogin?: boolean;
}

export default function Auth({ onAuthSuccess, addToast, onBackToLanding, role = 'researcher', initialIsLogin = true }: AuthProps) {
    const [isLogin, setIsLogin] = useState(initialIsLogin);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLecturerRegister, setIsLecturerRegister] = useState(role === 'lecturer');
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
        <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative font-sans">
            {/* Split Screen Layout Container */}
            <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden relative z-10">
                
                {/* Left Side: Branding (Refined Spacing) */}
                <div className="hidden md:flex md:w-[40%] bg-[#800000] relative overflow-hidden flex-col p-8 text-white shadow-2xl z-20">
                   <div className="absolute inset-0 bg-slate-900/40" />
                   <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4d4d]/10 rounded-full blur-[100px] -mr-48 -mt-48" />
                   <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-900/40 rounded-full blur-[120px] -ml-40 -mb-40" />
                   
                   <div className="relative z-10 flex flex-col h-full text-center">
                      <div className="flex-1 flex flex-col items-center justify-center">
                         <motion.div
                           initial={{ scale: 0.9, opacity: 0 }}
                           animate={{ scale: 1, opacity: 1 }}
                           className="mb-8"
                         >
                            <img src="/gmijp-logo.png" alt="Genius" className="w-24 h-24 object-contain shadow-2xl rounded-[1.5rem]" />
                         </motion.div>

                         <div className="mb-8">
                            <h1 className="font-black tracking-[0.2em] text-xs uppercase mb-2 opacity-50">Genius Mindspark</h1>
                            <div className="h-0.5 w-12 bg-[#ff4d4d] mx-auto" />
                         </div>
                         
                         <h2 className="text-4xl font-black mb-6 tracking-tight leading-[1.1]">
                             {role === 'lecturer' ? 'Academic' : 'Neural'} <br/>
                             <span className="text-white/40">{role === 'lecturer' ? 'Workspace' : 'Research'}</span>
                         </h2>
                         
                         <p className="text-rose-100/60 font-medium leading-relaxed max-w-sm text-base mx-auto">
                           {role === 'lecturer' 
                             ? 'Configure your institutional space, manage grading systems, and oversee secure assessments for your students.' 
                             : 'Global benchmark for multidisciplinary research. Transform your ideas with neural-assisted validation.'}
                         </p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-white/10">
                         <div className="flex items-center justify-center gap-3">
                            <ShieldCheck size={14} className="text-rose-400" />
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-tight">
                              Secured by GMIJ <br/> Neural Encryption
                            </p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Side: Action Area */}
                <div className="w-full md:w-[60%] p-6 sm:p-10 flex flex-col justify-center bg-white relative z-10 overflow-y-auto">
                    <div className="max-w-md w-full mx-auto relative px-4">
                        {/* Static Background Pattern */}
                        <div className="absolute -top-32 -right-32 text-slate-50 text-8xl font-black select-none pointer-events-none rotate-6 opacity-20">
                            GENIUS
                        </div>

                        <div className="mb-4 relative">
                             {onBackToLanding && (
                                <button 
                                    onClick={onBackToLanding}
                                    className="mb-4 flex items-center gap-2 text-slate-400 hover:text-[#800000] transition-all text-xs font-black uppercase tracking-widest group border-b border-transparent hover:border-[#800000]/20 pb-1"
                                >
                                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                    Back to Main Portal
                                </button>
                             )}

                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                                {isLogin 
                                    ? (role === 'lecturer' ? 'Lecturer Login' : 'Welcome back') 
                                    : (role === 'lecturer' ? 'Lecturer Signup' : 'Create Account')}
                            </h3>
                            <p className="text-slate-500 font-medium text-xs italic">
                                {isLogin
                                    ? (role === 'lecturer' ? 'Access your academic workspace' : 'Authorize to access your publication portal')
                                    : (role === 'lecturer' ? 'Create your workspace and manage exams' : 'Scale your research with neural intelligence')}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="mb-6 p-4 bg-rose-50 border border-rose-100/50 text-rose-600 rounded-2xl text-xs font-black flex items-center gap-3 shadow-sm"
                                >
                                    <div className="p-1.5 bg-[#800000] rounded-lg text-white"><ShieldCheck size={14} /></div>
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {forgotMode === 'off' ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {!isLogin && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="space-y-4"
                                        >
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest ml-1">Full Name</label>
                                                <div className="relative group">
                                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#800000] transition-colors" size={20} />
                                                    <input
                                                        type="text"
                                                        required
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold"
                                                        placeholder="John Doe"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest ml-1">
                                                    {isLecturerRegister ? "Workspace/Organization" : "Affiliation"}
                                                </label>
                                                <div className="relative group">
                                                    <Building className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#800000] transition-colors" size={20} />
                                                    <input
                                                        type="text"
                                                        value={isLecturerRegister ? tenantName : affiliation}
                                                        onChange={(e) => isLecturerRegister ? setTenantName(e.target.value) : setAffiliation(e.target.value)}
                                                        className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold"
                                                        placeholder={isLecturerRegister ? "e.g. Science Faculty" : "e.g. NSUK Research Unit"}
                                                        required={isLecturerRegister}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 px-2 pb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsLecturerRegister(!isLecturerRegister)}
                                                    className={`w-10 h-6 rounded-full p-1 transition-all ${isLecturerRegister ? 'bg-[#800000]' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${isLecturerRegister ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Create Workspace/Lecturer Account</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#800000] transition-colors" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold"
                                            placeholder="you@genius.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Password</label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={() => setForgotMode('choose')}
                                                className="text-[10px] font-black text-slate-400 hover:text-[#800000] uppercase tracking-widest transition-colors"
                                            >
                                                Forgot?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#800000] transition-colors" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#800000] focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.01, boxShadow: '0 20px 25px -5px rgb(128 0 0 / 0.1)' }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#800000] text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-900/10 hover:bg-[#600000] transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-3 group uppercase tracking-widest text-xs"
                                >
                                    {loading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            <span>{isLogin ? 'Sign In' : 'Establish Account'}</span>
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        ) : (
                            /* ─── FORGOT PASSWORD FLOW REDESIGN ─── */
                            <div className="space-y-6">
                                <AnimatePresence mode="wait">
                                    {forgotMode === 'choose' && (
                                        <motion.div key="choose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                            <button onClick={exitForgotMode} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors text-[10px] uppercase font-black tracking-widest mb-6">
                                                <ArrowLeft size={12} /> Back to Login
                                            </button>
                                            <h4 className="text-xl font-black text-slate-900 mb-2">Recovery Method</h4>
                                            <div className="grid gap-3">
                                                <button onClick={() => setForgotMode('email')} className="flex items-center gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 hover:border-rose-100 rounded-2xl transition-all group text-left">
                                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#800000] group-hover:scale-110 transition-transform"><Mail size={22} /></div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-sm">Email OTPCode</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fast & Secure Recovery</p>
                                                    </div>
                                                </button>
                                                <button onClick={() => setForgotMode('admin')} className="flex items-center gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 hover:border-amber-100 rounded-2xl transition-all group text-left">
                                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform"><ShieldCheck size={22} /></div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-sm">Admin Intervention</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lost your email? We can help</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Additional forgotMode views (email, code, admin, success) would be similarly styled here */}
                                    {/* Mapping standard logic to the new card-based aesthetic */}
                                    {['email', 'code', 'admin', 'adminSent', 'success'].includes(forgotMode) && (
                                        <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] relative overflow-hidden">
                                             {/* Standard Logic Form Elements (Styled) */}
                                             {forgotMode === 'email' && (
                                                 <div className="space-y-6">
                                                     <div className="text-center mb-6">
                                                         <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#800000] mx-auto mb-4 shadow-sm"><Mail size={28} /></div>
                                                         <h4 className="text-2xl font-black text-slate-900">Email Recovery</h4>
                                                         <p className="text-sm text-slate-500 font-medium italic">We'll send a 6-digit code to your inbox</p>
                                                     </div>
                                                     <input 
                                                        type="email" 
                                                        value={resetEmail} 
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#800000] font-bold text-slate-900"
                                                        placeholder="Enter registered email"
                                                     />
                                                     <button onClick={handleRequestCode} disabled={resetLoading} className="w-full bg-[#800000] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
                                                         {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <span>Request Code</span>}
                                                     </button>
                                                     <button onClick={() => setForgotMode('choose')} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Change Method</button>
                                                 </div>
                                             )}

                                             {forgotMode === 'code' && (
                                                 <div className="space-y-6">
                                                     <div className="text-center mb-6">
                                                         <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-sm"><KeyRound size={28} /></div>
                                                         <h4 className="text-2xl font-black text-slate-900">Verify Identity</h4>
                                                         <p className="text-sm text-slate-500 font-medium italic">Check your email for the recovery code</p>
                                                     </div>
                                                     <input 
                                                        type="text" 
                                                        maxLength={6}
                                                        value={resetCode} 
                                                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#800000] font-mono text-center text-2xl tracking-[0.5em] font-black text-[#800000]"
                                                        placeholder="000000"
                                                     />
                                                     <input 
                                                        type="password" 
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#800000] font-bold"
                                                        placeholder="New Secure Password"
                                                     />
                                                     <button onClick={handleVerifyCode} disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 6} className="w-full bg-[#800000] text-white font-black py-4 rounded-2xl">
                                                         {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <span>Update Password</span>}
                                                     </button>
                                                 </div>
                                             )}

                                             {/* Simplified Admin/Success views would follow the same card styling pattern */}
                                             {(forgotMode === 'admin' || forgotMode === 'adminSent' || forgotMode === 'success') && (
                                                 <div className="text-center space-y-6">
                                                     <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm ${forgotMode === 'admin' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                         {forgotMode === 'admin' ? <MessageSquare size={28} /> : <CheckCircle size={28} />}
                                                     </div>
                                                     <h4 className="text-2xl font-black text-slate-900">
                                                         {forgotMode === 'admin' ? 'Contact Support' : (forgotMode === 'adminSent' ? 'Request Dispatched' : 'Process Complete')}
                                                     </h4>
                                                     <p className="text-sm text-slate-500 font-medium italic">
                                                        {forgotMode === 'admin' ? 'Describe your recovery issue' : resetMessage || 'You can now log in with your new credentials.'}
                                                     </p>
                                                     {forgotMode === 'admin' && (
                                                         <textarea 
                                                            value={contactMessage}
                                                            onChange={(e) => setContactMessage(e.target.value)}
                                                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm"
                                                            rows={3}
                                                            placeholder="State your student ID or details..."
                                                         />
                                                     )}
                                                     <button onClick={forgotMode === 'admin' ? handleContactAdmin : exitForgotMode} className={`w-full text-white font-black py-4 rounded-2xl ${forgotMode === 'admin' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                                                         {forgotMode === 'admin' ? (resetLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Contact Admin') : 'Back to Login'}
                                                     </button>
                                                 </div>
                                             )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center relative z-10">
                            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                                {isLogin 
                                    ? (role === 'lecturer' ? "Configure new workspace?" : "New research team?") 
                                    : "Already a member?"}
                                <button
                                    onClick={() => { setIsLogin(!isLogin); exitForgotMode(); }}
                                    className="text-[#ff4d4d] hover:text-[#800000] transition-colors ml-2 font-black underline underline-offset-4"
                                >
                                    {isLogin 
                                        ? (role === 'lecturer' ? 'Establish Space' : 'Join Team') 
                                        : 'Account Login'}
                                </button>
                            </p>
                            
                            <div className="mt-8 flex items-center justify-center gap-4">
                               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                                 {role === 'lecturer' ? 'Academic Workspace Management' : 'GMIJ Publication Portal'} &copy; 2026
                               </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
