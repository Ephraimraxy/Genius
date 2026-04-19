import React, { useState, useEffect } from 'react';
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
    X
} from 'lucide-react';
import { motion } from 'motion/react';

export default function LecturerSettings() {
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
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/storage/info', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (d.quota_mb !== undefined) setStorageInfo(d); }).catch(() => {});
        fetch('/api/storage/plans', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setStoragePlans(d); }).catch(() => {});
    }, []);

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

    const handlePurchase = async (gateway: 'paystack' | 'kora') => {
        if (!selectedPlan) return;
        setPurchasing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/storage/purchase/initiate', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: selectedPlan, gateway })
            });
            const data = await res.json();
            if (data.checkout?.authorization_url) {
                window.location.href = data.checkout.authorization_url;
            } else if (data.checkout?.checkout_url) {
                window.location.href = data.checkout.checkout_url;
            }
        } catch (e) {}
        setPurchasing(false);
    };

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
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                                <Database size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Workspace Storage</h3>
                                <p className="text-xs text-slate-400 font-medium">{storageInfo.used_mb} MB used of {storageInfo.quota_mb} MB</p>
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
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        {(() => {
                            const pct = Math.min(100, Math.round((storageInfo.used_mb / storageInfo.quota_mb) * 100));
                            return (
                                <div className={`h-3 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-teal-500'}`}
                                    style={{ width: `${pct}%` }} />
                            );
                        })()}
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="text-[11px] text-slate-400 font-medium">{storageInfo.used_mb} MB used</span>
                        <span className="text-[11px] text-slate-400 font-medium">{(storageInfo.quota_mb - storageInfo.used_mb).toFixed(1)} MB free</span>
                    </div>
                    {storageInfo.used_mb / storageInfo.quota_mb >= 0.8 && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-medium text-amber-700">
                            Storage nearly full. Purchase additional storage to continue uploading files.
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
                        <button onClick={() => { setShowBuyModal(false); setSelectedPlan(null); setSelectedPlan(null); }}
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
                                            <button onClick={() => handlePurchase('paystack')} disabled={purchasing}
                                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
                                                {purchasing ? 'Redirecting...' : 'Pay with Paystack'}
                                            </button>
                                            <button onClick={() => handlePurchase('kora')} disabled={purchasing}
                                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors">
                                                {purchasing ? 'Redirecting...' : 'Pay with Kora'}
                                            </button>
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
