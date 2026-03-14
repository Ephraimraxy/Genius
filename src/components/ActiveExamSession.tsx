import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Clock, Save, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Volume2, Maximize2, Video } from 'lucide-react';
import { ToastType } from './ToastSystem';

interface ActiveExamSessionProps {
    courseName: string;
    matricNumber: string;
    addToast: (msg: string, type: ToastType) => void;
    onExamSubmit: (score: string, reason?: string) => void;
}

export default function ActiveExamSession({ courseName, matricNumber, addToast, onExamSubmit }: ActiveExamSessionProps) {
    const [timeLeft, setTimeLeft] = useState(3600); // 60 mins in seconds
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [warningCount, setWarningCount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
    
    // Refs for tracking system abuse
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const avStreamRef = useRef<MediaStream | null>(null);
    const reqFrameRef = useRef<number>(0);
    const examContainerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Mock Questions
    const baseQuestions = [
        { id: 1, text: "Which AI architecture is primarily responsible for generating human-like textual responses based on context?", options: ["A. Convolutional Neural Networks (CNNs)", "B. Transformer Models", "C. Generative Adversarial Networks (GANs)", "D. Recurrent Neural Networks (RNNs)"], correct: "B" },
        { id: 2, text: "What defines the process of 'Fine-tuning' a language model?", options: ["A. Changing the hardware it runs on.", "B. Training a pre-trained model on a smaller, specific dataset to adapt it to a new task.", "C. Deleting the model's memory of past inputs.", "D. Increasing the learning rate drastically."], correct: "B" },
        { id: 3, text: "In neural networks, what is the primary function of an activation function?", options: ["A. To store data.", "B. To compress images.", "C. To introduce non-linearity into the network.", "D. To connect to the database."], correct: "C" },
        { id: 4, text: "Which component of the Transformer architecture calculates the relevance of words to each other?", options: ["A. Polling Layer", "B. Dropout Layer", "C. Self-Attention Mechanism", "D. Sigmoid Gate"], correct: "C" },
    ];

    // --- Shuffle Logic on Mount ---
    useEffect(() => {
        // Shuffle questions and their respective options
        const shuffled = baseQuestions.map(q => {
            const correctOptStr = q.options.find(o => o.startsWith(q.correct))!;
            const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
            
            // Re-assign A, B, C, D labels to the shuffled options
            const relabeledOptions = shuffledOptions.map((opt, idx) => {
                const label = String.fromCharCode(65 + idx);
                return `${label}. ${opt.substring(3)}`;
            });
            
            // Find what the correct option's new label is
            const newCorrectOpt = relabeledOptions.find(o => o.substring(3) === correctOptStr.substring(3))!;
            
            return {
                ...q,
                options: relabeledOptions,
                correct: newCorrectOpt.split('.')[0]
            };
        }).sort(() => Math.random() - 0.5);
        
        setShuffledQuestions(shuffled);
    }, []);

    // --- Core Auto Submit Function ---
    const triggerAutoSubmit = useCallback((reason: string) => {
        if (submitting) return; // Prevent double firing
        setSubmitting(true);
        addToast(`SECURITY VIOLATION: ${reason}. Exam auto-submitting.`, 'error');
        
        // Clean up immediately
        stopAVMonitoring();
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.error(err));
        }

        // Calculate current score
        let score = 0;
        shuffledQuestions.forEach((q, index) => {
            if (answers[index] === q.correct) score += 10;
        });
        
        setTimeout(() => {
            onExamSubmit(`${score}/${shuffledQuestions.length * 10}`, reason);
        }, 3000);
    }, [answers, shuffledQuestions, submitting, addToast, onExamSubmit]);

    // --- AV Monitoring (Web Audio API & Camera PiP) ---
    const startAVMonitoring = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            avStreamRef.current = stream;
            
            // Attach video to PiP element
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            
            audioContextRef.current = new window.AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            
            // Function to continuously check volume
            const checkVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                
                // Threshold Check (very simplified)
                // If average volume goes above a certain highly noticeable threshold
                if (average > 80) { // arbitrary loud noise threshold
                    handleSecurityWarning("Loud background noise or speech detected");
                }
                
                reqFrameRef.current = requestAnimationFrame(checkVolume);
            };
            
            checkVolume();
        } catch (err) {
            console.error("Failed to start AV monitoring during exam:", err);
            triggerAutoSubmit("Failed to maintain mandatory AV stream");
        }
    };

    const stopAVMonitoring = () => {
        if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
        if (avStreamRef.current) avStreamRef.current.getTracks().forEach(t => t.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };

    // --- Security Warning Handler ---
    const handleSecurityWarning = useCallback((reason: string) => {
        setWarningCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 3) {
                triggerAutoSubmit(`Multiple violations: ${reason}`);
            } else {
                addToast(`WARNING (${newCount}/3): ${reason}. Further warnings will auto-submit.`, 'error');
            }
            return newCount;
        });
    }, [triggerAutoSubmit, addToast]);

    // --- Event Listeners Setup ---
    useEffect(() => {
        // Enforce Fullscreen automatically on mount
        const enterFullscreen = () => {
            if (examContainerRef.current) {
                examContainerRef.current.requestFullscreen().catch(err => {
                    console.error("Error attempting to enable fullscreen:", err);
                    triggerAutoSubmit("Failed to enter fullscreen mode.");
                });
            }
        };

        // Delay slightly giving the DOM time to mount
        setTimeout(enterFullscreen, 100);

        // Visibility Change (Switching Tabs/Apps)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerAutoSubmit("Switched tabs or minimized window");
            }
        };

        // Fullscreen Change (Exiting Fullscreen)
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                triggerAutoSubmit("Exited full-screen mode");
            }
        };

        // Prevent Copy/Paste/Right-Click
        const disableContextAndCopy = (e: Event) => e.preventDefault();
        
        // Prevent common shortcuts (PrintScreen, Ctrl+C, etc)
        const handleKeyDown = (e: KeyboardEvent) => {
            // Block PrintScreen
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                handleSecurityWarning("Screenshot attempt blocked");
            }
            // Block Ctrl+C, Ctrl+V, Windows key, Mac Command key combinations
            if (e.metaKey || (e.ctrlKey && ['c', 'v', 'p', 'x'].includes(e.key.toLowerCase()))) {
                e.preventDefault();
                handleSecurityWarning("Unauthorized keyboard shortcut blocked");
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', disableContextAndCopy);
        document.addEventListener('copy', disableContextAndCopy);
        document.addEventListener('paste', disableContextAndCopy);
        window.addEventListener('keydown', handleKeyDown);

        // Start AV
        startAVMonitoring();

        // Timer
        const timerObj = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerObj);
                    triggerAutoSubmit("Time expired");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', disableContextAndCopy);
            document.removeEventListener('copy', disableContextAndCopy);
            document.removeEventListener('paste', disableContextAndCopy);
            window.removeEventListener('keydown', handleKeyDown);
            clearInterval(timerObj);
            stopAVMonitoring();
        };
    }, [triggerAutoSubmit, handleSecurityWarning]);

    // --- UI Helpers ---
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSelectOption = (option: string) => {
        if (submitting) return;
        setAnswers(prev => ({ ...prev, [currentQuestionIndex]: option.split('.')[0] }));
    };
    
    const handleManualSubmit = () => {
        if(window.confirm("Are you sure you want to submit your exam now? You cannot return.")) {
            triggerAutoSubmit("Manual Submission");
        }
    };

    // Create the watermark array string
    const watermarkPattern = Array(200).fill(matricNumber).join('        ');

    return (
        <div ref={examContainerRef} className="fixed inset-0 bg-slate-50 z-[200] flex flex-col font-sans select-none overflow-hidden group">
            
            {/* Background Watermark Pattern */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5 z-0 flex items-center justify-center break-words leading-loose text-2xl font-bold italic rotate-[-15deg] scale-150 text-slate-900" aria-hidden="true">
                {watermarkPattern}
            </div>
            
            {/* Top Security Header */}
            <header className="bg-slate-900 text-white px-4 md:px-6 py-4 flex items-center justify-between shadow-lg shrink-0 relative z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 text-[10px] md:text-xs font-bold uppercase tracking-widest animate-pulse">
                        <ShieldAlert size={16} /> <span className="hidden sm:block">Proctoring Active</span>
                    </div>
                </div>
                <div className="text-center absolute left-1/2 -translate-x-1/2 hidden md:block">
                    <h1 className="text-xs md:text-sm font-black tracking-widest uppercase text-slate-300">{courseName}</h1>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-2 text-rose-400">
                        <Video size={16} />
                        <span className="text-[10px] xl:text-xs font-bold uppercase tracking-widest hidden lg:block">AV Active</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-300">
                        <Maximize2 size={16} />
                        <span className="text-[10px] xl:text-xs font-bold uppercase tracking-widest hidden lg:block">Fullscreen Lock</span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-bold font-mono tracking-widest text-sm md:text-base ${timeLeft < 300 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                        <Clock size={18} /> {formatTime(timeLeft)}
                    </div>
                </div>
            </header>

            {/* PIP Video Frame */}
            <div className="fixed bottom-6 right-6 w-32 h-40 md:w-48 md:h-36 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 z-50">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-rose-500/80 backdrop-blur-sm rounded-md text-[10px] font-bold text-white uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> REC
                </div>
            </div>

            {/* Submitting Overlay */}
            <AnimatePresence>
                {submitting && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-[300] flex flex-col items-center justify-center p-6"
                    >
                        <ShieldAlert size={64} className="text-rose-500 mb-6 animate-pulse" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight text-center">Finalizing Exam</h2>
                        <p className="text-slate-400 font-medium text-center">Do not close the page. Uploading encrypted assessment data...</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center relative z-10 pb-48">
                {shuffledQuestions.length > 0 && (
                    <div className="w-full max-w-4xl flex flex-col h-full bg-white/80 backdrop-blur-sm p-4 md:p-8 rounded-[2rem] shadow-sm border border-white">
                        
                        {/* Question Header */}
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
                            </h2>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                                Points: 10
                            </span>
                        </div>

                        {/* Question Content */}
                        <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-12 z-20">
                            <h3 className="text-lg md:text-2xl font-bold text-slate-900 leading-relaxed mb-10">
                                {shuffledQuestions[currentQuestionIndex].text}
                            </h3>

                            <div className="space-y-4">
                                {shuffledQuestions[currentQuestionIndex].options.map((option: string, i: number) => {
                                const optLetter = option.split('.')[0];
                                const isSelected = answers[currentQuestionIndex] === optLetter;
                                
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleSelectOption(option)}
                                        className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center gap-4 group
                                            ${isSelected 
                                                ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100' 
                                                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                            ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-transparent group-hover:border-indigo-300'}`}>
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

                    {/* Bottom Navigation Navigation */}
                    <div className="flex items-center justify-between mt-8">
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestionIndex === 0}
                            className="px-6 py-4 flex items-center gap-2 font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                            <ChevronLeft size={20} /> Previous
                        </button>

                        {/* Progress Dots */}
                        <div className="hidden md:flex items-center gap-2">
                            {shuffledQuestions.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                                        i === currentQuestionIndex ? 'bg-indigo-600 scale-150' : 
                                        answers[i] ? 'bg-indigo-300' : 'bg-slate-300'
                                    }`}
                                />
                            ))}
                        </div>

                        {currentQuestionIndex === shuffledQuestions.length - 1 ? (
                            <button
                                onClick={handleManualSubmit}
                                className="px-6 md:px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm rounded-xl shadow-xl shadow-emerald-600/20 transition-all flex items-center gap-2"
                            >
                                <Save size={18} /> Submit Exam
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentQuestionIndex(prev => Math.min(shuffledQuestions.length - 1, prev + 1))}
                                className="px-6 md:px-8 py-4 flex items-center gap-2 font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-lg"
                            >
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

