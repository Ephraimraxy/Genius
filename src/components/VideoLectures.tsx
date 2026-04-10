import React, { useState, useEffect, useRef } from 'react';
import {
    Video, Upload, Trash2, Play, Loader2, Film, Plus, X, CheckCircle,
    Save, AlertTriangle, AlertCircle, Info, FileVideo, Wifi, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastType } from './ToastSystem';
import { analyzeFile, FileAnalysis, formatFileSize } from '../utils/fileValidation';

interface VideoItem {
    id: number;
    name: string;
    file_url: string | null;
    mime_type: string | null;
    is_paid: boolean;
    price: number;
    is_available: boolean;
    created_at: string;
}

interface VideoLecturesProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

type UploadPhase = 'idle' | 'analysing' | 'ready' | 'confirm' | 'uploading' | 'done' | 'error';

function CompatibilityBadge({ compat }: { compat: 'full' | 'partial' | 'unknown' }) {
    if (compat === 'full') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
            <CheckCircle size={9} /> Compatible
        </span>
    );
    if (compat === 'partial') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
            <AlertTriangle size={9} /> May Work
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wide">
            <Info size={9} /> Checking
        </span>
    );
}

export default function VideoLectures({ addToast, token }: VideoLecturesProps) {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
    const [uploadStatusMsg, setUploadStatusMsg] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);
    const [videoTitle, setVideoTitle] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const xhrRef = useRef<XMLHttpRequest | null>(null);

    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/videos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setVideos(data.videos || []);
        } catch {
            addToast('Failed to load videos', 'error');
        }
        setIsLoading(false);
    };

    const handleFileSelect = (file: File) => {
        setUploadPhase('analysing');
        setUploadError(null);
        setFileAnalysis(null);

        // Small delay for visual feedback
        setTimeout(() => {
            const analysis = analyzeFile(file, 'video');
            setFileAnalysis(analysis);
            setVideoFile(file);
            if (analysis.error) {
                setUploadPhase('error');
                setUploadError(analysis.error);
            } else {
                setUploadPhase('ready');
            }
        }, 350);
    };

    const handleUpload = async () => {
        if (!videoFile || !videoTitle.trim() || !fileAnalysis || fileAnalysis.error) return;

        setUploadPhase('uploading');
        setUploadProgress(0);
        setUploadError(null);
        setUploadStatusMsg('Preparing upload...');

        try {
            const formData = new FormData();
            formData.append('file', videoFile);
            formData.append('type', 'video');
            formData.append('name', videoTitle.trim());

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhrRef.current = xhr;

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(pct);
                        if (pct < 30) setUploadStatusMsg('Starting upload...');
                        else if (pct < 60) setUploadStatusMsg('Uploading to cloud storage...');
                        else if (pct < 90) setUploadStatusMsg('Almost there...');
                        else setUploadStatusMsg('Finalising...');
                    }
                });

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        let msg = `Upload failed (${xhr.status})`;
                        try {
                            const err = JSON.parse(xhr.responseText);
                            if (err.error) msg = err.error;
                            else if (xhr.status === 413) msg = 'File is too large for the server. Try a smaller file or compress the video.';
                            else if (xhr.status === 415) msg = 'File format not accepted by the server. Try converting to MP4.';
                            else if (xhr.status === 500) msg = 'Server error during upload. Please try again.';
                        } catch {
                            if (xhr.status === 413) msg = 'File is too large. Try compressing the video first.';
                        }
                        reject(new Error(msg));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error — check your internet connection and try again.'));
                xhr.ontimeout = () => reject(new Error('Upload timed out. Check your internet connection and try with a smaller file.'));
                xhr.timeout = 30 * 60 * 1000; // 30 min

                xhr.open('POST', '/api/resources/upload/file');
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });

            setUploadPhase('done');
            setUploadStatusMsg('Upload complete!');
            addToast(`"${videoTitle}" uploaded successfully`, 'success');

            setTimeout(() => {
                closeModal();
                fetchVideos();
            }, 1200);

        } catch (err: any) {
            setUploadPhase('error');
            const msg = err?.message || 'Upload failed. Please try again.';
            setUploadError(msg);
            setUploadStatusMsg('');
            addToast(msg, 'error');
        }
    };

    const cancelUpload = () => {
        if (xhrRef.current) {
            xhrRef.current.abort();
            xhrRef.current = null;
        }
        setUploadPhase('ready');
        setUploadProgress(0);
        setUploadStatusMsg('');
    };

    const closeModal = () => {
        if (uploadPhase === 'uploading') {
            cancelUpload();
        }
        setShowUploadModal(false);
        setVideoTitle('');
        setVideoFile(null);
        setFileAnalysis(null);
        setUploadPhase('idle');
        setUploadProgress(0);
        setUploadError(null);
        setUploadStatusMsg('');
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`/api/videos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            addToast('Video deleted', 'success');
            fetchVideos();
        } catch {
            addToast('Failed to delete video', 'error');
        }
    };

    const updateSettings = async (id: number, settings: { price?: number; is_available?: boolean; is_paid?: boolean }) => {
        try {
            await fetch(`/api/videos/${id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(settings)
            });
            setVideos(prev => prev.map(v => v.id === id ? { ...v, ...settings } : v));
        } catch {
            addToast('Update failed', 'error');
        }
    };

    const canUpload = videoFile && videoTitle.trim() && fileAnalysis && !fileAnalysis.error && uploadPhase === 'ready';

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto pb-32 lg:pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-violet-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-violet-300">
                        <Film size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Video Lectures</h2>
                        <p className="text-slate-500 font-medium">Upload and manage lecture video recordings</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-3 bg-violet-600 hover:bg-violet-700 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-violet-200 transition-all hover:scale-105 uppercase tracking-wider text-sm"
                >
                    <Plus size={20} /> Upload Lecture
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                {[
                    { label: 'Total Videos', value: videos.length, icon: Film, color: 'bg-violet-50 text-violet-600' },
                    { label: 'Available', value: videos.filter(v => v.is_available).length, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Paid Videos', value: videos.filter(v => v.is_paid).length, icon: Video, color: 'bg-amber-50 text-amber-600' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-[1.5rem] p-5 border border-slate-100 shadow-sm">
                        <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                            <stat.icon size={20} />
                        </div>
                        <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Video Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-violet-600" size={48} />
                </div>
            ) : videos.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-16 text-center">
                    <Video className="mx-auto mb-6 text-slate-300" size={64} />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Lecture Videos Yet</h3>
                    <p className="text-slate-400 font-medium mb-8">Upload your first lecture video to get started</p>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="bg-violet-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-violet-700 transition-all"
                    >
                        Upload First Video
                    </button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map((video) => (
                        <motion.div
                            key={video.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-lg hover:border-violet-200 transition-all"
                        >
                            <div
                                className="relative h-44 bg-slate-900 cursor-pointer overflow-hidden"
                                onClick={() => { setSelectedVideo(video); setShowPlayer(true); }}
                            >
                                <div className="w-full h-full flex items-center justify-center">
                                    <Film className="text-slate-700" size={48} />
                                </div>
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl">
                                        <Play className="text-violet-600 ml-1" size={28} />
                                    </div>
                                </div>
                                <div className="absolute top-3 left-3 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600">
                                    Ready
                                </div>
                            </div>
                            <div className="p-5">
                                <h4 className="font-bold text-slate-900 mb-1 truncate">{video.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                    {new Date(video.created_at).toLocaleDateString()}
                                </p>
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const becomingPaid = !video.is_paid;
                                                if (!becomingPaid) {
                                                    updateSettings(video.id, { is_paid: false, price: 0 });
                                                    setPriceInputs(prev => { const n = { ...prev }; delete n[video.id]; return n; });
                                                } else {
                                                    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, is_paid: true } : v));
                                                    setPriceInputs(prev => ({ ...prev, [video.id]: String(video.price || '') }));
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${video.is_paid ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                        >
                                            {video.is_paid ? 'Paid' : 'Free'}
                                        </button>
                                        <div className="flex-1" />
                                        <button
                                            onClick={() => updateSettings(video.id, { is_available: !video.is_available })}
                                            className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${video.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${video.is_available ? 'right-1' : 'left-1'}`} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(video.id)}
                                            className="p-2 text-slate-300 hover:text-rose-600 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    {video.is_paid && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400">₦</span>
                                            <input
                                                type="number"
                                                value={priceInputs[video.id] ?? String(video.price || '')}
                                                onChange={(e) => setPriceInputs(prev => ({ ...prev, [video.id]: e.target.value }))}
                                                placeholder="Enter price"
                                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-violet-400 transition-all"
                                            />
                                            <button
                                                onClick={() => {
                                                    const price = parseInt(priceInputs[video.id] || '0') || 0;
                                                    updateSettings(video.id, { is_paid: true, price });
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                            >
                                                <Save size={12} /> Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-6 md:p-8 border-b bg-violet-50 flex justify-between items-start shrink-0">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Upload Lecture Video</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        MP4, MOV, MKV, WebM, AVI, FLV, WMV and more · Max 2 GB
                                    </p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    disabled={uploadPhase === 'uploading'}
                                    className="p-2 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-30"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
                                {/* Title input */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Video Title *</label>
                                    <input
                                        type="text"
                                        value={videoTitle}
                                        onChange={(e) => setVideoTitle(e.target.value)}
                                        disabled={uploadPhase === 'uploading' || uploadPhase === 'done'}
                                        placeholder="e.g. Lecture 1 — Introduction to Algorithms"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-violet-400 transition-all disabled:opacity-50"
                                    />
                                </div>

                                {/* File drop zone */}
                                {uploadPhase !== 'uploading' && uploadPhase !== 'done' && (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Video File *</label>
                                        <div
                                            onClick={() => uploadPhase !== 'uploading' && fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all cursor-pointer group
                                                ${fileAnalysis?.error ? 'border-rose-300 bg-rose-50' :
                                                  fileAnalysis && !fileAnalysis.error ? 'border-violet-300 bg-violet-50' :
                                                  'border-slate-200 hover:bg-violet-50 hover:border-violet-300'}`}
                                        >
                                            <FileVideo
                                                className={`mx-auto mb-3 transition-colors ${fileAnalysis?.error ? 'text-rose-400' : fileAnalysis ? 'text-violet-500' : 'text-slate-300 group-hover:text-violet-500'}`}
                                                size={36}
                                            />
                                            <p className="font-bold text-slate-700 text-sm">
                                                {videoFile ? videoFile.name : 'Click to select video file'}
                                            </p>
                                            {videoFile && !fileAnalysis && (
                                                <p className="text-[10px] text-slate-400 mt-1">{formatFileSize(videoFile.size)}</p>
                                            )}
                                            {!videoFile && (
                                                <p className="text-[11px] text-slate-400 mt-2">
                                                    MP4, MOV, MKV, WebM, AVI, FLV, WMV, HEVC and more
                                                </p>
                                            )}
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".mp4,.mov,.mkv,.webm,.avi,.flv,.wmv,.m4v,.3gp,.3g2,.ogv,.ts,.mts,.m2ts,.mpeg,.mpg,.hevc,.h264,.h265,.asf,.divx,.rmvb,.vob"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                        />
                                    </div>
                                )}

                                {/* Analysing indicator */}
                                <AnimatePresence>
                                    {uploadPhase === 'analysing' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100"
                                        >
                                            <Loader2 className="animate-spin text-violet-500 shrink-0" size={18} />
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">Analysing file...</p>
                                                <p className="text-xs text-slate-400">Detecting format and compatibility</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* File Analysis Card */}
                                <AnimatePresence>
                                    {fileAnalysis && uploadPhase !== 'uploading' && uploadPhase !== 'done' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className={`rounded-2xl border p-4 space-y-3 ${
                                                fileAnalysis.error ? 'bg-rose-50 border-rose-200' :
                                                fileAnalysis.warning ? 'bg-amber-50 border-amber-200' :
                                                'bg-emerald-50 border-emerald-200'
                                            }`}
                                        >
                                            {/* Info rows */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-white/70 rounded-xl p-2.5">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Format</p>
                                                    <p className="text-sm font-black text-slate-900">{fileAnalysis.formatLabel}</p>
                                                </div>
                                                <div className="bg-white/70 rounded-xl p-2.5">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">File Size</p>
                                                    <p className="text-sm font-black text-slate-900">{fileAnalysis.sizeFormatted}</p>
                                                </div>
                                                <div className="bg-white/70 rounded-xl p-2.5 col-span-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Compatibility</p>
                                                    <CompatibilityBadge compat={fileAnalysis.error ? 'unknown' : fileAnalysis.compatible} />
                                                </div>
                                            </div>

                                            {/* Error */}
                                            {fileAnalysis.error && (
                                                <div className="flex items-start gap-2 p-3 bg-rose-100 rounded-xl border border-rose-200">
                                                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                                    <p className="text-xs font-bold text-rose-700">{fileAnalysis.error}</p>
                                                </div>
                                            )}

                                            {/* Warning */}
                                            {fileAnalysis.warning && !fileAnalysis.error && (
                                                <div className="flex items-start gap-2 p-3 bg-amber-100 rounded-xl border border-amber-200">
                                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                                    <p className="text-xs font-bold text-amber-700">{fileAnalysis.warning}</p>
                                                </div>
                                            )}

                                            {/* All clear */}
                                            {!fileAnalysis.error && !fileAnalysis.warning && (
                                                <div className="flex items-center gap-2 p-3 bg-emerald-100 rounded-xl border border-emerald-200">
                                                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                                    <p className="text-xs font-bold text-emerald-700">
                                                        File looks good and ready to upload.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Change file hint */}
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-[10px] font-black text-slate-400 hover:text-violet-600 uppercase tracking-widest transition-colors w-full text-center pt-1"
                                            >
                                                Choose a different file
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Upload Error (server-side) */}
                                {uploadError && uploadPhase === 'error' && !fileAnalysis?.error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl"
                                    >
                                        <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-black text-rose-700 mb-0.5">Upload Failed</p>
                                            <p className="text-xs text-rose-600">{uploadError}</p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Progress Bar */}
                                {uploadPhase === 'uploading' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-3"
                                    >
                                        <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Wifi className="text-violet-500 animate-pulse shrink-0" size={18} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-black text-slate-800">{uploadStatusMsg}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate">{videoFile?.name}</p>
                                                </div>
                                                <span className="text-xl font-black text-violet-600">{uploadProgress}%</span>
                                            </div>
                                            <div className="h-3 bg-violet-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-violet-600 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${uploadProgress}%` }}
                                                    transition={{ ease: 'linear', duration: 0.3 }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-2">
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {formatFileSize(Math.round((videoFile?.size || 0) * uploadProgress / 100))} of {formatFileSize(videoFile?.size || 0)}
                                                </span>
                                                <span className="text-[10px] text-violet-500 font-black">UPLOADING</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={cancelUpload}
                                            className="w-full py-3 border border-slate-200 rounded-2xl text-xs font-black text-slate-500 hover:text-rose-600 hover:border-rose-200 transition-all uppercase tracking-widest"
                                        >
                                            Cancel Upload
                                        </button>
                                    </motion.div>
                                )}

                                {/* Done state */}
                                {uploadPhase === 'done' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center gap-3 py-6"
                                    >
                                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                            <CheckCircle className="text-emerald-600" size={32} />
                                        </div>
                                        <p className="text-lg font-black text-slate-900">Upload Complete!</p>
                                        <p className="text-sm text-slate-500">Your video is ready in the library.</p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer actions */}
                            {uploadPhase !== 'uploading' && uploadPhase !== 'done' && (
                                <div className="px-6 md:px-8 pb-6 md:pb-8 shrink-0">
                                    <button
                                        onClick={handleUpload}
                                        disabled={!canUpload}
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-3"
                                    >
                                        <Upload size={18} />
                                        {uploadPhase === 'error' && !fileAnalysis?.error ? 'Retry Upload' : 'Upload Video'}
                                    </button>
                                    {!canUpload && fileAnalysis?.error && (
                                        <p className="text-center text-[10px] text-rose-500 font-bold mt-2 uppercase tracking-wide">
                                            Fix the issue above to continue
                                        </p>
                                    )}
                                    {!canUpload && !videoFile && (
                                        <p className="text-center text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wide">
                                            Select a video file to continue
                                        </p>
                                    )}
                                    {!canUpload && videoFile && fileAnalysis && !fileAnalysis.error && !videoTitle.trim() && (
                                        <p className="text-center text-[10px] text-amber-500 font-bold mt-2 uppercase tracking-wide">
                                            Enter a title to continue
                                        </p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Video Player Modal */}
            <AnimatePresence>
                {showPlayer && selectedVideo && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-10">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                            onClick={() => setShowPlayer(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-5xl bg-black rounded-[2rem] overflow-hidden shadow-2xl"
                        >
                            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
                                <h3 className="text-white font-bold truncate">{selectedVideo.name}</h3>
                                <button onClick={() => setShowPlayer(false)} className="p-2 text-slate-400 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            {selectedVideo.file_url ? (
                                <video src={selectedVideo.file_url} controls autoPlay className="w-full max-h-[70vh]" />
                            ) : (
                                <div className="flex items-center justify-center h-48 text-slate-500">Video not available</div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
