import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Building, ArrowRight, Loader2, ShieldCheck, ArrowLeft, KeyRound, CheckCircle, MessageSquare, Send, Phone } from 'lucide-react';

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
    const [tenantName, setTenantName] = useState('');
    const [phone, setPhone] = useState('');

    const isLecturer = role === 'lecturer';
    const themeColor = isLecturer ? '#1a237e' : '#800000';
    const accentColor = isLecturer ? '#3f51b5' : '#ff4d4d';
    const focusRing = isLecturer ? 'focus:ring-indigo-600' : 'focus:ring-[#800000]';
    const labelColor = isLecturer ? 'text-indigo-700' : 'text-rose-800';
    const lightBg = isLecturer ? 'bg-indigo-50' : 'bg-rose-50';
    const borderAccent = isLecturer ? 'border-indigo-100/50' : 'border-rose-100/50';

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
            : (isLecturer ? '/api/auth/lecturer/register' : '/api/auth/register');
        
        if (!isLogin && isLecturer && phone.length !== 11) {
            setError('Phone number must be exactly 11 digits');
            setLoading(false);
            return;
        }

        const body = isLogin
            ? { email, password, role }
            : (isLecturer 
                ? { email, password, name, tenantName, phone, role: 'tenant_admin' }
                : { email, password, name, affiliation, role: 'user' });

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
                <div 
                    className="hidden md:flex md:w-[40%] relative overflow-hidden flex-col p-8 text-white shadow-2xl z-20"
                    style={{ backgroundColor: themeColor }}
                >
                   <div className="absolute inset-0 bg-slate-900/40" />
                   <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] -mr-48 -mt-48 opacity-20" style={{ backgroundColor: accentColor }} />
                   <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-900/40 rounded-full blur-[120px] -ml-40 -mb-40" />
                   
                   <div className="relative z-10 flex flex-col h-full text-center">
                      <div className="flex-1 flex flex-col items-center justify-center">
                         <motion.div
                           initial={{ scale: 0.9, opacity: 0 }}
                           animate={{ scale: 1, opacity: 1 }}
                           className="mb-8"
                         >
                            <img src="/gmijp-logo.png" alt="Genius" className="w-24 h-24 object-contain shadow-2xl rounded-full bg-white p-4" />
                         </motion.div>

                         <div className="mb-8">
                            <h1 className="font-black tracking-[0.2em] text-xs uppercase mb-2 opacity-50">Genius Mindspark</h1>
                            <div className="h-0.5 w-12 mx-auto" style={{ backgroundColor: accentColor }} />
                         </div>
                         
                         <h2 className="text-4xl font-black mb-6 tracking-tight leading-[1.1]">
                             {isLecturer ? 'Academic' : 'Neural'} <br/>
                             <span className="text-white/40">{isLecturer ? 'Workspace' : 'Research'}</span>
                         </h2>
                         
                         <p className="text-white/60 font-medium leading-relaxed max-w-sm text-base mx-auto">
                           {isLecturer 
                             ? 'Establish your school hub, manage student enrollments, and coordinate secure exam sessions across your department.' 
                             : 'Global benchmark for multidisciplinary research. Transform your ideas with neural-assisted validation and peer review.'}
                         </p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-white/10">
                         <div className="flex items-center justify-center gap-3">
                            <ShieldCheck size={14} className="opacity-50" />
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-tight text-left">
                               Secured by GMIJ <br/> Neural Encryption
                            </p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Side: Action Area */}
                <div className={`w-full md:w-[60%] p-4 md:p-6 lg:p-10 flex flex-col justify-center bg-white relative z-10 overflow-y-auto ${!isLecturer ? 'md:bg-white bg-slate-50' : 'md:bg-white bg-blue-50/50'}`}>
                    <div className={`max-w-md w-full mx-auto relative px-6 py-10 md:p-0 transition-all ${
                        !isLecturer 
                        ? 'bg-white rounded-[4rem] border-[10px] border-[#800000] shadow-[0_40px_100px_-20px_rgba(128,0,0,0.15)] md:bg-transparent md:border-0 md:shadow-none' 
                        : 'bg-white rounded-[4rem] border-[10px] border-[#1a237e] shadow-[0_40px_100px_-20px_rgba(26,35,126,0.15)] md:bg-transparent md:border-0 md:shadow-none'
                    }`}>
                        {/* Static Background Pattern */}
                        <div className="absolute -top-32 -right-32 text-slate-50 text-8xl font-black select-none pointer-events-none rotate-6 opacity-20">
                            GENIUS
                        </div>

                        <div className="mb-6 relative text-center md:text-left">
                             {onBackToLanding && (
                                <button 
                                    onClick={onBackToLanding}
                                    className="mb-6 flex items-center justify-center md:justify-start gap-2 text-slate-400 transition-all text-xs font-black uppercase tracking-widest group border-b border-transparent pb-1 mx-auto md:mx-0"
                                    style={{ '--hover-color': themeColor } as any}
                                >
                                    <div className="flex items-center gap-2 group-hover:text-[var(--hover-color)]">
                                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                        BACK TO MAIN PORTAL
                                    </div>
                                </button>
                             )}

                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                {isLogin 
                                    ? (isLecturer ? 'Lecturer Login' : 'Welcome back') 
                                    : (isLecturer ? 'Lecturer Signup' : 'Create Account')}
                            </h3>
                            <p className="text-slate-500 font-medium text-xs italic">
                                {isLogin
                                    ? (isLecturer ? 'Access your academic workspace' : 'Authorize to access your publication portal')
                                    : (isLecturer ? 'Create your workspace and manage exams' : 'Scale your research with neural intelligence')}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`mb-6 p-4 border rounded-2xl text-xs font-black flex items-center gap-3 shadow-sm ${isLecturer ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-rose-50 border-rose-100 text-rose-600'}`}
                                >
                                    <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: themeColor }}><ShieldCheck size={14} /></div>
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
                                                <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${labelColor}`}>FULL NAME</label>
                                                <div className="relative group">
                                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" size={20} />
                                                    <input
                                                        type="text"
                                                        required
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        className={`w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold ${focusRing}`}
                                                        placeholder="John Doe"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1">
                                                <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${labelColor}`}>
                                                    {isLecturer ? "WORKSPACE/ORGANIZATION" : "AFFILIATION"}
                                                </label>
                                                <div className="relative group">
                                                    <Building className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" size={20} />
                                                    <input
                                                        type="text"
                                                        value={isLecturer ? tenantName : affiliation}
                                                        onChange={(e) => isLecturer ? setTenantName(e.target.value) : setAffiliation(e.target.value)}
                                                        className={`w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold ${focusRing}`}
                                                        placeholder={isLecturer ? "e.g. Science Faculty" : "e.g. NSUK Research Unit"}
                                                        required={!isLogin}
                                                    />
                                                </div>
                                            </div>

                                            {isLecturer && (
                                                <div className="space-y-1">
                                                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${labelColor}`}>PHONE NUMBER (11 DIGITS)</label>
                                                    <div className="relative group">
                                                        <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" size={20} />
                                                        <input
                                                            type="tel"
                                                            required
                                                            pattern="[0-9]{11}"
                                                            maxLength={11}
                                                            value={phone}
                                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                                            className={`w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold ${focusRing}`}
                                                            placeholder="08012345678"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-1">
                                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 ${labelColor}`}>EMAIL ADDRESS</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" size={20} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={`w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold ${focusRing}`}
                                            placeholder="you@genius.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-2">
                                        <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${labelColor}`}>PASSWORD</label>
                                        {isLogin && (
                                            <button
                                                type="button"
                                                onClick={() => setForgotMode('choose')}
                                                className={`text-[10px] font-black text-slate-400 hover:text-[${themeColor}] uppercase tracking-widest transition-colors`}
                                            >
                                                FORGOT?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" size={20} />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-300 font-bold ${focusRing}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.01, boxShadow: `0 20px 25px -5px ${themeColor}1a` }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    disabled={loading}
                                    className="w-full text-white font-black py-5 rounded-2xl shadow-xl transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-3 group uppercase tracking-widest text-xs"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    {loading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            <span>{isLogin ? 'SIGN IN' : (isLecturer ? 'SECURE SPACE' : 'ESTABLISH ACCOUNT')}</span>
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
                                                <ArrowLeft size={12} /> BACK TO LOGIN
                                            </button>
                                            <h4 className="text-xl font-black text-slate-900 mb-2">Recovery Method</h4>
                                            <div className="grid gap-3">
                                                <button onClick={() => setForgotMode('email')} className={`flex items-center gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 rounded-2xl transition-all group text-left ${isLecturer ? 'hover:border-indigo-100' : 'hover:border-rose-100'}`}>
                                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform" style={{ color: themeColor }}><Mail size={22} /></div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-sm">Email OTPCode</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fast & Secure Recovery</p>
                                                    </div>
                                                </button>
                                                <button onClick={() => setForgotMode('admin')} className={`flex items-center gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 rounded-2xl transition-all group text-left ${isLecturer ? 'hover:border-indigo-100' : 'hover:border-amber-100'}`}>
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
                                                         <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm" style={{ color: themeColor }}><Mail size={28} /></div>
                                                         <h4 className="text-2xl font-black text-slate-900">Email Recovery</h4>
                                                         <p className="text-sm text-slate-500 font-medium italic">We'll send a 6-digit code to your inbox</p>
                                                     </div>
                                                     <input 
                                                        type="email" 
                                                        value={resetEmail} 
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                        className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 ${focusRing}`}
                                                        placeholder="Enter registered email"
                                                     />
                                                     <button onClick={handleRequestCode} disabled={resetLoading} className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2" style={{ backgroundColor: themeColor }}>
                                                         {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <span>REQUEST CODE</span>}
                                                     </button>
                                                     <button onClick={() => setForgotMode('choose')} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">CHANGE METHOD</button>
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
                                                        className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-mono text-center text-2xl tracking-[0.5em] font-black ${focusRing}`}
                                                        style={{ color: themeColor }}
                                                        placeholder="000000"
                                                     />
                                                     <input 
                                                        type="password" 
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold ${focusRing}`}
                                                        placeholder="New Secure Password"
                                                     />
                                                     <button onClick={handleVerifyCode} disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 6} className="w-full text-white font-black py-4 rounded-2xl" style={{ backgroundColor: themeColor }}>
                                                         {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <span>UPDATE PASSWORD</span>}
                                                     </button>
                                                 </div>
                                             )}

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
                                                            placeholder="State your contact ID or details..."
                                                         />
                                                     )}
                                                     <button onClick={forgotMode === 'admin' ? handleContactAdmin : exitForgotMode} className={`w-full text-white font-black py-4 rounded-2xl ${forgotMode === 'admin' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                                                         {forgotMode === 'admin' ? (resetLoading ? <Loader2 className="animate-spin mx-auto" /> : 'CONTACT ADMIN') : 'BACK TO LOGIN'}
                                                     </button>
                                                 </div>
                                             )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center relative z-10">
                            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] flex flex-col sm:flex-row items-center justify-center gap-1">
                                <span>{isLogin 
                                    ? (isLecturer ? "Configure new workspace?" : "ALREADY A MEMBER?") 
                                    : "ALREADY A MEMBER?"}</span>
                                <button
                                    onClick={() => { setIsLogin(!isLogin); exitForgotMode(); }}
                                    className="transition-colors font-black underline underline-offset-4"
                                    style={{ color: themeColor }}
                                >
                                    {isLogin 
                                        ? (isLecturer ? 'Establish Space' : 'Account Login') 
                                        : 'Account Login'}
                                </button>
                            </p>
                            
                            <div className="mt-8 flex flex-col items-center justify-center gap-2">
                               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
                                 {isLecturer ? 'Institutional Academic Gateway' : 'GMIJ NEURAL PUBLICATION NETWORK'}
                               </p>
                               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                                 &copy; 2026 GENIUS MINDSPARK
                               </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
