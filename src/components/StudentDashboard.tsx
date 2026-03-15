import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ToastType, useToasts } from './ToastSystem';
import ExamProctoringModal from './ExamProctoringModal';
import ActiveExamSession from './ActiveExamSession';

interface StudentDashboardProps {
    profile: any;
    onNavigate: (tab: any) => void;
    addToast: (msg: string, type: ToastType) => void;
    view: string;
    token: string | null;
    confirm?: (config: any) => Promise<boolean>;
}

export default function StudentDashboard({ profile, onNavigate, addToast, view, token, confirm }: StudentDashboardProps) {
    const [activeExamId, setActiveExamId] = useState<number | null>(null);
    const [activeExamCourse, setActiveExamCourse] = useState<string | null>(null);
    const [showProctoringModal, setShowProctoringModal] = useState(false);
    
    // Dynamic Application State
    const [exams, setExams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Unified Data Management (Genius Real-System Pattern)
    useEffect(() => {
        const syncDashboardData = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                const res = await fetch('/api/student/assessments', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.success) {
                    setExams(data.assessments);
                } else {
                    addToast("Failed to sync Genius records.", "error");
                }
            } catch (err) {
                addToast("Network error syncing records.", "error");
            } finally {
                setIsLoading(false);
            }
        };

        syncDashboardData();
    }, [view, token]); // Sync when view context changes // Refetch when view changes

    // Filter based on BOTH status AND view type
    const activeType = view === 'dashboard' ? 'exam' : view === 'tests' ? 'test' : 'assignment';
    
    const upcomingExams = exams.filter(e => e.status === 'pending' && e.type === activeType);
    const pastExams = exams.filter(e => e.status === 'completed' && e.type === activeType);
    const activeExams = exams.filter(e => e.status === 'active' && e.type === activeType);

    const handleStartExamClick = (examId: number, courseName: string) => {
        setActiveExamId(examId);
        setActiveExamCourse(courseName);
        setShowProctoringModal(true);
    };

    const handleExamSubmit = (score: string, reason?: string) => {
        if (reason) {
            console.log("Exam Auto-Submitted due to:", reason);
        } else {
            addToast('Exam submitted successfully.', 'success');
        }
        
        // Update local state (in a real app this would POST to the backend and re-fetch)
        setExams(prev => prev.map(e => 
            e.course === activeExamCourse 
                ? { ...e, status: 'completed', score, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } 
                : e
        ));
        
        setActiveExamId(null);
        setActiveExamCourse(null);
    };

    if (activeExamId && activeExamCourse && !showProctoringModal) {
        return <ActiveExamSession 
            examId={activeExamId}
            courseName={activeExamCourse}
            matricNumber={profile?.user?.matricNumber || 'GUEST'}
            addToast={addToast} 
            onExamSubmit={handleExamSubmit}
            token={token}
            confirm={confirm}
        />;
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            <header className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1 md:mb-2">
                    Welcome, {profile?.user?.name || 'Student'}
                </h2>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider font-mono">
                        {profile?.user?.matricNumber || 'MATRIC NOT FOUND'}
                    </span>
                    <span className="text-slate-500 font-medium text-sm">
                        • {profile?.user?.email}
                    </span>
                </div>
            </header>

            {/* Active Exams Banner */}
            {activeExams.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-gradient-to-r from-red-500 to-rose-600 rounded-[2rem] shadow-xl text-white flex flex-col md:flex-row items-center justify-between gap-6"
                >
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-2.5 bg-white/20 rounded-xl mt-1 shrink-0">
                            <AlertCircle size={20} className="animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg md:text-xl font-black mb-0.5 md:mb-1 truncate">Active {activeType.toUpperCase()} Available</h3>
                            <p className="text-red-100 font-medium text-sm md:text-base truncate">{activeExams[0].course}</p>
                            <p className="text-[10px] md:text-xs font-bold mt-1.5 md:mt-2 opacity-80 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} /> {activeType === 'assignment' ? 'Deadline' : 'Duration'}: {activeExams[0].duration}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleStartExamClick(activeExams[0].id, activeExams[0].course)}
                        className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-rose-600 font-black rounded-xl shadow-lg hover:bg-slate-50 transition-colors uppercase tracking-[0.1em] text-xs md:text-sm"
                    >
                        {activeType === 'assignment' ? 'Open Assignment' : 'Start Now'}
                    </button>
                </motion.div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Upcoming Assessments */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="text-indigo-500" /> Upcoming {view === 'dashboard' ? 'Exams' : view === 'tests' ? 'Tests' : 'Assignments'}
                    </h3>
                    {upcomingExams.length === 0 ? (
                        <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                            <img src="/gmijp-logo.png" alt="Genius" className="mx-auto w-16 h-16 object-contain mb-4 opacity-40 bg-white rounded-full p-2 shadow-sm" />
                            <p className="text-slate-500 font-medium">No {activeType}s scheduled.</p>
                        </div>
                    ) : (
                        upcomingExams.map(exam => (
                            <div key={exam.id} className="p-5 md:p-6 bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white border border-indigo-100 text-indigo-600 rounded-xl group-hover:border-indigo-600 transition-colors shadow-sm">
                                        <img src="/gmijp-logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                                    </div>
                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                        Pending
                                    </span>
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">{exam.course}</h4>
                                <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar size={14} /> {exam.date}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {exam.duration}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded-md">{exam.totalQuestions} Qs</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Past Exams */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-500" /> Recent Results
                    </h3>
                    {pastExams.length === 0 ? (
                        <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                            <p className="text-slate-500 font-medium">No past exam results available.</p>
                        </div>
                    ) : (
                        pastExams.map(exam => (
                             <div key={exam.id} className="p-5 md:p-6 bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900">{exam.course}</h4>
                                        <p className="text-sm text-slate-500 font-medium mt-1">Taken on {exam.date}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Score</span>
                                    <span className="text-2xl font-black text-emerald-600">{exam.score}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {/* Branding */}
             <div className="mt-12 flex items-center justify-center opacity-50">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center p-1.5 shadow-sm border border-slate-100 overflow-hidden">
                  <img src="/gmijp-logo.png" alt="Genius Portal" className="w-full h-full object-contain" />
                </div>
            </div>

            {/* Proctoring Warning Modal Overlay */}
            <AnimatePresence>
                {showProctoringModal && activeExamCourse && (
                    <ExamProctoringModal 
                        courseName={activeExamCourse}
                        onCancel={() => {
                            setShowProctoringModal(false);
                            setActiveExamCourse(null);
                        }}
                        onStartExam={() => setShowProctoringModal(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
