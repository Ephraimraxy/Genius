import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Clock, Download, ArrowLeft, CalendarDays, BookOpen, Loader2 } from 'lucide-react';

interface AttendanceRecord {
    session_id: number;
    course_code: string;
    course_name: string;
    session_date: string;
    topic: string;
    status: 'present' | 'absent';
    access_type: 'free' | 'paid';
    marked_at: string | null;
}

interface StudentAttendancePageProps {
    token: string;
    addToast: (message: string, type?: string) => void;
    onNavigate: (tab: any) => void;
}

export default function StudentAttendancePage({ token, addToast, onNavigate }: StudentAttendancePageProps) {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchAttendance = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/student/attendance', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setRecords(data.records || []);
            } catch {
                addToast('Failed to load attendance records', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAttendance();
    }, [token]);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const res = await fetch('/api/student/attendance/pdf', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'attendance-report.pdf';
            a.click();
            URL.revokeObjectURL(url);
            addToast('Attendance report downloaded', 'success');
        } catch {
            addToast('Failed to download PDF', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const attendanceRate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                        <ArrowLeft size={16} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">My Attendance</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Your session attendance history and records.</p>
                    </div>
                </div>
                <button
                    onClick={handleDownload}
                    disabled={isDownloading || records.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-200"
                >
                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download PDF
                </button>
            </header>

            {/* Summary Cards */}
            {!isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            label: 'Total Sessions',
                            value: records.length,
                            icon: CalendarDays,
                            color: 'text-indigo-600',
                            bg: 'bg-indigo-50'
                        },
                        {
                            label: 'Present',
                            value: presentCount,
                            icon: CheckCircle2,
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-50'
                        },
                        {
                            label: 'Absent',
                            value: absentCount,
                            icon: XCircle,
                            color: 'text-rose-600',
                            bg: 'bg-rose-50'
                        },
                        {
                            label: 'Attendance Rate',
                            value: `${attendanceRate}%`,
                            icon: BookOpen,
                            color: 'text-amber-600',
                            bg: 'bg-amber-50'
                        },
                    ].map((card, i) => {
                        const Icon = card.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.08 }}
                                className="p-4 md:p-6 bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-md transition-all"
                            >
                                <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-4`}>
                                    <Icon size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{card.label}</p>
                                <p className="text-2xl font-black text-slate-900">{card.value}</p>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Attendance Rate Bar */}
            {!isLoading && records.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Overall Attendance Rate</h3>
                        <span className={`text-2xl font-black ${attendanceRate >= 75 ? 'text-emerald-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {attendanceRate}%
                        </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${attendanceRate}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className={`h-full rounded-full ${attendanceRate >= 75 ? 'bg-emerald-500' : attendanceRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        />
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-2">
                        {attendanceRate >= 75 ? 'Good standing — keep it up!' : attendanceRate >= 50 ? 'Attendance is below recommended threshold.' : 'Critical — attendance is very low.'}
                    </p>
                </div>
            )}

            {/* Records Table */}
            <div className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="text-indigo-500" size={18} /> Session History
                    </h3>
                    <span className="text-xs font-bold text-slate-400">{records.length} records</span>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Records...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <CalendarDays size={40} className="text-slate-200" />
                        <p className="text-slate-400 font-bold text-sm">No attendance records found.</p>
                        <p className="text-slate-300 text-xs">Your sessions will appear here once enrolled.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 md:px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Course</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Topic</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                                    <th className="px-6 md:px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {records.map((record, idx) => (
                                    <motion.tr
                                        key={`${record.session_id}-${idx}`}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="hover:bg-slate-50/50 transition-colors group"
                                    >
                                        <td className="px-6 md:px-8 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-4 py-4 min-w-[140px]">
                                            <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">{record.course_code}</p>
                                            {record.course_name && (
                                                <p className="text-[11px] text-slate-400 font-medium truncate max-w-[160px]">{record.course_name}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-xs text-slate-500 font-medium max-w-[200px] truncate">
                                            {record.topic || '—'}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {record.status === 'present' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                    <CheckCircle2 size={10} /> Present
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                    <XCircle size={10} /> Absent
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${record.access_type === 'paid' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {record.access_type}
                                            </span>
                                        </td>
                                        <td className="px-6 md:px-8 py-4 text-right text-xs font-bold text-slate-400 whitespace-nowrap">
                                            {record.session_date ? new Date(record.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
