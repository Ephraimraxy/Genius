import React, { useState, useEffect } from 'react';
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
    Download as DownloadIcon
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
}

interface AcademicManagementProps {
    mode: 'attendance' | 'tests' | 'assignments' | 'exams' | 'materials' | 'records';
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function AcademicManagement({ mode, addToast, token }: AcademicManagementProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showResourceSelector, setShowResourceSelector] = useState(false);
    const [hubResources, setHubResources] = useState<Resource[]>([]);
    const [isLoadingHub, setIsLoadingHub] = useState(false);
    const [selectedHubResource, setSelectedHubResource] = useState<Resource | null>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | string | null>(null);
    const [previewName, setPreviewName] = useState<string>('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [categories, setCategories] = useState<{id: number, name: string}[]>([]);

    // Assessment builder state
    const [assessTitle, setAssessTitle] = useState('');
    const [assessCategoryId, setAssessCategoryId] = useState('');
    const [assessDuration, setAssessDuration] = useState('60');
    const [assessTimerMode, setAssessTimerMode] = useState<'whole' | 'per_question'>('whole');
    const [assessQuestionsCount, setAssessQuestionsCount] = useState('20');
    const [assessBatchSize, setAssessBatchSize] = useState('10');
    const [assessStartDate, setAssessStartDate] = useState('');
    const [assessEndDate, setAssessEndDate] = useState('');
    const [assessInstructions, setAssessInstructions] = useState('');
    const [assessSlots, setAssessSlots] = useState<any[]>([]);
    const [viewingSlotsFor, setViewingSlotsFor] = useState<number | null>(null);

    useEffect(() => {
        if (token) {
            fetch('/api/courses/categories', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => { if(Array.isArray(data)) setCategories(data); })
                .catch(console.error);
        }
    }, [token]);

    const fetchRecords = async () => {
        setIsLoadingRecords(true);
        try {
            const res = await fetch('/api/academic/tests', {
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
            const res = await fetch(`/api/resources/${id}`, {
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
            const res = await fetch('/api/resources', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setHubResources(data.filter((r: Resource) => r.type === type && r.status === 'ready'));
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
    }, [mode]);

    const handleOpenSelector = () => {
        const type = mode === 'attendance' ? 'roster' : 'material';
        fetchHubResources(type);
        setShowResourceSelector(true);
    };

    const selectResource = (res: Resource) => {
        setSelectedHubResource(res);
        setShowResourceSelector(false);
        addToast(`Linked to resource: ${res.name}`, 'success');
        if (res.type === 'roster') {
            fetchHubResourceContent(res.id);
        }
    };

    const handleCreateAssessment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assessTitle.trim()) return addToast('Please enter an assessment title', 'error');

        setIsProcessing(true);
        try {
            const body = {
                title: assessTitle,
                description: '',
                duration: parseInt(assessDuration) || 60,
                type: mode === 'exams' ? 'exam' : mode === 'assignments' ? 'assignment' : 'test',
                category_id: assessCategoryId ? parseInt(assessCategoryId) : null,
                start_date: assessStartDate || null,
                end_date: assessEndDate || null,
                timer_mode: assessTimerMode,
                questions_count: parseInt(assessQuestionsCount) || 20,
                batch_size: parseInt(assessBatchSize) || 10,
                instructions: assessInstructions || null,
                material_id: selectedHubResource?.id || null
            };

            const res = await fetch('/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (res.ok) {
                addToast(data.message || 'Assessment created successfully', 'success');
                fetchRecords();
                setAssessTitle(''); setAssessCategoryId(''); setAssessStartDate(''); setAssessEndDate('');
                setAssessInstructions(''); setAssessDuration('60'); setAssessQuestionsCount('20');
                setAssessBatchSize('10'); setAssessTimerMode('whole'); setSelectedHubResource(null);
            } else {
                addToast(data.error || 'Failed to create assessment', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        }
        setIsProcessing(false);
    };

    const loadSlots = async (examId: number) => {
        setViewingSlotsFor(examId);
        try {
            const res = await fetch(`/api/exams/${examId}/slots`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setAssessSlots(Array.isArray(data) ? data : []);
        } catch {
            addToast('Failed to load slots', 'error');
        }
    };

    const updateSettings = async (itemId: number, isResource: boolean, settings: { price: number; is_available: boolean; is_paid: boolean }) => {
        try {
            const endpoint = isResource ? `/api/resources/${itemId}/settings` : `/api/exams/${itemId}/settings`;
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

        return (
            <div className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Icon size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{current.title}</h2>
                        <p className="text-slate-500 font-medium">{current.desc}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderAttendanceContent = () => {
        const rosterCategory = selectedHubResource && selectedHubResource.category_id 
            ? categories.find(c => c.id === selectedHubResource.category_id)?.name
            : null;
            
        return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Student Whitelist</h3>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Link a roster to authorize students.</p>
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-blue-50 transition-all cursor-pointer group mb-6" onClick={handleOpenSelector}>
                        <Upload className="mx-auto text-slate-300 group-hover:text-blue-500 mb-4" size={32} />
                        <p className="font-bold text-slate-700">{selectedHubResource ? selectedHubResource.name : 'Click to select roster'}</p>
                    </div>
                    <button onClick={handleOpenSelector} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg">
                        {selectedHubResource ? 'Change Roster' : 'Link Hub Roster'}
                    </button>
                </div>
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 font-display">Access Statistics</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-sm font-bold text-slate-500 uppercase">Authorized</span>
                            <span className="text-2xl font-black text-blue-600">{students.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-sm font-bold text-slate-500 uppercase">Active Today</span>
                            <span className="text-2xl font-black text-emerald-600">{students.length > 0 ? Math.floor(students.length * 0.8) : 0}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800">Student Roll Call</h3>
                    {rosterCategory && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-black uppercase tracking-widest rounded-lg">
                            {rosterCategory}
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matric Number</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length === 0 ? (
                                <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-400 font-bold">No roster linked.</td></tr>
                            ) : students.map((s, i) => (
                                <tr key={i} className="border-b border-slate-50">
                                    <td className="px-8 py-4 font-bold text-slate-900">{s.name || 'Anonymous'}</td>
                                    <td className="px-4 py-4 font-mono text-sm text-slate-600">{s.matricNumber}</td>
                                    <td className="px-8 py-4 text-right">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase">Awaiting</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        );
    };

    const renderAssessmentBuilder = (isExam: boolean) => (
        <form onSubmit={handleCreateAssessment} className="space-y-5">
            {/* Title */}
            <input
                value={assessTitle} onChange={e => setAssessTitle(e.target.value)}
                required placeholder={isExam ? 'Examination Title' : 'Test Title'}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-blue-400"
            />

            {/* Category + Questions Count */}
            <div className="grid grid-cols-2 gap-3">
                <select value={assessCategoryId} onChange={e => setAssessCategoryId(e.target.value)}
                    className="px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none focus:border-blue-400">
                    <option value="">Target Category (All)</option>
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

            {/* Time Window for Batch Scheduling */}
            <div className={`p-4 rounded-2xl border ${isExam ? 'bg-blue-500/20 border-blue-400/30' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isExam ? 'text-blue-300' : 'text-blue-600'}`}>📅 Exam Window (Batch Scheduling)</p>
                <p className={`text-[10px] mb-3 ${isExam ? 'text-white/50' : 'text-slate-500'}`}>Set a date range. The system will auto-split students into slots across this window and notify each student of their exact time.</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={`text-[10px] font-black uppercase ml-1 ${isExam ? 'text-white/50' : 'text-slate-400'}`}>Start Date & Time</label>
                        <input type="datetime-local" value={assessStartDate} onChange={e => setAssessStartDate(e.target.value)}
                            className={`w-full mt-1 px-4 py-3 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`} />
                    </div>
                    <div>
                        <label className={`text-[10px] font-black uppercase ml-1 ${isExam ? 'text-white/50' : 'text-slate-400'}`}>End Date & Time</label>
                        <input type="datetime-local" value={assessEndDate} onChange={e => setAssessEndDate(e.target.value)}
                            className={`w-full mt-1 px-4 py-3 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-slate-200 text-slate-700'}`} />
                    </div>
                </div>

                {/* Batch size */}
                {assessStartDate && assessEndDate && (
                    <div className="mt-3">
                        <label className={`text-[10px] font-black uppercase ml-1 ${isExam ? 'text-white/50' : 'text-slate-400'}`}>Students Per Slot</label>
                        <input type="number" min="1" max="50" value={assessBatchSize} onChange={e => setAssessBatchSize(e.target.value)}
                            className={`w-full mt-1 px-4 py-3 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-400 ${isExam ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/30' : 'bg-white border border-slate-200 text-slate-700'}`}
                            placeholder="e.g. 10 (students sharing same slot time)" />
                        <p className={`text-[10px] mt-1 ml-1 ${isExam ? 'text-white/40' : 'text-slate-400'}`}>
                            The system distributes students evenly — each group gets a unique start time within the window.
                        </p>
                    </div>
                )}
            </div>

            {/* Instructions to include in notification email */}
            <textarea value={assessInstructions} onChange={e => setAssessInstructions(e.target.value)}
                rows={3} placeholder="Instructions / warnings to include in the student notification email (optional)..."
                className={`w-full px-5 py-3.5 rounded-2xl font-bold text-sm focus:outline-none focus:border-blue-400 resize-none border ${isExam ? 'bg-white/10 border-white/20 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
            />

            {/* Link Material */}
            <div className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${isExam ? 'border-white/20 hover:border-blue-400 hover:bg-white/10' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`} onClick={handleOpenSelector}>
                <Database size={20} className={`mx-auto mb-2 ${isExam ? 'text-white/40' : 'text-slate-400'}`} />
                <p className={`font-bold text-sm ${isExam ? 'text-white/60' : 'text-slate-500'}`}>{selectedHubResource ? `📎 ${selectedHubResource.name}` : 'Link Lecture Material (AI generates questions from it)'}</p>
            </div>

            <button type="submit" disabled={isProcessing || !selectedHubResource}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl disabled:opacity-40 transition-all shadow-xl">
                {isProcessing ? '⚙️ Creating & Notifying Students...' : `🚀 Create ${isExam ? 'Examination' : 'Test'} & Schedule`}
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
                            <div className="pt-2 border-t border-slate-50 flex items-center gap-3 flex-wrap">
                                <button onClick={() => updateSettings(r.id, false, { ...r, is_paid: !r.is_paid })}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${r.is_paid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {r.is_paid ? 'Paid' : 'Free'}
                                </button>
                                {r.is_paid && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-black text-slate-400">₦</span>
                                        <input type="number" defaultValue={r.price}
                                            onBlur={e => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold" />
                                    </div>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">{r.is_available ? 'Live' : 'Hidden'}</span>
                                    <button onClick={() => updateSettings(r.id, false, { ...r, is_available: !r.is_available })}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${r.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${r.is_available ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

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
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{slot.student_name || slot.student_email}</p>
                                            <p className="text-[10px] text-slate-400">{slot.student_email}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-blue-600">{new Date(slot.scheduled_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                slot.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                slot.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                slot.status === 'missed' ? 'bg-rose-100 text-rose-700' :
                                                'bg-slate-100 text-slate-500'}`}>
                                                {slot.status}
                                            </span>
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
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Task Dispatch</h3>
                <form onSubmit={handleCreateAssessment} className="space-y-4">
                    <input name="title" required placeholder="Assignment Title" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    <textarea name="description" placeholder="Instructions" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold min-h-[100px]" />
                    <select name="category_id" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-600 mb-4 cursor-pointer">
                        <option value="">Target Category (All)</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <div className="flex gap-4">
                         <button type="submit" disabled={isProcessing} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl disabled:opacity-50">Dispatch</button>
                         <button type="button" onClick={handleOpenSelector} className="px-6 bg-slate-900 text-white rounded-2xl"><Database size={20} /></button>
                    </div>
                </form>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                {records.map((r, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <p className="font-bold text-slate-900">{r.title}</p>
                            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                        </div>
                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Paid</label>
                                <input 
                                    type="checkbox" 
                                    checked={r.is_paid} 
                                    onChange={(e) => updateSettings(r.id, false, { ...r, is_paid: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                            {r.is_paid && (
                                <input 
                                    type="number" 
                                    value={r.price} 
                                    onBlur={(e) => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold"
                                />
                            )}
                            <button 
                                onClick={() => updateSettings(r.id, false, { ...r, is_available: !r.is_available })}
                                className={`w-10 h-5 rounded-full relative transition-colors ml-auto ${r.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${r.is_available ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderExamsContent = () => (
        <div className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Exam Builder */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={28} /></div>
                        <div>
                            <h3 className="text-xl font-black">Formal Exam Console</h3>
                            <p className="text-slate-400 text-xs mt-1">AI generates high-standard questions. Students are scheduled, proctored & auto-graded.</p>
                        </div>
                    </div>
                    <div className="[&_input]:!bg-white/10 [&_input]:!border-white/20 [&_input]:!text-white [&_input]:placeholder:!text-white/40 [&_select]:!bg-white/10 [&_select]:!border-white/20 [&_select]:!text-white [&_textarea]:!bg-white/10 [&_textarea]:!border-white/20 [&_textarea]:!text-white [&_textarea]:placeholder:!text-white/40">
                        {renderAssessmentBuilder(true)}
                    </div>
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
                            <div className="pt-2 border-t border-slate-50 flex items-center gap-3 flex-wrap">
                                <button onClick={() => updateSettings(r.id, false, { ...r, is_paid: !r.is_paid })}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${r.is_paid ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {r.is_paid ? 'Paid' : 'Free'}
                                </button>
                                {r.is_paid && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-black text-slate-400">₦</span>
                                        <input type="number" defaultValue={r.price}
                                            onBlur={e => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                                            className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black" />
                                    </div>
                                )}
                                <button onClick={() => updateSettings(r.id, false, { ...r, is_available: !r.is_available })}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ml-auto ${r.is_available ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    {r.is_available ? 'Live' : 'Hidden'}
                                </button>
                            </div>
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
                                    setPreviewFile(`/api/resources/${item.id}/download`);
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
                            
                            {item.is_paid && (
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
                                    setPreviewFile(`/api/resources/${item.id}/download`);
                                    setPreviewName(item.name);
                                    setIsPreviewOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 transition-all ml-2"
                                title="Listen to Record"
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Access Status</label>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => updateSettings(item.id, true, { ...item, is_paid: false } as any)}
                                        className={`flex-1 py-3 px-3 rounded-xl text-[10px] font-bold border transition-all ${!item.is_paid ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}
                                    >
                                        Free
                                    </button>
                                    <button 
                                        onClick={() => updateSettings(item.id, true, { ...item, is_paid: true } as any)}
                                        className={`flex-1 py-3 px-3 rounded-xl text-[10px] font-bold border transition-all ${item.is_paid ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-200'}`}
                                    >
                                        Paid
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Monetization (₦)</label>
                                <div className="relative">
                                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="number"
                                        disabled={!item.is_paid}
                                        value={item.price || 0}
                                        onBlur={(e) => updateSettings(item.id, true, { ...item, price: parseInt(e.target.value) || 0 } as any)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-rose-400 disabled:opacity-40 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="col-span-2 pt-4">
                                <button 
                                    onClick={() => updateSettings(item.id, true, { ...item, is_available: !item.is_available } as any)}
                                    className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${item.is_available ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-200'}`}
                                >
                                    {item.is_available ? 'Set Record Private' : 'Publish to Students'}
                                </button>
                            </div>
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
                                <h3 className="font-bold text-xl">Select Resource</h3>
                                <button onClick={() => setShowResourceSelector(false)}><MoreHorizontal /></button>
                            </div>
                            <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
                                {hubResources.map(res => (
                                    <div key={res.id} onClick={() => selectResource(res)} className="p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            {res.type === 'roster' ? <Users size={18} /> : <FileText size={18} />}
                                            <span className="font-bold text-sm">{res.name}</span>
                                        </div>
                                        <CheckCircle className="text-emerald-500 opacity-0 group-hover:opacity-100" />
                                    </div>
                                ))}
                                {hubResources.length === 0 && <p className="text-center py-10 text-slate-400">No resources found.</p>}
                            </div>
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
        </motion.div>
    );
}
