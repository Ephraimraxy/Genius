import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Maximize, Eye, XCircle, AlertTriangle, PlayCircle, Brain, Clock } from 'lucide-react';

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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-3xl w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl border border-rose-500/20"
            >
                {/* Header */}
                <div className="bg-rose-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500 rounded-full blur-3xl opacity-50 -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-700 rounded-full blur-3xl opacity-50 -ml-20 -mb-20" />
                    <ShieldAlert size={48} className="text-white mx-auto mb-4 relative z-10 animate-pulse" />
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight relative z-10">Secure Exam Environment</h2>
                    <p className="text-rose-200 mt-2 font-medium text-sm max-w-md mx-auto relative z-10">{courseName}</p>
                </div>

                <div className="p-8 space-y-5">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Rules — read carefully before proceeding</p>

                    <div className="space-y-3">
                        {[
                            { icon: Maximize, color: 'text-indigo-600', bg: 'bg-indigo-50', title: 'Fullscreen Lock', desc: 'The exam runs in fullscreen. Exiting fullscreen at any point will immediately auto-submit your exam.' },
                            { icon: Eye, color: 'text-amber-600', bg: 'bg-amber-50', title: 'Tab Switching & Minimising', desc: 'Switching tabs, switching apps, or minimising the window triggers an immediate auto-submission.' },
                            { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', title: 'Right-Click & Inspect Disabled', desc: 'Right-clicking, F12, Ctrl+Shift+I and all DevTools shortcuts are fully blocked and trigger auto-submission.' },
                            { icon: Brain, color: 'text-violet-600', bg: 'bg-violet-50', title: 'Behaviour Integrity Scoring', desc: 'Unusual actions increase your risk score. At 25 points your exam auto-submits and the violation log is sent to your lecturer.' },
                            { icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50', title: 'Answer-Time Analytics', desc: 'Suspiciously fast answers after long idle periods are flagged as potential external lookup.' },
                            { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', title: 'No Copy / Paste', desc: 'Clipboard access, screenshot shortcuts, and text selection are all disabled for the duration of the exam.' },
                        ].map(({ icon: Icon, color, bg, title, desc }) => (
                            <div key={title} className={`flex items-start gap-4 p-4 ${bg} rounded-2xl`}>
                                <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm`}>
                                    <Icon size={18} className={color} />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">{title}</p>
                                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-amber-800 text-xs font-bold text-center leading-relaxed">
                            By proceeding, you confirm you are alone, your device is connected to the internet, and you are ready to complete this exam without interruption.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200"
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
                                <div className="flex items-center gap-2 text-slate-500 font-black text-xs uppercase tracking-widest">
                                    <Clock size={14} className="animate-pulse text-rose-500" />
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
            </motion.div>
        </div>
    );
}
