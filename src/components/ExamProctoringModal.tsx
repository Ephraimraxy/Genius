import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Maximize, Eye, XCircle, AlertTriangle, PlayCircle, Brain, Clock, ArrowLeft } from 'lucide-react';

interface ExamProctoringModalProps {
    courseName: string;
    startDate?: string | null;
    onStartExam: () => void;
    onCancel: () => void;
}

export default function ExamProctoringModal({ courseName, startDate, onStartExam, onCancel }: ExamProctoringModalProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const startMs = startDate ? new Date(startDate).getTime() : null;
    const msLeft = startMs !== null ? startMs - now : null;
    const secsLeft = msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 1000) : 0;
    const canStart = secsLeft === 0;

    const formatWait = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const rules = [
        { icon: Maximize,      color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', title: 'Fullscreen Lock',              desc: 'The exam runs in fullscreen. Exiting fullscreen at any point will immediately auto-submit your exam.' },
        { icon: Eye,           color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100',  title: 'Tab Switching & Minimising',    desc: 'Switching tabs, switching apps, or minimising the window triggers an immediate auto-submission.' },
        { icon: XCircle,       color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100',   title: 'Right-Click & Inspect Disabled', desc: 'Right-clicking, F12, Ctrl+Shift+I and all DevTools shortcuts are fully blocked and trigger auto-submission.' },
        { icon: Brain,         color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', title: 'Behaviour Integrity Scoring',    desc: 'Unusual actions increase your risk score. At 25 points your exam auto-submits and the violation log is sent to your lecturer.' },
        { icon: Clock,         color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  title: 'Answer-Time Analytics',          desc: 'Suspiciously fast answers after long idle periods are flagged as potential external lookup.' },
        { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', title: 'No Copy / Paste',                desc: 'Clipboard access, screenshot shortcuts, and text selection are all disabled for the duration of the exam.' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="min-h-screen bg-slate-50 flex flex-col"
        >
            {/* Sticky top bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors"
                >
                    <ArrowLeft size={18} /> Back
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest truncate">Exam Rules</p>
                    <p className="text-sm font-black text-slate-900 truncate">{courseName}</p>
                </div>
                <ShieldAlert size={22} className="text-rose-500 shrink-0 animate-pulse" />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
                {/* Header banner */}
                <div className="bg-rose-600 px-6 py-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500 rounded-full blur-3xl opacity-40 -mr-24 -mt-24" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-700 rounded-full blur-3xl opacity-40 -ml-24 -mb-24" />
                    <ShieldAlert size={52} className="text-white mx-auto mb-3 relative z-10 animate-pulse" />
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight relative z-10">Secure Exam Environment</h2>
                    <p className="text-rose-200 mt-1 font-medium text-sm relative z-10">{courseName}</p>
                </div>

                <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rules — read carefully before proceeding</p>

                    {/* Rule cards */}
                    <div className="space-y-3">
                        {rules.map(({ icon: Icon, color, bg, border, title, desc }) => (
                            <div key={title} className={`flex items-start gap-4 p-4 ${bg} border ${border} rounded-2xl`}>
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Icon size={19} className={color} />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">{title}</p>
                                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Consent notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-amber-800 text-xs font-bold text-center leading-relaxed">
                            By proceeding, you confirm you are alone, your device is connected to the internet, and you are ready to complete this exam without interruption.
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1 pb-8">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-2xl transition-colors border border-slate-200 text-sm"
                        >
                            Cancel
                        </button>

                        {canStart ? (
                            <button
                                onClick={onStartExam}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-lg shadow-rose-600/30 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                            >
                                <PlayCircle size={18} /> I Understand — Start Exam
                            </button>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-1 py-3 bg-slate-100 rounded-2xl border border-slate-200 select-none">
                                <div className="flex items-center gap-1.5 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                    <Clock size={13} className="animate-pulse text-rose-500" />
                                    Exam starts in
                                </div>
                                <span className="font-mono text-2xl font-black text-rose-600 tabular-nums leading-none">
                                    {formatWait(secsLeft)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                    Button activates automatically
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
