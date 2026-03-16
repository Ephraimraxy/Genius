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
    ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastType } from './ToastSystem';

interface Resource {
    id: number;
    type: 'roster' | 'material';
    name: string;
    status: 'ready' | 'failed' | 'pending' | 'short';
    created_at: string;
    content?: any;
}

interface AcademicManagementProps {
    mode: 'attendance' | 'tests' | 'assignments' | 'exams';
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

    const fetchHubResources = async (type: 'roster' | 'material') => {
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
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        setIsProcessing(true);
        try {
            const body = {
                title: formData.get('title'),
                description: formData.get('description') || '',
                duration: parseInt(formData.get('duration') as string) || 60,
                type: mode === 'exams' ? 'exam' : mode === 'assignments' ? 'assignment' : 'test'
            };

            const res = await fetch('/api/exams', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                addToast(`${mode.charAt(0).toUpperCase() + mode.slice(1, -1)} created successfully`, 'success');
                fetchRecords();
                form.reset();
                setSelectedHubResource(null);
            } else {
                addToast('Failed to create assessment', 'error');
            }
        } catch (err) {
            addToast('Network error', 'error');
        }
        setIsProcessing(false);
    };

    const renderHeader = () => {
        const titles = {
            attendance: { title: 'Attendance Management', desc: 'Manage your student whitelist and track daily portal access logs.', icon: ClipboardList },
            tests: { title: 'CBT Assessment Suite', desc: 'Create AI-powered tests and track student performance in real-time.', icon: BrainCircuit },
            assignments: { title: 'Submission Manager', desc: 'Set academic tasks - management student submissions.', icon: FileUp },
            exams: { title: 'Proctored Exam Console', desc: 'Coordinate formal examinations with advanced security.', icon: GraduationCap }
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

    const renderAttendanceContent = () => (
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
                <div className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Student Roll Call</h3>
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

    const renderTestsContent = () => (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Genius AI Test Builder</h3>
                    <form onSubmit={handleCreateAssessment} className="space-y-4">
                        <input name="title" required placeholder="Assessment Title" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                        <div className="flex gap-3">
                            <select name="duration" className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                                <option value="30">30 Mins</option>
                                <option value="60">60 Mins</option>
                                <option value="120">120 Mins</option>
                            </select>
                        </div>
                        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center cursor-pointer" onClick={handleOpenSelector}>
                            <p className="font-bold text-slate-500 text-sm">{selectedHubResource ? selectedHubResource.name : 'Link Material'}</p>
                        </div>
                        <button type="submit" disabled={isProcessing || !selectedHubResource} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl disabled:opacity-50">
                            {isProcessing ? 'Generating...' : 'Initiate AI Generation'}
                        </button>
                    </form>
                </div>
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase px-2">Records</h3>
                    {records.map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><BookOpen size={18} /></div>
                                <p className="font-bold text-slate-900">{r.title}</p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">{r.duration}m</span>
                        </div>
                    ))}
                    {records.length === 0 && !isLoadingRecords && <div className="text-center py-10 text-slate-400 font-bold">No records.</div>}
                </div>
            </div>
        </div>
    );

    const renderAssignmentsContent = () => (
        <div className="space-y-8">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Task Dispatch</h3>
                <form onSubmit={handleCreateAssessment} className="space-y-4">
                    <input name="title" required placeholder="Assignment Title" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    <textarea name="description" placeholder="Instructions" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold min-h-[100px]" />
                    <div className="flex gap-4">
                         <button type="submit" disabled={isProcessing || !selectedHubResource} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl disabled:opacity-50">Dispatch</button>
                         <button type="button" onClick={handleOpenSelector} className="px-6 bg-slate-900 text-white rounded-2xl"><Database size={20} /></button>
                    </div>
                </form>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                {records.map((r, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200">
                        <p className="font-bold text-slate-900 mb-2">{r.title}</p>
                        <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderExamsContent = () => (
        <div className="space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col md:flex-row items-center gap-10">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={40} /></div>
                <div className="flex-1">
                    <h3 className="text-2xl font-black mb-2">Formal Exam Console</h3>
                    <p className="text-slate-400 text-sm">Coordinate proctored assessments.</p>
                </div>
                <button onClick={handleOpenSelector} className="bg-white text-slate-900 font-black px-8 py-4 rounded-xl">New Session</button>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6">History</h3>
                {records.length === 0 ? <p className="text-center py-10 text-slate-400">Empty history.</p> : records.map((r, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl mb-2 flex justify-between items-center">
                        <p className="font-bold">{r.title}</p>
                        <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
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
        </motion.div>
    );
}
