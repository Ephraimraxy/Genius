import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Trophy, Award, BookOpen, Clock, ChevronRight, Download, Loader2, CheckCircle2, CalendarDays } from 'lucide-react';

interface StudentPerformanceProps {
    profile: any;
    onNavigate: (tab: any) => void;
}

interface PerfRecord {
    id: number;
    course: string;
    type: string;
    score: number;
    grade: string;
    date: string;
}

interface Skill {
    name: string;
    percent: number;
    color: string;
    count: number;
}

interface StatCard {
    label: string;
    value: string;
    type: string;
    icon: any;
    color: string;
    bg: string;
}

function getGradeColor(grade: string) {
    if (grade?.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
    if (grade?.startsWith('B')) return 'bg-indigo-100 text-indigo-700';
    if (grade?.startsWith('C')) return 'bg-amber-100 text-amber-700';
    if (grade?.startsWith('D')) return 'bg-orange-100 text-orange-700';
    return 'bg-rose-100 text-rose-700';
}

function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
    const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-indigo-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, delay }}
                className={`h-full ${color} rounded-full`}
            />
        </div>
    );
}

export default function StudentPerformance({ profile, onNavigate }: StudentPerformanceProps) {
    const [records, setRecords] = useState<PerfRecord[]>([]);
    const [stats, setStats] = useState<StatCard[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [improvement, setImprovement] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/student/performance-stats', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();

                if (data.stats) {
                    const iconMap: any = {
                        gpa: Trophy,
                        count: BookOpen,
                        rank: Award,
                        credits: Clock,
                        attendance: CheckCircle2,
                        avg: BarChart3
                    };
                    const colorMap: any = {
                        gpa: { text: 'text-amber-600', bg: 'bg-amber-50' },
                        count: { text: 'text-indigo-600', bg: 'bg-indigo-50' },
                        rank: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
                        credits: { text: 'text-rose-600', bg: 'bg-rose-50' },
                        attendance: { text: 'text-teal-600', bg: 'bg-teal-50' },
                        avg: { text: 'text-violet-600', bg: 'bg-violet-50' }
                    };
                    const formattedStats = (data.stats || []).map((s: any) => ({
                        ...s,
                        icon: iconMap[s.type] || BookOpen,
                        color: colorMap[s.type]?.text || 'text-indigo-600',
                        bg: colorMap[s.type]?.bg || 'bg-indigo-50'
                    }));
                    setStats(formattedStats);
                    setRecords(data.records || []);
                    setSkills(data.skills || []);
                    setImprovement(data.improvement ?? null);
                }
            } catch (err) {
                console.error('Failed to load performance data', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await fetch('/api/student/transcript/pdf', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'academic-transcript.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            console.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const types = ['all', ...Array.from(new Set(records.map(r => r.type)))];
    const filtered = filterType === 'all' ? records : records.filter(r => r.type === filterType);

    // Chart data: score distribution buckets
    const buckets = [
        { label: '90–100', min: 90, max: 100, color: 'bg-emerald-500' },
        { label: '80–89', min: 80, max: 89, color: 'bg-indigo-500' },
        { label: '70–79', min: 70, max: 79, color: 'bg-violet-500' },
        { label: '60–69', min: 60, max: 69, color: 'bg-amber-500' },
        { label: '50–59', min: 50, max: 59, color: 'bg-orange-500' },
        { label: '0–49', min: 0, max: 49, color: 'bg-rose-500' },
    ].map(b => ({
        ...b,
        count: records.filter(r => r.score >= b.min && r.score <= b.max).length
    }));
    const maxBucket = Math.max(...buckets.map(b => b.count), 1);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Syncing Genius Records...</p>
            </div>
        );
    }

    const hasRecords = records.length > 0;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1 md:mb-2">Academic Excellence</h2>
                    <p className="text-slate-500 font-medium text-sm md:text-base">Detailed tracking of your scores, grades, and overall performance.</p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={isExporting || !hasRecords}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-200 whitespace-nowrap"
                >
                    {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Export Transcript
                </button>
            </header>

            {/* Stat Cards */}
            {stats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.08 }}
                                className="p-4 md:p-6 bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-md transition-all"
                            >
                                <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                                    <Icon size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Performance Trend Banner */}
                    <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-indigo-400 font-black uppercase tracking-[0.2em] text-[10px] mb-4">
                                {improvement === null || !hasRecords ? (
                                    <><Minus size={14} /> Performance Trend</>
                                ) : improvement > 0 ? (
                                    <><TrendingUp size={14} /> Performance Trend</>
                                ) : improvement < 0 ? (
                                    <><TrendingDown size={14} /> Performance Trend</>
                                ) : (
                                    <><Minus size={14} /> Performance Trend</>
                                )}
                            </div>
                            {!hasRecords ? (
                                <h3 className="text-xl font-black leading-tight mb-6 text-slate-400">
                                    No assessment records yet. Complete an exam or assignment to see your trend.
                                </h3>
                            ) : improvement === null || improvement === 0 ? (
                                <h3 className="text-xl font-black leading-tight mb-6">
                                    Performance is <span className="text-slate-300">stable</span> — not enough history to compute a trend yet.
                                </h3>
                            ) : improvement > 0 ? (
                                <h3 className="text-xl font-black leading-tight mb-6">
                                    Your academic performance has improved by{' '}
                                    <span className="text-emerald-400">+{improvement}%</span> compared to earlier submissions.
                                </h3>
                            ) : (
                                <h3 className="text-xl font-black leading-tight mb-6">
                                    Your recent scores are{' '}
                                    <span className="text-rose-400">{improvement}%</span> lower than your earlier submissions. Keep pushing!
                                </h3>
                            )}
                            <div className="flex flex-wrap gap-3">
                                <div className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold">
                                    {records.length} Total Assessments
                                </div>
                                {hasRecords && (
                                    <div className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold">
                                        Avg: {Math.round(records.reduce((s, r) => s + r.score, 0) / records.length)}%
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Score Distribution Chart */}
                    {hasRecords && (
                        <div className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-sm">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <BarChart3 size={16} className="text-indigo-500" /> Score Distribution
                            </h3>
                            <div className="flex items-end gap-3 h-32">
                                {buckets.map((b, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-[9px] font-black text-slate-400">{b.count}</span>
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${(b.count / maxBucket) * 100}%` }}
                                            transition={{ duration: 0.8, delay: i * 0.1 }}
                                            className={`w-full ${b.color} rounded-t-lg min-h-[4px] opacity-80`}
                                            style={{ maxHeight: '100%' }}
                                        />
                                        <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap">{b.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Records Table */}
                    <div className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="text-indigo-500" size={18} /> Assessment Records
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                {types.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setFilterType(t)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-slate-400 ml-1">{filtered.length} records</span>
                            </div>
                        </div>

                        {!hasRecords ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <BookOpen size={40} className="text-slate-200" />
                                <p className="text-slate-400 font-bold text-sm">No assessment records found.</p>
                                <p className="text-slate-300 text-xs">Grades will appear here after your first assessment.</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <p className="text-slate-400 font-bold text-sm">No records for this type.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Course</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Grade</th>
                                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.map((record, idx) => (
                                            <motion.tr
                                                key={record.id}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-slate-50/50 transition-colors group"
                                            >
                                                <td className="px-8 py-4 min-w-[180px]">
                                                    <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">{record.course}</p>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black text-slate-500 rounded uppercase tracking-[0.1em]">
                                                        {record.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 text-sm w-10">{record.score}%</span>
                                                        <ScoreBar score={record.score} delay={idx * 0.02} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-xs font-black ${getGradeColor(record.grade)}`}>
                                                        {record.grade}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-right text-xs font-bold text-slate-400 whitespace-nowrap">{record.date}</td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Grading System */}
                    <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] md:rounded-[2.5rem] shadow-xl text-white">
                        <h3 className="text-xl font-black mb-6">Grading System</h3>
                        <div className="space-y-3">
                            {[
                                { grade: 'A+', range: '90–100', points: '4.0', color: 'bg-emerald-400/20 border-emerald-400/30' },
                                { grade: 'A', range: '80–89', points: '3.7', color: 'bg-white/10 border-white/5' },
                                { grade: 'B', range: '70–79', points: '3.3', color: 'bg-white/10 border-white/5' },
                                { grade: 'C', range: '60–69', points: '3.0', color: 'bg-white/10 border-white/5' },
                                { grade: 'D', range: '50–59', points: '2.0', color: 'bg-amber-400/10 border-amber-400/20' },
                                { grade: 'F', range: '0–49', points: '0.0', color: 'bg-rose-400/10 border-rose-400/20' },
                            ].map((item, i) => (
                                <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${item.color}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-xs">
                                            {item.grade}
                                        </div>
                                        <span className="text-xs font-bold text-indigo-100 tracking-wide">{item.range}%</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                        {item.points} GP
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 p-4 bg-indigo-900/40 rounded-2xl border border-indigo-400/20">
                            <p className="text-[10px] font-bold text-indigo-200 leading-relaxed italic">
                                Performance evaluation uses the Genius Portal neural weighting algorithm.
                            </p>
                        </div>
                    </div>

                    {/* Top Skills */}
                    {skills.length > 0 && (
                        <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] shadow-sm">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Performance by Type</h3>
                                <ChevronRight size={16} className="text-slate-400" />
                            </div>
                            <div className="space-y-5">
                                {skills.map((skill, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">{skill.name}</span>
                                            <div className="flex items-center gap-2">
                                                {skill.count !== undefined && (
                                                    <span className="text-slate-300 font-bold normal-case tracking-normal text-[10px]">{skill.count}x</span>
                                                )}
                                                <span className="text-slate-900">{skill.percent}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${skill.percent}%` }}
                                                transition={{ duration: 1, delay: 0.4 + i * 0.1 }}
                                                className={`h-full ${skill.color || 'bg-indigo-500'}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Links */}
                    <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Quick Access</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => onNavigate('attendance')}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                                        <CalendarDays size={14} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Attendance Records</span>
                                </div>
                                <ChevronRight size={14} className="text-slate-400" />
                            </button>
                            <button
                                onClick={() => onNavigate('materials')}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                        <BookOpen size={14} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Course Materials</span>
                                </div>
                                <ChevronRight size={14} className="text-slate-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
