import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, ShieldCheck, UserCheck, UserX, Mail, Building2, Calendar, ChevronDown, Filter, RefreshCw } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  affiliation: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [changingRole, setChangingRole] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setChangingRole(userId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      console.error('Failed to update role', err);
    }
    setChangingRole(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    researchers: users.filter(u => u.role === 'user').length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] rounded-[2rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Users size={180} /></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30">Admin Only</span>
          </div>
          <h2 className="text-4xl font-bold font-display mb-3 tracking-tight">User Management</h2>
          <p className="text-slate-300 text-lg max-w-xl font-medium">
            Manage <span className="text-white font-bold">{stats.total} registered users</span> — {stats.admins} admin{stats.admins !== 1 ? 's' : ''}, {stats.researchers} researcher{stats.researchers !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Total Users', value: stats.total, icon: <Users className="text-indigo-600" size={22} />, color: 'bg-indigo-50', border: 'border-indigo-100' },
          { label: 'Administrators', value: stats.admins, icon: <ShieldCheck className="text-amber-600" size={22} />, color: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Researchers', value: stats.researchers, icon: <UserCheck className="text-emerald-600" size={22} />, color: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`bg-white p-6 rounded-[1.5rem] shadow-sm border ${stat.border} hover:shadow-md transition-all`}>
            <div className={`p-3 ${stat.color} rounded-xl w-fit mb-3`}>{stat.icon}</div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 flex items-center bg-white rounded-2xl px-5 py-3 border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-amber-500/20 transition-all w-full">
          <Search size={18} className="text-slate-400" />
          <input type="text" placeholder="Search by name or email..." className="bg-transparent border-none outline-none text-sm ml-3 w-full font-medium"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {(['all', 'user', 'admin'] as const).map(role => (
              <button key={role} onClick={() => setRoleFilter(role)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${roleFilter === role ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {role === 'all' ? 'All' : role === 'user' ? 'Researchers' : 'Admins'}
              </button>
            ))}
          </div>
          <button onClick={fetchUsers} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
            <RefreshCw size={18} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">User</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Email</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Affiliation</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Role</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Joined</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-8 py-16 text-center">
                  <RefreshCw className="animate-spin text-slate-300 mx-auto mb-3" size={32} />
                  <p className="text-sm font-bold text-slate-400">Loading users...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-16 text-center">
                  <UserX className="text-slate-200 mx-auto mb-3" size={40} />
                  <p className="text-sm font-bold text-slate-400">No users found</p>
                </td></tr>
              ) : filtered.map((user) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${user.role === 'admin' ? 'bg-gradient-to-br from-slate-900 to-[#800000] text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {user.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{user.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5"><Mail size={14} /> {user.email}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5"><Building2 size={14} /> {user.affiliation || '—'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${user.role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {user.role === 'admin' ? 'Admin' : 'Researcher'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <Calendar size={14} /> {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <button
                      onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}
                      disabled={changingRole === user.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        user.role === 'admin'
                          ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      } ${changingRole === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {changingRole === user.id ? 'Updating...' : user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
