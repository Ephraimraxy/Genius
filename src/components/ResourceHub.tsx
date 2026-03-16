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
    Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastType } from './ToastSystem';

interface Resource {
    id: number;
    type: 'roster' | 'material';
    name: string;
    status: 'ready' | 'failed' | 'pending' | 'short';
    created_at: string;
}

interface ResourceHubProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function ResourceHub({ addToast, token }: ResourceHubProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadType, setUploadType] = useState<'roster' | 'material'>('roster');
    const [fileHandle, setFileHandle] = useState<File | null>(null);

    useEffect(() => {
        fetchResources();
    }, []);

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

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawContent = e.target?.result as string;
            let finalContent: any = rawContent;

            if (uploadType === 'roster') {
                // Simplified roster parsing for the demo
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
                    addToast(`${uploadType === 'roster' ? 'Roster' : 'Material'} uploaded & sanitized successfully`, 'success');
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

        if (uploadType === 'roster') reader.readAsText(fileHandle);
        else reader.readAsText(fileHandle); // In real app, we'd handle PDF/DOCX
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

    return (
        <div className="space-y-8 pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Genius Resource Hub <Database className="text-blue-600" size={28} />
                    </h2>
                    <p className="text-slate-500 font-medium">Global storage for your rosters and lecture notes. Upload once, use everywhere.</p>
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
                                    Student Roster
                                </button>
                                <button 
                                    onClick={() => setUploadType('material')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${uploadType === 'material' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Lecture Material
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
                            </div>

                            <button 
                                onClick={processUpload}
                                disabled={!fileHandle || isUploading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-40 shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                            >
                                {isUploading ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                                {isUploading ? 'Sanitizing...' : 'Upload & Sanitize'}
                            </button>
                         </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Storage Insight</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600">Total Items</span>
                                <span className="text-lg font-black text-slate-900">{resources.length}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: '15%' }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">Using 45.2 MB of 2.0 GB Allocated Space</p>
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
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${item.type === 'roster' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {item.type === 'roster' ? <Users size={24} /> : <FileText size={24} />}
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
        </div>
    );
}
