import React, { useState, useEffect } from 'react';
import { friendlyError } from '../utils/friendlyError';
import {
    Users,
    ClipboardList,
    BrainCircuit,
    FileUp,
    GraduationCap,
    Upload,
    CheckCircle,
    Search,
    Filter,
    MoreHorizontal,
    FileDown,
    Plus,
    Database,
    FileText,
    Calendar,
    Clock,
    AlertCircle,
    BookOpen,
    ShieldCheck,
    Mic,
    Volume2,
    Coins,
    Eye,
    Trash2,
    Send,
    Download as DownloadIcon,
    Save,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FilePreviewModal from './FilePreviewModal';
import { ToastType } from './ToastSystem';

interface Resource {
    id: number;
    type: 'roster' | 'material' | 'audio';
    name: string;
    status: 'ready' | 'failed' | 'pending' | 'short';
    created_at: string;
    content?: any;
    is_available?: boolean;
    price?: number;
    is_paid?: boolean;
    ai_fitness_status?: 'unchecked' | 'checking' | 'fit' | 'unfit';
    ai_fitness_reason?: string;
    professional_program_id?: number | null;
    professional_course_id?: number | null;
    professional_program_name?: string | null;
    professional_course_title?: string | null;
}

interface ProfessionalCourse {
    id: number;
    title: string;
    code?: string | null;
}

interface ProfessionalProgram {
    id: number;
    name: string;
    code?: string | null;
    price: number;
    is_published: boolean;
    courses: ProfessionalCourse[];
}

interface AcademicManagementProps {
    mode: 'attendance' | 'tests' | 'assignments' | 'exams' | 'materials' | 'records';
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
    hub?: 'academic' | 'professional';
    defaultProgramId?: number | null;
}

export default function AcademicManagement({ mode, addToast, token, hub = 'academic', defaultProgramId }: AcademicManagementProps) {
    const isProfessionalHub = hub === 'professional';
    const withHub = (url: string) => `${url}${url.includes('?') ? '&' : '?'}hub=${hub}`;
    const [isProcessing, setIsProcessing] = useState(false);
    const [showResourceSelector, setShowResourceSelector] = useState(false);
    const [hubResources, setHubResources] = useState<Resource[]>([]);
    const [isLoadingHub, setIsLoadingHub] = useState(false);
    const [audioPriceInputs, setAudioPriceInputs] = useState<Record<number, string>>({});
    const [selectedHubResource, setSelectedHubResource] = useState<Resource | null>(null);
    const [selectedMaterialResources, setSelectedMaterialResources] = useState<Resource[]>([]);
    const [records, setRecords] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | string | null>(null);
    const [previewName, setPreviewName] = useState<string>('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
    const [professionalPrograms, setProfessionalPrograms] = useState<ProfessionalProgram[]>([]);
    const isAssessmentMaterialSelector = mode === 'tests' || mode === 'exams' || mode === 'assignments';
    const assessmentMaterialIds = selectedMaterialResources.map(resource => resource.id);

    // Assessment builder state
    const [assessTitle, setAssessTitle] = useState('');
    const [assessCategoryId, setAssessCategoryId] = useState('');
    const [assessDuration, setAssessDuration] = useState('60');
    const [assessTimerMode, setAssessTimerMode] = useState<'whole' | 'per_question'>('whole');
    const [assessQuestionsCount, setAssessQuestionsCount] = useState('20');
    const [publishingId, setPublishingId] = useState<number | null>(null);
    const [assessBatchSize, setAssessBatchSize] = useState('10');
    const [assessStartDate, setAssessStartDate] = useState('');
    const [assessStartTime, setAssessStartTime] = useState('08:00');
    const [assessEndDate, setAssessEndDate] = useState('');
    const [assessEndTime, setAssessEndTime] = useState('18:00');
    const [customStartVal, setCustomStartVal] = useState('');
    const [customStartUnit, setCustomStartUnit] = useState<'seconds'|'minutes'|'hours'|'days'>('minutes');
    const [customDurVal, setCustomDurVal] = useState('');
    const [customDurUnit, setCustomDurUnit] = useState<'seconds'|'minutes'|'hours'|'days'>('hours');
    const [assessInstructions, setAssessInstructions] = useState('');
    const [assessProgramId, setAssessProgramId] = useState('');
    const [assessCourseId, setAssessCourseId] = useState('');
    const [assessSlots, setAssessSlots] = useState<any[]>([]);
    const [viewingSlotsFor, setViewingSlotsFor] = useState<number | null>(null);
    const [resendingSlotId, setResendingSlotId] = useState<number | null>(null);

    // Inline confirmation dialog (replaces all window.confirm / confirm() calls)
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

    // Assignment-specific
    const [assessOpenVal, setAssessOpenVal] = useState('');
    const [assessOpenUnit, setAssessOpenUnit] = useState<'minutes'|'hours'|'days'>('hours');
    const [assessWindowVal, setAssessWindowVal] = useState('');
    const [assessWindowUnit, setAssessWindowUnit] = useState<'hours'|'days'>('days');
    const [assessSubmType, setAssessSubmType] = useState<'text'|'file'|'both'>('file');
    const [assessAllowLate, setAssessAllowLate] = useState(false);
    const [viewingSubsFor, setViewingSubsFor] = useState<number | null>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [gradingSubId, setGradingSubId] = useState<number | null>(null);
    const [gradeInput, setGradeInput] = useState('');
    const [feedbackInput, setFeedbackInput] = useState('');

    // GAP 2/12: AI generation settings
    const [assessDifficulty, setAssessDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
    const [assessBlooms, setAssessBlooms] = useState('mixed');
    // GAP 7: Max attempts
    const [assessMaxAttempts, setAssessMaxAttempts] = useState('1');
    // GAP 4: Pool mode
    const [assessIsPool, setAssessIsPool] = useState(false);
    const [assessPoolSize, setAssessPoolSize] = useState('40');
    // GAP 6: Results modal
    const [viewingResultsFor, setViewingResultsFor] = useState<number | null>(null);
    const [examResults, setExamResults] = useState<any[]>([]);
    const [viewingAnswersFor, setViewingAnswersFor] = useState<{examId: number; studentId: number; name: string} | null>(null);
    const [studentAnswers, setStudentAnswers] = useState<any[]>([]);

    // Attendance session state
    const [attendSessions, setAttendSessions] = useState<any[]>([]);
    const [attendTitle, setAttendTitle] = useState('');
    const [attendCourseCode, setAttendCourseCode] = useState('');
    const [attendCategoryId, setAttendCategoryId] = useState('');
    const [attendDate, setAttendDate] = useState('');
    const [attendIsPaid, setAttendIsPaid] = useState(false);
    const [attendPrice, setAttendPrice] = useState('0');
    const [attendProgramId, setAttendProgramId] = useState('');
    const [attendCourseId, setAttendCourseId] = useState('');
    const [viewingRollFor, setViewingRollFor] = useState<number | null>(null);
    const [rollRecords, setRollRecords] = useState<any[]>([]);
    const [sessionPriceInputs, setSessionPriceInputs] = useState<Record<number, string>>({});
    const [isDownloadingRoll, setIsDownloadingRoll] = useState(false);

    useEffect(() => {
        if (token) {
            fetch(withHub('/api/courses/categories'), { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => { if(Array.isArray(data)) setCategories(data); })
                .catch(console.error);
            if (isProfessionalHub) {
                fetch(withHub('/api/pro-hub/programs'), { headers: { 'Authorization': `Bearer ${token}` } })
                    .then(res => res.json())
                    .then(data => setProfessionalPrograms(data.programs || []))
                    .catch(console.error);
            }
        }
    }, [token, hub]);

    const selectedAssessProgram = professionalPrograms.find(p => String(p.id) === String(assessProgramId));
    const selectedAttendProgram = professionalPrograms.find(p => String(p.id) === String(attendProgramId));

    // Pre-populate program scope when mounted from a program context
    React.useEffect(() => {
        if (defaultProgramId != null && String(defaultProgramId)) {
            setAssessProgramId(String(defaultProgramId));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultProgramId]);

    const renderProfessionalScopePicker = (kind: 'assessment' | 'attendance') => {
        if (!isProfessionalHub) return null;
        // When defaultProgramId is set (embedded in program view), hide the program selector
        if (kind === 'assessment' && defaultProgramId != null) {
            const program = selectedAssessProgram;
            return (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        Program: {program?.name || '...'}
                    </p>
                    <select value={assessCourseId} onChange={e => { setAssessCourseId(e.target.value); setSelectedMaterialResources([]); }}
                        className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
                        disabled={!program}>
                        <option value="">All Courses (no specific course)</option>
                        {(program?.courses || []).map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                </div>
            );
        }
        const programId = kind === 'assessment' ? assessProgramId : attendProgramId;
        const courseId = kind === 'assessment' ? assessCourseId : attendCourseId;
        const program = kind === 'assessment' ? selectedAssessProgram : selectedAttendProgram;
        const setProgram = kind === 'assessment' ? setAssessProgramId : setAttendProgramId;
        const setCourse = kind === 'assessment' ? setAssessCourseId : setAttendCourseId;
        return (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Professional Program Scope</p>
                <div className="grid md:grid-cols-2 gap-3">
                    <select value={programId} onChange={e => { setProgram(e.target.value); setCourse(''); setSelectedMaterialResources([]); }}
                        className="px-4 py-3 bg-white border border-emerald-100 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-emerald-400">
                        <option value="">Select Program</option>
                        {professionalPrograms.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
                    </select>
                    <select value={courseId} onChange={e => { setCourse(e.target.value); setSelectedMaterialResources([]); }}
                        className="px-4 py-3 bg-white border border-emerald-100 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
                        disabled={!program}>
                        <option value="">All Courses</option>
                        {(program?.courses || []).map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                </div>
            </div>
        );
    };

    const fetchRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const res = await fetch(withHub('/api/academic/tests'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const filtered = data.filter((r: any) => {
                if (mode === 'tests') return r.type === 'test' || !r.type;
                if (mode === 'exams') return r.type === 'exam';
                if (mode === 'assignments') return r.type === 'assignment';
                return true;
            });
            setRecords(filtered);
        } catch (err) {
            console.error('Failed to fetch records');
        }
        setIsLoadingRecords(false);
    };

    useEffect(() => {
        fetchRecords();
    }, [mode, token]);

    const fetchHubResourceContent = async (id: number) => {
        try {
            const res = await fetch(withHub(`/api/resources/${id}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.type === 'roster' && Array.isArray(data.content)) {
                setStudents(data.content);
            }
        } catch (err) {
            addToast('Failed to load resource content', 'error');
        }
    };

    const fetchHubResources = async (type: 'roster' | 'material' | 'audio') => {
        setIsLoadingHub(true);
        try {
            const res = await fetch(withHub('/api/resources'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setHubResources(data.filter((r: Resource) => {
                if (!(r.type === type && r.status === 'ready')) return false;
                if (!isProfessionalHub || type !== 'material' || !isAssessmentMaterialSelector) return true;
                if (assessProgramId && String(r.professional_program_id || '') !== String(assessProgramId)) return false;
                if (assessCourseId && String(r.professional_course_id || '') !== String(assessCourseId)) return false;
                return true;
            }));
        } catch (err) {
            addToast('Failed to fetch from Resource Hub', 'error');
        }
        setIsLoadingHub(false);
    };

    useEffect(() => {
        if (mode === 'records') {
            fetchHubResources('audio');
        } else if (mode === 'materials') {
            fetchHubResources('material');
        }
    }, [mode, hub]);

    const handleOpenSelector = () => {
        if (isProfessionalHub && isAssessmentMaterialSelector && !assessProgramId) {
            addToast('Select a professional program before linking materials', 'error');
            return;
        }
        const type = mode === 'attendance' ? 'roster' : 'material';
        fetchHubResources(type);
        setShowResourceSelector(true);
    };

    const selectSingleResource = (res: Resource) => {
        setSelectedHubResource(res);
        setShowResourceSelector(false);
        addToast(`Linked to resource: ${res.name}`, 'success');
        if (res.type === 'roster') {
            fetchHubResourceContent(res.id);
        }
    };

    const toggleMaterialResource = (res: Resource) => {
        setSelectedMaterialResources(prev => {
            const exists = prev.some(item => item.id === res.id);
            if (exists) {
                return prev.filter(item => item.id !== res.id);
            }
            return [...prev, res];
        });
    };

    const confirmMaterialSelection = () => {
        setShowResourceSelector(false);
        if (selectedMaterialResources.length > 0) {
            addToast(`Linked ${selectedMaterialResources.length} lecture material(s) for AI generation`, 'success');
        }
    };

    const handleCreateAssessment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assessTitle.trim()) return addToast('Please enter an assessment title', 'error');
        if (isProfessionalHub && !assessProgramId) {
            return addToast('Select the professional program for this assessment', 'error');
        }
        if ((mode === 'tests' || mode === 'exams') && assessmentMaterialIds.length === 0) {
            return addToast('Link at least one lecture material for AI question generation', 'error');
        }

        setIsProcessing(true);
        try {
            const toMs = (val: string, unit: string) => {
                const n = parseFloat(val) || 0;
                const map: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
                return n * (map[unit] || 60000);
            };

            let resolvedStartDate: string | null = null;
            let resolvedEndDate: string | null = null;

            {
                const now = Date.now();
                if (customStartVal) {
                    const startMs = now + toMs(customStartVal, customStartUnit);
                    resolvedStartDate = new Date(startMs).toISOString();
                }
                if (customDurVal) {
                    const base = resolvedStartDate ? new Date(resolvedStartDate).getTime() : now;
                    resolvedEndDate = new Date(base + toMs(customDurVal, customDurUnit)).toISOString();
                }
            }

            const body = {
                title: assessTitle,
                description: '',
                duration: parseInt(assessDuration) || 60,
                type: mode === 'exams' ? 'exam' : mode === 'assignments' ? 'assignment' : 'test',
                category_id: assessCategoryId ? parseInt(assessCategoryId) : null,
                start_date: resolvedStartDate,
                end_date: resolvedEndDate,
                timer_mode: assessTimerMode,
                questions_count: parseInt(assessQuestionsCount) || 20,
                batch_size: parseInt(assessBatchSize) || 10,
                instructions: assessInstructions || null,
                material_id: assessmentMaterialIds[0] || null,
                material_ids: assessmentMaterialIds,
                due_date: (() => {
                    if (!assessWindowVal) return null;
                    const openMs = assessOpenVal ? toMs(assessOpenVal, assessOpenUnit) : 0;
                    const windowMs = toMs(assessWindowVal, assessWindowUnit);
                    return new Date(Date.now() + openMs + windowMs).toISOString();
                })(),
                submission_type: assessSubmType,
                allow_late: assessAllowLate,
                difficulty: assessDifficulty,
                blooms_level: assessBlooms,
                max_attempts: parseInt(assessMaxAttempts) || 1,
                is_pool: assessIsPool,
                pool_size: assessIsPool ? parseInt(assessPoolSize) || 40 : 0,
                professional_program_id: isProfessionalHub ? parseInt(assessProgramId) : null,
                professional_course_id: isProfessionalHub && assessCourseId ? parseInt(assessCourseId) : null,
                hub
            };

            const res = await fetch(withHub('/api/exams'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (res.ok) {
                addToast(data.message || 'Assessment created successfully', 'success');
                fetchRecords();
                setAssessTitle(''); setAssessCategoryId(''); setAssessStartDate(''); setAssessStartTime('08:00'); setAssessEndDate(''); setAssessEndTime('18:00');
                setAssessInstructions(''); setAssessDuration('60'); setAssessQuestionsCount('20');
                setAssessBatchSize('10'); setAssessTimerMode('whole'); setSelectedHubResource(null); setSelectedMaterialResources([]);
                setAssessSubmType('file'); setAssessAllowLate(false);
                setAssessDifficulty('medium'); setAssessBlooms('mixed'); setAssessMaxAttempts('1');
                setAssessIsPool(false); setAssessPoolSize('40');
                setCustomStartVal(''); setCustomStartUnit('minutes'); setCustomDurVal(''); setCustomDurUnit('hours');
                setAssessCourseId('');
            } else {
                addToast(friendlyError({ message: data.error }, 'assessment'), 'error');
            }
        } catch (err: any) {
            addToast(friendlyError(err, 'assessment'), 'error');
        }
        setIsProcessing(false);
    };

    const loadSlots = async (examId: number) => {
        setViewingSlotsFor(examId);
        try {
            const res = await fetch(withHub(`/api/exams/${examId}/slots`), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setAssessSlots(Array.isArray(data) ? data : []);
        } catch {
            addToast('Failed to load slots', 'error');
        }
    };

    const resendSlotNotification = async (examId: number, slotId: number) => {
        setResendingSlotId(slotId);
        try {
            const res = await fetch(withHub(`/api/exams/${examId}/slots/${slotId}/resend`), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setAssessSlots(prev => prev.map(s => s.id === slotId ? { ...s, notification_status: 'sent', notification_sent: true } : s));
                addToast('Notification re-sent', 'success');
            } else {
                addToast(friendlyError({ message: data.error }, 'generic'), 'error');
            }
        } catch {
            addToast('Network error', 'error');
        }
        setResendingSlotId(null);
    };

    const deleteRecord = (id: number) => {
        setConfirmDialog({
            message: 'Delete this record? This cannot be undone.',
            onConfirm: async () => {
                try {
                    await fetch(withHub(`/api/exams/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    addToast('Deleted', 'info');
                    fetchRecords();
                } catch { addToast('Delete failed', 'error'); }
            }
        });
    };

    const togglePublish = async (id: number, current: string) => {
        const next = current === 'published' ? 'draft' : 'published';
        if (publishingId !== null) return; // prevent double-click
        setPublishingId(id);
        try {
            const res = await fetch(withHub(`/api/exams/${id}/publish`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ published_status: next }),
                // AI generation can take up to 60s — use a long timeout via signal
                signal: AbortSignal.timeout(90000)
            });
            const data = await res.json();
            if (!res.ok) {
                addToast(friendlyError({ message: data.error }, 'assessment'), 'error');
                return;
            }
            addToast(data.message || (next === 'published' ? 'Published — students can now see it' : 'Moved to draft'), 'success');
            fetchRecords();
        } catch (err: any) {
            if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                addToast('Publishing timed out. AI question generation is taking too long — please try again or check your material.', 'error');
            } else {
                addToast('Network error during publishing. Please try again.', 'error');
            }
        } finally {
            setPublishingId(null);
        }
    };

    const fetchAttendSessions = async () => {
        try {
            const res = await fetch(withHub('/api/attendance/sessions'), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setAttendSessions(Array.isArray(data) ? data : []);
        } catch { console.error('Failed to fetch attendance sessions'); }
    };

    const createAttendSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!attendTitle.trim() || !attendDate) return addToast('Title and date are required', 'error');
        if (isProfessionalHub && !attendProgramId) return addToast('Select a professional program for attendance', 'error');
        try {
            const res = await fetch(withHub('/api/attendance/sessions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    title: attendTitle,
                    course_code: attendCourseCode,
                    category_id: isProfessionalHub ? null : (attendCategoryId || null),
                    session_date: attendDate,
                    is_paid: isProfessionalHub ? false : attendIsPaid,
                    price: isProfessionalHub ? 0 : (parseInt(attendPrice) || 0),
                    professional_program_id: isProfessionalHub ? parseInt(attendProgramId) : null,
                    professional_course_id: isProfessionalHub && attendCourseId ? parseInt(attendCourseId) : null,
                    hub
                })
            });
            if (res.ok) {
                addToast('Session created', 'success');
                setAttendTitle(''); setAttendCourseCode(''); setAttendCategoryId(''); setAttendDate(''); setAttendIsPaid(false); setAttendPrice('0'); setAttendCourseId('');
                fetchAttendSessions();
            }
        } catch { addToast('Failed to create session', 'error'); }
    };

    const updateAttendSession = async (id: number, fields: any) => {
        try {
            await fetch(withHub(`/api/attendance/sessions/${id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(fields)
            });
            fetchAttendSessions();
        } catch { addToast('Update failed', 'error'); }
    };

    const deleteAttendSession = (id: number) => {
        setConfirmDialog({
            message: 'Delete this attendance session?',
            onConfirm: async () => {
                try {
                    await fetch(withHub(`/api/attendance/sessions/${id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    addToast('Session deleted', 'info');
                    fetchAttendSessions();
                } catch { addToast('Delete failed', 'error'); }
            }
        });
    };

    const loadRollCall = async (sessionId: number) => {
        setViewingRollFor(sessionId);
        try {
            const res = await fetch(withHub(`/api/attendance/sessions/${sessionId}/records`), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setRollRecords(Array.isArray(data) ? data : []);
        } catch { addToast('Failed to load roll call', 'error'); }
    };

    const loadSubmissions = async (examId: number) => {
        setViewingSubsFor(examId);
        try {
            const res = await fetch(withHub(`/api/assignments/${examId}/submissions`), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setSubmissions(Array.isArray(data) ? data : []);
        } catch { addToast('Failed to load submissions', 'error'); }
    };

    const gradeSubmission = async (subId: number) => {
        try {
            await fetch(withHub(`/api/assignments/submissions/${subId}/grade`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ grade: gradeInput, feedback: feedbackInput })
            });
            addToast('Graded', 'success');
            setGradingSubId(null);
            loadSubmissions(viewingSubsFor!);
        } catch { addToast('Grade failed', 'error'); }
    };

    // GAP 6: Load exam results for lecturer
    const loadExamResults = async (examId: number) => {
        setViewingResultsFor(examId);
        try {
            const res = await fetch(withHub(`/api/exams/${examId}/results`), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setExamResults(Array.isArray(data) ? data : []);
        } catch { addToast('Failed to load results', 'error'); }
    };

    const loadStudentAnswers = async (examId: number, studentId: number, name: string) => {
        setViewingAnswersFor({ examId, studentId, name });
        try {
            const res = await fetch(withHub(`/api/exams/${examId}/answers/${studentId}`), { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setStudentAnswers(Array.isArray(data) ? data : []);
        } catch { addToast('Failed to load answers', 'error'); }
    };

    const clearStudentResult = (examId: number, studentId: number) => {
        setConfirmDialog({
            message: "Clear this student's result? They will be able to retake.",
            onConfirm: async () => {
                try {
                    await fetch(withHub(`/api/exams/${examId}/results/${studentId}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    addToast('Result cleared', 'success');
                    loadExamResults(examId);
                } catch { addToast('Failed to clear result', 'error'); }
            }
        });
    };

    useEffect(() => {
        if (mode === 'attendance') fetchAttendSessions();
    }, [mode]);

    const updateSettings = async (itemId: number, isResource: boolean, settings: { price: number; is_available: boolean; is_paid: boolean }) => {
        try {
            const endpoint = withHub(isResource ? `/api/resources/${itemId}/settings` : `/api/exams/${itemId}/settings`);
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                addToast('Settings updated', 'success');
                if (isResource) {
                    if (mode === 'materials') fetchHubResources('material');
                    if (mode === 'records') fetchHubResources('audio');
                } else {
                    fetchRecords();
                }
            }
        } catch (err) {
            addToast('Update failed', 'error');
        }
    };

    const renderHeader = () => {
        const titles = {
            attendance: { title: 'Attendance Management', desc: 'Manage your student whitelist and track daily portal access logs.', icon: ClipboardList },
            tests: { title: 'CBT Assessment Suite', desc: 'Create AI-powered tests and track student performance in real-time.', icon: BrainCircuit },
            assignments: { title: 'Submission Manager', desc: 'Set academic tasks - management student submissions.', icon: FileUp },
            exams: { title: 'Proctored Exam Console', desc: 'Coordinate formal examinations with advanced security.', icon: GraduationCap },
            materials: { title: 'Lecture Material Manager', desc: 'Manage your uploaded materials, set prices, and control availability.', icon: BookOpen },
            records: { title: 'Lecture Record Repository', desc: 'Manage your voice/audio recordings, set monetization, and control access.', icon: Mic }
        };
        const current = titles[mode];
        const Icon = current.icon;
        const title = isProfessionalHub ? `Professional ${current.title}` : current.title;
        const desc = isProfessionalHub
            ? 'This professional hub is separated from the normal academic workspace.'
            : current.desc;

        return (
            <div className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Icon size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h2>
                        <p className="text-slate-500 font-medium">{desc}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderRecordControls = (r: any) => (
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            {!isProfessionalHub && <button onClick={() => updateSettings(r.id, false, { ...r, is_paid: !r.is_paid })}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${r.is_paid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {r.is_paid ? 'Paid' : 'Free'}
            </button>}
            {isProfessionalHub && <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-emerald-50 text-emerald-700">Program-priced</span>}
            {!isProfessionalHub && r.is_paid && (
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-slate-400">₦</span>
                    <input type="number" defaultValue={r.price}
                        onBlur={e => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black" />
                </div>
            )}
            <button
                onClick={() => togglePublish(r.id, r.published_status || 'draft')}
                disabled={publishingId !== null}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    publishingId === r.id
                        ? 'bg-indigo-500 text-white cursor-wait'
                        : r.published_status === 'published'
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-amber-400 text-white hover:bg-amber-500'
                } disabled:opacity-60`}
            >
                {publishingId === r.id ? (
                    <><Loader2 size={11} className="animate-spin" /> Generating…</>
                ) : r.published_status === 'published' ? (
                    '● Live'
                ) : (
                    '○ Draft'
                )}
            </button>
            {/* GAP 6: Results button — only for tests/exams (not assignments) */}
            {r.type !== 'assignment' && (
                <button onClick={() => loadExamResults(r.id)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
                    📊 Results
                </button>
            )}
            <button onClick={() => deleteRecord(r.id)}
                className="ml-auto p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                <Trash2 size={14} />
            </button>
        </div>
    );

    const renderAttendanceContent = () => (
        <div className="space-y-8 relative min-h-[600px]">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Create Session */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">Create Attendance Session</h3>
                    <p className="text-xs text-slate-400 mb-6">Each session is one class/lecture date. Students mark themselves present when the session is open.</p>
                    <form onSubmit={createAttendSession} className="space-y-4">
                        <input value={attendTitle} onChange={e => setAttendTitle(e.target.value)} required
                            placeholder="e.g. Week 5 — Introduction to Algorithms"
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400" />
                        <div className="grid grid-cols-2 gap-3">
                            <input value={attendCourseCode} onChange={e => setAttendCourseCode(e.target.value)}
                                placeholder="Course Code (e.g. CSC301)"
                                className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400" />
                            <select value={attendCategoryId} onChange={e => setAttendCategoryId(e.target.value)}
                                className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-blue-400">
                                <option value="">{isProfessionalHub ? 'Program Students' : 'All Categories'}</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        {renderProfessionalScopePicker('attendance')}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Session Date</label>
                            <input type="date" value={attendDate} onChange={e => setAttendDate(e.target.value)} required
                                className="w-full mt-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400" />
                        </div>
                        {!isProfessionalHub && <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">Paid Attendance</p>
                                    <p className="text-[10px] text-slate-400">Charge students to mark their attendance</p>
                                </div>
                                <button type="button" onClick={() => setAttendIsPaid(!attendIsPaid)}
                                    className={`w-12 h-6 rounded-full relative transition-all ${attendIsPaid ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${attendIsPaid ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                            {attendIsPaid && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="font-black text-slate-400">₦</span>
                                    <input type="number" value={attendPrice} onChange={e => setAttendPrice(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400" />
                                </div>
                            )}
                        </div>}
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all">
                            ＋ Create Session
                        </button>
                    </form>
                </div>

                {/* Session Statistics */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2">Attendance Sessions</h3>
                    {attendSessions.length === 0 && (
                        <div className="bg-white rounded-[2rem] p-12 border border-slate-200 text-center text-slate-400">
                            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">No sessions yet. Create your first one.</p>
                        </div>
                    )}
                    {attendSessions.map(s => (
                        <div key={s.id} className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 text-sm">{s.title}</p>
                                    <div className="flex gap-3 mt-1 flex-wrap">
                                        {s.course_code && <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{s.course_code}</span>}
                                        {s.category_name && <span className="text-[9px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">{s.category_name}</span>}
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(s.session_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-2xl font-black text-emerald-600">{s.present_count || 0}</span>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Present</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button onClick={() => updateAttendSession(s.id, { is_open: !s.is_open })}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${s.is_open ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {s.is_open ? '🟢 Open' : '⭕ Closed'}
                                    </button>
                                    <button onClick={() => {
                                        if (s.is_paid) {
                                            updateAttendSession(s.id, { is_paid: false, price: 0 });
                                            setSessionPriceInputs(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                                        } else {
                                            setAttendSessions(prev => prev.map(x => x.id === s.id ? { ...x, is_paid: true } : x));
                                            if (!(s.id in sessionPriceInputs)) setSessionPriceInputs(prev => ({ ...prev, [s.id]: String(s.price || '') }));
                                        }
                                    }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${s.is_paid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {s.is_paid ? `Paid${s.price ? ' ₦' + s.price : ''}` : 'Free'}
                                    </button>
                                    <button onClick={() => loadRollCall(s.id)}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-[10px] font-black uppercase transition-all">
                                        Roll Call
                                    </button>
                                    <button onClick={() => deleteAttendSession(s.id)}
                                        className="ml-auto p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {s.is_paid && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={sessionPriceInputs[s.id] ?? String(s.price || '')}
                                            onChange={e => setSessionPriceInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                                            placeholder="Enter price"
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:border-indigo-400 transition-all"
                                        />
                                        <button onClick={() => {
                                            const price = parseInt(sessionPriceInputs[s.id] || '0') || 0;
                                            updateAttendSession(s.id, { is_paid: true, price });
                                            setSessionPriceInputs(prev => ({ ...prev, [s.id]: String(price) }));
                                        }} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap">
                                            <Save size={12} /> Save
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Roll Call Inline Page */}
            <AnimatePresence>
                {viewingRollFor !== null && (() => {
                    const session = attendSessions.find(s => s.id === viewingRollFor);
                    return (
                        <motion.div
                            key="rollcall"
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            className="absolute inset-0 bg-slate-50 z-50 overflow-y-auto"
                        >
                            {/* Top bar */}
                            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setViewingRollFor(null)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-black uppercase tracking-wider transition-all"
                                    >
                                        ← Back
                                    </button>
                                    <div>
                                        <p className="font-black text-slate-900 text-base">{session?.title}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {session?.course_code} · {session?.session_date ? new Date(session.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        setIsDownloadingRoll(true);
                                        try {
                                            const res = await fetch(withHub(`/api/attendance/sessions/${viewingRollFor}/records/pdf`), {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            if (!res.ok) throw new Error('Failed to generate PDF');
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `RollCall_${session?.title || 'session'}.pdf`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        } catch { addToast('Failed to download PDF', 'error'); }
                                        setIsDownloadingRoll(false);
                                    }}
                                    disabled={isDownloadingRoll}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-200"
                                >
                                    {isDownloadingRoll ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><DownloadIcon size={16} /> Download PDF</>}
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="p-6 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                                {[
                                    { label: 'Present', value: rollRecords.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                                    { label: 'Access', value: session?.is_paid ? `₦${(session.price || 0).toLocaleString()}` : 'Free', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                                    { label: 'Status', value: session?.is_open ? 'Open' : 'Closed', color: session?.is_open ? 'text-emerald-600' : 'text-rose-600', bg: session?.is_open ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' },
                                ].map((s, i) => (
                                    <div key={i} className={`rounded-2xl border p-4 ${s.bg}`}>
                                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Table */}
                            <div className="px-6 pb-10 max-w-3xl mx-auto">
                                <div className="bg-white rounded-[1.5rem] border border-slate-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900">
                                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Student Name</th>
                                                <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Matric No.</th>
                                                <th className="px-5 py-3.5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rollRecords.length === 0 && (
                                                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">No attendance recorded yet.</td></tr>
                                            )}
                                            {rollRecords.map((r, i) => (
                                                <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                    <td className="px-5 py-3 text-xs font-black text-slate-400">{i + 1}</td>
                                                    <td className="px-5 py-3 font-bold text-slate-900 text-sm">{r.student_name || r.name}</td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.matric_number || '—'}</td>
                                                    <td className="px-5 py-3 text-right text-xs text-slate-400">{new Date(r.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );

    const renderAssessmentBuilder = (isExam: boolean) => (
        <form onSubmit={handleCreateAssessment} className="space-y-5">
            {/* Title */}
            <input
                value={assessTitle} onChange={e => setAssessTitle(e.target.value)}
                required placeholder={isExam ? 'Examination Title' : 'Test Title'}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400"
            />

            {renderProfessionalScopePicker('assessment')}

            {/* Category + Questions Count */}
            <div className="grid grid-cols-2 gap-3">
                <select value={assessCategoryId} onChange={e => setAssessCategoryId(e.target.value)}
                    className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-blue-400">
                    <option value="">{isProfessionalHub ? 'Program Students' : 'Target Category (All)'}</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <input type="number" min="5" max={isExam ? 100 : 50} value={assessQuestionsCount}
                    onChange={e => setAssessQuestionsCount(e.target.value)}
                    placeholder={isExam ? 'No. of Questions (e.g. 50)' : 'No. of Questions (e.g. 20)'}
                    className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400"
                />
            </div>

            {/* Timer Mode */}
            <div className={`p-4 rounded-2xl border ${isExam ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isExam ? 'text-white/60' : 'text-slate-400'}`}>Timer Mode</p>
                <div className="flex gap-3">
                    <button type="button" onClick={() => setAssessTimerMode('whole')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${assessTimerMode === 'whole' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : isExam ? 'bg-white/10 border border-white/20 text-white/60' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        ⏱ Whole Test Timer
                    </button>
                    <button type="button" onClick={() => setAssessTimerMode('per_question')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${assessTimerMode === 'per_question' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : isExam ? 'bg-white/10 border border-white/20 text-white/60' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        ⚡ Per Question Timer
                    </button>
                </div>
                {assessTimerMode === 'whole' && (
                    <div className="mt-3">
                        <select value={assessDuration} onChange={e => setAssessDuration(e.target.value)}
                            className={`w-full px-5 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                            {(isExam ? [60,90,120,150,180] : [15,20,30,45,60,90]).map(m => (
                                <option key={m} value={m}>{m} Minutes</option>
                            ))}
                        </select>
                    </div>
                )}
                {assessTimerMode === 'per_question' && (
                    <div className="mt-3">
                        <select value={assessDuration} onChange={e => setAssessDuration(e.target.value)}
                            className={`w-full px-5 py-3 rounded-xl font-bold focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                            {(isExam ? [60,90,120] : [30,45,60,90,120]).map(s => (
                                <option key={s} value={s}>{s} Seconds per question</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Schedule Window */}
            <div className={`p-4 rounded-2xl border ${isExam ? 'bg-blue-500/20 border-blue-400/30' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isExam ? 'text-blue-300' : 'text-blue-600'}`}>📅 Schedule Window</p>

                <div className="space-y-3">
                    {/* Start offset */}
                    <div>
                        <label className={`text-[10px] font-black uppercase ml-1 mb-1 block ${isExam ? 'text-white/60' : 'text-slate-500'}`}>
                            Starts in
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                value={customStartVal}
                                onChange={e => setCustomStartVal(e.target.value)}
                                placeholder="e.g. 10"
                                className={`flex-1 px-4 py-3 rounded-xl font-black text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/30' : 'bg-white border border-slate-200 text-slate-700'}`}
                            />
                            <select
                                value={customStartUnit}
                                onChange={e => setCustomStartUnit(e.target.value as any)}
                                className={`px-3 py-3 rounded-xl font-black text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                            >
                                <option value="seconds">Seconds</option>
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                            </select>
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className={`text-[10px] font-black uppercase ml-1 mb-1 block ${isExam ? 'text-white/60' : 'text-slate-500'}`}>
                            Ends after (duration from start)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                value={customDurVal}
                                onChange={e => setCustomDurVal(e.target.value)}
                                placeholder="e.g. 2"
                                className={`flex-1 px-4 py-3 rounded-xl font-black text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/30' : 'bg-white border border-slate-200 text-slate-700'}`}
                            />
                            <select
                                value={customDurUnit}
                                onChange={e => setCustomDurUnit(e.target.value as any)}
                                className={`px-3 py-3 rounded-xl font-black text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                            >
                                <option value="seconds">Seconds</option>
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                            </select>
                        </div>
                    </div>

                    {/* Live preview */}
                    {(customStartVal || customDurVal) && (() => {
                        const toMs = (v: string, u: string) => {
                            const n = parseFloat(v) || 0;
                            const m: Record<string,number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
                            return n * (m[u] || 60000);
                        };
                        const now = Date.now();
                        const startMs = customStartVal ? now + toMs(customStartVal, customStartUnit) : now;
                        const endMs = customDurVal ? startMs + toMs(customDurVal, customDurUnit) : null;
                        const fmt = (ms: number) => new Date(ms).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
                        return (
                            <div className={`p-3 rounded-xl text-[10px] font-bold space-y-1 ${isExam ? 'bg-white/10 text-white/70' : 'bg-blue-100 text-blue-700'}`}>
                                <p>🟢 Starts: <span className="font-black">{customStartVal ? fmt(startMs) : 'immediately'}</span></p>
                                {endMs && <p>🔴 Ends: <span className="font-black">{fmt(endMs)}</span></p>}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Instructions to include in notification email */}
            <textarea value={assessInstructions} onChange={e => setAssessInstructions(e.target.value)}
                rows={3} placeholder="Instructions / warnings to include in the student notification email (optional)..."
                className={`w-full px-5 py-3.5 rounded-2xl font-bold text-sm focus:outline-none focus:border-blue-400 resize-none border ${isExam ? 'bg-white/10 border-white/20 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
            />

            {/* AI Settings — Difficulty + Bloom's + Max Attempts + Pool Mode */}
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">🤖 AI Question Settings</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Difficulty</label>
                        <select value={assessDifficulty} onChange={e => setAssessDifficulty(e.target.value as any)}
                            className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-blue-400">
                            <option value="easy">Easy — Recall & Recognition</option>
                            <option value="medium">Medium — Application & Analysis</option>
                            <option value="hard">Hard — Critical Thinking & Synthesis</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bloom's Taxonomy Focus</label>
                        <select value={assessBlooms} onChange={e => setAssessBlooms(e.target.value)}
                            className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-blue-400">
                            <option value="mixed">Mixed (Balanced)</option>
                            <option value="remember">Remember — Facts & Definitions</option>
                            <option value="understand">Understand — Concepts & Ideas</option>
                            <option value="apply">Apply — Solve Problems</option>
                            <option value="analyze">Analyze — Break Down & Compare</option>
                            <option value="evaluate">Evaluate — Justify & Critique</option>
                            <option value="create">Create — Design & Propose</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Max Attempts Per Student</label>
                        <input type="number" min="1" max="5" value={assessMaxAttempts} onChange={e => setAssessMaxAttempts(e.target.value)}
                            className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Question Pool Mode</label>
                        <div className="mt-1 flex items-center gap-3">
                            <button type="button" onClick={() => setAssessIsPool(p => !p)}
                                className={`px-3 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${assessIsPool ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                {assessIsPool ? '🎲 Pool ON' : '🎲 Pool OFF'}
                            </button>
                            {assessIsPool && (
                                <input type="number" min="20" value={assessPoolSize} onChange={e => setAssessPoolSize(e.target.value)}
                                    placeholder="Pool size (e.g. 60)"
                                    className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400" />
                            )}
                        </div>
                        {assessIsPool && <p className="text-[9px] text-slate-400 mt-1 ml-1">AI generates this many, each student draws {assessQuestionsCount} randomly</p>}
                    </div>
                </div>
            </div>

            {/* Link Material */}
            <div className="border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all border-slate-200 hover:border-blue-300 hover:bg-blue-50" onClick={handleOpenSelector}>
                <Database size={20} className="mx-auto mb-2 text-slate-400" />
                <p className="font-bold text-sm text-slate-500">
                    {selectedMaterialResources.length > 0
                        ? `📎 ${selectedMaterialResources.length} lecture material(s) linked`
                        : 'Link Lecture Materials (AI generates questions from all selected files)'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">AI reads every linked material before generating the final question set</p>
                {selectedMaterialResources.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {selectedMaterialResources.map(resource => (
                            <button
                                key={resource.id}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggleMaterialResource(resource);
                                }}
                                className="px-3 py-1 rounded-full bg-white border border-blue-100 text-[10px] font-black text-blue-700 hover:bg-blue-100 transition-all"
                                title="Remove material"
                            >
                                {resource.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button type="submit" disabled={isProcessing || selectedMaterialResources.length === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl disabled:opacity-40 transition-all shadow-xl">
                {isProcessing ? '⚙️ AI Generating Questions & Notifying Students...' : `🚀 Create ${isExam ? 'Examination' : 'Test'} & Schedule`}
            </button>
        </form>
    );

    const renderTestsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Builder */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Genius AI Test Builder</h3>
                    <p className="text-xs text-slate-400 mb-6">AI generates questions from your linked material. Students are auto-scheduled and notified.</p>
                    {renderAssessmentBuilder(false)}
                </div>

                {/* Records */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2">Test Records</h3>
                    {records.length === 0 && !isLoadingRecords && (
                        <div className="text-center py-16 text-slate-400 font-bold bg-white rounded-[2rem] border border-slate-200">No tests created yet.</div>
                    )}
                    {records.map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><BookOpen size={18} /></div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">{r.duration}m • {r.timer_mode === 'per_question' ? 'Per Q' : 'Whole'}</span>
                                            {r.start_date && <span className="text-[9px] font-black text-blue-500 uppercase">Scheduled</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {r.start_date && (
                                        <button onClick={() => loadSlots(r.id)}
                                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-all">
                                            Slots
                                        </button>
                                    )}
                                </div>
                            </div>
                            {r.start_date && (
                                <div className="text-[10px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2 flex gap-4">
                                    <span>📅 {new Date(r.start_date).toLocaleDateString()}</span>
                                    <span>→</span>
                                    <span>{new Date(r.end_date).toLocaleDateString()}</span>
                                    <span className="ml-auto">{r.questions_count}Q • {r.batch_size}/slot</span>
                                </div>
                            )}
                            {renderRecordControls(r)}
                        </div>
                    ))}
                </div>
            </div>

            {/* GAP 6: Results modal */}
            <AnimatePresence>
                {viewingResultsFor !== null && !viewingAnswersFor && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setViewingResultsFor(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
                                <h3 className="font-black text-slate-900">📊 Student Results</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const t = localStorage.getItem('token') || '';
                                            const a = document.createElement('a');
                                            a.href = withHub(`/api/transcripts/exam/${viewingResultsFor}?token=${encodeURIComponent(t)}`);
                                            (a as any).setAttribute('download', `class-report-${viewingResultsFor}.pdf`);
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                                    >
                                        <DownloadIcon size={12} /> Class Report
                                    </button>
                                    <button onClick={() => setViewingResultsFor(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
                                </div>
                            </div>
                            <div className="overflow-y-auto p-6 space-y-3">
                                {examResults.length === 0 && <p className="text-center text-slate-400 py-8">No submissions yet.</p>}
                                {examResults.map((r, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{r.student_name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{r.student_email}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-black text-lg text-slate-900">{r.score}%</p>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${r.grade === 'A+' || r.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : r.grade === 'B' ? 'bg-blue-100 text-blue-700' : r.grade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{r.grade}</span>
                                        </div>
                                        <div className="text-center hidden sm:block">
                                            <p className="text-xs text-slate-500">{r.total_earned}/{r.total_possible} pts</p>
                                            {r.risk_score > 0 && <p className="text-[10px] text-rose-500 font-bold">⚠️ Risk: {r.risk_score}</p>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => loadStudentAnswers(viewingResultsFor!, r.user_id, r.student_name)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all">
                                                Review
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const t = localStorage.getItem('token') || '';
                                                    const a = document.createElement('a');
                                                    a.href = withHub(`/api/transcripts/student/${r.user_id}?token=${encodeURIComponent(t)}`);
                                                    (a as any).setAttribute('download', `transcript-${r.student_name?.replace(/\s+/g,'-') || r.user_id}.pdf`);
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-all"
                                                title="Download student transcript PDF"
                                            >
                                                <DownloadIcon size={11} />
                                            </button>
                                            <button onClick={() => clearStudentResult(viewingResultsFor!, r.user_id)}
                                                className="px-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase hover:bg-rose-100 transition-all">
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Student answer review modal */}
            <AnimatePresence>
                {viewingAnswersFor !== null && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setViewingAnswersFor(null)}
                            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-900">Answer Review — {viewingAnswersFor.name}</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">{studentAnswers.filter(a => a.is_correct).length}/{studentAnswers.length} correct</p>
                                </div>
                                <button onClick={() => setViewingAnswersFor(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
                            </div>
                            <div className="overflow-y-auto p-6 space-y-4">
                                {studentAnswers.map((a, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border ${a.is_correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                                        <p className="font-bold text-slate-900 text-sm mb-2">Q{i + 1}: {a.question_text}</p>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <p><span className="font-black text-slate-500 uppercase">Student answered:</span> <span className={a.is_correct ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>{a.submitted_answer || '(No answer)'}</span></p>
                                            {!a.is_correct && <p><span className="font-black text-slate-500 uppercase">Correct answer:</span> <span className="text-emerald-700 font-bold">{a.correct_answer}</span></p>}
                                            <p className="text-slate-400">{a.is_correct ? `+${a.points_earned} pts` : `0 / ${a.max_points} pts`}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Slots viewer modal */}
            <AnimatePresence>
                {viewingSlotsFor !== null && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setViewingSlotsFor(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden max-h-[80vh] flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-black text-slate-900">Student Slots</h3>
                                <button onClick={() => setViewingSlotsFor(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
                            </div>
                            <div className="overflow-y-auto p-6 space-y-3">
                                {assessSlots.length === 0 && <p className="text-center text-slate-400 py-8">No slots found.</p>}
                                {assessSlots.map((slot, i) => (
                                    <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{slot.student_name || slot.student_email}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{slot.student_email}</p>
                                            <p className="text-xs font-bold text-blue-600 mt-0.5">{new Date(slot.scheduled_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                slot.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                slot.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                slot.status === 'missed' ? 'bg-rose-100 text-rose-700' :
                                                'bg-slate-100 text-slate-500'}`}>
                                                {slot.status || 'pending'}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                slot.notification_status === 'sent' ? 'bg-emerald-50 text-emerald-600' :
                                                slot.notification_status === 'failed' ? 'bg-rose-50 text-rose-600' :
                                                'bg-amber-50 text-amber-600'}`}>
                                                {slot.notification_status === 'sent' ? '✓ Notified' :
                                                 slot.notification_status === 'failed' ? '✗ Notify Failed' : '⏳ Not Sent'}
                                            </span>
                                            {slot.notification_status !== 'sent' && (
                                                <button
                                                    onClick={() => resendSlotNotification(viewingSlotsFor!, slot.id)}
                                                    disabled={resendingSlotId === slot.id}
                                                    className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-all disabled:opacity-50"
                                                >
                                                    {resendingSlotId === slot.id ? '...' : 'Send'}
                                                </button>
                                            )}
                                            {slot.notification_status === 'sent' && (
                                                <button
                                                    onClick={() => resendSlotNotification(viewingSlotsFor!, slot.id)}
                                                    disabled={resendingSlotId === slot.id}
                                                    className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all disabled:opacity-50"
                                                >
                                                    {resendingSlotId === slot.id ? '...' : 'Re-send'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );

    const renderAssignmentsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Assignment Builder */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">Assignment Builder</h3>
                    <p className="text-xs text-slate-400 mb-6">Assignments differ from tests — students write, upload or respond at their own pace within a deadline. No MCQ, no timer.</p>
                    <form onSubmit={handleCreateAssessment} className="space-y-4">
                        <input value={assessTitle} onChange={e => setAssessTitle(e.target.value)} required
                            placeholder="Assignment Title"
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400" />
                        {renderProfessionalScopePicker('assessment')}
                        <textarea value={assessInstructions} onChange={e => setAssessInstructions(e.target.value)}
                            placeholder="Full instructions / question / task description — this is what the student will read and respond to..."
                            rows={5}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:outline-none focus:border-blue-400 resize-none" />
                        <select value={assessCategoryId} onChange={e => setAssessCategoryId(e.target.value)}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-blue-400">
                            <option value="">{isProfessionalHub ? 'Program Students' : 'Target Category (All)'}</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        {/* Submission Deadline — schedule-window style */}
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-3">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">📅 Submission Deadline</p>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Opens in (from publish)</label>
                                <div className="flex gap-2">
                                    <input type="number" min="0" value={assessOpenVal} onChange={e => setAssessOpenVal(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 focus:outline-none focus:border-blue-400" />
                                    <select value={assessOpenUnit} onChange={e => setAssessOpenUnit(e.target.value as any)}
                                        className="px-3 py-3 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 focus:outline-none focus:border-blue-400">
                                        <option value="minutes">Minutes</option>
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Closes after (duration from opening)</label>
                                <div className="flex gap-2">
                                    <input type="number" min="1" value={assessWindowVal} onChange={e => setAssessWindowVal(e.target.value)}
                                        placeholder="e.g. 7"
                                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 focus:outline-none focus:border-blue-400" />
                                    <select value={assessWindowUnit} onChange={e => setAssessWindowUnit(e.target.value as any)}
                                        className="px-3 py-3 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 focus:outline-none focus:border-blue-400">
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                            </div>
                            {assessWindowVal && (
                                <p className="text-[10px] text-blue-500 font-bold ml-1">
                                    Deadline: {(() => {
                                        const toMsLocal = (v: string, u: string) => (parseFloat(v)||0) * ({minutes:60000,hours:3600000,days:86400000}[u]||3600000);
                                        const d = new Date(Date.now() + toMsLocal(assessOpenVal, assessOpenUnit) + toMsLocal(assessWindowVal, assessWindowUnit));
                                        return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
                                    })()}
                                </p>
                            )}
                        </div>

                        {/* Submission type */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">How do students submit?</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['file','text','both'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setAssessSubmType(t)}
                                        className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${assessSubmType === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                        {t === 'file' ? '📎 File Upload' : t === 'text' ? '✏️ Text Answer' : '🔀 Both'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <div>
                                <p className="font-bold text-slate-700 text-sm">Allow Late Submissions</p>
                                <p className="text-[10px] text-slate-400">Students can still submit after the deadline</p>
                            </div>
                            <button type="button" onClick={() => setAssessAllowLate(!assessAllowLate)}
                                className={`w-12 h-6 rounded-full relative transition-all ${assessAllowLate ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${assessAllowLate ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {/* Optional material attachment */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all" onClick={handleOpenSelector}>
                            <Database size={18} className="mx-auto mb-1 text-slate-400" />
                            <p className="font-bold text-slate-500 text-xs">
                                {selectedMaterialResources.length > 0
                                    ? `📎 ${selectedMaterialResources.length} lecture material(s) linked`
                                    : 'Attach lecture materials (optional AI assignment drafting)'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">Leave the instructions light and let AI draft the assignment from all linked materials if you want.</p>
                            {selectedMaterialResources.length > 0 && (
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                    {selectedMaterialResources.map(resource => (
                                        <button
                                            key={resource.id}
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleMaterialResource(resource);
                                            }}
                                            className="px-3 py-1 rounded-full bg-white border border-blue-100 text-[10px] font-black text-blue-700 hover:bg-blue-100 transition-all"
                                            title="Remove material"
                                        >
                                            {resource.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={isProcessing || !assessTitle.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl disabled:opacity-40 transition-all shadow-lg shadow-blue-200">
                            {isProcessing ? '⚙️ Creating...' : '🚀 Publish Assignment'}
                        </button>
                    </form>
                </div>

                {/* Assignment Records */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2">Assignment Records</h3>
                    {records.length === 0 && !isLoadingRecords && (
                        <div className="bg-white rounded-[2rem] p-12 border border-slate-200 text-center text-slate-400">
                            <FileUp size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">No assignments yet.</p>
                        </div>
                    )}
                    {records.map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><FileUp size={18} /></div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                                        <div className="flex gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">{r.submission_type || 'file'} submission</span>
                                            {r.due_date && <span className={`text-[9px] font-black uppercase ${new Date(r.due_date) < new Date() ? 'text-rose-500' : 'text-blue-500'}`}>
                                                Due: {new Date(r.due_date).toLocaleDateString()}
                                            </span>}
                                            {r.allow_late && <span className="text-[9px] font-black text-amber-500 uppercase">Late OK</span>}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => loadSubmissions(r.id)}
                                    className="px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-[9px] font-black uppercase transition-all shrink-0">
                                    Submissions
                                </button>
                            </div>
                            {r.instructions && (
                                <p className="text-xs text-slate-500 line-clamp-2 px-1">{r.instructions}</p>
                            )}
                            {renderRecordControls(r)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Submissions Modal */}
            <AnimatePresence>
                {viewingSubsFor !== null && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setViewingSubsFor(null); setGradingSubId(null); }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b flex items-center justify-between">
                                <h3 className="font-black text-slate-900">Submissions — {records.find(r => r.id === viewingSubsFor)?.title}</h3>
                                <button onClick={() => { setViewingSubsFor(null); setGradingSubId(null); }} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-6 space-y-4">
                                {submissions.length === 0 && <p className="text-center text-slate-400 py-8">No submissions yet.</p>}
                                {submissions.map(s => (
                                    <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{s.student_name}</p>
                                                <p className="text-[10px] text-slate-400">{s.student_email} · {new Date(s.submitted_at).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {s.grade && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-lg">{s.grade}</span>}
                                                {s.file_name && (
                                                    <a href={withHub(`/api/assignments/submissions/${s.id}/file`)} target="_blank"
                                                        className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1">
                                                        <DownloadIcon size={12} /> {s.file_name}
                                                    </a>
                                                )}
                                                <button onClick={() => { setGradingSubId(s.id); setGradeInput(s.grade || ''); setFeedbackInput(s.feedback || ''); }}
                                                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-lg transition-all">Grade</button>
                                            </div>
                                        </div>
                                        {s.content && <p className="mt-3 text-sm text-slate-600 bg-white p-3 rounded-xl border border-slate-100">{s.content}</p>}
                                        {s.feedback && <p className="mt-2 text-xs text-slate-500 italic">Feedback: {s.feedback}</p>}

                                        {/* Inline grade form */}
                                        {gradingSubId === s.id && (
                                            <div className="mt-3 p-4 bg-white rounded-xl border border-blue-100 space-y-3">
                                                <div className="flex gap-3">
                                                    <input value={gradeInput} onChange={e => setGradeInput(e.target.value)}
                                                        placeholder="Grade (e.g. A, 85/100, Pass)"
                                                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400" />
                                                </div>
                                                <textarea value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)}
                                                    placeholder="Feedback to student..."
                                                    rows={2}
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400 resize-none" />
                                                <div className="flex gap-2">
                                                    <button onClick={() => gradeSubmission(s.id)}
                                                        className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all">Save Grade</button>
                                                    <button onClick={() => setGradingSubId(null)}
                                                        className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all">Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );

    const renderExamsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Exam Builder */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={28} /></div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Formal Exam Console</h3>
                            <p className="text-slate-400 text-xs mt-1">AI generates high-standard questions. Students are scheduled, proctored & auto-graded.</p>
                        </div>
                    </div>
                    {renderAssessmentBuilder(false)}
                </div>

                {/* Exam Records */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2">Examination Records</h3>
                    {records.length === 0 && !isLoadingRecords && (
                        <div className="text-center py-16 text-slate-400 font-bold bg-white rounded-[2rem] border border-slate-200">No examinations created yet.</div>
                    )}
                    {records.map((r, i) => (
                        <div key={i} className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-3 hover:border-blue-100 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm"><GraduationCap size={22} /></div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900">{r.title}</p>
                                    <div className="flex gap-3 mt-0.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{r.duration}m • {r.questions_count || '—'}Q • {r.timer_mode === 'per_question' ? 'Per Q' : 'Whole'}</span>
                                        {r.start_date && <span className="text-[9px] font-black text-blue-500 uppercase">Scheduled {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                {r.start_date && (
                                    <button onClick={() => loadSlots(r.id)}
                                        className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-100 transition-all">
                                        View Slots
                                    </button>
                                )}
                            </div>
                            {renderRecordControls(r)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderMaterialsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {hubResources.filter(r => r.type === 'material').length === 0 && (
                    <div className="lg:col-span-2 bg-white rounded-[2rem] p-12 text-center border border-slate-200 grayscale opacity-40">
                         <BookOpen size={48} className="mx-auto mb-4" />
                         <p className="font-bold">No lecture materials uploaded in the Hub yet.</p>
                         <p className="text-sm">Upload materials in the "Resource Hub" first.</p>
                    </div>
                )}
                
                {hubResources.filter(r => r.type === 'material').map((item) => (
                    <motion.div 
                        key={item.id}
                        layout
                        className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm hover:border-blue-200 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 uppercase tracking-tight">{item.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Material ID: {item.id}</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {item.is_available ? 'Public' : 'Hidden'}
                            </div>
                            <button 
                                onClick={() => {
                                    setPreviewFile(withHub(`/api/resources/${item.id}/download`));
                                    setPreviewName(item.name);
                                    setIsPreviewOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-all ml-2"
                                title="Preview Material"
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                            {isProfessionalHub ? (
                                <div className="col-span-2 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Program Access</p>
                                    <p className="text-xs text-emerald-700 font-bold mt-1">This material is unlocked through the program price set in Pro Hub.</p>
                                </div>
                            ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Access Policy</label>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => updateSettings(item.id, true, { ...item, is_paid: !item.is_paid } as any)}
                                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-bold border transition-all ${item.is_paid ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200'}`}
                                    >
                                        {item.is_paid ? 'Paid Access' : 'Free Access'}
                                    </button>
                                </div>
                            </div>
                            )}
                            
                            {!isProfessionalHub && item.is_paid && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Download Price (₦)</label>
                                    <input 
                                        type="number"
                                        value={item.price}
                                        onBlur={(e) => updateSettings(item.id, true, { ...item, price: parseInt(e.target.value) || 0 } as any)}
                                        onChange={(e) => {
                                            // Local state update would be better but let's stick to updateSettings on blur
                                        }}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-blue-400 transition-all"
                                    />
                                </div>
                            )}

                            <div className="col-span-2 pt-4">
                                <button 
                                    onClick={() => updateSettings(item.id, true, { ...item, is_available: !item.is_available } as any)}
                                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${item.is_available ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-200'}`}
                                >
                                    {item.is_available ? 'Disable Student Access' : 'Authorize Student Access'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );

    const renderRecordsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {hubResources.filter(r => r.type === 'audio').length === 0 && (
                    <div className="lg:col-span-2 bg-white rounded-[2rem] p-12 text-center border border-slate-200 grayscale opacity-40">
                         <Volume2 size={48} className="mx-auto mb-4 text-rose-600" />
                         <p className="font-bold">No voice/audio records found in the Hub.</p>
                         <p className="text-sm">Upload audio records in the "Resource Hub" first.</p>
                    </div>
                )}
                
                {hubResources.filter(r => r.type === 'audio').map((item) => (
                    <motion.div 
                        key={item.id}
                        layout
                        className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm hover:border-rose-200 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
                                    <Volume2 size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 uppercase tracking-tight">{item.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Record ID: {item.id}</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {item.is_available ? 'Active' : 'Private'}
                            </div>
                            <button 
                                onClick={() => {
                                    setPreviewFile(withHub(`/api/resources/${item.id}/download`));
                                    setPreviewName(item.name);
                                    setIsPreviewOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 transition-all ml-2"
                                title="Listen to Record"
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        <div className="pt-6 border-t border-slate-50 space-y-4">
                            {isProfessionalHub ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Program Access</p>
                                    <p className="text-xs text-emerald-700 font-bold mt-1">This audio record is unlocked through the program price set in Pro Hub.</p>
                                </div>
                            ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Access Status</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            updateSettings(item.id, true, { ...item, is_paid: false, price: 0 } as any);
                                            setAudioPriceInputs(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                        }}
                                        className={`flex-1 py-3 px-3 rounded-xl text-[10px] font-bold border transition-all ${!item.is_paid ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}
                                    >
                                        Free
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Just flip UI to paid — don't save yet
                                            setHubResources(prev => prev.map(r => r.id === item.id ? { ...r, is_paid: true } : r));
                                            if (!(item.id in audioPriceInputs)) {
                                                setAudioPriceInputs(prev => ({ ...prev, [item.id]: String(item.price || '') }));
                                            }
                                        }}
                                        className={`flex-1 py-3 px-3 rounded-xl text-[10px] font-bold border transition-all ${item.is_paid ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-200'}`}
                                    >
                                        Paid
                                    </button>
                                </div>
                            </div>
                            )}

                            {!isProfessionalHub && item.is_paid && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Monetization (₦)</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="number"
                                                min="0"
                                                value={audioPriceInputs[item.id] ?? String(item.price || '')}
                                                onChange={(e) => setAudioPriceInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="Enter price"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-rose-400 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const price = parseInt(audioPriceInputs[item.id] || '0') || 0;
                                                updateSettings(item.id, true, { ...item, is_paid: true, price } as any);
                                                setAudioPriceInputs(prev => ({ ...prev, [item.id]: String(price) }));
                                            }}
                                            className="flex items-center gap-1.5 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap"
                                        >
                                            <Save size={12} /> Save Price
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => updateSettings(item.id, true, { ...item, is_available: !item.is_available } as any)}
                                className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${item.is_available ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-200'}`}
                            >
                                {item.is_available ? 'Set Record Private' : 'Publish to Students'}
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );

    return (
        <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-12">
            {renderHeader()}
            <AnimatePresence mode="wait">
                {mode === 'attendance' && <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAttendanceContent()}</motion.div>}
                {mode === 'tests' && <motion.div key="tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderTestsContent()}</motion.div>}
                {mode === 'assignments' && <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAssignmentsContent()}</motion.div>}
                {mode === 'exams' && <motion.div key="exams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderExamsContent()}</motion.div>}
                {mode === 'materials' && <motion.div key="materials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderMaterialsContent()}</motion.div>}
                {mode === 'records' && <motion.div key="records" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderRecordsContent()}</motion.div>}
            </AnimatePresence>

            <AnimatePresence>
                {showResourceSelector && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden">
                            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-xl">{isAssessmentMaterialSelector ? 'Select Lecture Materials' : 'Select Resource'}</h3>
                                    {isAssessmentMaterialSelector && (
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                                            {selectedMaterialResources.length} selected for AI
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => setShowResourceSelector(false)}><MoreHorizontal /></button>
                            </div>
                            <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
                                {hubResources.map(res => {
                                    const isSelected = selectedMaterialResources.some(item => item.id === res.id);
                                    const isUnfit = isAssessmentMaterialSelector && res.type === 'material' && res.ai_fitness_status === 'unfit';
                                    const isChecking = isAssessmentMaterialSelector && res.type === 'material' && res.ai_fitness_status === 'checking';
                                    const unfitReason = res.ai_fitness_reason || 'This material cannot be used to set up assessments.';
                                    return (
                                    <div
                                        key={res.id}
                                        onClick={() => {
                                            if (isUnfit || isChecking) return;
                                            isAssessmentMaterialSelector ? toggleMaterialResource(res) : selectSingleResource(res);
                                        }}
                                        className={`p-4 rounded-2xl flex flex-col gap-1 border transition-all ${
                                            isUnfit
                                                ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                                : isChecking
                                                    ? 'bg-amber-50 border-amber-100 opacity-70 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-blue-50 border-blue-200 cursor-pointer'
                                                        : 'bg-slate-50 border-transparent hover:bg-blue-50 cursor-pointer group'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                {res.type === 'roster' ? <Users size={18} className={isUnfit ? 'text-slate-400' : ''} /> : <FileText size={18} className={isUnfit ? 'text-slate-400' : ''} />}
                                                <span className={`font-bold text-sm ${isUnfit ? 'text-slate-400' : ''}`}>{res.name}</span>
                                            </div>
                                            {isChecking ? (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Checking…</span>
                                            ) : isUnfit ? (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Unfit</span>
                                            ) : (
                                                <CheckCircle className={`text-emerald-500 transition-all ${isAssessmentMaterialSelector ? (isSelected ? 'opacity-100' : 'opacity-20 group-hover:opacity-70') : 'opacity-0 group-hover:opacity-100'}`} />
                                            )}
                                        </div>
                                        {isUnfit && (
                                            <p className="text-[11px] text-red-400 leading-snug pl-7">{unfitReason}</p>
                                        )}
                                        {isChecking && (
                                            <p className="text-[11px] text-amber-500 leading-snug pl-7">AI fitness check in progress — check back shortly.</p>
                                        )}
                                    </div>
                                )})}
                                {hubResources.length === 0 && <p className="text-center py-10 text-slate-400">No resources found.</p>}
                            </div>
                            {isAssessmentMaterialSelector && (
                                <div className="p-6 border-t bg-slate-50 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowResourceSelector(false)}
                                        className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-white transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmMaterialSelection}
                                        className="flex-1 px-4 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all"
                                    >
                                        Use Selected
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    fileName={previewName}
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}

            {/* ── Inline Confirmation Dialog ── */}
            <AnimatePresence>
                {confirmDialog && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setConfirmDialog(null)}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            className="relative z-10 bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm text-center">
                            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <p className="font-bold text-slate-900 text-base mb-6">{confirmDialog.message}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDialog(null)}
                                    className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                                    className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-black text-sm hover:bg-rose-700 transition-all"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
