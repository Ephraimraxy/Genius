import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen, FileText, Download, Lock, CheckCircle, Search,
    Loader2, Volume2, Play, X, Eye, Video, ChevronLeft,
    BookMarked, ChevronDown, ChevronUp, GraduationCap, Layers
} from 'lucide-react';
import { ToastType } from './ToastSystem';
import { friendlyError } from '../utils/friendlyError';
import GeniusPaymentModal from './GeniusPaymentModal';

interface Material {
    id: number;
    name: string;
    type: string;
    created_at: string;
    is_available: boolean;
    price: number;
    is_paid: boolean;
    hasPaid: boolean;
    professional_program_id?: number | null;
    professional_course_id?: number | null;
    program_name?: string | null;
    course_title?: string | null;
    course_sort_order?: number | null;
    program_price?: number;
}

interface VideoItem {
    id: number;
    name: string;
    file_url: string | null;
    stream_url?: string | null;
    is_paid: boolean;
    price: number;
    hasPaid: boolean;
    created_at: string;
    professional_program_id?: number | null;
    professional_course_id?: number | null;
    program_name?: string | null;
    course_title?: string | null;
    course_sort_order?: number | null;
    completion_ratio?: number;
    watched_seconds?: number;
    duration_seconds?: number;
    last_position_seconds?: number;
    completed?: boolean;
}

interface ProgramInfo {
    id: number;
    name: string;
    price: number;
    description: string | null;
    coordinator_name: string | null;
    hasPaid: boolean;
}

interface StudentMaterialViewProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
    isProfessionalStudent?: boolean;
}

export default function StudentMaterialView({ addToast, token, isProfessionalStudent }: StudentMaterialViewProps) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingVideos, setIsLoadingVideos] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
    const [activeTab, setActiveTab] = useState<'materials' | 'audio' | 'videos'>('materials');

    // Pro Hub LMS view
    const [programView, setProgramView] = useState<'overview' | 'detail'>('overview');
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

    // Payment
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

    // Audio player
    const [activeAudio, setActiveAudio] = useState<{ url: string; name: string } | null>(null);

    // Video player
    const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastVideoTimeRef = useRef(0);
    const lastProgressSentRef = useRef(0);

    // Preview
    const [previewItem, setPreviewItem] = useState<{ name: string; text: string; wordCount: number; price: number } | null>(null);
    const [previewLoading, setPreviewLoading] = useState<number | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const fetchMaterials = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/student/materials', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load materials');
            setMaterials(data.materials || []);
            if (data.program) setProgramInfo(data.program);
        } catch {
            addToast('Failed to load materials', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchVideos = async () => {
        setIsLoadingVideos(true);
        try {
            const res = await fetch('/api/student/videos', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setVideos(data.videos || []);
        } catch { /* silent */ }
        finally { setIsLoadingVideos(false); }
    };

    useEffect(() => { fetchMaterials(); fetchVideos(); }, [token]);

    // Expand all courses by default when entering detail view
    useEffect(() => {
        if (programView === 'detail') {
            const keys = new Set(courseGroups.map(c => c.key));
            setExpandedCourses(keys);
        }
    }, [programView]);

    const handleDownload = async (material: Material) => {
        if (material.is_paid && !material.hasPaid) { beginPayment(material); return; }
        if (downloadingId === material.id) return;
        setDownloadingId(material.id);
        try {
            const res = await fetch(`/api/resources/${material.id}/download`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Download failed');
            const blob = await res.blob();
            const disposition = res.headers.get('content-disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/i);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = match?.[1] || material.name;
            document.body.appendChild(link); link.click(); link.remove();
            window.URL.revokeObjectURL(url);
            addToast('Download started', 'success');
        } catch (err: any) {
            addToast(friendlyError(err, 'download'), 'error');
        } finally { setDownloadingId(null); }
    };

    const beginPayment = (item: Material | VideoItem) => {
        setSelectedMaterial({
            id: item.professional_program_id || item.id,
            name: item.professional_program_id ? (item.program_name || programInfo?.name || 'Professional Program') : item.name,
            type: (item as any).type || 'video',
            created_at: item.created_at,
            is_available: true,
            price: item.professional_program_id ? Number((item as any).program_price ?? programInfo?.price ?? item.price ?? 0) : Number(item.price || 0),
            is_paid: true, hasPaid: false,
            professional_program_id: item.professional_program_id || null,
            program_name: item.program_name || programInfo?.name || null,
            program_price: (item as any).program_price ?? programInfo?.price ?? item.price,
        });
        setShowPaymentModal(true);
    };

    const beginProgramPayment = () => {
        if (!programInfo) return;
        setSelectedMaterial({
            id: programInfo.id,
            name: programInfo.name,
            type: 'material',
            created_at: new Date().toISOString(),
            is_available: true,
            price: programInfo.price,
            is_paid: true, hasPaid: false,
            professional_program_id: programInfo.id,
            program_name: programInfo.name,
            program_price: programInfo.price,
        });
        setShowPaymentModal(true);
    };

    const handleAudioPlay = async (material: Material) => {
        if (material.is_paid && !material.hasPaid) { beginPayment(material); return; }
        try {
            const res = await fetch(`/api/resources/${material.id}/download`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to load audio');
            const blob = await res.blob();
            setActiveAudio({ url: window.URL.createObjectURL(blob), name: material.name });
        } catch (err: any) { addToast(friendlyError(err, 'generic'), 'error'); }
    };

    const openVideo = (video: VideoItem) => {
        if (video.is_paid && !video.hasPaid) { beginPayment(video); return; }
        lastVideoTimeRef.current = Number(video.last_position_seconds || 0);
        lastProgressSentRef.current = 0;
        setActiveVideo(video);
    };

    const videoSource = (video: VideoItem) => {
        if (video.file_url) return video.file_url;
        const s = video.stream_url || `/api/student/videos/${video.id}/stream`;
        return `${s}${s.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`;
    };

    const reportVideoProgress = async (video: HTMLVideoElement | null, force = false) => {
        if (!activeVideo?.professional_program_id || !video || !token) return;
        const current = Math.max(0, Number(video.currentTime || 0));
        const duration = Math.max(0, Number(video.duration || activeVideo.duration_seconds || 0));
        const last = Math.max(0, Number(lastVideoTimeRef.current || 0));
        const forwardDelta = current - last;
        if (!force && (Date.now() - lastProgressSentRef.current < 5000 || forwardDelta <= 0.75)) return;
        lastVideoTimeRef.current = current;
        if (forwardDelta <= 0 || forwardDelta > 15) return;
        lastProgressSentRef.current = Date.now();
        try {
            const res = await fetch(`/api/student/videos/${activeVideo.id}/progress`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: last, end: current, currentTime: current, duration })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.progress) {
                setVideos(prev => prev.map(v => v.id === activeVideo.id ? {
                    ...v,
                    completion_ratio: Number(data.progress.completion_ratio || v.completion_ratio || 0),
                    watched_seconds: Number(data.progress.watched_seconds || v.watched_seconds || 0),
                    duration_seconds: Number(data.progress.duration_seconds || v.duration_seconds || 0),
                    last_position_seconds: Number(data.progress.last_position_seconds || current),
                    completed: !!data.progress.completed
                } : v));
            }
        } catch { /* non-blocking */ }
    };

    const handlePreview = async (material: Material) => {
        setPreviewLoading(material.id);
        try {
            const res = await fetch(`/api/student/materials/${material.id}/preview`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Preview failed');
            if (data.preview) setPreviewItem({ name: data.name, text: data.previewText, wordCount: data.wordCount, price: material.price });
            else handleDownload(material);
        } catch (err: any) { addToast(friendlyError(err, 'generic'), 'error'); }
        finally { setPreviewLoading(null); }
    };

    // ── Build course groups for Pro Hub LMS view ──────────────────
    const courseGroups: {
        key: string;
        courseId: number | null;
        courseTitle: string;
        sortOrder: number;
        textMaterials: Material[];
        audioMaterials: Material[];
        videos: VideoItem[];
    }[] = (() => {
        const map = new Map<string, typeof courseGroups[0]>();
        [...materials].forEach(m => {
            const key = m.professional_course_id != null ? String(m.professional_course_id) : '__none__';
            if (!map.has(key)) map.set(key, {
                key, courseId: m.professional_course_id ?? null,
                courseTitle: m.course_title || 'General Content',
                sortOrder: m.course_sort_order ?? 9999,
                textMaterials: [], audioMaterials: [], videos: []
            });
            if (m.type === 'audio') map.get(key)!.audioMaterials.push(m);
            else map.get(key)!.textMaterials.push(m);
        });
        [...videos].forEach(v => {
            const key = v.professional_course_id != null ? String(v.professional_course_id) : '__none__';
            if (!map.has(key)) map.set(key, {
                key, courseId: v.professional_course_id ?? null,
                courseTitle: v.course_title || 'General Content',
                sortOrder: v.course_sort_order ?? 9999,
                textMaterials: [], audioMaterials: [], videos: []
            });
            map.get(key)!.videos.push(v);
        });
        return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    })();

    const totalContent = materials.length + videos.length;
    const isUnlocked = !!(programInfo?.hasPaid || programInfo?.price === 0);
    const loading = isLoading || isLoadingVideos;

    // ══════════════════════════════════════════════════════════════
    // PRO HUB — Programs LMS view
    // ══════════════════════════════════════════════════════════════
    if (isProfessionalStudent) {
        return (
            <div className="space-y-6 pb-16">
                {/* Header */}
                <header className="flex items-center gap-4">
                    {programView === 'detail' && (
                        <button
                            onClick={() => setProgramView('overview')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <ChevronLeft size={16} /> Back to Programs
                        </button>
                    )}
                    {programView === 'overview' && (
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <GraduationCap size={28} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Programs</h2>
                                <p className="text-slate-500 font-medium">Your enrolled professional programs.</p>
                            </div>
                        </div>
                    )}
                    {programView === 'detail' && programInfo && (
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{programInfo.name}</h2>
                            <p className="text-slate-500 text-sm font-medium">{programInfo.description || 'Professional program content'}</p>
                        </div>
                    )}
                </header>

                {loading ? (
                    <LoadingState label="Loading Programs..." />
                ) : programView === 'overview' ? (
                    // ── PROGRAMS OVERVIEW ─────────────────────────────────
                    !programInfo ? (
                        <EmptyState icon={GraduationCap} label="You are not enrolled in any program yet. Contact your coordinator." />
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                            {/* Program card top bar */}
                            <div className="h-2 bg-gradient-to-r from-indigo-600 to-purple-600" />
                            <div className="p-8">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                                <BookMarked size={20} className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight">{programInfo.name}</h3>
                                                {programInfo.coordinator_name && (
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                                        Coordinator: {programInfo.coordinator_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {programInfo.description && (
                                            <p className="text-slate-500 text-sm leading-relaxed mb-4">{programInfo.description}</p>
                                        )}
                                    </div>
                                    {/* Price / status badge */}
                                    <div className="shrink-0 text-right">
                                        {isUnlocked ? (
                                            <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black text-sm border border-emerald-100">
                                                <CheckCircle size={14} /> Enrolled
                                            </div>
                                        ) : programInfo.price > 0 ? (
                                            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-sm border border-indigo-100">
                                                ₦{programInfo.price.toLocaleString()}
                                            </div>
                                        ) : (
                                            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black text-sm border border-emerald-100">
                                                Free
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content stats */}
                                <div className="flex flex-wrap gap-3 mb-6">
                                    {courseGroups.length > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <Layers size={12} /> {courseGroups.length} Course{courseGroups.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {materials.filter(m => m.type !== 'audio').length > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <FileText size={12} /> {materials.filter(m => m.type !== 'audio').length} Material{materials.filter(m => m.type !== 'audio').length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {materials.filter(m => m.type === 'audio').length > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <Volume2 size={12} /> {materials.filter(m => m.type === 'audio').length} Audio
                                        </span>
                                    )}
                                    {videos.length > 0 && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <Video size={12} /> {videos.length} Video{videos.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {totalContent === 0 && (
                                        <span className="text-xs text-slate-400 font-medium italic">No content uploaded yet</span>
                                    )}
                                </div>

                                {/* Action button */}
                                <div className="flex gap-3">
                                    {isUnlocked ? (
                                        <button
                                            onClick={() => setProgramView('detail')}
                                            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                        >
                                            <Play size={16} /> Enter Program
                                        </button>
                                    ) : programInfo.price > 0 ? (
                                        <>
                                            <button
                                                onClick={beginProgramPayment}
                                                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                            >
                                                <Lock size={16} /> Unlock Program — ₦{programInfo.price.toLocaleString()}
                                            </button>
                                            {totalContent > 0 && (
                                                <button
                                                    onClick={() => setProgramView('detail')}
                                                    className="px-6 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-colors"
                                                >
                                                    Preview
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setProgramView('detail')}
                                            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                        >
                                            <Play size={16} /> Enter Program
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )
                ) : (
                    // ── PROGRAM DETAIL — content by course ────────────────
                    courseGroups.length === 0 ? (
                        <EmptyState icon={BookOpen} label="No content has been uploaded to this program yet." />
                    ) : (
                        <div className="space-y-4">
                            {/* Unlock banner if not paid */}
                            {!isUnlocked && programInfo && programInfo.price > 0 && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <Lock size={18} className="text-amber-600 shrink-0" />
                                        <p className="text-sm font-bold text-amber-800">
                                            Unlock the full program for ₦{programInfo.price.toLocaleString()} to access all content.
                                        </p>
                                    </div>
                                    <button
                                        onClick={beginProgramPayment}
                                        className="shrink-0 px-5 py-2.5 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-700 transition-colors"
                                    >
                                        Unlock Now
                                    </button>
                                </motion.div>
                            )}

                            {courseGroups.map((course, idx) => {
                                const isOpen = expandedCourses.has(course.key);
                                const itemCount = course.textMaterials.length + course.audioMaterials.length + course.videos.length;
                                return (
                                    <motion.div key={course.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        {/* Course header — click to expand/collapse */}
                                        <button
                                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                                            onClick={() => setExpandedCourses(prev => {
                                                const next = new Set(prev);
                                                isOpen ? next.delete(course.key) : next.add(course.key);
                                                return next;
                                            })}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                                    <BookOpen size={15} className="text-indigo-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-900 uppercase tracking-tight text-sm truncate">{course.courseTitle}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                                                        {course.textMaterials.length > 0 && ` · ${course.textMaterials.length} material${course.textMaterials.length !== 1 ? 's' : ''}`}
                                                        {course.audioMaterials.length > 0 && ` · ${course.audioMaterials.length} audio`}
                                                        {course.videos.length > 0 && ` · ${course.videos.length} video${course.videos.length !== 1 ? 's' : ''}`}
                                                    </p>
                                                </div>
                                            </div>
                                            {isOpen ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <motion.div
                                                    key="content"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                                                        {/* Text materials */}
                                                        {course.textMaterials.map(item => (
                                                            <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                                                                        <FileText size={14} className="text-amber-600" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Document</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {item.is_paid && !item.hasPaid && (
                                                                        <button onClick={() => handlePreview(item)} disabled={previewLoading === item.id}
                                                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black uppercase hover:bg-slate-200 transition-colors flex items-center gap-1">
                                                                            {previewLoading === item.id ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />} Preview
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id}
                                                                        className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-colors ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
                                                                        {downloadingId === item.id ? <Loader2 size={11} className="animate-spin" /> : item.is_paid && !item.hasPaid ? <Lock size={11} /> : <Download size={11} />}
                                                                        {item.is_paid && !item.hasPaid ? 'Unlock' : 'Download'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Audio materials */}
                                                        {course.audioMaterials.map(item => (
                                                            <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                                                                        <Volume2 size={14} className="text-purple-600" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Audio Lecture</p>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleAudioPlay(item)}
                                                                    className={`shrink-0 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-colors ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                                                                    {item.is_paid && !item.hasPaid ? <><Lock size={11} /> Unlock</> : <><Play size={11} /> Play</>}
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {/* Videos */}
                                                        {course.videos.map(vid => (
                                                            <div key={vid.id} className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                                                        <Video size={14} className="text-indigo-600" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 text-sm truncate">{vid.name}</p>
                                                                        {vid.professional_program_id && (
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                                                                                    <div className={`h-full ${vid.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                                                        style={{ width: `${Math.round(Number(vid.completion_ratio || 0) * 100)}%` }} />
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                                                    {vid.completed ? '✓ Done' : `${Math.round(Number(vid.completion_ratio || 0) * 100)}%`}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => openVideo(vid)}
                                                                    className={`shrink-0 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-colors ${vid.is_paid && !vid.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                                                    {vid.is_paid && !vid.hasPaid ? <><Lock size={11} /> Unlock</> : <><Play size={11} /> {Number(vid.last_position_seconds || 0) > 3 ? 'Resume' : 'Watch'}</>}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )
                )}

                {/* Audio mini-player (sticky) */}
                <AnimatePresence>
                    {activeAudio && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mx-auto bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-4 shadow-2xl">
                            <div className="w-9 h-9 bg-purple-500 rounded-xl flex items-center justify-center shrink-0"><Volume2 size={16} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Now Playing</p>
                                <p className="text-sm font-bold truncate">{activeAudio.name}</p>
                                <audio controls autoPlay src={activeAudio.url} className="w-full mt-1.5 h-7" style={{ accentColor: '#a855f7' }} />
                            </div>
                            <button onClick={() => setActiveAudio(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"><X size={16} /></button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Shared modals */}
                {renderVideoModal()}
                {renderPreviewModal()}
                {renderPaymentModal()}
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════
    // ACADEMIC HUB — original tabs view (unchanged)
    // ══════════════════════════════════════════════════════════════
    const textMaterials = materials.filter(m => m.type !== 'audio');
    const audioMaterials = materials.filter(m => m.type === 'audio');
    const filtered = (list: Material[]) => list.filter(m => {
        const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchFilter = filter === 'all' || (filter === 'free' ? !m.is_paid : m.is_paid);
        return matchSearch && matchFilter;
    });
    const tabCounts = { materials: textMaterials.length, audio: audioMaterials.length, videos: videos.length };

    return (
        <div className="space-y-8 pb-12">
            <header className="mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lecture Resources</h2>
                        <p className="text-slate-500 font-medium">Materials, audio lectures, and video recordings.</p>
                    </div>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 w-fit mb-6">
                    {([{ key: 'materials', label: 'Materials', icon: FileText }, { key: 'audio', label: 'Audio', icon: Volume2 }, { key: 'videos', label: 'Videos', icon: Video }] as const).map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === key ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Icon size={13} />{label}
                            {tabCounts[key] > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-white/20' : 'bg-slate-100'}`}>{tabCounts[key]}</span>}
                        </button>
                    ))}
                </div>
                {activeTab !== 'videos' && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                        </div>
                        <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200">
                            {(['all', 'free', 'paid'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {activeTab === 'materials' && (
                isLoading ? <LoadingState label="Syncing Materials..." /> :
                filtered(textMaterials).length === 0 ? <EmptyState icon={FileText} label="No materials available yet." /> :
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered(textMaterials).map(item => (
                        <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 border border-slate-200 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-100 transition-all group">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 rounded-2xl flex items-center justify-center transition-colors shadow-sm"><FileText size={24} /></div>
                                <AccessBadge item={item} />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{item.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Published: {new Date(item.created_at).toLocaleDateString()}</p>
                            <div className="flex flex-col gap-2">
                                {item.is_paid && !item.hasPaid && (
                                    <button onClick={() => handlePreview(item)} disabled={previewLoading === item.id}
                                        className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.12em] text-[11px] transition-all bg-slate-100 text-slate-600 hover:bg-slate-200">
                                        {previewLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
                                    </button>
                                )}
                                <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'}`}>
                                    {downloadingId === item.id ? <><Loader2 size={16} className="animate-spin" /> Downloading...</> : item.is_paid && !item.hasPaid ? <><Lock size={16} /> Unlock Access</> : <><Download size={16} /> Download Now</>}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {activeTab === 'audio' && (
                isLoading ? <LoadingState label="Syncing Audio Lectures..." /> :
                filtered(audioMaterials).length === 0 ? <EmptyState icon={Volume2} label="No audio lectures uploaded yet." /> :
                <>
                    <AnimatePresence>
                        {activeAudio && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                                className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-4 shadow-2xl mb-6">
                                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0"><Volume2 size={18} /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-400 mb-1">Now Playing</p>
                                    <p className="text-sm font-bold truncate">{activeAudio.name}</p>
                                    <audio controls autoPlay src={activeAudio.url} className="w-full mt-2 h-8" style={{ accentColor: '#f59e0b' }} />
                                </div>
                                <button onClick={() => setActiveAudio(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"><X size={18} /></button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered(audioMaterials).map(item => (
                            <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2.5rem] p-8 border border-slate-200 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-100 transition-all group">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-sm"><Volume2 size={24} /></div>
                                    <AccessBadge item={item} />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{item.name}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{new Date(item.created_at).toLocaleDateString()}</p>
                                <button onClick={() => handleAudioPlay(item)}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-lg ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'}`}>
                                    {item.is_paid && !item.hasPaid ? <><Lock size={16} /> Unlock Audio</> : <><Play size={16} /> Play Audio</>}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'videos' && (
                isLoadingVideos ? <LoadingState label="Loading Video Lectures..." /> :
                videos.length === 0 ? <EmptyState icon={Video} label="No video lectures available yet." /> :
                <>
                    {renderVideoModal()}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map(vid => (
                            <motion.div key={vid.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100 transition-all group">
                                <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/40 group-hover:scale-110 transition-transform"><Play size={22} className="text-white ml-1" /></div>
                                    {vid.is_paid && !vid.hasPaid && <div className="absolute top-3 right-3 bg-slate-900/80 text-amber-400 text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-sm">₦{vid.price?.toLocaleString()}</div>}
                                </div>
                                <div className="p-6">
                                    <h4 className="font-black text-slate-900 mb-1 leading-tight">{vid.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">{vid.course_title || new Date(vid.created_at).toLocaleDateString()}</p>
                                    {vid.professional_program_id && (
                                        <div className="mb-4">
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${vid.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.round(Number(vid.completion_ratio || 0) * 100)}%` }} />
                                            </div>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{vid.completed ? 'Completed' : `${Math.round(Number(vid.completion_ratio || 0) * 100)}% watched`}</p>
                                        </div>
                                    )}
                                    <button onClick={() => openVideo(vid)}
                                        className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.12em] text-xs transition-all ${vid.is_paid && !vid.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                        {vid.is_paid && !vid.hasPaid ? <><Lock size={14} /> Enroll Program</> : <><Play size={14} /> {Number(vid.last_position_seconds || 0) > 3 ? 'Resume' : 'Watch Now'}</>}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {renderPreviewModal()}
            {renderPaymentModal()}
        </div>
    );

    // ── Shared modal renderers ────────────────────────────────────
    function renderVideoModal() {
        return (
            <AnimatePresence>
                {activeVideo && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-slate-900 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <p className="font-black text-white truncate">{activeVideo.name}</p>
                                <button onClick={() => setActiveVideo(null)} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"><X size={20} /></button>
                            </div>
                            {activeVideo.file_url || activeVideo.stream_url ? (
                                <>
                                    {Number(activeVideo.last_position_seconds || 0) > 3 && (
                                        <div className="px-6 py-3 bg-slate-800/80 border-b border-white/10 flex items-center justify-between gap-3">
                                            <p className="text-xs font-bold text-slate-300">Resume: {Math.floor(Number(activeVideo.last_position_seconds || 0) / 60)}m {Math.floor(Number(activeVideo.last_position_seconds || 0) % 60)}s</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Number(activeVideo.last_position_seconds || 0); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">Resume</button>
                                                <button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; lastVideoTimeRef.current = 0; } }} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-[10px] font-black uppercase">Restart</button>
                                            </div>
                                        </div>
                                    )}
                                    <video ref={videoRef} src={videoSource(activeVideo)} controls controlsList="nodownload" disablePictureInPicture autoPlay
                                        onLoadedMetadata={e => { const r = Number(activeVideo.last_position_seconds || 0); if (r > 3 && r < e.currentTarget.duration - 3) e.currentTarget.currentTime = r; }}
                                        onTimeUpdate={e => reportVideoProgress(e.currentTarget)}
                                        onPause={e => reportVideoProgress(e.currentTarget, true)}
                                        onEnded={e => reportVideoProgress(e.currentTarget, true)}
                                        className="w-full max-h-[70vh]" />
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-slate-400">Video not available</div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    function renderPreviewModal() {
        return (
            <AnimatePresence>
                {previewItem && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Preview</p>
                                    <p className="font-black text-slate-900 text-lg">{previewItem.name}</p>
                                </div>
                                <button onClick={() => setPreviewItem(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><X size={20} className="text-slate-400" /></button>
                            </div>
                            <div className="px-8 py-6 max-h-80 overflow-y-auto">
                                <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{previewItem.text}</p>
                            </div>
                            <div className="px-8 py-5 border-t border-slate-100 bg-amber-50 flex items-center justify-between gap-4">
                                <p className="text-xs text-amber-700 font-bold">Showing first 300 of {previewItem.wordCount.toLocaleString()} words. Unlock full access for ₦{previewItem.price?.toLocaleString()}.</p>
                                <button onClick={() => { setPreviewItem(null); const mat = materials.find(m => m.name === previewItem.name); if (mat) beginPayment(mat); }}
                                    className="shrink-0 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-700 transition-colors flex items-center gap-2">
                                    <Lock size={13} /> Unlock Full
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    function renderPaymentModal() {
        return (
            <AnimatePresence>
                {showPaymentModal && selectedMaterial && (
                    <GeniusPaymentModal
                        courseName={selectedMaterial.name}
                        courseId={selectedMaterial.id.toString()}
                        amount={selectedMaterial.price}
                        token={token}
                        addToast={addToast}
                        onClose={() => { setShowPaymentModal(false); setSelectedMaterial(null); }}
                        onSuccess={() => { setShowPaymentModal(false); setSelectedMaterial(null); fetchMaterials(); fetchVideos(); addToast('Access unlocked.', 'success'); }}
                        type={selectedMaterial.professional_program_id ? 'program' : selectedMaterial.type === 'audio' ? 'audio' : 'material'}
                    />
                )}
            </AnimatePresence>
        );
    }
}

function AccessBadge({ item }: { item: Material }) {
    if (item.is_paid && !item.hasPaid) return (
        <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">₦{item.price?.toLocaleString()}</div>
    );
    return (
        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
            {item.is_paid && <CheckCircle size={10} />}{item.is_paid ? 'Purchased' : 'Free'}
        </div>
    );
}

function LoadingState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-indigo-600 animate-spin" />
            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">{label}</p>
        </div>
    );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Nothing Here Yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto">{label}</p>
        </div>
    );
}
