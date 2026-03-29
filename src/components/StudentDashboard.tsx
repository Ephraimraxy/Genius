import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ToastType, useToasts } from './ToastSystem';
import ExamProctoringModal from './ExamProctoringModal';
import ActiveExamSession from './ActiveExamSession';
import GeniusPaymentModal from './GeniusPaymentModal';

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
    
    // Attendance State
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [selectedCourseForAttendance, setSelectedCourseForAttendance] = useState<string | null>(null);
    
    // Assessment Payment State
    const [showAssessmentPaymentModal, setShowAssessmentPaymentModal] = useState(false);
    const [selectedAssessmentForPayment, setSelectedAssessmentForPayment] = useState<any | null>(null);
    
    // Dynamic Application State
    const [exams, setExams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [accessBlocked, setAccessBlocked] = useState(profile?.user?.accessBlocked || false);
    const [entryFee, setEntryFee] = useState(profile?.user?.entryFee || 0);
    const [showPortalPayment, setShowPortalPayment] = useState(false);

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

    // Filter based on BOTH status AND view type (Harden against undefined)
    const activeType = view === 'dashboard' ? 'exam' : view === 'tests' ? 'test' : 'assignment';
    
    const upcomingExams = (exams || []).filter(e => e && e.status === 'pending' && e.type === activeType);
    const pastExams = (exams || []).filter(e => e && e.status === 'completed' && e.type === activeType);
    const activeExams = (exams || []).filter(e => e && e.status === 'active' && e.type === activeType);

    const handleStartExamClick = (exam: any) => {
        if (exam.is_paid && !exam.hasPaid) {
            setSelectedAssessmentForPayment(exam);
            setShowAssessmentPaymentModal(true);
            return;
        }
        setActiveExamId(exam.id);
        setActiveExamCourse(exam.course);
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
            {activeExams.length > 0 && activeExams[0] && (
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
                            <p className="text-red-100 font-medium text-sm md:text-base truncate">{activeExams[0]?.course || 'Exam Session'}</p>
                            <p className="text-[10px] md:text-xs font-bold mt-1.5 md:mt-2 opacity-80 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} /> {activeType === 'assignment' ? 'Deadline' : 'Duration'}: {activeExams[0]?.duration || 'N/A'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleStartExamClick(activeExams[0])}
                        className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-rose-600 font-black rounded-xl shadow-lg hover:bg-slate-50 transition-colors uppercase tracking-[0.1em] text-xs md:text-sm"
                    >
                        {activeExams[0]?.is_paid && !activeExams[0]?.hasPaid ? 'Unlock Now' : (activeType === 'assignment' ? 'Open Assignment' : 'Start Now')}
                    </button>
                </motion.div>
            )}

            {/* Attendance Banner (Always Visible for Demo) */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-gradient-to-r from-indigo-600 to-blue-800 rounded-[2rem] shadow-xl text-white flex flex-col md:flex-row items-center justify-between gap-6"
            >
                <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 bg-white/20 rounded-xl mt-1 shrink-0">
                        <CheckCircle2 size={20} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg md:text-xl font-black mb-0.5 md:mb-1 truncate">Today's Attendance</h3>
                        <p className="text-indigo-100 font-medium text-sm md:text-base truncate">General Course Module</p>
                        <p className="text-[10px] md:text-xs font-bold mt-1.5 md:mt-2 opacity-80 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={12} /> Date: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setSelectedCourseForAttendance('General Course Module');
                        setShowAttendanceModal(true);
                    }}
                    className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-indigo-600 font-black rounded-xl shadow-lg hover:bg-slate-50 transition-colors uppercase tracking-[0.1em] text-xs md:text-sm"
                >
                    Sign Attendance (₦500)
                </button>
            </motion.div>

            <AnimatePresence>
                {showAttendanceModal && selectedCourseForAttendance && (
                    <GeniusPaymentModal
                        courseName={selectedCourseForAttendance}
                        courseId={selectedCourseForAttendance}
                        amount={500}
                        token={token}
                        addToast={addToast}
                        onClose={() => {
                            setShowAttendanceModal(false);
                            setSelectedCourseForAttendance(null);
                        }}
                        onSuccess={() => {
                            setShowAttendanceModal(false);
                            setSelectedCourseForAttendance(null);
                            // Real app: fetch updated attendance status here
                        }}
                        type="attendance"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAssessmentPaymentModal && selectedAssessmentForPayment && (
                    <GeniusPaymentModal
                        courseName={selectedAssessmentForPayment.course}
                        courseId={selectedAssessmentForPayment.id.toString()}
                        amount={selectedAssessmentForPayment.price}
                        token={token}
                        addToast={addToast}
                        onClose={() => {
                            setShowAssessmentPaymentModal(false);
                            setSelectedAssessmentForPayment(null);
                        }}
                        onSuccess={() => {
                            setShowAssessmentPaymentModal(false);
                            const assessment = selectedAssessmentForPayment;
                            setSelectedAssessmentForPayment(null);
                            // Refresh data
                            window.location.reload(); // Simple refresh to update hasPaid
                        }}
                        type="assessment"
                    />
                )}
            </AnimatePresence>

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

            {/* Portal Entry Payment Blocker — hidden when payment modal is open */}
            <AnimatePresence>
                {accessBlocked && !showPortalPayment && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={40} className="text-amber-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Portal Access Blocked</h2>
                            <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
                                Your batch/category requires a one-time portal access fee of <span className="text-indigo-600 font-bold">₦{entryFee}</span> to unlock your dashboard and assessments.
                            </p>
                            <button 
                                onClick={() => setShowPortalPayment(true)}
                                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs mb-4"
                            >
                                Pay Now to Unlock
                            </button>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secure Academic Gateway &copy; 2026</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showPortalPayment && (
                    <GeniusPaymentModal 
                        amount={entryFee}
                        courseId="PORTAL-ENTRY"
                        courseName="Portal Access Activation"
                        token={token}
                        addToast={addToast}
                        onClose={() => setShowPortalPayment(false)}
                        onSuccess={() => {
                            setShowPortalPayment(false);
                            setAccessBlocked(false);
                            addToast('Payment logged. Access will be granted shortly.', 'success');
                            setTimeout(() => window.location.reload(), 2000);
                        }}
                        type="portal_entry"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
