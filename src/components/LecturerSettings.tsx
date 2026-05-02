import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Bell,
    Shield,
    Smartphone,
    Globe,
    CheckCircle,
    Lock,
    Eye,
    EyeOff,
    Database,
    ShoppingCart,
    X,
    ChevronDown,
    ChevronUp,
    FileText,
    Video,
    Music,
    File,
    ClipboardList
} from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { friendlyError } from '../utils/friendlyError';
import { subscribePaymentReturn } from './paymentChannel';
import { openPaymentPopup } from './paymentPopup';
import { openPaystackInline } from './paystackInline';

declare global {
    interface Window {
        PaystackPop: any;
        Korapay: any;
    }
}

type Gateway = 'paystack' | 'kora';

interface LecturerSettingsProps {
    addToast?: (msg: string, type: any) => void;
}

export default function LecturerSettings({ addToast }: LecturerSettingsProps = {}) {
    const { gateways } = useSettings();
    const [notifications, setNotifications] = useState({
        email: true,
        sms: false,
        browser: true,
        submissions: true
    });
    const [isPublic, setIsPublic] = useState(true);

    // Storage state
    const [storageInfo, setStorageInfo] = useState<{ quota_mb: number; used_bytes: number; used_mb: number } | null>(null);
    const [storagePlans, setStoragePlans] = useState<Array<{ id: number; name: string; storage_mb: number; price_kobo: number; duration_days: number }>>([]);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
    const [purchasingGateway, setPurchasingGateway] = useState<Gateway | null>(null);
    const [paymentRef, setPaymentRef] = useState<string | null>(null);
    const [paymentGateway, setPaymentGateway] = useState<Gateway | null>(null);
    const [gatewaysStatus, setGatewaysStatus] = useState<{ paystack: boolean; kora: boolean } | null>(null);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [breakdown, setBreakdown] = useState<Array<{ id: number; name: string; type: string; mime_type: string; size_bytes: number; size_mb: number; uploaded_at: string }>>([]);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);
    const activeGateways = gatewaysStatus || gateways;

    const notify = useCallback((msg: string, type: any = 'info') => {
        addToast?.(msg, type);
    }, [addToast]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/storage/info', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (d.quota_mb !== undefined) setStorageInfo(d); }).catch(() => {});
        fetch('/api/storage/plans', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setStoragePlans(d); }).catch(() => {});
        fetch('/api/payment/gateways')
            .then(r => r.json())
            .then(d => setGatewaysStatus({ paystack: d?.paystack !== false, kora: d?.kora !== false }))
            .catch(() => setGatewaysStatus(gateways));
    }, []);

    useEffect(() => {
        setGatewaysStatus(gateways);
    }, [gateways.paystack, gateways.kora]);

    const refreshStorageInfo = useCallback(async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/storage/info', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.quota_mb !== undefined) setStorageInfo(data);
    }, []);

    const fetchBreakdown = async () => {
        if (breakdown.length > 0) { setShowBreakdown(s => !s); return; }
        setLoadingBreakdown(true);
        setShowBreakdown(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/storage/breakdown', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (Array.isArray(data)) setBreakdown(data);
        } catch (e) {}
        setLoadingBreakdown(false);
    };

    const fileIcon = (mime: string, type: string) => {
        if (type === 'video' || mime?.startsWith('video/')) return <Video size={14} className="text-blue-500" />;
        if (type === 'audio' || mime?.startsWith('audio/')) return <Music size={14} className="text-purple-500" />;
        if (mime === 'application/pdf' || mime?.includes('pdf')) return <FileText size={14} className="text-red-500" />;
        if (type === 'submission') return <ClipboardList size={14} className="text-amber-500" />;
        return <File size={14} className="text-slate-400" />;
    };

    const handleRecalculate = async () => {
        setRecalculating(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/storage/recalculate', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.quota_mb !== undefined) setStorageInfo(data);
        } catch (e) {}
        setRecalculating(false);
    };

    const checkStoragePaymentStatus = useCallback(async (refOverride?: string | null, silent = false) => {
        const ref = refOverride || paymentRef;
        if (!ref) return;
        try {
            const res = await fetch(`/api/payment/verify/${ref}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === 'success') {
                await refreshStorageInfo();
                setPurchaseSuccess(true);
                setPaymentRef(null);
                setPaymentGateway(null);
                notify('Storage payment confirmed. Workspace quota updated.', 'success');
            } else if (!silent) {
                notify('Payment is not confirmed yet. Please complete checkout first.', 'info');
            }
        } catch (err: any) {
            if (!silent) notify(friendlyError(err, 'payment'), 'error');
        }
    }, [notify, paymentRef, refreshStorageInfo]);

    const openStorageCheckout = (gateway: Gateway, checkout: any, reference: string) => {
        if (!checkout) {
            notify('Payment gateway did not return checkout details. Please try again.', 'error');
            return;
        }

        if (gateway === 'paystack' && checkout.publicKey) {
            const opened = openPaystackInline({
                key: checkout.publicKey,
                email: checkout.email || checkout.customer?.email || '',
                amount: Number(checkout.amount_kobo || checkout.amount || 0),
                currency: checkout.currency || 'NGN',
                ref: reference,
                onClose: () => notify('Payment window closed. Complete payment to add storage.', 'info'),
                onSuccess: () => void checkStoragePaymentStatus(reference, false)
            });
            if (!opened) notify('Unable to open Paystack checkout. Please retry.', 'error');
            return;
        }

        if (gateway === 'kora' && window.Korapay && checkout.publicKey) {
            window.Korapay.initialize({
                key: checkout.publicKey,
                reference,
                amount: Number(checkout.amount_naira || checkout.amount || 0),
                currency: checkout.currency || 'NGN',
                customer: {
                    email: checkout.email || checkout.customer?.email || '',
                    name: checkout.name || checkout.customer?.name || ''
                },
                onClose: () => notify('Payment window closed. Complete payment to add storage.', 'info'),
                onSuccess: () => void checkStoragePaymentStatus(reference, false)
            });
            return;
        }

        const checkoutUrl = checkout.checkout_url || checkout.checkoutUrl || checkout.authorization_url;
        if (checkoutUrl) {
            const popup = openPaymentPopup(checkoutUrl, {
                onBlocked: () => {
                    notify('Popup blocked. Redirecting to checkout instead.', 'info');
                    window.location.href = checkoutUrl;
                }
            });
            if (popup) notify('Secure checkout opened. Complete payment to add storage.', 'info');
            return;
        }

        notify('Unable to open checkout. Please retry.', 'error');
    };

    const handlePurchase = async (gateway: Gateway) => {
        if (!selectedPlan) return;
        if (activeGateways[gateway] === false) {
            notify(`${gateway === 'paystack' ? 'Paystack' : 'Kora'} is currently disabled by the administrator.`, 'error');
            return;
        }
        setPurchasingGateway(gateway);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/storage/purchase/initiate', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: selectedPlan, gateway, mode: 'inline' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Payment could not be initialized.');
            const reference = data.reference;
            const checkout = data.checkout || data;
            setPaymentRef(reference);
            setPaymentGateway(gateway);
            openStorageCheckout(gateway, checkout, reference);
        } catch (err: any) {
            notify(friendlyError(err, 'payment'), 'error');
        } finally {
            setPurchasingGateway(null);
        }
    };

    useEffect(() => {
        if (!paymentRef) return;
        const interval = setInterval(() => void checkStoragePaymentStatus(paymentRef, true), 10000);
        return () => clearInterval(interval);
    }, [checkStoragePaymentStatus, paymentRef]);

    useEffect(() => {
        if (!paymentRef) return;
        const unsubscribe = subscribePaymentReturn((message) => {
            if (message.reference && message.reference !== paymentRef) return;
            void checkStoragePaymentStatus(paymentRef, false);
        });
        return unsubscribe;
    }, [checkStoragePaymentStatus, paymentRef]);

    const toggleNotif = (key: keyof typeof notifications) => {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12 overflow-hidden"
        >
            {/* Header */}
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Preferences & Workspace Settings</h2>
                        <p className="text-slate-500 font-medium">Customize your academic environment and security protocols.</p>
                    </div>
                </div>
            </div>

            {/* Storage Usage Card */}
            {storageInfo && (
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    {/* Top row */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                                <Database size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Workspace Storage</h3>
                                <p className="text-xs text-slate-400 font-medium">{storageInfo.used_mb} MB used of {storageInfo.quota_mb} MB quota</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleRecalculate} disabled={recalculating}
                                title="Recalculate storage from uploaded files"
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold rounded-xl transition-colors">
                                <svg className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {recalculating ? 'Syncing...' : 'Sync'}
                            </button>
                            <button onClick={() => setShowBuyModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors">
                                <ShoppingCart size={14} /> Get More
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {(() => {
                        const pct = Math.min(100, Math.round((storageInfo.used_mb / storageInfo.quota_mb) * 100));
                        return (
                            <>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-3 rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-teal-500'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex justify-between mt-2 mb-1">
                                    <span className="text-[11px] text-slate-500 font-semibold">{storageInfo.used_mb} MB used</span>
                                    <span className="text-[11px] text-slate-400 font-medium">{Math.max(0, storageInfo.quota_mb - storageInfo.used_mb).toFixed(2)} MB free · {pct}%</span>
                                </div>
                            </>
                        );
                    })()}

                    {storageInfo.used_mb / storageInfo.quota_mb >= 0.8 && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-medium text-amber-700">
                            Storage nearly full. Purchase additional storage to continue uploading files.
                        </div>
                    )}

                    {/* File breakdown toggle */}
                    <button onClick={fetchBreakdown}
                        className="mt-4 w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 transition-colors">
                        <span>View storage breakdown by file</span>
                        {showBreakdown ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {/* Breakdown list */}
                    {showBreakdown && (
                        <div className="mt-3 border border-slate-100 rounded-2xl overflow-hidden">
                            {loadingBreakdown ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-medium">Loading files...</div>
                            ) : breakdown.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-medium">No tracked files found. Click Sync to recalculate.</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {breakdown.map((f, i) => (
                                        <div key={f.id} className={`flex items-center gap-3 px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                            <div className="w-7 h-7 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center">
                                                {fileIcon(f.mime_type, f.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 truncate">{f.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                                    {f.type} · {new Date(f.uploaded_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-xs font-black text-slate-700">{f.size_mb > 0 ? `${f.size_mb} MB` : `${f.size_bytes} B`}</p>
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                                    <div className="h-1.5 bg-teal-400 rounded-full"
                                                        style={{ width: `${Math.min(100, (f.size_mb / storageInfo.used_mb) * 100)}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="px-4 py-3 bg-teal-50 flex items-center justify-between">
                                        <span className="text-[11px] font-black text-teal-700 uppercase tracking-widest">{breakdown.length} file{breakdown.length !== 1 ? 's' : ''}</span>
                                        <span className="text-[11px] font-black text-teal-700">{storageInfo.used_mb} MB total</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Notification Settings */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Bell size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Notification Channels</h3>
                    </div>

                    <div className="space-y-4">
                        {[
                            { id: 'email', label: 'Email Notifications', desc: 'Summary of portal activity', icon: Globe },
                            { id: 'browser', label: 'Push Notifications', desc: 'Real-time student alerts', icon: Smartphone },
                            { id: 'submissions', label: 'Task Submissions', desc: 'Alert when a student submits work', icon: CheckCircle }
                        ].map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:border-blue-100 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                        <item.icon size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{item.desc}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => toggleNotif(item.id as keyof typeof notifications)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${notifications[item.id as keyof typeof notifications] ? 'bg-blue-600' : 'bg-slate-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications[item.id as keyof typeof notifications] ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Security & Access */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                            <Shield size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Security & Privacy</h3>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden group cursor-pointer">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl transition-all group-hover:scale-150"></div>
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Lock className="text-blue-400" size={24} />
                                    <div>
                                        <p className="font-bold">Credential Manager</p>
                                        <p className="text-[10px] text-white/50 uppercase font-black tracking-widest">Rotate security PIN & Password</p>
                                    </div>
                                </div>
                                <button className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-all">
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400">
                                   {isPublic ? <Eye size={20} /> : <EyeOff size={20} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Public Profile Visibility</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Allow students to see your bio</p>
                                </div>
                             </div>
                             <button 
                                onClick={() => setIsPublic(!isPublic)}
                                className={`w-12 h-6 rounded-full transition-all relative ${isPublic ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPublic ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <button className="w-full py-4 text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-2xl transition-all">
                             Deactivate Workspace
                        </button>
                    </div>
                </div>
            </div>
        {/* Buy Storage Modal */}
        {showBuyModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-slate-800">Buy Storage</h3>
                        <button onClick={() => { setShowBuyModal(false); setSelectedPlan(null); setPaymentRef(null); setPaymentGateway(null); setPurchaseSuccess(false); }}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={18} /></button>
                    </div>
                    {purchaseSuccess ? (
                        <div className="text-center py-8">
                            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                            <p className="font-bold text-slate-800">Storage Added!</p>
                            <p className="text-sm text-slate-500 mt-1">Your workspace quota has been updated.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">Select a plan to add extra storage to your workspace.</p>
                            {storagePlans.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">No storage plans available. Contact support.</p>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {storagePlans.map(plan => (
                                            <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                                                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${selectedPlan === plan.id ? 'border-teal-500 bg-teal-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">{plan.name}</p>
                                                        <p className="text-xs text-slate-500">+{plan.storage_mb} MB · {plan.duration_days} days</p>
                                                    </div>
                                                    <p className="font-black text-teal-700 text-sm">₦{(plan.price_kobo / 100).toLocaleString()}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedPlan && (
                                        <div className="space-y-2 pt-2">
                                            {!activeGateways.paystack && !activeGateways.kora ? (
                                                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-xs font-bold text-amber-700">
                                                    Payment gateways are currently disabled. Please contact support.
                                                </div>
                                            ) : (
                                                <>
                                                    {activeGateways.paystack && (
                                                        <button onClick={() => handlePurchase('paystack')} disabled={!!purchasingGateway || !!paymentRef}
                                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
                                                            {purchasingGateway === 'paystack' ? 'Redirecting...' : 'Pay with Paystack'}
                                                        </button>
                                                    )}
                                                    {activeGateways.kora && (
                                                        <button onClick={() => handlePurchase('kora')} disabled={!!purchasingGateway || !!paymentRef}
                                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
                                                            {purchasingGateway === 'kora' ? 'Redirecting...' : 'Pay with Kora'}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {paymentRef && (
                                                <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-[11px] font-bold text-slate-500">
                                                    Listening for {paymentGateway === 'kora' ? 'Kora' : 'Paystack'} confirmation...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
        </motion.div>
    );
}

function ArrowRight({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}
