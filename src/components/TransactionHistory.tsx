import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  PlusCircle,
  Save,
  DollarSign,
  Volume2,
  Video
} from 'lucide-react';

interface Transaction {
  id: number;
  user_email?: string;
  reference: string;
  amount: number;
  status: string;
  type: string;
  metadata?: any;
  created_at: string;
}

export default function TransactionHistory({ profile }: { profile: any }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicationPrice, setPublicationPrice] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'standard' | 'attendance' | 'audio' | 'video'>('standard');
  const isAdmin = profile?.user?.role === 'admin';

  useEffect(() => {
    fetchTransactions();
    fetchPrice();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrice = async () => {
    const res = await fetch('/api/settings/price');
    const data = await res.json();
    setPublicationPrice(data.price);
    setNewPrice(data.price.toString());
  };

  const handleUpdatePrice = async () => {
    try {
      const response = await fetch('/api/settings/price', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ price: parseInt(newPrice) })
      });
      if (response.ok) {
        setPublicationPrice(parseInt(newPrice));
        alert('Price updated successfully!');
      }
    } catch (err) {
      alert('Failed to update price');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'pending': return <Clock className="text-amber-500" size={18} />;
      default: return <AlertCircle className="text-red-500" size={18} />;
    }
  };

  const attendanceTransactions = transactions.filter(t => t.type === 'attendance_token');
  const audioTransactions = transactions.filter(t => t.type === 'audio_payment');
  const videoTransactions = transactions.filter(t => t.type === 'video_payment');
  const standardTransactions = transactions.filter(t => t.type !== 'attendance_token' && t.type !== 'audio_payment' && t.type !== 'video_payment');
  
  const displayedTransactions = 
    activeTab === 'attendance' ? attendanceTransactions : 
    activeTab === 'audio' ? audioTransactions : 
    activeTab === 'video' ? videoTransactions :
    standardTransactions;

  const totalAttendanceIncome = attendanceTransactions
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalAudioIncome = audioTransactions
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalVideoIncome = videoTransactions
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalStandardIncome = standardTransactions
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalWalletBalance = totalAttendanceIncome + totalAudioIncome + totalVideoIncome + totalStandardIncome;

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Admin Action Bar */}
      {isAdmin && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex flex-col md:row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Fee Configuration</h3>
              <p className="text-sm text-slate-500 font-medium">Set the mandatory publication fee for all researchers.</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-slate-400 font-bold">₦</span>
                <input 
                  type="number" 
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-transparent border-none outline-none w-24 font-black text-slate-900"
                />
              </div>
              <button 
                onClick={handleUpdatePrice}
                className="flex items-center gap-2 px-6 py-2.5 premium-gradient text-white rounded-xl shadow-lg shadow-[#800000]/20 hover:scale-105 transition-all text-xs font-black uppercase tracking-wider"
              >
                <Save size={14} />
                Update Price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats (Simplified for context) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Successful</p>
            <p className="text-xl font-black text-slate-900">{transactions.filter(t => t.status === 'success').length}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
            <p className="text-xl font-black text-slate-900">{transactions.filter(t => t.status === 'pending').length}</p>
          </div>
        </div>
        <div className="bg-[#800000] rounded-3xl p-6 border border-[#800000]/10 shadow-xl shadow-[#800000]/10 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              {isAdmin ? 'Publication Fee' : 'Total Wallet Balance'}
            </p>
            <p className="text-xl font-black text-white">
              ₦{(isAdmin ? publicationPrice : totalWalletBalance).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Optional: Tab switcher for Lecturers to see Attendance Income */}
      {!isAdmin && (
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
          <button 
            onClick={() => setActiveTab('standard')}
            className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${activeTab === 'standard' ? 'bg-[#800000] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Payments & Subscriptions
          </button>
          <button 
             onClick={() => setActiveTab('attendance')}
             className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2 ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Clock size={16} />
            Attendance Tokens
          </button>
          <button 
             onClick={() => setActiveTab('audio')}
             className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2 ${activeTab === 'audio' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Volume2 size={16} />
            Audio Royalties
          </button>
          <button 
             onClick={() => setActiveTab('video')}
             className={`px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-2 ${activeTab === 'video' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Video size={16} />
            Video Royalties
          </button>
        </div>
      )}

      {/* Attendance Income Overview Banner */}
      {activeTab === 'attendance' && (
         <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6 md:p-8 flex items-center justify-between shadow-sm"
         >
            <div className="flex items-center gap-4">
               <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
                  <span className="font-serif text-2xl font-black">₦</span>
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Total Attendance Income</h3>
                  <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs mt-1">From Token Payments</p>
               </div>
            </div>
            <div className="text-right">
               <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">₦{totalAttendanceIncome.toLocaleString()}</span>
            </div>
         </motion.div>
      )}

      {/* Audio Income Overview Banner */}
      {activeTab === 'audio' && (
         <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 md:p-8 flex items-center justify-between shadow-sm"
         >
            <div className="flex items-center gap-4">
               <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/20">
                  <span className="font-serif text-2xl font-black">₦</span>
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Total Audio Revenue</h3>
                  <p className="text-rose-600 font-bold uppercase tracking-widest text-xs mt-1">From Premium Records</p>
               </div>
            </div>
            <div className="text-right">
               <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">₦{totalAudioIncome.toLocaleString()}</span>
            </div>
         </motion.div>
      )}

      {/* Video Income Overview Banner */}
      {activeTab === 'video' && (
         <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 md:p-8 flex items-center justify-between shadow-sm"
         >
            <div className="flex items-center gap-4">
               <div className="p-4 bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-600/20">
                  <span className="font-serif text-2xl font-black">₦</span>
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Total Video Revenue</h3>
                  <p className="text-amber-600 font-bold uppercase tracking-widest text-xs mt-1">From Studio Stream Access</p>
               </div>
            </div>
            <div className="text-right">
               <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">₦{totalVideoIncome.toLocaleString()}</span>
            </div>
         </motion.div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Transaction History</h3>
          <div className="flex gap-2">
            <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
              <Filter size={18} />
            </button>
            <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
              <Search size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Reference</th>
                {isAdmin && <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">User</th>}
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Amount</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                   <td colSpan={isAdmin ? 6 : 5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Loading your financial records...
                  </td>
                </tr>
              ) : displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No {activeTab} transactions found.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-slate-900 tracking-tight">{t.reference}</span>
                      {t.type === 'attendance_token' && t.metadata?.course_id && (
                        <span className="block text-[10px] font-bold text-indigo-500 mt-1 uppercase">Course: {t.metadata.course_id}</span>
                      )}
                      {t.type === 'audio_payment' && t.metadata?.record_name && (
                        <span className="block text-[10px] font-bold text-rose-500 mt-1 uppercase">Record: {t.metadata.record_name}</span>
                      )}
                      {t.type === 'video_payment' && t.metadata?.video_name && (
                        <span className="block text-[10px] font-bold text-amber-500 mt-1 uppercase">Video: {t.metadata.video_name}</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-8 py-5">
                        <span className="text-sm font-bold text-slate-600">{t.user_email}</span>
                      </td>
                    )}
                    <td className="px-8 py-5">
                      <span className={`text-sm font-black ${
                        t.type === 'attendance_token' ? 'text-indigo-600' : 
                        t.type === 'audio_payment' ? 'text-rose-600' : 
                        t.type === 'video_payment' ? 'text-amber-600' : 
                        'text-[#800000]'
                      }`}>₦{t.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(t.status)}
                        <span className={`text-[10px] font-black uppercase tracking-wider ${t.status === 'success' ? 'text-green-600' : 'text-amber-600'}`}>
                          {t.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-400">
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <button className="p-2 text-slate-400 hover:text-[#800000] hover:bg-[#800000]/5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <ExternalLink size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
