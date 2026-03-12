import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  User,
  Eye,
  ArrowUpRight,
  TrendingUp,
  FileText
} from 'lucide-react';

interface Publication {
  id: number;
  title: string;
  authors: string;
  status: string;
  doi?: string;
  created_at: string;
  researcher_name?: string;
  researcher_email?: string;
}

export default function PublicationRecords({ profile }: { profile: any }) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isAdmin = profile?.user?.role === 'admin';

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    try {
      const response = await fetch('/api/publications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setPublications(data);
    } catch (err) {
      console.error('Failed to fetch publications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-500';
      case 'ready': return 'bg-indigo-500';
      case 'peer_review': return 'bg-amber-500';
      case 'integrity_check': return 'bg-purple-500';
      case 'formatting': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'published': return 100;
      case 'ready': return 90;
      case 'peer_review': return 75;
      case 'integrity_check': return 50;
      case 'formatting': return 25;
      default: return 10;
    }
  };

  const filteredPubs = publications.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.researcher_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display flex items-center gap-3">
            <History className="text-[#800000]" size={32} />
            Publication History
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {isAdmin ? 'Global research monitoring and oversight console.' : 'Track your academic journey and manuscript readiness.'}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 w-full md:w-auto">
          <div className="flex items-center gap-3 px-4 flex-1">
            <Search size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by title..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-bold w-full"
            />
          </div>
          <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all border border-slate-100">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Main Stats (Admin Highlight) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Submissions</p>
            <p className="text-2xl font-black text-slate-900">{publications.length}</p>
          </div>
          <div className="bg-emerald-50 p-6 rounded-[1.5rem] border border-emerald-100 shadow-sm">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Finalized</p>
            <p className="text-2xl font-black text-emerald-800">{publications.filter(p => p.status === 'published').length}</p>
          </div>
          <div className="bg-amber-50 p-6 rounded-[1.5rem] border border-amber-100 shadow-sm">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">In Review</p>
            <p className="text-2xl font-black text-amber-800">{publications.filter(p => p.status === 'peer_review').length}</p>
          </div>
          <div className="bg-indigo-50 p-6 rounded-[1.5rem] border border-indigo-100 shadow-sm">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Pending Payment</p>
            <p className="text-2xl font-black text-indigo-800">{publications.filter(p => p.status === 'ready').length}</p>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Manuscript</th>
                {isAdmin && <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Researcher</th>}
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Readiness</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">DOI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#800000] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Synchronizing Records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPubs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="text-slate-200" size={48} />
                      <p className="text-sm font-bold text-slate-400">No records found matching your filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPubs.map((pub, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={pub.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="max-w-xs md:max-w-sm">
                        <p className="text-sm font-black text-slate-900 leading-snug group-hover:text-[#800000] transition-colors">{pub.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">ID: #{pub.id}</p>
                      </div>
                    </td>
                    
                    {isAdmin && (
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">
                            {pub.researcher_name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900">{pub.researcher_name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{pub.researcher_email}</p>
                          </div>
                        </div>
                      </td>
                    )}

                    <td className="px-8 py-6 min-w-[200px]">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className={`${getStatusProgress(pub.status) === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {pub.status.replace('_', ' ')}
                          </span>
                          <span className="text-slate-900">{getStatusProgress(pub.status)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${getStatusProgress(pub.status)}%` }}
                            className={`h-full ${getStatusColor(pub.status)} transition-all duration-1000 ease-out shadow-sm`}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        pub.status === 'published' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : pub.status === 'ready'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-100 font-black animate-pulse'
                        : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {pub.status}
                      </span>
                    </td>

                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-500">{new Date(pub.created_at).toLocaleDateString()}</p>
                    </td>

                    <td className="px-8 py-6">
                      {pub.doi ? (
                        <a 
                          href={`https://doi.org/${pub.doi}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest"
                        >
                          {pub.doi}
                          <ArrowUpRight size={12} />
                        </a>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Not Assigned</span>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
