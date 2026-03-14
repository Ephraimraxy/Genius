import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Mic, Maximize, ShieldAlert, CheckCircle2, PlayCircle, Loader2, Camera, Smartphone, Bluetooth, Brain, Activity, Clock } from 'lucide-react';

interface ExamProctoringModalProps {
    courseName: string;
    onStartExam: () => void;
    onCancel: () => void;
}

export default function ExamProctoringModal({ courseName, onStartExam, onCancel }: ExamProctoringModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [micGranted, setMicGranted] = useState(false);
    const [camGranted, setCamGranted] = useState(false);
    const [requestingPerms, setRequestingPerms] = useState(false);
    const [permError, setPermError] = useState('');

    const requestPermissions = async () => {
        setRequestingPerms(true);
        setPermError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            
            // We just need permission for the pre-check. 
            // The actual exam component will request the stream again to use it.
            // We'll close these specific tracks to avoid keeping the devices active unnecessarily here.
            stream.getTracks().forEach(track => track.stop());
            
            setMicGranted(true);
            setCamGranted(true);
        } catch (err: any) {
            console.error("Camera/Microphone access denied:", err);
            if (err.name === 'NotAllowedError') {
                 setPermError('Camera or Microphone access was denied. You must grant access in your browser settings to proceed.');
            } else if (err.name === 'NotFoundError') {
                 setPermError('No camera/microphone detected. You need both for exam proctoring.');
            } else {
                 setPermError('Failed to access AV devices. Please try again.');
            }
        } finally {
            setRequestingPerms(false);
        }
    };

    const handleEnterExam = () => {
        if (!micGranted || !camGranted) {
             setPermError('You must grant camera and microphone access before starting.');
             return;
        }
        
        // Let the parent component know we can proceed.
        // The parent will handle full-streaming and rendering the actual exam UI.
        onStartExam();
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
                {/* Header Pattern */}
                <div className="bg-rose-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-700 rounded-full blur-3xl opacity-50 -ml-20 -mb-20"></div>
                    
                    <ShieldAlert size={48} className="text-white mx-auto mb-4 relative z-10 animate-pulse" />
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight relative z-10">
                        Strict Exam Proctoring
                    </h2>
                    <p className="text-rose-200 mt-2 font-medium text-sm max-w-md mx-auto relative z-10">
                        {courseName}
                    </p>
                </div>

                <div className="p-8">
                    {step === 1 && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                                <h3 className="text-rose-800 font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-xs">
                                    <ShieldAlert size={18} /> Deep-AI Security Protocols
                                </h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-rose-100">
                                        <Brain size={20} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-1">Behavioral Risk Scoring</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Neural AI monitors gaze, speech, and patterns. High risk scores trigger auto-submission.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-rose-100">
                                        <Smartphone size={20} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-1">Motion & Orientation</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Gyroscopic sensors detect if the device is picked up or tilted to photograph questions.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-rose-100">
                                        <Clock size={20} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-1">Answer-Time Analytics</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Suspiciously fast answers after long idle periods (external lookup) are flagged.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-rose-100">
                                        <Bluetooth size={20} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-1">Proximity Scanning</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Bluetooth signals are monitored to detect nearby secondary devices/smartphones.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-3 pt-4 border-t border-rose-100">
                                    <div className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></div>
                                        <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                                            Questions are <span className="text-rose-600">Dynamic & Parameterized</span>. Sharing answers or searching online will result in incorrect results due to unique student variables.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></div>
                                        <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                            <span className="text-rose-600">Environment Lockdown:</span> Switching tabs, exits from fullscreen, or keyboard shortcuts result in immediate failure.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button 
                                    onClick={onCancel}
                                    className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => setStep(2)}
                                    className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-600/30 transition-all uppercase tracking-widest text-sm"
                                >
                                    I Understand, Proceed
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                             <div className="text-center mb-6">
                                <h3 className="text-slate-900 font-black text-xl mb-2">System Check</h3>
                                <p className="text-sm font-medium text-slate-500">We need to verify your environment before configuring the exam.</p>
                            </div>

                            <div className="space-y-4">
                                {/* Component Check 1: Audio/Video */}
                                <div className={`p-5 rounded-2xl border ${(micGranted && camGranted) ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'} transition-colors`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(micGranted && camGranted) ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                <Camera size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm">AV Proctoring Access</h4>
                                                <p className="text-xs font-medium text-slate-500">Camera and Microphone required.</p>
                                            </div>
                                        </div>
                                        {(micGranted && camGranted) ? (
                                            <span className="text-emerald-600 font-bold text-sm flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-lg">
                                                <CheckCircle2 size={16} /> Verified
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={requestPermissions}
                                                disabled={requestingPerms}
                                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {requestingPerms ? <Loader2 size={14} className="animate-spin" /> : 'Allow Access'}
                                            </button>
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {permError && (
                                            <motion.p 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg mt-2"
                                            >
                                                {permError}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>
                                
                                {/* Note about Fullscreen */}
                                <div className="p-5 rounded-2xl border bg-indigo-50 border-indigo-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-200 text-indigo-700">
                                            <Maximize size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-indigo-900 text-sm">Full-Screen Enforcement</h4>
                                            <p className="text-xs font-medium text-indigo-700 leading-relaxed mt-1">
                                                Clicking "Start Exam" below will automatically trigger your browser into full screen. <strong className="text-rose-600">Do not exit full screen manually until you have clicked Submit in the exam.</strong>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
                                <button 
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    Back to Rules
                                </button>
                                
                                <button 
                                    onClick={handleEnterExam}
                                    disabled={!micGranted || !camGranted}
                                    className={`px-8 py-4 font-black rounded-xl transition-all uppercase tracking-widest text-sm flex items-center gap-2
                                        ${(micGranted && camGranted) 
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/30 hover:scale-105' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <PlayCircle size={20} /> Start Exam
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

