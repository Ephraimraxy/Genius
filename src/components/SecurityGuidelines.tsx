import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Brain, Smartphone, Bluetooth, Clock, Lock, Eye, Volume2, AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';

interface SecurityGuidelinesProps {
    onNavigate: (tab: any) => void;
}

export default function SecurityGuidelines({ onNavigate }: SecurityGuidelinesProps) {
    const protocols = [
        {
            title: "Behavioral AI Monitoring",
            icon: Brain,
            description: "Our neural engine monitors gaze, head movement, and environmental anomalies. Suspicious patterns increase your Risk Score.",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            title: "Dynamic Questions",
            icon: Lock,
            description: "Questions use variable parameters. Every student receives a unique version, making answer-sharing and searching ineffective.",
            color: "text-emerald-600",
            bg: "bg-emerald-50"
        },
        {
            title: "Motion Detection",
            icon: Smartphone,
            description: "On mobile devices, gyroscopic sensors detect if the phone is being moved or tilted to take photos of the screen.",
            color: "text-rose-600",
            bg: "bg-rose-50"
        },
        {
            title: "Answer-Time Analytics",
            icon: Clock,
            description: "Sudden fast answers after long idle periods are flagged as potential external lookups using secondary devices.",
            color: "text-amber-600",
            bg: "bg-amber-50"
        },
        {
            title: "Environment Lockdown",
            icon: ShieldAlert,
            description: "Exiting full-screen mode, switching tabs, or attempting to use unauthorized shortcuts results in immediate failure.",
            color: "text-slate-900",
            bg: "bg-slate-100"
        },
        {
            title: "Signal Proximity",
            icon: Bluetooth,
            description: "The system scans for nearby Bluetooth and wireless frequencies to detect the presence of unauthorized secondary phones.",
            color: "text-blue-600",
            bg: "bg-blue-50"
        }
    ];

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <header className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-rose-600 text-white rounded-lg">
                        <ShieldAlert size={20} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Integrity & Security</span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Security Guidelines</h1>
                <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                    The Genius Portal uses advanced Behavioral Intelligence to ensure a fair and secure testing environment for everyone. Please review these protocols carefully.
                </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {protocols.map((protocol, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className={`w-12 h-12 ${protocol.bg} ${protocol.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <protocol.icon size={24} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 mb-2">{protocol.title}</h3>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">
                            {protocol.description}
                        </p>
                    </motion.div>
                ))}
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-black mb-6">Deep-AI Proctoring (DeepProct)</h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                                    <strong className="text-white">Real-time Gaze Tracking:</strong> Constantly monitoring if you are looking at the screen or externally.
                                </p>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                                    <strong className="text-white">Acoustic Analysis:</strong> Sophisticated audio detection flags speech, whispering, or external help.
                                </p>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle2 className="text-emerald-400 shrink-0 mt-1" size={18} />
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                                    <strong className="text-white">Keystroke Biometrics:</strong> Analysis of typing patterns to confirm identity and detect copy-pasting.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => onNavigate('dashboard')}
                            className="mt-10 px-8 py-4 bg-white text-slate-900 font-black rounded-2xl flex items-center gap-2 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                        >
                            Return to Dashboard <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="w-full md:w-1/3 aspect-square bg-white/5 rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                        <AlertCircle size={48} className="text-rose-500 mb-6" />
                        <h4 className="text-xl font-black mb-2 uppercase tracking-tight">Zero Tolerance</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                            Any attempt to circumvent the security system will lead to immediate portal suspension and academic disciplinary action.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
