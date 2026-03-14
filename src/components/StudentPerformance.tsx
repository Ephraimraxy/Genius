import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, Trophy, Award, BookOpen, Clock, ChevronRight } from 'lucide-react';

interface StudentPerformanceProps {
    profile: any;
    onNavigate: (tab: any) => void;
}

export default function StudentPerformance({ profile, onNavigate }: StudentPerformanceProps) {
    const records = [
        { id: 1, course: 'Advanced Physics (PHY401)', type: 'Exam', score: 88, grade: 'A', date: 'Sept 2025' },
        { id: 2, course: 'Quantum Mechanics (PHY405)', type: 'Test', score: 92, grade: 'A+', date: 'Aug 2025' },
        { id: 3, course: 'Linear Algebra', type: 'Test', score: 76, grade: 'B', date: 'July 2025' },
        { id: 4, course: 'Lab Report: Optics', type: 'Assignment', score: 95, grade: 'A+', date: 'June 2025' },
        { id: 5, course: 'Classical Mechanics', type: 'Exam', score: 82, grade: 'A', date: 'May 2025' },
    ];

    const stats = [
        { label: 'CGPA', value: '3.82', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Courses Passed', value: '12', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Global Rank', value: '#4', icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Total Credits', value: '36', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    return (
        <div className="space-y-8 pb-12">
            <header className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Academic Excellence</h2>
                <p className="text-slate-500 font-medium">Detailed tracking of your scores, grades, and overall performance.</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md transition-all"
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

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-indigo-400 font-black uppercase tracking-[0.2em] text-[10px] mb-4">
                                <TrendingUp size={14} /> Performance Trend
                            </div>
                            <h3 className="text-2xl font-black leading-tight mb-6">
                                Your academic performance has improved by <span className="text-emerald-400">12%</span> compared to last semester.
                            </h3>
                            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                                View Semester Analysis
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="text-indigo-500" /> Recent Grades
                            </h3>
                            <span className="text-xs font-bold text-slate-400">Total Records: {records.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Course</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Grade</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {records.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-4 min-w-[200px]">
                                                <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{record.course}</p>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black text-slate-500 rounded uppercase tracking-[0.1em]">
                                                    {record.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-slate-600">{record.score}%</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-xs font-black ${
                                                    record.grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                                }`}>
                                                    {record.grade}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right text-xs font-bold text-slate-400 whitespace-nowrap">{record.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] shadow-xl text-white">
                        <h3 className="text-xl font-black mb-6">Grading System</h3>
                        <div className="space-y-4">
                            {[
                                { grade: 'A+', range: '90 - 100', points: '4.0' },
                                { grade: 'A', range: '80 - 89', points: '3.7' },
                                { grade: 'B', range: '70 - 79', points: '3.3' },
                                { grade: 'C', range: '60 - 69', points: '3.0' },
                                { grade: 'D', range: '50 - 59', points: '2.0' },
                                { grade: 'F', range: '0 - 49', points: '0.0' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white/10 rounded-2xl border border-white/5">
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
                        <div className="mt-8 p-4 bg-indigo-900/40 rounded-2xl border border-indigo-400/20">
                            <p className="text-[10px] font-bold text-indigo-200 leading-relaxed italic">
                                Note: Performance evaluation is processed using the standard Genius Portal neural weighting algorithm.
                            </p>
                        </div>
                    </div>

                    <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Top Skills</h3>
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                        <div className="space-y-5">
                            {[
                                { name: 'Analytical Thinking', percent: 94, color: 'bg-emerald-500' },
                                { name: 'Problem Solving', percent: 88, color: 'bg-indigo-500' },
                                { name: 'Lab Techniques', percent: 79, color: 'bg-amber-500' },
                            ].map((skill, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                        <span className="text-slate-500">{skill.name}</span>
                                        <span className="text-slate-900">{skill.percent}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${skill.percent}%` }}
                                            transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                                            className={`h-full ${skill.color}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
