import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, FileText, Download, Lock, CheckCircle, Search, Loader2, Volume2, Play, X, Eye, Video } from 'lucide-react';
import { ToastType } from './ToastSystem';
import { friendlyError } from '../utils/friendlyError';
import GeniusPaymentModal from './GeniusPaymentModal';

interface Material {
    id: number;
    name: string;
    type: string; // 'material' | 'audio'
    created_at: string;
    is_available: boolean;
    price: number;
    is_paid: boolean;
    hasPaid: boolean;
}

interface VideoItem {
    guid: string;
    title: string;
    is_paid: boolean;
    price: number;
    hasPaid: boolean;
    thumbnailUrl: string;
    embedUrl: string;
    created_at: string;
}

interface StudentMaterialViewProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function StudentMaterialView({ addToast, token }: StudentMaterialViewProps) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingVideos, setIsLoadingVideos] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
    const [activeTab, setActiveTab] = useState<'materials' | 'audio' | 'videos'>('materials');

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

    // Audio player state
    const [activeAudio, setActiveAudio] = useState<{ url: string; name: string } | null>(null);

    // Video player state
    const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

    // Preview state
    const [previewItem, setPreviewItem] = useState<{ name: string; text: string; wordCount: number; price: number } | null>(null);
    const [previewLoading, setPreviewLoading] = useState<number | null>(null);

    const fetchMaterials = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/student/materials', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load materials');
            setMaterials(data.materials || []);
        } catch {
            addToast('Failed to load materials', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchVideos = async () => {
        setIsLoadingVideos(true);
        try {
            const res = await fetch('/api/student/videos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setVideos(data.videos || []);
        } catch {
            // Silent — videos section will just show empty
        } finally {
            setIsLoadingVideos(false);
        }
    };

    useEffect(() => {
        fetchMaterials();
        fetchVideos();
    }, [token]);

    const handleDownload = async (material: Material) => {
        if (material.is_paid && !material.hasPaid) {
            setSelectedMaterial(material);
            setShowPaymentModal(true);
            return;
        }
        try {
            const res = await fetch(`/api/resources/${material.id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Download failed');
            }
            const blob = await res.blob();
            const disposition = res.headers.get('content-disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/i);
            const fileName = match?.[1] || material.name;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            addToast('Download started', 'success');
        } catch (err: any) {
            addToast(friendlyError(err, 'download'), 'error');
        }
    };

    const handleAudioPlay = async (material: Material) => {
        if (material.is_paid && !material.hasPaid) {
            setSelectedMaterial(material);
            setShowPaymentModal(true);
            return;
        }
        try {
            const res = await fetch(`/api/resources/${material.id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load audio');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setActiveAudio({ url, name: material.name });
        } catch (err: any) {
            addToast(friendlyError(err, 'generic'), 'error');
        }
    };

    const handlePreview = async (material: Material) => {
        setPreviewLoading(material.id);
        try {
            const res = await fetch(`/api/student/materials/${material.id}/preview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Preview failed');
            if (data.preview) {
                setPreviewItem({ name: data.name, text: data.previewText, wordCount: data.wordCount, price: material.price });
            } else {
                // Full content available (already paid / free) — just download
                handleDownload(material);
            }
        } catch (err: any) {
            addToast(friendlyError(err, 'generic'), 'error');
        } finally {
            setPreviewLoading(null);
        }
    };

    const textMaterials = materials.filter(m => m.type !== 'audio');
    const audioMaterials = materials.filter(m => m.type === 'audio');

    const filtered = (list: Material[]) => list.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || (filter === 'free' ? !m.is_paid : m.is_paid);
        return matchesSearch && matchesFilter;
    });

    const tabCounts = {
        materials: textMaterials.length,
        audio: audioMaterials.length,
        videos: videos.length,
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
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

                {/* Tabs */}
                <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 w-fit mb-6">
                    {([
                        { key: 'materials', label: 'Materials', icon: FileText },
                        { key: 'audio', label: 'Audio', icon: Volume2 },
                        { key: 'videos', label: 'Videos', icon: Video },
                    ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === key ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Icon size={13} />
                            {label}
                            {tabCounts[key] > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-white/20' : 'bg-slate-100'}`}>
                                    {tabCounts[key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search + Filter (not for videos) */}
                {activeTab !== 'videos' && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200">
                            {(['all', 'free', 'paid'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {/* ── MATERIALS TAB ── */}
            {activeTab === 'materials' && (
                isLoading ? <LoadingState label="Syncing Materials..." /> :
                filtered(textMaterials).length === 0 ? <EmptyState icon={FileText} label="No materials available yet." /> :
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered(textMaterials).map((item) => (
                        <motion.div
                            key={item.id}
                            layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 border border-slate-200 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-100 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 rounded-2xl flex items-center justify-center transition-colors shadow-sm">
                                    <FileText size={24} />
                                </div>
                                <AccessBadge item={item} />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{item.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                                Published: {new Date(item.created_at).toLocaleDateString()}
                            </p>

                            <div className="flex flex-col gap-2">
                                {/* Preview button for paid+unpurchased materials */}
                                {item.is_paid && !item.hasPaid && (
                                    <button
                                        onClick={() => handlePreview(item)}
                                        disabled={previewLoading === item.id}
                                        className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.12em] text-[11px] transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    >
                                        {previewLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                                        Preview
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDownload(item)}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-lg ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'}`}
                                >
                                    {item.is_paid && !item.hasPaid ? <><Lock size={16} /> Unlock Access</> : <><Download size={16} /> Download Now</>}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ── AUDIO TAB ── */}
            {activeTab === 'audio' && (
                isLoading ? <LoadingState label="Syncing Audio Lectures..." /> :
                filtered(audioMaterials).length === 0 ? <EmptyState icon={Volume2} label="No audio lectures uploaded yet." /> :
                <>
                    {/* Mini audio player (sticky when active) */}
                    <AnimatePresence>
                        {activeAudio && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                                className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-4 shadow-2xl mb-6"
                            >
                                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
                                    <Volume2 size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-400 mb-1">Now Playing</p>
                                    <p className="text-sm font-bold truncate">{activeAudio.name}</p>
                                    <audio controls autoPlay src={activeAudio.url} className="w-full mt-2 h-8" style={{ accentColor: '#f59e0b' }} />
                                </div>
                                <button onClick={() => setActiveAudio(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0">
                                    <X size={18} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered(audioMaterials).map((item) => (
                            <motion.div
                                key={item.id}
                                layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2.5rem] p-8 border border-slate-200 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-100 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-6">
                                    <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-sm">
                                        <Volume2 size={24} />
                                    </div>
                                    <AccessBadge item={item} />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{item.name}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </p>
                                <button
                                    onClick={() => handleAudioPlay(item)}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-lg ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'}`}
                                >
                                    {item.is_paid && !item.hasPaid ? <><Lock size={16} /> Unlock Audio</> : <><Play size={16} /> Play Audio</>}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {/* ── VIDEOS TAB ── */}
            {activeTab === 'videos' && (
                isLoadingVideos ? <LoadingState label="Loading Video Lectures..." /> :
                videos.length === 0 ? <EmptyState icon={Video} label="No video lectures available yet." /> :
                <>
                    {/* Video player modal */}
                    <AnimatePresence>
                        {activeVideo && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                            >
                                <motion.div
                                    initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                                    className="bg-slate-900 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl"
                                >
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                        <p className="font-black text-white truncate">{activeVideo.title}</p>
                                        <button onClick={() => setActiveVideo(null)} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="relative" style={{ paddingTop: '56.25%' }}>
                                        <iframe
                                            src={activeVideo.embedUrl}
                                            className="absolute inset-0 w-full h-full"
                                            allowFullScreen
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        />
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((vid) => (
                            <motion.div
                                key={vid.guid}
                                layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100 transition-all group"
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                                    <img
                                        src={vid.thumbnailUrl}
                                        alt={vid.title}
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/40 group-hover:scale-110 transition-transform">
                                            <Play size={22} className="text-white ml-1" />
                                        </div>
                                    </div>
                                    {vid.is_paid && !vid.hasPaid && (
                                        <div className="absolute top-3 right-3 bg-slate-900/80 text-amber-400 text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-sm">
                                            ₦{vid.price?.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                <div className="p-6">
                                    <h4 className="font-black text-slate-900 mb-1 leading-tight">{vid.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">
                                        {new Date(vid.created_at).toLocaleDateString()}
                                    </p>
                                    <button
                                        onClick={() => {
                                            if (vid.is_paid && !vid.hasPaid) {
                                                addToast('Purchase required to watch this video', 'info');
                                                return;
                                            }
                                            setActiveVideo(vid);
                                        }}
                                        className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-[0.12em] text-xs transition-all ${vid.is_paid && !vid.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                    >
                                        {vid.is_paid && !vid.hasPaid ? <><Lock size={14} /> Unlock Video</> : <><Play size={14} /> Watch Now</>}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {/* Preview Modal */}
            <AnimatePresence>
                {previewItem && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Preview</p>
                                    <p className="font-black text-slate-900 text-lg">{previewItem.name}</p>
                                </div>
                                <button onClick={() => setPreviewItem(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="px-8 py-6 max-h-80 overflow-y-auto">
                                <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{previewItem.text}</p>
                            </div>
                            <div className="px-8 py-5 border-t border-slate-100 bg-amber-50 flex items-center justify-between gap-4">
                                <p className="text-xs text-amber-700 font-bold">
                                    Showing first 300 of {previewItem.wordCount.toLocaleString()} words.
                                    Unlock full access for ₦{previewItem.price?.toLocaleString()}.
                                </p>
                                <button
                                    onClick={() => {
                                        setPreviewItem(null);
                                        const mat = materials.find(m => m.name === previewItem.name);
                                        if (mat) { setSelectedMaterial(mat); setShowPaymentModal(true); }
                                    }}
                                    className="shrink-0 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-700 transition-colors flex items-center gap-2"
                                >
                                    <Lock size={13} /> Unlock Full
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Payment Modal */}
            <AnimatePresence>
                {showPaymentModal && selectedMaterial && (
                    <GeniusPaymentModal
                        courseName={selectedMaterial.name}
                        courseId={selectedMaterial.id.toString()}
                        amount={selectedMaterial.price}
                        token={token}
                        addToast={addToast}
                        onClose={() => { setShowPaymentModal(false); setSelectedMaterial(null); }}
                        onSuccess={() => {
                            setShowPaymentModal(false);
                            setSelectedMaterial(null);
                            fetchMaterials();
                            addToast('Access Unlocked! You can now download.', 'success');
                        }}
                        type="material"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Shared sub-components ───────────────────────────────────────────
function AccessBadge({ item }: { item: Material }) {
    if (item.is_paid && !item.hasPaid) {
        return (
            <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">
                ₦{item.price?.toLocaleString()}
            </div>
        );
    }
    return (
        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
            {item.is_paid && <CheckCircle size={10} />}
            {item.is_paid ? 'Purchased' : 'Free'}
        </div>
    );
}

function LoadingState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-amber-600 animate-spin" />
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
