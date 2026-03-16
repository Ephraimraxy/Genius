import React, { useState } from 'react';
import { 
    Settings, 
    Bell, 
    Shield, 
    User, 
    Smartphone, 
    Globe, 
    CheckCircle, 
    Lock,
    Eye,
    EyeOff
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
