import React, { useState } from 'react';
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
    Calendar,
    Clock,
    AlertCircle,
    BookOpen,
    ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastType } from './ToastSystem';

interface AcademicManagementProps {
    mode: 'attendance' | 'tests' | 'assignments' | 'exams';
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function AcademicManagement({ mode, addToast, token }: AcademicManagementProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const renderHeader = () => {
        const titles = {
            attendance: { title: 'Attendance Management', desc: 'Manage your student whitelist and track daily portal access logs.', icon: ClipboardList },
            tests: { title: 'CBT Assessment Suite', desc: 'Create AI-powered tests and track student performance in real-time.', icon: BrainCircuit },
            assignments: { title: 'Submission Manager', desc: 'Set academic tasks, upload resources, and manage student submissions.', icon: FileUp },
            exams: { title: 'Proctored Exam Console', desc: 'Coordinate formal examinations with advanced security and risk analysis.', icon: GraduationCap }
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
                {/* Roster Management */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Student Whitelist</h3>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Upload matriculation numbers to authorize specific students for this session.</p>
                    
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-blue-50 transition-all cursor-pointer group mb-6">
                        <Upload className="mx-auto text-slate-300 group-hover:text-blue-500 mb-4 transition-colors" size={32} />
                        <p className="font-bold text-slate-700">Drop roster file here</p>
                        <p className="text-xs text-slate-400 mt-1">Supports .csv or .xlsx members (Max 5,000 students)</p>
                    </div>

                    <div className="flex gap-3">
                        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                            <Plus size={18} /> Update Roster
                        </button>
                        <button className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                             <FileDown size={18} />
                        </button>
                    </div>
                </div>

                {/* Attendance Summary */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>
                    <h3 className="text-xl font-bold text-slate-900 mb-6 relative z-10">Access Statistics</h3>
                    
                    <div className="space-y-6 relative z-10">
                        {[
                            { label: 'Authorized Students', value: '452', color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Active Today', value: '389', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Pending Access', value: '12', color: 'text-amber-600', bg: 'bg-amber-50' }
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                                <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Attendance List */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="text-blue-600" size={20} /> Today's Log
                    </h3>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                placeholder="Search student..." 
                                className="pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-400 w-full md:w-64 transition-all"
                            />
                        </div>
                        <button className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                             <Filter size={18} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 px-8 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Matric Number</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Punch In</th>
                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Device</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xs shadow-sm">
                                                JD
                                            </div>
                                            <p className="font-bold text-slate-900">John Doe {i}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 font-mono text-xs font-bold text-slate-600">2021/ENG/00{i}</td>
                                    <td className="px-4 py-5 text-sm font-medium text-slate-500">08:42 AM</td>
                                    <td className="px-4 py-5 text-sm font-medium text-slate-500">iPhone 13 Pro</td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">Verified</span>
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
                {/* AI Test Creator */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Genius AI Builder</h3>
                        <p className="text-sm text-slate-500 mb-6 font-medium">Upload a course material and let our Neural AI generate a multi-choice assessment for you.</p>
                        
                        <div className="space-y-4 mb-6">
                            <input 
                                placeholder="Assessment Title (e.g. Mid-Term Quiz)"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                            <div className="flex gap-3">
                                <select className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer">
                                    <option>20 Questions</option>
                                    <option>50 Questions</option>
                                    <option>100 Questions</option>
                                </select>
                                <select className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer">
                                    <option>30 Minutes</option>
                                    <option>60 Minutes</option>
                                    <option>2 Hours</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:bg-slate-50 transition-all cursor-pointer group mb-6">
                            <Plus className="mx-auto text-slate-300 group-hover:text-blue-500 mb-3" size={24} />
                            <p className="font-bold text-slate-700 text-sm">Upload Material (.pdf)</p>
                        </div>

                        <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                             <BrainCircuit size={18} /> Initiate AI Generation
                        </button>
                    </div>
                </div>

                {/* Test Records */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2 px-2">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Assessments</h3>
                        <button className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">View All</button>
                    </div>
                    {[
                        { title: 'Intro to Quantum Computing', questions: 30, takers: 124, date: 'Today' },
                        { title: 'Data Structures MCQ', questions: 50, takers: 89, date: 'Yesterday' },
                        { title: 'Digital Logic Quiz', questions: 20, takers: 156, date: '2 days ago' }
                    ].map((test, i) => (
                        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <BookOpen size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{test.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold text-slate-400">{test.questions} Qs</span>
                                        <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                        <span className="text-[10px] font-bold text-slate-400">{test.takers} Students</span>
                                    </div>
                                </div>
                            </div>
                            <button className="p-2 text-slate-300 hover:text-slate-600">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderAssignmentsContent = () => (
        <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-10">
                    <div className="md:w-1/3">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">New Task Dispatch</h3>
                        <p className="text-sm text-slate-500 mb-6 font-medium">Create and distribute academic assignments with automated deadline enforcement.</p>
                        
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                                <AlertCircle className="text-blue-600 shrink-0" size={20} />
                                <p className="text-xs font-bold text-blue-900">Ensure the resource material contains clear instructions for AI validation.</p>
                            </div>
                            <img src="/gmijp-logo.png" alt="Genius" className="w-12 h-12 opacity-20 mx-auto mt-8 hidden md:block" />
                        </div>
                    </div>
                    <div className="flex-1 space-y-5">
                        <input placeholder="Assignment Title" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                        <textarea placeholder="Instruction / Context" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 min-h-[120px] resize-none" />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input type="date" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                            </div>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input type="time" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg shadow-blue-200 transition-all">
                                <Plus size={18} /> Dispatch Task
                            </button>
                            <button className="px-8 bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
                                <Upload size={18} /> Upload Resource
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Active Submissions</h3>
                 <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { title: 'Algorithm Analysis', count: 42, total: 452, status: 'In Progress' },
                        { title: 'Project Proposal', count: 124, total: 452, status: 'Closed' },
                        { title: 'Weekly Journal', count: 389, total: 452, status: 'Active' }
                    ].map((item, i) => (
                        <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 group hover:border-blue-300 transition-all">
                            <div className="flex justify-between mb-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400">
                                    <FileUp size={20} />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'Closed' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {item.status}
                                </span>
                            </div>
                            <p className="font-bold text-slate-900 mb-4">{item.title}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(j => <div key={j} className="w-6 h-6 rounded-full border-2 border-white bg-blue-500"></div>)}
                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold">+{item.count}</div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400">{Math.round((item.count/item.total)*100)}% Submit</p>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );

    const renderExamsContent = () => (
        <div className="space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600 rounded-full blur-[120px] -mr-48 -mt-48 opacity-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/40">
                        <ShieldCheck size={48} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-3xl font-black mb-2 tracking-tight">Formal Examination Console</h3>
                        <p className="text-slate-400 font-medium max-w-xl">Configure final assessments with active proctoring, AI risk scoring, and student whitelist enforcement.</p>
                    </div>
                    <div className="shrink-0">
                         <button className="bg-white text-slate-900 font-black px-10 py-5 rounded-2xl hover:scale-105 transition-all shadow-xl">
                            Create New Session
                         </button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { label: 'Exams Conducted', value: '24', icon: CheckCircle, color: 'text-blue-600' },
                    { label: 'Average Risk Score', value: '02%', icon: AlertCircle, color: 'text-emerald-600' },
                    { label: 'Pending Results', value: '03', icon: Clock, color: 'text-amber-600' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                        <stat.icon className={`mb-6 ${stat.color}`} size={32} />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-4xl font-black text-slate-900 mt-2">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">Examination History</h3>
                    <button className="bg-slate-50 text-slate-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-slate-100 transition-all">Download Reports</button>
                </div>
                <div className="p-8">
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <GraduationCap className="text-slate-300" size={32} />
                        </div>
                        <h4 className="text-xl font-bold text-slate-800">No recent exam sessions</h4>
                        <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">Create your first examination session to start collecting proctored assessment data.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <motion.div 
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-12"
        >
            {renderHeader()}
            
            <AnimatePresence mode="wait">
                {mode === 'attendance' && <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAttendanceContent()}</motion.div>}
                {mode === 'tests' && <motion.div key="tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderTestsContent()}</motion.div>}
                {mode === 'assignments' && <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderAssignmentsContent()}</motion.div>}
                {mode === 'exams' && <motion.div key="exams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{renderExamsContent()}</motion.div>}
            </AnimatePresence>
        </motion.div>
    );
}
