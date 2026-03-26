import React, { useState, useEffect } from 'react';
import { 
    Upload, 
    Database, 
    FileText, 
    Users, 
    CheckCircle, 
    AlertTriangle, 
    Trash2, 
    Search,
    RefreshCw,
    ShieldCheck,
    FileUp,
    Download,
    Mic,
    Volume2,
    Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FilePreviewModal from './FilePreviewModal';
import { ToastType } from './ToastSystem';

interface Resource {
    id: number;
    type: 'roster' | 'material' | 'audio';
    name: string;
    status: 'ready' | 'failed' | 'pending' | 'short';
    created_at: string;
    is_available: boolean;
    is_paid: boolean;
    price: number;
}

interface ResourceHubProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function ResourceHub({ addToast, token }: ResourceHubProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadType, setUploadType] = useState<'roster' | 'material' | 'audio'>('roster');
    const [fileHandle, setFileHandle] = useState<File | null>(null);
    const [previewFile, setPreviewFile] = useState<File | string | null>(null);
    const [previewName, setPreviewName] = useState<string>('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [categories, setCategories] = useState<{id: number, name: string, is_paid_entry: boolean, entry_fee: number}[]>([]);
    const [isUpdatingCategory, setIsUpdatingCategory] = useState<number | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string>('');

    useEffect(() => {
        fetchResources();
        fetchCategories();
        fetchTenantInfo();
    }, []);

    const fetchTenantInfo = async () => {
        try {
            const res = await fetch('/api/tenant/info', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.workspace_id) setWorkspaceId(data.workspace_id);
        } catch (err) {
            console.error('Failed to load tenant info');
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/courses/categories', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setCategories(data);
        } catch (err) {
            console.error('Failed to load categories');
        }
    };

    const fetchResources = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/resources', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setResources(data);
        } catch (err) {
            addToast('Failed to load resources', 'error');
        }
        setIsLoading(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFileHandle(e.target.files[0]);
        }
    };

    const processUpload = async () => {
        if (!fileHandle) return;
        setIsUploading(true);

        // ─── AUDIO: Upload to Bunny Stream (same path as video) ───
        if (uploadType === 'audio') {
            try {
                // Step 1: Create entry on Bunny Stream
                const createRes = await fetch('/api/videos/create', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ title: `[Audio] ${fileHandle.name}` })
                });
                const { videoId, uploadUrl, cdnHost } = await createRes.json();
                if (!videoId) throw new Error('Failed to create audio entry');

                // Step 2: Upload audio file to Bunny
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: fileHandle
                });
                if (!uploadRes.ok) throw new Error('Bunny upload failed');

                // Step 3: Save reference in resources table (URL only, not the file)
                const bunnyStreamUrl = `https://${cdnHost || 'vz-3d11f78c-1a6.b-cdn.net'}/${videoId}/play.mp4`;
                await fetch('/api/resources/upload', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'audio',
                        name: fileHandle.name,
                        content: JSON.stringify({ bunnyId: videoId, streamUrl: bunnyStreamUrl })
                    })
                });

                addToast('Audio uploaded to Bunny Stream CDN successfully!', 'success');
                fetchResources();
                setFileHandle(null);
            } catch (err: any) {
                addToast(`Audio upload failed: ${err.message}`, 'error');
            }
            setIsUploading(false);
            return;
        }

        // ─── ROSTER / MATERIAL: Keep existing PostgreSQL flow ───
        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawContent = e.target?.result as string;
            let finalContent: any = rawContent;

            if (uploadType === 'roster') {
                const lines = rawContent.split('\n');
                finalContent = lines.map(line => {
                    const [matric, email] = line.split(',');
                    return { matricNumber: matric?.trim(), email: email?.trim() };
                }).filter(s => s.matricNumber && s.email);
            }

            try {
                const res = await fetch('/api/resources/upload', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: uploadType,
                        name: fileHandle.name,
                        content: finalContent
                    })
                });
                const data = await res.json();
                if (data.success) {
                    addToast(`${uploadType === 'roster' ? 'Student Data' : 'Material'} uploaded & sanitized successfully`, 'success');
                    fetchResources();
                    setFileHandle(null);
                } else {
                    addToast(data.error || 'Upload failed', 'error');
                }
            } catch (err) {
                addToast('Network error during upload', 'error');
            }
            setIsUploading(false);
        };

        reader.readAsText(fileHandle);
    };


    const deleteResource = async (id: number) => {
        try {
            const res = await fetch(`/api/resources/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setResources(resources.filter(r => r.id !== id));
                addToast('Resource removed', 'info');
            }
        } catch (err) {
            addToast('Delete failed', 'error');
        }
    };

    const updateResourceSettings = async (id: number, settings: { price?: number; is_available?: boolean; is_paid?: boolean }) => {
        try {
            await fetch(`/api/resources/${id}/settings`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(settings)
            });
            addToast('Settings updated', 'success');
            fetchResources();
        } catch (err) {
            addToast('Update failed', 'error');
        }
    };

    const updateCategoryFee = async (id: number, is_paid: boolean, fee: number) => {
        setIsUpdatingCategory(id);
        try {
            const res = await fetch(`/api/courses/categories/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ is_paid_entry: is_paid, entry_fee: fee })
            });
            if (res.ok) {
                addToast('Batch entry settings updated', 'success');
                fetchCategories();
            }
        } catch (err) {
            addToast('Failed to update category', 'error');
        }
        setIsUpdatingCategory(null);
    };

    return (
        <div className="space-y-8 pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Genius Resource Hub <Database className="text-blue-600" size={28} />
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 font-medium">Global storage for your rosters and lecture notes. Upload once, use everywhere.</p>
                        {workspaceId && (
                            <div className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 animate-pulse">
                                <ShieldCheck size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Workspace ID: {workspaceId}</span>
                            </div>
                        )}
                    </div>
                </div>
                <button 
                    onClick={fetchResources}
                    className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                >
                    <RefreshCw className={isLoading ? 'animate-spin' : ''} size={20} />
                </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Upload Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[80px] -mr-16 -mt-16 opacity-30"></div>
                         <h3 className="text-xl font-bold mb-6 relative z-10">Global Upload</h3>
                         
                         <div className="space-y-4 relative z-10">
                            <div className="flex p-1 bg-white/10 rounded-2xl border border-white/10">
                                <button 
                                    onClick={() => setUploadType('roster')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadType === 'roster' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Student Data
                                </button>
                                <button 
                                    onClick={() => setUploadType('material')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadType === 'material' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Lecture Material
                                </button>
                                <button 
                                    onClick={() => setUploadType('audio')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadType === 'audio' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Audio Record
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-white/20 rounded-[2rem] p-10 text-center hover:border-blue-400 hover:bg-white/5 transition-all cursor-pointer relative group">
                                <input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                />
                                <Upload className="mx-auto text-white/30 group-hover:text-blue-400 mb-4" size={32} />
                                <p className="font-bold text-sm">
                                    {fileHandle ? fileHandle.name : 'Choose File'}
                                </p>
                                {fileHandle && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewFile(fileHandle);
                                            setPreviewName(fileHandle.name);
                                            setIsPreviewOpen(true);
                                        }}
                                        className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all relative z-20"
                                    >
                                        <Eye size={14} /> Quick Preview
                                    </button>
                                )}
                            </div>

                            <button 
                                onClick={processUpload}
                                disabled={!fileHandle || isUploading}
                                className={`w-full ${uploadType === 'audio' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'} text-white font-black py-4 rounded-2xl transition-all disabled:opacity-40 shadow-xl flex items-center justify-center gap-2`}
                            >
                                {isUploading ? <RefreshCw className="animate-spin" size={20} /> : (uploadType === 'audio' ? <Mic size={20} /> : <ShieldCheck size={20} />)}
                                {isUploading ? (uploadType === 'audio' ? 'Neural Refining...' : 'Sanitizing...') : (uploadType === 'audio' ? 'Upload & Refine' : 'Upload & Sanitize')}
                            </button>
                         </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Batch Entry Fees</h4>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {categories.length === 0 && <p className="text-xs text-slate-400">No student categories defined yet.</p>}
                            {categories.map(cat => (
                                <div key={cat.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black text-slate-900 uppercase truncate max-w-[120px]">{cat.name}</span>
                                        <button 
                                            onClick={() => updateCategoryFee(cat.id, !cat.is_paid_entry, cat.entry_fee)}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${cat.is_paid_entry ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                                        >
                                            {cat.is_paid_entry ? 'Paid Entry' : 'Free Entry'}
                                        </button>
                                    </div>
                                    {cat.is_paid_entry && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400">₦</span>
                                            <input 
                                                type="number"
                                                defaultValue={cat.entry_fee}
                                                onBlur={(e) => updateCategoryFee(cat.id, true, parseInt(e.target.value) || 0)}
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Resource List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-slate-900">Academic Inventory</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    placeholder="Filter resources..."
                                    className="pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-400 transition-all w-64"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {resources.length === 0 && !isLoading && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 grayscale opacity-40">
                                        <FileUp size={48} className="mx-auto mb-4" />
                                        <p className="font-bold">No resources found in your workspace.</p>
                                    </motion.div>
                                )}
                                
                                {resources.map((item) => (
                                    <motion.div 
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-blue-200 transition-all"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                                                item.type === 'roster' ? 'bg-indigo-50 text-indigo-600' : 
                                                item.type === 'audio' ? 'bg-rose-50 text-rose-600' :
                                                'bg-amber-50 text-amber-600'
                                            }`}>
                                                {item.type === 'roster' ? <Users size={24} /> : 
                                                 item.type === 'audio' ? <Volume2 size={24} /> : 
                                                 <FileText size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.name}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.type}</span>
                                                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${item.status === 'ready' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                        {item.status === 'ready' ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                                                        {item.status === 'ready' ? 'Sanitized & Ready' : (item.status === 'failed' ? 'Checks Failed' : 'Resource Flagged')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.type !== 'roster' && (
                                                <div className="flex items-center gap-2 mr-4 border-r pr-4 border-slate-200">
                                                    <button
                                                        onClick={() => updateResourceSettings(item.id, { is_paid: !item.is_paid })}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                                            item.is_paid ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                                        }`}
                                                    >
                                                        {item.is_paid ? 'Paid' : 'Free'}
                                                    </button>
                                                    {item.is_paid && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-black text-slate-400">₦</span>
                                                            <input
                                                                type="number"
                                                                defaultValue={item.price || 0}
                                                                onBlur={(e) => updateResourceSettings(item.id, { price: parseInt(e.target.value) || 0 })}
                                                                className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold"
                                                            />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => updateResourceSettings(item.id, { is_available: !item.is_available })}
                                                        className={`ml-2 w-8 h-4 rounded-full relative transition-colors ${item.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${item.is_available ? 'right-0.5' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    setPreviewFile(`/api/resources/${item.id}/download`); // Assuming this endpoint exists or just use a placeholder
                                                    setPreviewName(item.name);
                                                    setIsPreviewOpen(true);
                                                }}
                                                className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-2xl border border-slate-200 shadow-sm transition-all hover:scale-105"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-200 shadow-sm transition-all hover:scale-105">
                                                <Download size={18} />
                                            </button>
                                            <button 
                                                onClick={() => deleteResource(item.id)}
                                                className="p-3 bg-white text-slate-400 hover:text-rose-600 rounded-2xl border border-slate-200 shadow-sm transition-all hover:scale-105"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    fileName={previewName}
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </div>
    );
}
