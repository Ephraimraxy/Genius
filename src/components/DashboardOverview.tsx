import React from 'react';
import { motion } from 'motion/react';
import { FileText, CheckCircle, AlertCircle, Clock, ArrowRight, UploadCloud, BookOpen, Star, TrendingUp } from 'lucide-react';
import { Tab } from '../App';

export default function DashboardOverview({ onNavigate, profile, setActivePaperId }: { onNavigate: (tab: Tab) => void, profile: any, setActivePaperId: (id: number) => void }) {
  const papers = profile?.papers || [];

  const stats = [
    { label: 'Total Papers', value: papers.length.toString(), icon: <FileText className="text-blue-600" size={24} />, color: 'bg-blue-50' },
    { label: 'Published', value: papers.filter((p: any) => p.status === 'published').length.toString(), icon: <CheckCircle className="text-emerald-600" size={24} />, color: 'bg-emerald-50' },
    { label: 'In Progress', value: papers.filter((p: any) => p.status !== 'published').length.toString(), icon: <AlertCircle className="text-amber-600" size={24} />, color: 'bg-amber-50' },
    { label: 'Total Citations', value: profile?.profile?.metrics?.citations?.toString() || '0', icon: <TrendingUp className="text-indigo-600" size={24} />, color: 'bg-indigo-50' },
  ];

  const handlePaperClick = (id: number) => {
    setActivePaperId(id);
    onNavigate('formatting');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Welcome Section */}
      <div className="relative overflow-hidden premium-gradient rounded-[2rem] p-10 text-white shadow-2xl shadow-indigo-900/20">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BookOpen size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-bold font-display mb-3 tracking-tight">
              Welcome back, {profile?.profile?.name?.split(' ')[0] || 'Researcher'}
            </h2>
            <p className="text-indigo-100 text-lg max-w-xl font-medium">
              Your research factory is running. You have <span className="text-white font-bold">{papers.filter((p: any) => p.status !== 'published').length} manuscripts</span> waiting for refinement.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('upload')}
            className="shrink-0 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 hover:bg-indigo-50"
          >
            <UploadCloud size={22} strokeWidth={2.5} />
            Elevate Manuscript
          </motion.button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-7 rounded-[1.5rem] shadow-sm border border-slate-200 hover:shadow-md transition-all group"
          >
            <div className={`p-4 ${stat.color} rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Papers */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800 font-display">Active Research Pipeline</h3>
          <button className="text-indigo-600 text-sm font-bold hover:underline">View All Papers</button>
        </div>
        <div className="divide-y divide-slate-100">
          {papers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-slate-300" size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-800">No manuscripts found</h4>
              <p className="text-slate-500 mt-1">Start by uploading your first paper to our AI engine.</p>
            </div>
          ) : papers.map((paper: any, idx: number) => (
            <motion.div
              key={paper.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className="p-8 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="text-slate-500" size={24} />
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-slate-900 text-lg truncate">{paper.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-tighter
                        ${paper.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200'}
                      `}>
                        {paper.status}
                      </span>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Clock size={12} /> {new Date(paper.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handlePaperClick(paper.id)}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-slate-200 hover:shadow-indigo-200 group"
                >
                  Continuue
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
