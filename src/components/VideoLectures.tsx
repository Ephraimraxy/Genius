import React, { useState, useEffect, useRef } from 'react';
import { 
    Video, 
    Upload, 
    Trash2, 
    Eye, 
    Play,
    Loader2,
    Film,
    Clock,
    HardDrive,
    Plus,
    X,
    Coins,
    BarChart3,
    CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastType } from './ToastSystem';
import { friendlyError } from '../utils/friendlyError';

interface VideoItem {
    guid: string;
    title: string;
    status: number; // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
    length: number;
    views: number;
    dateUploaded: string;
    storageSize: number;
    thumbnailUrl: string;
    is_available?: boolean;
    is_paid?: boolean;
    price?: number;
}

interface VideoLecturesProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}


const statusMap: Record<number, { label: string; color: string }> = {
    0: { label: 'Created', color: 'bg-slate-100 text-slate-500' },
    1: { label: 'Uploaded', color: 'bg-blue-50 text-blue-600' },
    2: { label: 'Processing', color: 'bg-amber-50 text-amber-600' },
    3: { label: 'Transcoding', color: 'bg-indigo-50 text-indigo-600' },
    4: { label: 'Ready', color: 'bg-emerald-50 text-emerald-600' },
    5: { label: 'Error', color: 'bg-rose-50 text-rose-600' },
};

export default function VideoLectures({ addToast, token }: VideoLecturesProps) {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [cdnHost, setCdnHost] = useState('');
    const [libraryId, setLibraryId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [showPlayer, setShowPlayer] = useState(false);
    const [videoTitle, setVideoTitle] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            if (data.cdnHost) setCdnHost(data.cdnHost);
            if (data.libraryId) setLibraryId(data.libraryId);
        } catch (err) {
            addToast('Failed to load videos', 'error');
        }
        setIsLoading(false);
    };

    const handleUpload = async () => {
        if (!videoFile || !videoTitle.trim()) {
            addToast('Please provide a title and select a video file', 'error');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: Create video entry on server (which creates it on Bunny)
            const createRes = await fetch('/api/videos/create', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ title: videoTitle })
            });
            
            const { videoId, uploadUrl } = await createRes.json();
            if (!videoId) throw new Error('Failed to create video entry');

            // Step 2: Upload the actual file via XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            });

            await new Promise<void>((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload failed: ${xhr.status}`));
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(videoFile);
            });

            addToast('Video uploaded successfully! Processing will begin shortly.', 'success');
            setShowUploadModal(false);
            setVideoTitle('');
            setVideoFile(null);
            fetchVideos();
        } catch (err: any) {
            addToast(friendlyError(err, 'upload'), 'error');
        }
        setIsUploading(false);
    };

    const handleDelete = async (guid: string) => {
        try {
            await fetch(`/api/videos/${guid}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            addToast('Video deleted', 'success');
            fetchVideos();
        } catch (err) {
            addToast('Failed to delete video', 'error');
        }
    };

    const updateSettings = async (guid: string, settings: { price?: number; is_available?: boolean; is_paid?: boolean }) => {
        try {
            await fetch(`/api/videos/${guid}/settings`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(settings)
            });
            addToast('Settings updated', 'success');
            fetchVideos();
        } catch (err) {
            addToast('Update failed', 'error');
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const totalStorage = videos.reduce((sum, v) => sum + (v.storageSize || 0), 0);
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const readyCount = videos.filter(v => v.status === 4).length;

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
                        <p className="text-slate-500 font-medium">Upload, manage, and stream lecture videos powered by Bunny Stream</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {[
                    { label: 'Total Videos', value: videos.length, icon: Film, color: 'bg-violet-50 text-violet-600' },
                    { label: 'Ready to Stream', value: readyCount, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Total Views', value: totalViews, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Storage Used', value: formatSize(totalStorage), icon: HardDrive, color: 'bg-amber-50 text-amber-600' },
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
                    {videos.map((video) => {
                        const status = statusMap[video.status] || statusMap[0];
                        return (
                            <motion.div
                                key={video.guid}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-lg hover:border-violet-200 transition-all"
                            >
                                {/* Thumbnail */}
                                <div 
                                    className="relative h-44 bg-slate-900 cursor-pointer overflow-hidden"
                                    onClick={() => { 
                                        if (video.status === 4) { setSelectedVideo(video); setShowPlayer(true); }
                                    }}
                                >
                                    {video.thumbnailUrl ? (
                                        <img 
                                            src={video.thumbnailUrl} 
                                            alt={video.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Film className="text-slate-700" size={48} />
                                        </div>
                                    )}
                                    
                                    {/* Play overlay */}
                                    {video.status === 4 && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl">
                                                <Play className="text-violet-600 ml-1" size={28} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Duration badge */}
                                    {video.length > 0 && (
                                        <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                            <Clock size={12} /> {formatDuration(video.length)}
                                        </div>
                                    )}

                                    {/* Status badge */}
                                    <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${status.color}`}>
                                        {status.label}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-5">
                                    <h4 className="font-bold text-slate-900 mb-1 truncate">{video.title}</h4>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                        <span>{video.views} views</span>
                                        <span>•</span>
                                        <span>{formatSize(video.storageSize)}</span>
                                        <span>•</span>
                                        <span>{new Date(video.dateUploaded).toLocaleDateString()}</span>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2 flex-1">
                                            <button
                                                onClick={() => updateSettings(video.guid, { is_paid: !video.is_paid })}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                                    video.is_paid ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}
                                            >
                                                {video.is_paid ? 'Paid' : 'Free'}
                                            </button>
                                            {video.is_paid && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-black text-slate-400">₦</span>
                                                    <input
                                                        type="number"
                                                        defaultValue={video.price || 0}
                                                        onBlur={(e) => updateSettings(video.guid, { price: parseInt(e.target.value) || 0 })}
                                                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => updateSettings(video.guid, { is_available: !video.is_available })}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${video.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${video.is_available ? 'right-1' : 'left-1'}`} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(video.guid)}
                                            className="p-2 text-slate-300 hover:text-rose-600 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b bg-violet-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Upload Lecture Video</h3>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Supports MP4, MOV, MKV, AVI</p>
                                </div>
                                <button onClick={() => setShowUploadModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Video Title</label>
                                    <input
                                        type="text"
                                        value={videoTitle}
                                        onChange={(e) => setVideoTitle(e.target.value)}
                                        placeholder="e.g. Lecture 1 — Introduction to Algorithms"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-violet-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Video File</label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center hover:bg-violet-50 hover:border-violet-300 transition-all cursor-pointer group"
                                    >
                                        <Upload className="mx-auto text-slate-300 group-hover:text-violet-500 mb-3 transition-colors" size={40} />
                                        <p className="font-bold text-slate-600 text-sm">
                                            {videoFile ? videoFile.name : 'Click to select video file'}
                                        </p>
                                        {videoFile && (
                                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                                                {formatSize(videoFile.size)}
                                            </p>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && setVideoFile(e.target.files[0])}
                                    />
                                </div>

                                {isUploading && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>Uploading to Bunny Stream...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-violet-600 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadProgress}%` }}
                                                transition={{ ease: 'linear' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || !videoFile || !videoTitle.trim()}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-4 rounded-2xl disabled:opacity-50 transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-3"
                                >
                                    {isUploading ? (
                                        <><Loader2 className="animate-spin" size={20} /> Uploading...</>
                                    ) : (
                                        <><Upload size={20} /> Upload Video</>
                                    )}
                                </button>
                            </div>
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
                                <div>
                                    <h3 className="text-white font-bold truncate">{selectedVideo.title}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Bunny Stream &bull; Adaptive Playback
                                    </p>
                                </div>
                                <button onClick={() => setShowPlayer(false)} className="p-2 text-slate-400 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="relative" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                    src={`https://iframe.mediadelivery.net/embed/${libraryId}/${selectedVideo.guid}?autoplay=true&loop=false&muted=false&preload=true`}
                                    loading="lazy"
                                    className="absolute inset-0 w-full h-full border-none"
                                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
