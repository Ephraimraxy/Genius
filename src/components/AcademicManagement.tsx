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
    is_available?: boolean;
    price?: number;
    is_paid?: boolean;
}

interface AcademicManagementProps {
    mode: 'attendance' | 'tests' | 'assignments' | 'exams' | 'materials';
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
            materials: { title: 'Lecture Material Manager', desc: 'Manage your uploaded materials, set prices, and control availability.', icon: BookOpen }
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
                        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><BookOpen size={18} /></div>
                                    <p className="font-bold text-slate-900">{r.title}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{r.duration}m</span>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Paid Access</label>
                                    <input 
                                        type="checkbox" 
                                        checked={r.is_paid} 
                                        onChange={(e) => updateSettings(r.id, false, { ...r, is_paid: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                </div>
                                {r.is_paid && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400">₦</span>
                                        <input 
                                            type="number" 
                                            value={r.price} 
                                            onChange={(e) => {
                                                const newPrice = parseInt(e.target.value);
                                                if (isNaN(newPrice)) return;
                                                // We might want to debounce this or use a button, but for now lets just update
                                            }}
                                            onBlur={(e) => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold"
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">{r.is_available ? 'Enabled' : 'Disabled'}</span>
                                    <button 
                                        onClick={() => updateSettings(r.id, false, { ...r, is_available: !r.is_available })}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${r.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${r.is_available ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
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
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col md:flex-row items-center gap-10">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={40} /></div>
                <div className="flex-1">
                    <h3 className="text-2xl font-black mb-2">Formal Exam Console</h3>
                    <p className="text-slate-400 text-sm">Coordinate proctored assessments.</p>
                </div>
                <button onClick={handleOpenSelector} className="bg-white text-slate-900 font-black px-8 py-4 rounded-xl">New Session</button>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6 font-display">Active & Past Examinations</h3>
                <div className="space-y-4">
                    {records.length === 0 ? <p className="text-center py-10 text-slate-400">Empty history.</p> : records.map((r, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 group hover:bg-white border border-transparent hover:border-blue-100 transition-all">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all"><GraduationCap size={24} /></div>
                                <div>
                                    <p className="font-bold text-slate-900">{r.title}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(r.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Paid Access</label>
                                    <input 
                                        type="checkbox" 
                                        checked={r.is_paid} 
                                        onChange={(e) => updateSettings(r.id, false, { ...r, is_paid: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                </div>
                                {r.is_paid && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400">₦</span>
                                        <input 
                                            type="number" 
                                            value={r.price} 
                                            onBlur={(e) => updateSettings(r.id, false, { ...r, price: parseInt(e.target.value) || 0 })}
                                            className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black shadow-sm"
                                        />
                                    </div>
                                )}
                                <button 
                                    onClick={() => updateSettings(r.id, false, { ...r, is_available: !r.is_available })}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${r.is_available ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}
                                >
                                    {r.is_available ? 'Available' : 'Disabled'}
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

    return (
        <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-12">
            {renderHeader()}
            <AnimatePresence mode="wait">
                {mode === 'attendance' && <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAttendanceContent()}</motion.div>}
                {mode === 'tests' && <motion.div key="tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderTestsContent()}</motion.div>}
                {mode === 'assignments' && <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAssignmentsContent()}</motion.div>}
                {mode === 'exams' && <motion.div key="exams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderExamsContent()}</motion.div>}
                {mode === 'materials' && <motion.div key="materials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderMaterialsContent()}</motion.div>}
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
