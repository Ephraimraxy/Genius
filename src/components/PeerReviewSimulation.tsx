import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Sparkles, Brain, Cpu, ArrowRight } from 'lucide-react';

interface Review {
  id: number;
  reviewer_name: string;
  status: 'accept' | 'minor_revision' | 'major_revision' | 'reject' | 'pending';
  score: number;
  comments: string;
  created_at: string;
}

export default function PeerReviewSimulation({ activePaperId }: { activePaperId: number | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaperId) {
      fetchReviews();
    } else {
      setReviews([]);
    }
  }, [activePaperId]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/papers/${activePaperId}/reviews`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    }
  };

  const simulateReview = async () => {
    if (!activePaperId) return;
    setIsSimulating(true);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${activePaperId}/reviews/simulate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Neural simulation cluster failed to respond.');
      const newReview = await res.json();
      setReviews(prev => [...prev, newReview]);
    } catch (err: any) {
      setError(err.message || 'An error occurred during neural simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accept': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'minor_revision': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'major_revision': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'reject': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accept': return <CheckCircle size={18} />;
      case 'minor_revision': return <AlertTriangle size={18} />;
      case 'major_revision': return <AlertTriangle size={18} />;
      case 'reject': return <XCircle size={18} />;
      default: return <Brain size={18} />;
    }
  };

  const getStatusText = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (!activePaperId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-6">
        <div className="p-6 bg-slate-50 rounded-full border-2 border-dashed border-slate-200">
          <Brain size={48} className="text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800">Review Simulator Standby</p>
          <p className="text-slate-500 mt-2 font-medium">Load a manuscript to initiate AI-driven peer assessment.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-10 pb-20 h-full flex flex-col"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-4">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
              <Cpu size={28} />
            </div>
            Neural Peer Simulation
          </h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Predictive feedback loops using specialized AI reviewer personas.</p>
        </div>

        <button
          onClick={simulateReview}
          disabled={isSimulating}
          className="flex items-center gap-3 bg-slate-900 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-slate-900/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isSimulating ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} className="text-indigo-400" />}
          <span>{isSimulating ? 'Processing...' : 'Initiate Simulation'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-[2rem] flex items-center gap-4">
          <AlertTriangle size={24} />
          <p className="font-bold">{error}</p>
        </div>
      )}

      <div className="space-y-8">
        {reviews.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} />
            </div>
            <p className="text-xl font-bold text-slate-900">No Active Simulations</p>
            <p className="text-slate-500 mt-2">Trigger a simulation to receive persona-based technical feedback.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            <AnimatePresence mode="popLayout">
              {reviews.map((review, idx) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden group"
                >
                  <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-600/20 group-hover:rotate-6 transition-transform">
                        {review.reviewer_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{review.reviewer_name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Node: {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Index Score</span>
                        <span className="text-2xl font-black text-slate-900 italic">{review.score}<span className="text-slate-300 not-italic">/10</span></span>
                      </div>
                      <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
                      <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border font-black text-[10px] uppercase tracking-[0.2em] shadow-sm ${getStatusStyle(review.status)}`}>
                        {getStatusIcon(review.status)}
                        {getStatusText(review.status)}
                      </div>
                    </div>
                  </div>

                  <div className="p-10 relative">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                      <Brain size={120} />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Expert Appraisal Network Output</h4>
                    <div className="text-slate-600 text-lg leading-relaxed font-medium bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 italic">
                      “{review.comments}”
                    </div>

                    <div className="mt-8 flex items-center justify-end gap-3">
                      <button className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2 hover:translate-x-1 transition-transform">
                        Detailed Action Plan <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
