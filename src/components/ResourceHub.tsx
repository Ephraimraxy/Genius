import React, { useState, useEffect, useRef } from 'react';
import { friendlyError } from '../utils/friendlyError';
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
    Eye,
    AlertCircle,
    Wifi,
    X as XIcon,
    ArrowLeft,
    ShieldOff,
    ShieldAlert,
    Mail,
    Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FilePreviewModal from './FilePreviewModal';
import { ToastType } from './ToastSystem';
import { analyzeFile, FileAnalysis, formatFileSize } from '../utils/fileValidation';

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
    const [editingPrice, setEditingPrice] = useState<{id: number, val: string} | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatusMsg, setUploadStatusMsg] = useState('');
    const [audioAnalysis, setAudioAnalysis] = useState<FileAnalysis | null>(null);
    const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
    const audioXhrRef = useRef<XMLHttpRequest | null>(null);
    const [uploadType, setUploadType] = useState<'roster' | 'material' | 'audio'>('roster');
    const [fileHandle, setFileHandle] = useState<File | null>(null);
    const [previewFile, setPreviewFile] = useState<File | string | null>(null);
    const [previewName, setPreviewName] = useState<string>('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [categories, setCategories] = useState<{id: number, name: string, is_paid_entry: boolean, entry_fee: number}[]>([]);
    const [isUpdatingCategory, setIsUpdatingCategory] = useState<number | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string>('');

    // Delete category confirmation modal
    const [deleteCatTarget, setDeleteCatTarget] = useState<{id: number, name: string} | null>(null);
    const [isDeletingCat, setIsDeletingCat] = useState(false);

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
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editMatric, setEditMatric] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [suspendingId, setSuspendingId] = useState<number | null>(null);
    const [bulkSuspending, setBulkSuspending] = useState(false);

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
                addToast(friendlyError({ message: data.error }, 'generic'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
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
                addToast(friendlyError({ message: data.error }, 'generic'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
        setBulkResending(false);
    };

    const deleteStudent = async (id: number) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/courses/roster/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                addToast('Student removed', 'success');
                setRosterStudents(prev => prev.filter(s => s.id !== id));
                setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            } else {
                addToast(friendlyError({ message: data.error }, 'delete'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
        setDeletingId(null);
    };

    const bulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setBulkDeleting(true);
        const ids = Array.from(selectedIds);
        let done = 0;
        for (const id of ids) {
            try {
                await fetch(`/api/courses/roster/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                done++;
            } catch {}
        }
        addToast(`Deleted ${done} student(s)`, 'success');
        setRosterStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
        setSelectedIds(new Set());
        setBulkDeleting(false);
    };

    const toggleSuspend = async (student: any) => {
        setSuspendingId(student.id);
        const newState = !student.is_suspended;
        try {
            const res = await fetch(`/api/courses/roster/${student.id}/suspend`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ suspend: newState })
            });
            const data = await res.json();
            if (res.ok) {
                addToast(newState ? 'Student suspended' : 'Student unsuspended', 'success');
                setRosterStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_suspended: newState } : s));
            } else {
                addToast(friendlyError({ message: data.error }, 'save'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
        setSuspendingId(null);
    };

    const bulkSuspend = async (suspend: boolean) => {
        if (selectedIds.size === 0) return;
        setBulkSuspending(true);
        try {
            const res = await fetch('/api/courses/roster/bulk-suspend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ids: Array.from(selectedIds), suspend })
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`${suspend ? 'Suspended' : 'Unsuspended'} ${data.updated} student(s)`, 'success');
                setRosterStudents(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, is_suspended: suspend } : s));
                setSelectedIds(new Set());
            } else {
                addToast(friendlyError({ message: data.error }, 'save'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
        setBulkSuspending(false);
    };

    const saveEdit = async () => {
        if (!editingStudent) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/courses/roster/${editingStudent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: editName, email: editEmail, matric_number: editMatric })
            });
            const data = await res.json();
            if (res.ok) {
                addToast('Student updated', 'success');
                setRosterStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, name: editName, email: editEmail, matric_number: editMatric } : s));
                setEditingStudent(null);
            } else {
                addToast(friendlyError({ message: data.error }, 'save'), 'error');
            }
        } catch { addToast(friendlyError(new Error('network error'), 'generic'), 'error'); }
        setIsSavingEdit(false);
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const toggleSelectAll = (visible: any[]) => {
        const allSelected = visible.every(s => selectedIds.has(s.id));
        if (allSelected) {
            setSelectedIds(prev => { const n = new Set(prev); visible.forEach(s => n.delete(s.id)); return n; });
        } else {
            setSelectedIds(prev => { const n = new Set(prev); visible.forEach(s => n.add(s.id)); return n; });
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileHandle(file);
        setAudioAnalysis(null);
        setAudioUploadError(null);
        setUploadProgress(0);
        setUploadStatusMsg('');

        if (uploadType === 'audio') {
            // Small delay for visual "analysing" feedback
            setTimeout(() => {
                const analysis = analyzeFile(file, 'audio');
                setAudioAnalysis(analysis);
                if (analysis.error) {
                    setAudioUploadError(analysis.error);
                }
            }, 300);
        }
    };

    const processUpload = async () => {
        if (!fileHandle) return;

        // For roster, we must first ensure category is selected
        if (uploadType === 'roster' && !showBatchModal && !selectedCatId && !newCatName) {
            setShowBatchModal(true);
            return;
        }

        // Validate audio before uploading
        if (uploadType === 'audio') {
            if (audioAnalysis?.error) {
                addToast(audioAnalysis.error, 'error');
                return;
            }
            if (!audioAnalysis) {
                // run analysis now if not yet done
                const analysis = analyzeFile(fileHandle, 'audio');
                setAudioAnalysis(analysis);
                if (analysis.error) {
                    setAudioUploadError(analysis.error);
                    addToast(analysis.error, 'error');
                    return;
                }
            }
        }

        setIsUploading(true);
        setUploadProgress(0);
        setAudioUploadError(null);
        setUploadStatusMsg('Preparing upload...');

        // ─── AUDIO: Upload directly to R2 via XHR for progress tracking ───
        if (uploadType === 'audio') {
            try {
                const formData = new FormData();
                formData.append('file', fileHandle);
                formData.append('type', 'audio');
                formData.append('name', fileHandle.name);
                if (selectedCatId) formData.append('categoryId', String(selectedCatId));
                if (newCatName) formData.append('categoryName', newCatName);
                if (isPaidEntry) formData.append('isPaidEntry', 'true');
                if (entryFee) formData.append('entryFee', String(entryFee));

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    audioXhrRef.current = xhr;

                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100);
                            setUploadProgress(pct);
                            if (pct < 30) setUploadStatusMsg('Starting upload...');
                            else if (pct < 70) setUploadStatusMsg('Uploading to cloud storage...');
                            else if (pct < 95) setUploadStatusMsg('Almost there...');
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
                                else if (xhr.status === 413) msg = 'File is too large. Maximum is 500 MB for audio.';
                                else if (xhr.status === 415) msg = 'File format rejected by server. Try converting to MP3 or WAV.';
                                else if (xhr.status === 500) msg = 'Server error during upload. Please try again.';
                            } catch {
                                if (xhr.status === 413) msg = 'File is too large. Maximum is 500 MB for audio.';
                            }
                            reject(new Error(msg));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network error — check your internet connection.'));
                    xhr.ontimeout = () => reject(new Error('Upload timed out. Try a smaller file or check your connection.'));
                    xhr.timeout = 20 * 60 * 1000;

                    xhr.open('POST', '/api/resources/upload/file');
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.send(formData);
                });

                setUploadStatusMsg('Upload complete!');
                addToast(`"${fileHandle.name}" uploaded successfully!`, 'success');
                fetchResources();
                setFileHandle(null);
                setAudioAnalysis(null);
                setUploadProgress(0);
                setUploadStatusMsg('');
            } catch (err: any) {
                const msg = err?.message || 'Upload failed. Please try again.';
                setAudioUploadError(msg);
                setUploadStatusMsg('');
                addToast(msg, 'error');
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
                        addToast(friendlyError({ message: data.error }, 'upload'), 'error');
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
                addToast(friendlyError({ message: data.error }, 'upload'), 'error');
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
        // Optimistic local update — no re-fetch, prevents input losing focus/state
        setResources(prev => prev.map(r => r.id === id ? { ...r, ...settings } : r));
        try {
            const res = await fetch(`/api/resources/${id}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error('Failed');
            if (settings.price !== undefined) {
                addToast('Price saved', 'success');
                setEditingPrice(null);
            }
        } catch (err) {
            addToast('Update failed', 'error');
            fetchResources(); // revert on failure
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

    const deleteCategory = async () => {
        if (!deleteCatTarget) return;
        setIsDeletingCat(true);
        try {
            const res = await fetch(`/api/courses/categories/${deleteCatTarget.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addToast(`"${deleteCatTarget.name}" and all students deleted`, 'success');
                setDeleteCatTarget(null);
                fetchCategories();
            } else {
                const d = await res.json().catch(() => ({}));
                addToast(d.error || 'Failed to delete category', 'error');
            }
        } catch {
            addToast('Failed to delete category', 'error');
        }
        setIsDeletingCat(false);
    };

    return (
        <div className="space-y-8 pb-12 relative min-h-screen">
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
                                {(['roster', 'material', 'audio'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setUploadType(t);
                                            setFileHandle(null);
                                            setAudioAnalysis(null);
                                            setAudioUploadError(null);
                                            setUploadProgress(0);
                                            setUploadStatusMsg('');
                                        }}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadType === t ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
                                    >
                                        {t === 'roster' ? 'Student Data' : t === 'material' ? 'Lecture Material' : 'Audio Record'}
                                    </button>
                                ))}
                            </div>

                            <div className={`border-2 border-dashed rounded-[2rem] p-8 text-center transition-all cursor-pointer relative group
                                ${audioAnalysis?.error && uploadType === 'audio' ? 'border-rose-400/50 bg-rose-900/10' :
                                  audioAnalysis && !audioAnalysis.error && uploadType === 'audio' ? 'border-indigo-400/60 bg-indigo-900/10' :
                                  'border-white/20 hover:border-blue-400 hover:bg-white/5'}`}>
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept={uploadType === 'roster' ? '.csv' : uploadType === 'audio' ? '.mp3,.wav,.flac,.aac,.ogg,.opus,.m4a,.wma,.aiff,.aif,.amr,.webm,.caf' : '.pdf,.docx,.doc,.pptx'}
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                <Upload className={`mx-auto mb-3 transition-colors ${audioAnalysis?.error && uploadType === 'audio' ? 'text-rose-400' : audioAnalysis && uploadType === 'audio' ? 'text-indigo-400' : 'text-white/30 group-hover:text-blue-400'}`} size={28} />
                                <p className="font-bold text-sm">
                                    {fileHandle ? fileHandle.name : 'Choose File'}
                                </p>
                                {fileHandle && uploadType === 'audio' && (
                                    <p className="text-[10px] text-white/50 mt-1">{formatFileSize(fileHandle.size)}</p>
                                )}
                                {uploadType === 'roster' && !fileHandle && (
                                    <p className="text-[10px] text-white/40 mt-2 text-center">
                                        3 columns: <span className="text-white/60 font-bold">Full Name, Matric, Email</span>
                                    </p>
                                )}
                                {uploadType === 'audio' && !fileHandle && (
                                    <p className="text-[10px] text-white/40 mt-2">
                                        MP3, WAV, FLAC, AAC, OGG, M4A, OPUS and more
                                    </p>
                                )}
                                {fileHandle && uploadType !== 'audio' && (
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

                            {/* Audio analysis feedback panel */}
                            <AnimatePresence>
                                {uploadType === 'audio' && fileHandle && audioAnalysis && !isUploading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`rounded-2xl p-4 space-y-2 ${audioAnalysis.error ? 'bg-rose-900/20 border border-rose-500/30' : audioAnalysis.warning ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-emerald-900/20 border border-emerald-500/30'}`}
                                    >
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white/10 rounded-xl p-2">
                                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Format</p>
                                                <p className="text-sm font-black text-white">{audioAnalysis.formatLabel}</p>
                                            </div>
                                            <div className="bg-white/10 rounded-xl p-2">
                                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Size</p>
                                                <p className="text-sm font-black text-white">{audioAnalysis.sizeFormatted}</p>
                                            </div>
                                        </div>
                                        {audioAnalysis.error ? (
                                            <div className="flex items-start gap-2 p-2.5 bg-rose-500/20 rounded-xl">
                                                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                                <p className="text-[11px] font-bold text-rose-300">{audioAnalysis.error}</p>
                                            </div>
                                        ) : audioAnalysis.warning ? (
                                            <div className="flex items-start gap-2 p-2.5 bg-amber-500/20 rounded-xl">
                                                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                                <p className="text-[11px] font-bold text-amber-300">{audioAnalysis.warning}</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/20 rounded-xl">
                                                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                                <p className="text-[11px] font-bold text-emerald-300">File is compatible and ready to upload.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Audio upload progress */}
                            <AnimatePresence>
                                {uploadType === 'audio' && isUploading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="bg-indigo-900/30 border border-indigo-500/30 rounded-2xl p-4 space-y-2"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Wifi className="text-indigo-400 animate-pulse shrink-0" size={14} />
                                            <p className="text-xs font-bold text-white flex-1">{uploadStatusMsg}</p>
                                            <span className="text-sm font-black text-indigo-400">{uploadProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-indigo-500 rounded-full"
                                                animate={{ width: `${uploadProgress}%` }}
                                                transition={{ ease: 'linear', duration: 0.3 }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-white/40 truncate">{fileHandle?.name}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Audio upload error */}
                            <AnimatePresence>
                                {uploadType === 'audio' && audioUploadError && !isUploading && !audioAnalysis?.error && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-start gap-2 p-3 bg-rose-900/20 border border-rose-500/30 rounded-2xl"
                                    >
                                        <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-black text-rose-300">Upload Failed</p>
                                            <p className="text-[10px] text-rose-400">{audioUploadError}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                onClick={processUpload}
                                disabled={!fileHandle || isUploading || (uploadType === 'audio' && !!audioAnalysis?.error)}
                                className={`w-full ${uploadType === 'audio' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'} text-white font-black py-4 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xl flex items-center justify-center gap-2`}
                            >
                                {isUploading ? <RefreshCw className="animate-spin" size={20} /> : (uploadType === 'audio' ? <Mic size={20} /> : <ShieldCheck size={20} />)}
                                {isUploading
                                    ? (uploadType === 'audio' ? `Uploading ${uploadProgress}%...` : 'Sanitizing...')
                                    : (uploadType === 'audio' ? (audioUploadError ? 'Retry Upload' : 'Upload Audio') : 'Upload & Sanitize')}
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
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateCategoryFee(cat.id, !cat.is_paid_entry, cat.entry_fee)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${cat.is_paid_entry ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                                            >
                                                {cat.is_paid_entry ? 'Paid Entry' : 'Free Entry'}
                                            </button>
                                            <button
                                                onClick={() => setDeleteCatTarget({ id: cat.id, name: cat.name })}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                title="Delete category and all students"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
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
                                                        onClick={() => {
                                                            const nowPaid = !item.is_paid;
                                                            updateResourceSettings(item.id, { is_paid: nowPaid });
                                                            if (nowPaid) setEditingPrice({ id: item.id, val: String(item.price || '') });
                                                            else setEditingPrice(null);
                                                        }}
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
                                                                min={0}
                                                                value={editingPrice?.id === item.id ? editingPrice.val : String(item.price || '')}
                                                                onChange={(e) => setEditingPrice({ id: item.id, val: e.target.value })}
                                                                onFocus={() => { if (editingPrice?.id !== item.id) setEditingPrice({ id: item.id, val: String(item.price || '') }); }}
                                                                placeholder="0"
                                                                className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold focus:border-indigo-400 focus:outline-none"
                                                            />
                                                            {editingPrice?.id === item.id && (
                                                                <button
                                                                    onClick={() => updateResourceSettings(item.id, { price: parseInt(editingPrice.val) || 0 })}
                                                                    className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-black hover:bg-indigo-700 transition-all"
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
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

            {/* Delete Category Confirmation Modal */}
            <AnimatePresence>
                {deleteCatTarget && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => !isDeletingCat && setDeleteCatTarget(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                            className="relative bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md z-10"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                                    <Trash2 className="text-red-600" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Delete Category?</h3>
                                    <p className="text-sm text-slate-500 mt-2">
                                        This will permanently delete <span className="font-bold text-slate-800">"{deleteCatTarget.name}"</span> and <span className="font-bold text-red-600">all students enrolled in it</span>. This cannot be undone.
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setDeleteCatTarget(null)}
                                        disabled={isDeletingCat}
                                        className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={deleteCategory}
                                        disabled={isDeletingCat}
                                        className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-black transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {isDeletingCat ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                        {isDeletingCat ? 'Deleting...' : 'Yes, Delete All'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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

            {/* ── Roster Viewer — Inline Full Page ── */}
            <AnimatePresence>
                {showRosterViewer && (
                    <motion.div
                        key="roster-page"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute inset-0 bg-slate-50 z-50 overflow-y-auto"
                    >
                        {/* Sticky top bar */}
                        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center gap-3 shadow-sm">
                            <button
                                onClick={() => { setShowRosterViewer(false); setSelectedIds(new Set()); setEditingStudent(null); }}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors shrink-0"
                            >
                                <ArrowLeft size={18} /> Back
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Enrolled Students</p>
                                <p className="text-sm font-black text-slate-900 truncate">
                                    {rosterStudents.length} total
                                    {selectedIds.size > 0 && <span className="text-blue-600"> · {selectedIds.size} selected</span>}
                                </p>
                            </div>
                            {/* Bulk actions — appear when items selected */}
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => bulkSuspend(true)}
                                        disabled={bulkSuspending}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                    >
                                        {bulkSuspending ? <RefreshCw size={11} className="animate-spin" /> : <ShieldOff size={11} />}
                                        Suspend
                                    </button>
                                    <button
                                        onClick={() => bulkDelete()}
                                        disabled={bulkDeleting}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                    >
                                        {bulkDeleting ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                        Delete
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => bulkResend()}
                                disabled={bulkResending}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                            >
                                {bulkResending ? <RefreshCw size={11} className="animate-spin" /> : <Mail size={11} />}
                                Resend Failed
                            </button>
                        </div>

                        <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24 space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, matric or email…"
                                    value={rosterSearch}
                                    onChange={e => setRosterSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 transition-all shadow-sm"
                                />
                            </div>

                            {/* Inline edit form */}
                            <AnimatePresence>
                                {editingStudent && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        className="p-5 bg-white border border-blue-200 rounded-2xl shadow-sm space-y-3"
                                    >
                                        <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Editing — {editingStudent.name}</p>
                                        <div className="grid sm:grid-cols-3 gap-3">
                                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full Name"
                                                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400" />
                                            <input value={editMatric} onChange={e => setEditMatric(e.target.value)} placeholder="Matric Number"
                                                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400" />
                                            <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email"
                                                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={saveEdit} disabled={isSavingEdit}
                                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5">
                                                {isSavingEdit ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />} Save
                                            </button>
                                            <button onClick={() => setEditingStudent(null)}
                                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                                                Cancel
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Student cards / table */}
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                {rosterLoading ? (
                                    <div className="flex justify-center py-20">
                                        <RefreshCw className="animate-spin text-slate-400" size={28} />
                                    </div>
                                ) : (() => {
                                    const visible = rosterStudents.filter(s => {
                                        const q = rosterSearch.toLowerCase();
                                        return !q || s.name?.toLowerCase().includes(q) || s.matric_number?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
                                    });
                                    const allSelected = visible.length > 0 && visible.every(s => selectedIds.has(s.id));
                                    if (visible.length === 0) return (
                                        <p className="text-center text-slate-400 py-20 font-medium">
                                            {rosterStudents.length === 0 ? 'No students enrolled yet.' : 'No results match your search.'}
                                        </p>
                                    );
                                    return (
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-5 py-4 w-10">
                                                        <input type="checkbox" checked={allSelected}
                                                            onChange={() => toggleSelectAll(visible)}
                                                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                                                    </th>
                                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Matric</th>
                                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Category</th>
                                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {visible.map(s => {
                                                    const emailColor = s.email_status === 'sent' ? 'bg-emerald-100 text-emerald-700'
                                                        : s.email_status === 'failed' ? 'bg-rose-100 text-rose-700'
                                                        : 'bg-amber-100 text-amber-700';
                                                    const emailLabel = s.email_status === 'sent' ? '✓ Sent'
                                                        : s.email_status === 'failed' ? '✗ Failed'
                                                        : '⏳ Pending';
                                                    const isSelected = selectedIds.has(s.id);
                                                    const isSuspended = !!s.is_suspended;
                                                    return (
                                                        <tr key={s.id} className={`transition-colors group ${isSuspended ? 'bg-amber-50/60' : isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/50'}`}>
                                                            <td className="px-5 py-3">
                                                                <input type="checkbox" checked={isSelected}
                                                                    onChange={() => toggleSelect(s.id)}
                                                                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                                                            </td>
                                                            <td className="px-4 py-3 min-w-[160px]">
                                                                <div className="flex items-center gap-2">
                                                                    <div>
                                                                        <p className={`font-bold text-sm ${isSuspended ? 'text-amber-700 line-through' : 'text-slate-900'}`}>{s.name}</p>
                                                                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{s.email}</p>
                                                                    </div>
                                                                    {isSuspended && (
                                                                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-md shrink-0">Suspended</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 hidden sm:table-cell text-xs font-bold text-slate-500 font-mono">{s.matric_number}</td>
                                                            <td className="px-4 py-3 hidden md:table-cell">
                                                                {s.category_name && <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wide">{s.category_name}</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${emailColor}`}>{emailLabel}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {/* Edit */}
                                                                    <button
                                                                        onClick={() => { setEditingStudent(s); setEditName(s.name); setEditEmail(s.email); setEditMatric(s.matric_number); }}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                                        title="Edit student"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    {/* Resend email */}
                                                                    <button
                                                                        onClick={() => resendOne(s.id)}
                                                                        disabled={resendingId === s.id}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-40"
                                                                        title="Resend credentials"
                                                                    >
                                                                        {resendingId === s.id ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                                                                    </button>
                                                                    {/* Suspend / Unsuspend */}
                                                                    <button
                                                                        onClick={() => toggleSuspend(s)}
                                                                        disabled={suspendingId === s.id}
                                                                        className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${isSuspended ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`}
                                                                        title={isSuspended ? 'Unsuspend student' : 'Suspend student'}
                                                                    >
                                                                        {suspendingId === s.id ? <RefreshCw size={14} className="animate-spin" /> : isSuspended ? <ShieldAlert size={14} /> : <ShieldOff size={14} />}
                                                                    </button>
                                                                    {/* Delete */}
                                                                    <button
                                                                        onClick={() => deleteStudent(s.id)}
                                                                        disabled={deletingId === s.id}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-40"
                                                                        title="Delete student"
                                                                    >
                                                                        {deletingId === s.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
