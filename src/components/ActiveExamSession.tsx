import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Save, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Maximize2, AlertTriangle, Eye, EyeOff, XCircle } from 'lucide-react';
import { ToastType } from './ToastSystem';
import { friendlyError } from '../utils/friendlyError';

interface ActiveExamSessionProps {
    examId: number;
    courseName: string;
    matricNumber: string;
    addToast: (msg: string, type: ToastType) => void;
    onExamSubmit: (score: string, reason?: string) => void;
    token: string | null;
    confirm?: (config: any) => Promise<boolean>;
}

type ExamPhase = 'loading' | 'active';

export default function ActiveExamSession({ examId, courseName, matricNumber, addToast, onExamSubmit, token, confirm }: ActiveExamSessionProps) {
    const [examPhase, setExamPhase] = useState<ExamPhase>('loading');


    const [timeLeft, setTimeLeft] = useState(3600);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [warningCount, setWarningCount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
    const [timerMode, setTimerMode] = useState<'whole' | 'per_question'>('whole');
    const [perQuestionTime, setPerQuestionTime] = useState(60);
    const [questionTimeLeft, setQuestionTimeLeft] = useState(60);
    const perQuestionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [riskScore, setRiskScore] = useState(0);
    const [suspiciousFlags, setSuspiciousFlags] = useState<string[]>([]);
    const questionStartTime = useRef<number>(Date.now());
    const lastActivityTime = useRef<number>(Date.now());
    const devToolsCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const examContainerRef = useRef<HTMLDivElement>(null);

    // ─── Fetch exam data and auto-start immediately (no briefing screen) ──
    useEffect(() => {
        const initializeExam = async () => {
            if (!token) return;
            try {
                const res = await fetch(`/api/exams/${examId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to load exam.');

                const exam = data.exam || {};
                const questions = data.questions || exam.questions || [];

                if (questions.length > 0) {
                    const processed = questions.map((q: any) => {
                        const rawOptions = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
                        return { id: q.id, text: q.question_text || q.text, options: rawOptions, correct: q.correct_answer, points: q.points || 10 };
                    });
                    setShuffledQuestions(processed);
                    const mode = exam.timer_mode || 'whole';
                    setTimerMode(mode as 'whole' | 'per_question');
                    if (mode === 'per_question') {
                        const pqt = parseInt(exam.duration) || 60;
                        setPerQuestionTime(pqt);
                        setQuestionTimeLeft(pqt);
                        setTimeLeft(pqt * processed.length);
                    } else {
                        if (exam.duration) setTimeLeft(exam.duration * 60);
                    }
                    // Auto-start: enter fullscreen and go active immediately
                    try { await document.documentElement.requestFullscreen(); } catch (e) {}
                    setExamPhase('active');
                } else {
                    addToast('Exam has no questions. Contact your lecturer.', 'error');
                }
            } catch (err: any) {
                addToast(friendlyError(err, 'load'), 'error');
            }
            questionStartTime.current = Date.now();
        };
        initializeExam();
    }, [examId, token]);

    // ─── Auto Submit ─────────────────────────────────────────────────
    const triggerAutoSubmit = useCallback((reason: string) => {
        if (submitting) return;
        setSubmitting(true);
        addToast(`🚨 AUTO-SUBMIT: ${reason}`, 'error');
        stopAVMonitoring();
        if (devToolsCheckRef.current) clearInterval(devToolsCheckRef.current);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

        const submissionPayload: any[] = [];
        setShuffledQuestions(qs => {
            qs.forEach((q, index) => {
                submissionPayload.push({ questionId: q.id, answer: '' });
            });
            return qs;
        });

        const submitToApi = async () => {
            if (!token) return;
            // Use a snapshot — we can't read state here reliably, so just submit what's stored
            const storedAnswers = JSON.parse(sessionStorage.getItem(`exam_answers_${examId}`) || '{}');
            setShuffledQuestions(qs => {
                const payload = qs.map((q, idx) => ({ questionId: q.id, answer: storedAnswers[idx] || '' }));
                fetch(`/api/exams/${examId}/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ answers: payload, riskScore, violations: suspiciousFlags })
                }).catch(err => console.error('Auto-submit failed:', err));
                return qs;
            });
        };
        submitToApi();
        setTimeout(() => { onExamSubmit('submitted', reason); }, 3000);
    }, [submitting, addToast, onExamSubmit, examId, token, riskScore, suspiciousFlags]);

    // ─── Risk Engine ─────────────────────────────────────────────────
    const incrementRisk = useCallback((points: number, reason: string) => {
        setRiskScore(prev => {
            const next = prev + points;
            setSuspiciousFlags(curr => [...new Set([...curr, reason])]);
            if (next >= 25) {
                triggerAutoSubmit(`High risk detected: ${reason}`);
            } else if (points >= 5) {
                addToast(`⚠️ PROCTORING WARNING: ${reason}`, 'error');
            }
            return next;
        });
    }, [triggerAutoSubmit, addToast]);

    const stopAVMonitoring = () => { /* AV monitoring removed */ };

    // ─── Start exam (no AV required) ────────────────────────────────
    // ─── Security event listeners (active phase only) ─────────────────
    useEffect(() => {
        if (examPhase !== 'active') return;

        // ── DevTools size-based detection ──
        const checkDevTools = () => {
            const threshold = 160;
            if (
                (window.outerWidth - window.innerWidth > threshold) ||
                (window.outerHeight - window.innerHeight > threshold)
            ) {
                triggerAutoSubmit('Developer tools opened');
            }
        };
        devToolsCheckRef.current = setInterval(checkDevTools, 1000);

        // ── Window blur (tab switch, minimize, alt-tab) ──
        const handleWindowBlur = () => {
            if (examPhase === 'active') triggerAutoSubmit('Window lost focus — tab switched or minimized');
        };

        // ── Visibility change ──
        const handleVisibilityChange = () => {
            if (document.hidden) triggerAutoSubmit('Page hidden — tab switched or minimized');
        };

        // ── Fullscreen exit ──
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && examPhase === 'active') {
                triggerAutoSubmit('Exited fullscreen mode');
            }
        };

        // ── Block all context menu (right-click) ──
        const blockEvent = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        // ── Keyboard: DevTools shortcuts + screengrab + copy ──
        const handleKeyDown = (e: KeyboardEvent) => {
            // DevTools shortcuts → auto-submit immediately
            const devToolsKeys = [
                e.key === 'F12',
                e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(e.key.toLowerCase()),
                e.metaKey && e.altKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()),
                e.ctrlKey && e.key.toLowerCase() === 'u',
            ];
            if (devToolsKeys.some(Boolean)) {
                e.preventDefault();
                triggerAutoSubmit('Attempted to open developer tools');
                return;
            }
            // PrintScreen → risk
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                incrementRisk(15, 'Screenshot attempt (PrintScreen)');
                return;
            }
            // Copy / paste / save / print
            if (e.ctrlKey && ['c', 'v', 'p', 'x', 's', 'a'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                incrementRisk(8, `Blocked keyboard shortcut: Ctrl+${e.key.toUpperCase()}`);
                return;
            }
            if (e.metaKey) {
                e.preventDefault();
                incrementRisk(8, 'Command key combination blocked');
            }
        };

        // ── Device orientation (phone tilting to photograph screen) ──
        const handleMotion = (e: DeviceOrientationEvent) => {
            if (e.beta && (Math.abs(e.beta) > 45 || Math.abs(e.gamma || 0) > 30)) {
                incrementRisk(10, 'Significant device tilt detected');
            }
        };

        // Whole-exam countdown
        const timerObj = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerObj); triggerAutoSubmit('Time expired'); return 0; }
                return prev - 1;
            });
        }, 1000);

        window.addEventListener('blur', handleWindowBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', blockEvent, true);
        document.addEventListener('copy', blockEvent, true);
        document.addEventListener('paste', blockEvent, true);
        document.addEventListener('cut', blockEvent, true);
        document.addEventListener('selectstart', blockEvent, true);
        document.addEventListener('dragstart', blockEvent, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('deviceorientation', handleMotion);

        return () => {
            if (devToolsCheckRef.current) clearInterval(devToolsCheckRef.current);
            clearInterval(timerObj);
            window.removeEventListener('blur', handleWindowBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', blockEvent, true);
            document.removeEventListener('copy', blockEvent, true);
            document.removeEventListener('paste', blockEvent, true);
            document.removeEventListener('cut', blockEvent, true);
            document.removeEventListener('selectstart', blockEvent, true);
            document.removeEventListener('dragstart', blockEvent, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('deviceorientation', handleMotion);
            stopAVMonitoring();
        };
    }, [examPhase, triggerAutoSubmit, incrementRisk]);

    // ─── Per-question timer (GAP 11) ────────────────────────────────
    useEffect(() => {
        if (timerMode !== 'per_question' || shuffledQuestions.length === 0 || examPhase !== 'active') return;
        if (perQuestionTimerRef.current) clearInterval(perQuestionTimerRef.current);
        setQuestionTimeLeft(perQuestionTime);
        perQuestionTimerRef.current = setInterval(() => {
            setQuestionTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(perQuestionTimerRef.current!);
                    setCurrentQuestionIndex(idx => {
                        if (idx >= shuffledQuestions.length - 1) { triggerAutoSubmit('Time expired on final question'); return idx; }
                        return idx + 1;
                    });
                    return perQuestionTime;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (perQuestionTimerRef.current) clearInterval(perQuestionTimerRef.current); };
    }, [timerMode, currentQuestionIndex, shuffledQuestions.length, perQuestionTime, examPhase]);

    // ─── Persist answers to sessionStorage for auto-submit reliability ─
    useEffect(() => {
        sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(answers));
    }, [answers, examId]);

    // ─── Helpers ─────────────────────────────────────────────────────
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSelectOption = (option: string) => {
        if (submitting) return;
        const timeSpent = (Date.now() - questionStartTime.current) / 1000;
        const totalIdle = (Date.now() - lastActivityTime.current) / 1000;
        if (totalIdle > 30 && timeSpent < 2.5) incrementRisk(12, 'Abnormal answer-speed pattern detected');
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: option }));
        lastActivityTime.current = Date.now();
    };

    const handleManualSubmit = async () => {
        const ok = confirm
            ? await confirm({ title: 'Submit Examination', message: 'Submit now? You cannot return after submission.', confirmLabel: 'Submit', type: 'info' })
            : window.confirm('Submit now? You cannot return after submission.');
        if (ok) {
            setSubmitting(true);
            stopAVMonitoring();
            if (devToolsCheckRef.current) clearInterval(devToolsCheckRef.current);
            const payload = shuffledQuestions.map((q, idx) => ({ questionId: q.id, answer: answers[idx] || '' }));
            try {
                const res = await fetch(`/api/exams/${examId}/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ answers: payload, riskScore, violations: suspiciousFlags })
                });
                const data = await res.json();
                if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                sessionStorage.removeItem(`exam_answers_${examId}`);
                onExamSubmit(data.scoreDisplay || 'submitted', 'Manual Submission');
            } catch (err) {
                addToast('Submission failed. Retrying...', 'error');
                setSubmitting(false);
            }
        }
    };

    const watermarkPattern = Array(200).fill(matricNumber).join('        ');

    // ═══════════════════════════════════════════════════════════════
    // PHASE: LOADING (questions fetching in background)
    // ═══════════════════════════════════════════════════════════════
    if (examPhase === 'loading') {
        return (
            <div className="fixed inset-0 bg-slate-950 z-[200] flex flex-col items-center justify-center gap-5">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                <div className="text-center">
                    <p className="text-white font-black text-lg">Preparing Your Exam</p>
                    <p className="text-slate-400 text-sm mt-1">{courseName}</p>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE: ACTIVE EXAM
    // ═══════════════════════════════════════════════════════════════
    return (
        <div
            ref={examContainerRef}
            className="fixed inset-0 bg-slate-50 z-[200] flex flex-col font-sans select-none overflow-hidden"
            onContextMenu={e => { e.preventDefault(); return false; }}
        >
            {/* Watermark */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] z-0 flex items-center justify-center break-words leading-loose text-2xl font-bold italic rotate-[-15deg] scale-150 text-slate-900" aria-hidden="true">
                {watermarkPattern}
            </div>

            {/* Header */}
            <header className="bg-slate-900 text-white px-4 md:px-6 py-4 flex items-center justify-between shadow-lg shrink-0 relative z-20">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                        <ShieldAlert size={14} /> <span className="hidden sm:block">Proctoring Active</span>
                    </div>
                    {riskScore > 0 && (
                        <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${riskScore >= 15 ? 'bg-rose-500/30 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                            ⚠ Risk: {riskScore}/25
                        </div>
                    )}
                </div>
                <div className="text-center absolute left-1/2 -translate-x-1/2 hidden md:block">
                    <h1 className="text-xs font-black tracking-widest uppercase text-slate-300">{courseName}</h1>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-1.5 text-emerald-400 hidden sm:flex">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">Cam+Mic</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-300 hidden sm:flex">
                        <Maximize2 size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block">Fullscreen</span>
                    </div>
                    {timerMode === 'per_question' ? (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono tracking-widest text-sm ${questionTimeLeft < 10 ? 'bg-rose-500 text-white animate-pulse' : questionTimeLeft < 20 ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                            <Clock size={16} /> {questionTimeLeft}s
                        </div>
                    ) : (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold font-mono tracking-widest text-sm ${timeLeft < 300 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                            <Clock size={16} /> {formatTime(timeLeft)}
                        </div>
                    )}
                </div>
            </header>

            {/* PIP Camera */}
            <div className="fixed bottom-6 right-6 w-28 h-36 md:w-44 md:h-32 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-emerald-600/40 z-50">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-rose-500/80 rounded-md text-[9px] font-bold text-white uppercase">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> REC
                </div>
            </div>

            {/* Submitting overlay */}
            <AnimatePresence>
                {submitting && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-[300] flex flex-col items-center justify-center p-6">
                        <ShieldAlert size={64} className="text-rose-500 mb-6 animate-pulse" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight text-center">Finalizing Exam</h2>
                        <p className="text-slate-400 font-medium text-center">Do not close this page. Uploading your answers securely…</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main content */}
            <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center relative z-10 pb-48">
                {shuffledQuestions.length > 0 && (
                    <div className="w-full max-w-4xl flex flex-col bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-[2rem] shadow-sm border border-white">

                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
                            </h2>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                                {shuffledQuestions[currentQuestionIndex]?.points || 10} pts
                            </span>
                        </div>

                        <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-12 z-20">
                            <h3 className="text-lg md:text-2xl font-bold text-slate-900 leading-relaxed mb-10">
                                {shuffledQuestions[currentQuestionIndex].text}
                            </h3>
                            <div className="space-y-4">
                                {shuffledQuestions[currentQuestionIndex].options.map((option: string, i: number) => {
                                    const isSelected = answers[currentQuestionIndex] === option;
                                    return (
                                        <button key={i} onClick={() => handleSelectOption(option)}
                                            className={`w-full text-left p-5 md:p-6 rounded-2xl border-2 transition-all flex items-center gap-4 group
                                                ${isSelected ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                                ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 group-hover:border-indigo-300'}`}>
                                                {isSelected && <CheckCircle2 size={16} />}
                                            </div>
                                            <span className={`font-medium sm:text-lg leading-relaxed ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>
                                                {option}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-8">
                            <button onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
                                disabled={currentQuestionIndex === 0}
                                className="px-6 py-4 flex items-center gap-2 font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-30">
                                <ChevronLeft size={20} /> Previous
                            </button>

                            <div className="hidden md:flex items-center gap-1.5">
                                {shuffledQuestions.map((_, i) => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentQuestionIndex ? 'bg-indigo-600 scale-150' : answers[i] ? 'bg-indigo-300' : 'bg-slate-300'}`} />
                                ))}
                            </div>

                            {currentQuestionIndex === shuffledQuestions.length - 1 ? (
                                <button onClick={handleManualSubmit}
                                    className="px-6 md:px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm rounded-xl shadow-xl transition-all flex items-center gap-2">
                                    <Save size={18} /> Submit Exam
                                </button>
                            ) : (
                                <button onClick={() => { setCurrentQuestionIndex(p => Math.min(shuffledQuestions.length - 1, p + 1)); questionStartTime.current = Date.now(); }}
                                    className="px-6 md:px-8 py-4 flex items-center gap-2 font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-lg">
                                    Next <ChevronRight size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
