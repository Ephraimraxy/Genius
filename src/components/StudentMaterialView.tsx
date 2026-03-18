import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, FileText, Download, Lock, CheckCircle, Search, Filter, ShoppingCart, Loader2 } from 'lucide-react';
import { ToastType } from './ToastSystem';
import GeniusPaymentModal from './GeniusPaymentModal'; 

interface Material {
    id: number;
    name: string;
    created_at: string;
    is_available: boolean;
    price: number;
    is_paid: boolean;
    hasPaid: boolean;
}

interface StudentMaterialViewProps {
    addToast: (msg: string, type: ToastType) => void;
    token: string | null;
}

export default function StudentMaterialView({ addToast, token }: StudentMaterialViewProps) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
    
    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

    const fetchMaterials = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/student/materials', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setMaterials(data);
        } catch (err) {
            addToast('Failed to load materials', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMaterials();
    }, [token]);

    const handleDownload = (material: Material) => {
        if (material.is_paid && !material.hasPaid) {
            setSelectedMaterial(material);
            setShowPaymentModal(true);
            return;
        }
        
        // Logic to download file
        window.open(`/api/resources/${material.id}/download?token=${token}`, '_blank');
        addToast('Download started', 'success');
    };

    const filteredMaterials = materials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || (filter === 'free' ? !m.is_paid : m.is_paid);
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-8 pb-12">
            <header className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lecture Materials</h2>
                        <p className="text-slate-500 font-medium">Access your course resources and study guides.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search materials..."
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
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 size={40} className="text-amber-600 animate-spin" />
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Syncing Genius Materials...</p>
                </div>
            ) : filteredMaterials.length === 0 ? (
                <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Materials Found</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">Either no materials are available yet, or they don't match your current filters.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMaterials.map((item) => (
                        <motion.div 
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 border border-slate-200 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-100 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-14 h-14 bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 rounded-2xl flex items-center justify-center transition-colors shadow-sm">
                                    <FileText size={24} />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {item.is_paid && !item.hasPaid ? (
                                        <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">
                                            ₦{item.price?.toLocaleString()}
                                        </div>
                                    ) : (
                                        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                                            {item.is_paid ? <CheckCircle size={10} /> : null}
                                            {item.is_paid ? 'Purchased' : 'Free Access'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{item.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Published: {new Date(item.created_at).toLocaleDateString()}</p>
                            
                            <button 
                                onClick={() => handleDownload(item)}
                                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-lg ${item.is_paid && !item.hasPaid ? 'bg-slate-900 text-white hover:bg-black' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'}`}
                            >
                                {item.is_paid && !item.hasPaid ? (
                                    <><Lock size={16} /> Unlock Access</>
                                ) : (
                                    <><Download size={16} /> Download Now</>
                                )}
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showPaymentModal && selectedMaterial && (
                    <GeniusPaymentModal
                        courseName={selectedMaterial.name}
                        courseId={selectedMaterial.id.toString()}
                        amount={selectedMaterial.price}
                        token={token}
                        addToast={addToast}
                        onClose={() => {
                            setShowPaymentModal(false);
                            setSelectedMaterial(null);
                        }}
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
