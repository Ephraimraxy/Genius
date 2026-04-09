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
import { friendlyError } from '../utils/friendlyError';

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

    // Batch Category Modal States
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedCatId, setSelectedCatId] = useState<string>('');
    const [newCatName, setNewCatName] = useState('');
    const [isPaidEntry, setIsPaidEntry] = useState(false);
    const [entryFee, setEntryFee] = useState(0);
    const [batchNameError, setBatchNameError] = useState('');

    // Import result summary modal
    const [importSummary, setImportSummary] = useState<{
        added: number; updated: number; conflicts: number; failed: number;
        conflictList: {matric: string, name: string, reason: string}[];
        failedList: {matric: string, reason: string}[];
        updatedList: {matric: string, name: string, changes: string[]}[];
    } | null>(null);

    // Roster viewer state
    const [showRosterViewer, setShowRosterViewer] = useState(false);
    const [rosterStudents, setRosterStudents] = useState<any[]>([]);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterSearch, setRosterSearch] = useState('');
    const [resendingId, setResendingId] = useState<number | null>(null);
    const [bulkResending, setBulkResending] = useState(false);

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

    const openRosterViewer = async () => {
        setShowRosterViewer(true);
        setRosterLoading(true);
        try {
            const res = await fetch('/api/courses/roster', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setRosterStudents(Array.isArray(data) ? data : []);
        } catch { addToast('Failed to load roster', 'error'); }
        setRosterLoading(false);
    };

    const resendOne = async (studentId: number) => {
        setResendingId(studentId);
        try {
            const res = await fetch(`/api/courses/roster/${studentId}/resend`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                addToast(data.message, 'success');
                setRosterStudents(prev => prev.map(s => s.id === studentId ? { ...s, email_status: 'sent' } : s));
            } else {
                addToast(data.error || 'Resend failed', 'error');
            }
        } catch { addToast('Network error', 'error'); }
        setResendingId(null);
    };

    const bulkResend = async (categoryId?: number) => {
        setBulkResending(true);
        try {
            const res = await fetch('/api/courses/roster/bulk-resend', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryId })
            });
            const data = await res.json();
            if (data.success) {
                addToast(`Resent to ${data.sent}/${data.total} student(s)`, 'success');
                // Refresh roster list
                const r2 = await fetch('/api/courses/roster', { headers: { 'Authorization': `Bearer ${token}` } });
                setRosterStudents(await r2.json());
            } else {
                addToast(data.error || 'Bulk resend failed', 'error');
            }
        } catch { addToast('Network error', 'error'); }
        setBulkResending(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFileHandle(e.target.files[0]);
        }
    };

    const processUpload = async () => {
        if (!fileHandle) return;

        // For roster, we must first ensure category is selected
        if (uploadType === 'roster' && !showBatchModal && !selectedCatId && !newCatName) {
            setShowBatchModal(true);
            return;
        }

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
                addToast(friendlyError(err, 'upload'), 'error');
            }
            setIsUploading(false);
            return;
        }

        // ─── ROSTER: Parse CSV client-side → send as JSON ───
        if (uploadType === 'roster') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const rawContent = e.target?.result as string;
                const lines = rawContent.split('\n');
                const finalContent = lines.map(line => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length === 3) {
                        return { name: parts[0], matricNumber: parts[1], email: parts[2] };
                    } else if (parts.length === 2) {
                        return { name: parts[0], matricNumber: parts[0], email: parts[1] };
                    }
                    return null;
                }).filter(s => s && (s as any).matricNumber && (s as any).email);

                try {
                    const res = await fetch('/api/resources/upload', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'roster', name: fileHandle.name, content: finalContent,
                            categoryId: selectedCatId, categoryName: newCatName, isPaidEntry, entryFee
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        if (data.rosterSummary) {
                            setImportSummary(data.rosterSummary);
                        } else {
                            addToast('Students uploaded successfully', 'success');
                        }
                        fetchResources();
                        setFileHandle(null);
                        setSelectedCatId('');
                        setNewCatName('');
                    } else {
                        addToast(data.error || 'Upload failed', 'error');
                    }
                } catch (err) {
                    addToast('Network error during upload', 'error');
                }
                setIsUploading(false);
            };
            reader.readAsText(fileHandle);
            return;
        }

        // ─── MATERIAL: Send binary file via FormData — server extracts text ───
        try {
            const formData = new FormData();
            formData.append('file', fileHandle);
            formData.append('type', uploadType);
            formData.append('name', fileHandle.name);
            if (selectedCatId) formData.append('categoryId', String(selectedCatId));
            if (newCatName) formData.append('categoryName', newCatName);
            if (isPaidEntry !== undefined) formData.append('isPaidEntry', String(isPaidEntry));
            if (entryFee !== undefined) formData.append('entryFee', String(entryFee));

            const res = await fetch('/api/resources/upload/file', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                addToast('Material uploaded successfully', 'success');
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
                                    accept={uploadType === 'roster' ? '.csv,text/csv' : uploadType === 'audio' ? 'audio/*' : '.pdf,.docx,.doc,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation'}
                                    onChange={handleFileUpload}
                                />
                                <Upload className="mx-auto text-white/30 group-hover:text-blue-400 mb-4" size={32} />
                                <p className="font-bold text-sm">
                                    {fileHandle ? fileHandle.name : 'Choose File'}
                                </p>
                                {uploadType === 'roster' && (
                                    <p className="text-[10px] text-white/40 mt-2 text-center">
                                        Support 3 columns: <span className="text-white/60 font-bold">Full Name, Matric, Email</span> for personalized onboarding.
                                    </p>
                                )}
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
                            {uploadType === 'roster' && (
                                <button
                                    onClick={openRosterViewer}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm border border-white/20"
                                >
                                    <Users size={16} /> View Enrolled Students & Email Status
                                </button>
                            )}
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

                                        <div className="flex items-center gap-2">
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
                                            <button 
                                                onClick={() => {
                                                    fetch(`/api/resources/${item.id}/download`, {
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    })
                                                    .then(res => res.blob())
                                                    .then(blob => {
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = item.name + (item.type === 'roster' && !item.name.toLowerCase().endsWith('.csv') ? '.csv' : '');
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        a.remove();
                                                        window.URL.revokeObjectURL(url);
                                                    })
                                                    .catch(err => addToast('Download failed', 'error'));
                                                }}
                                                className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-200 shadow-sm transition-all hover:scale-105"
                                            >
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

            {/* Batch Category Modal */}
            <AnimatePresence>
                {showBatchModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setShowBatchModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100"
                        >
                            <div className="bg-slate-900 p-8 text-white">
                                <h3 className="text-xl font-black flex items-center gap-3">
                                    <Users className="text-blue-400" /> Setup Student Batch
                                </h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">Assign these students to a category and set access rules.</p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Choose Batch Category</label>
                                        <select 
                                            value={selectedCatId}
                                            onChange={(e) => {
                                                setSelectedCatId(e.target.value);
                                                if (e.target.value) { setNewCatName(''); setBatchNameError(''); }
                                            }}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm"
                                        >
                                            <option value="">--- Create New Category ---</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {!selectedCatId && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">New Batch Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 200 Level Maths"
                                                value={newCatName}
                                                onChange={(e) => { setNewCatName(e.target.value); if (e.target.value.trim()) setBatchNameError(''); }}
                                                className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none font-bold text-sm transition-all ${batchNameError ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">Access Control</p>
                                            <p className="text-[10px] text-slate-500">Should students pay to access the portal?</p>
                                        </div>
                                        <button 
                                            onClick={() => setIsPaidEntry(!isPaidEntry)}
                                            className={`w-14 h-8 rounded-full relative transition-all ${isPaidEntry ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${isPaidEntry ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    {isPaidEntry && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="pt-4 border-t border-slate-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-black text-slate-400">₦</span>
                                                <input 
                                                    type="number"
                                                    placeholder="Set Entry Fee"
                                                    value={entryFee}
                                                    onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                                                    className="flex-1 bg-transparent border-b-2 border-slate-200 focus:border-indigo-600 py-2 outline-none font-black text-xl"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {batchNameError && (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl">
                                        <span className="text-rose-500 text-lg">⚠️</span>
                                        <p className="text-rose-700 text-xs font-bold">{batchNameError}</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (!selectedCatId && !newCatName.trim()) {
                                            setBatchNameError('Please choose an existing category or enter a new batch name to continue.');
                                            return;
                                        }
                                        setBatchNameError('');
                                        setShowBatchModal(false);
                                        processUpload();
                                    }}
                                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                >
                                    Confirm & Start Batch Upload
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Import Result Summary Modal ── */}
            <AnimatePresence>
                {importSummary && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setImportSummary(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden max-h-[85vh] flex flex-col">
                            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-lg">Upload Complete</h3>
                                    <p className="text-slate-400 text-xs mt-1">Detailed import breakdown below</p>
                                </div>
                                <button onClick={() => setImportSummary(null)} className="text-white/50 hover:text-white text-xl font-bold">✕</button>
                            </div>
                            <div className="p-6 space-y-4 overflow-y-auto">
                                {/* Stats row */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Added', value: importSummary.added, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                        { label: 'Updated', value: importSummary.updated, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                                        { label: 'Conflicts', value: importSummary.conflicts, color: 'bg-amber-50 text-amber-700 border-amber-100' },
                                        { label: 'Failed', value: importSummary.failed, color: 'bg-rose-50 text-rose-700 border-rose-100' },
                                    ].map(stat => (
                                        <div key={stat.label} className={`p-3 rounded-2xl border text-center ${stat.color}`}>
                                            <p className="text-2xl font-black">{stat.value}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest mt-0.5">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {importSummary.added > 0 && (
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">✅ {importSummary.added} student(s) enrolled — welcome emails sent</p>
                                    </div>
                                )}
                                {importSummary.updated > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">🔄 {importSummary.updated} record(s) updated — no re-email</p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {(importSummary.updatedList || []).map((u: {matric: string, name: string, changes: string[]}, i: number) => (
                                                <div key={i} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                    <p className="text-xs font-bold text-slate-900">{u.matric} — {u.name}</p>
                                                    {u.changes.length > 0
                                                        ? u.changes.map((c: string, j: number) => <p key={j} className="text-[10px] text-blue-700 mt-0.5">{c}</p>)
                                                        : <p className="text-[10px] text-slate-400 mt-0.5">No field changes detected</p>
                                                    }
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {importSummary.conflictList.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">⚠️ Conflicts — review required</p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {importSummary.conflictList.map((c, i) => (
                                                <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                                    <p className="text-xs font-bold text-slate-900">{c.matric} — {c.name}</p>
                                                    <p className="text-[10px] text-amber-700 mt-0.5">{c.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {importSummary.failedList.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">❌ Failed — invalid data</p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {importSummary.failedList.map((f, i) => (
                                                <div key={i} className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                                                    <p className="text-xs font-bold text-slate-900">{f.matric}</p>
                                                    <p className="text-[10px] text-rose-700 mt-0.5">{f.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button onClick={() => setImportSummary(null)}
                                    className="w-full bg-slate-900 text-white font-black py-3 rounded-2xl hover:bg-slate-800 transition-all">
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Roster Viewer Modal ── */}
            <AnimatePresence>
                {showRosterViewer && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowRosterViewer(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="bg-slate-900 p-6 text-white">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-black text-lg flex items-center gap-2"><Users size={20} className="text-blue-400" /> Enrolled Students</h3>
                                        <p className="text-slate-400 text-xs mt-1">{rosterStudents.length} total · email delivery status per student</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => bulkResend()}
                                            disabled={bulkResending}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                        >
                                            {bulkResending ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                            Resend Failed
                                        </button>
                                        <button onClick={() => setShowRosterViewer(false)} className="text-white/50 hover:text-white text-xl font-bold">✕</button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by name, matric or email…"
                                    value={rosterSearch}
                                    onChange={e => setRosterSearch(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-blue-400"
                                />
                            </div>
                            <div className="overflow-y-auto flex-1 p-4 space-y-2">
                                {rosterLoading && (
                                    <div className="flex justify-center py-12">
                                        <RefreshCw className="animate-spin text-slate-400" size={28} />
                                    </div>
                                )}
                                {!rosterLoading && rosterStudents.length === 0 && (
                                    <p className="text-center text-slate-400 py-12 font-medium">No students enrolled yet.</p>
                                )}
                                {!rosterLoading && rosterStudents
                                    .filter(s => {
                                        const q = rosterSearch.toLowerCase();
                                        return !q || s.name?.toLowerCase().includes(q) || s.matric_number?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
                                    })
                                    .map(s => {
                                        const statusColor = s.email_status === 'sent' ? 'bg-emerald-100 text-emerald-700'
                                            : s.email_status === 'failed' ? 'bg-rose-100 text-rose-700'
                                            : 'bg-amber-100 text-amber-700';
                                        const statusLabel = s.email_status === 'sent' ? '✓ Email Sent'
                                            : s.email_status === 'failed' ? '✗ Email Failed'
                                            : '⏳ Pending';
                                        return (
                                            <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-900 text-sm truncate">{s.name}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{s.matric_number} · {s.email}</p>
                                                    {s.category_name && <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5">{s.category_name}</p>}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${statusColor}`}>{statusLabel}</span>
                                                <button
                                                    onClick={() => resendOne(s.id)}
                                                    disabled={resendingId === s.id}
                                                    className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-1 ${
                                                        s.email_status === 'sent'
                                                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    {resendingId === s.id ? <RefreshCw size={10} className="animate-spin" /> : null}
                                                    {s.email_status === 'sent' ? 'Re-send' : 'Resend'}
                                                </button>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
