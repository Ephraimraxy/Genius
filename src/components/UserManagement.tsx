import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, ShieldCheck, UserCheck, UserX, Mail, Building2, Calendar, ChevronDown, Filter, RefreshCw, Edit2, Trash2, X, MessageSquare, Save, KeyRound, Lock, CheckCircle } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  affiliation: string;
  created_at: string;
}

interface UserManagementProps {
  addToast?: (msg: string, type?: any) => void;
  onOpenChat?: (userId: number) => void;
  confirm?: (config: any) => Promise<boolean>;
}

export default function UserManagement({ addToast, onOpenChat, confirm }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResettingPw, setIsResettingPw] = useState(false);
  const [pwResetSuccess, setPwResetSuccess] = useState('');

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

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
          affiliation: editingUser.affiliation
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      
      setUsers(prev => prev.map(u => u.id === editingUser.id ? data.user : u));
      setEditingUser(null);
      if (addToast) addToast('User updated successfully', 'success');
    } catch (err: any) {
      if (addToast) addToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const isConfirmed = confirm ? await confirm({
      title: 'Delete User Account',
      message: 'Are you sure you want to permanently delete this user? This action cannot be undone and will remove all their papers and data.',
      confirmLabel: 'Delete Forever',
      type: 'danger'
    }) : window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone and will remove all their papers and data.');

    if (!isConfirmed) return;
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      
      setUsers(prev => prev.filter(u => u.id !== id));
      if (addToast) addToast('User deleted successfully', 'success');
    } catch (err: any) {
      if (addToast) addToast(err.message, 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser || resetPassword.length < 6) return;
    setIsResettingPw(true);
    setPwResetSuccess('');
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newPassword: resetPassword.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setPwResetSuccess(`Password updated for ${editingUser.email}`);
      setResetPassword('');
      if (addToast) addToast(`Password reset for ${editingUser.email}`, 'success');
    } catch (err: any) {
      if (addToast) addToast(err.message, 'error');
    } finally {
      setIsResettingPw(false);
    }
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
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <img src="/gmijp-logo.png" alt="Branding" className="w-48 h-48 md:w-64 md:h-64 object-contain rounded-full bg-white/5 p-4" />
        </div>
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
          { label: 'Total Users', value: stats.total, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-indigo-50', border: 'border-indigo-100' },
          { label: 'Administrators', value: stats.admins, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Researchers', value: stats.researchers, icon: <img src="/gmijp-logo.png" className="w-6 h-6 object-contain" alt="Logo" />, color: 'bg-emerald-50', border: 'border-emerald-100' },
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
                  className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden ${user.role === 'admin' ? 'bg-gradient-to-br from-slate-900 to-[#800000] text-white' : 'bg-white border border-slate-100'}`}>
                        {user.role === 'admin' ? (
                           user.name?.[0]?.toUpperCase() || 'A'
                        ) : (
                           <img src="/gmijp-logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                        )}
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
                    <div className="flex items-center gap-2 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <button
                        onClick={() => onOpenChat?.(user.id)}
                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Message User"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isDeleting === user.id}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                  <Edit2 size={18} className="text-indigo-600" />
                  Edit User Details
                </h3>
                <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Affiliation</label>
                  <input
                    type="text"
                    value={editingUser.affiliation || ''}
                    onChange={e => setEditingUser({ ...editingUser, affiliation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Role Status</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="user">Researcher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {/* Security / Password Reset Section */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <KeyRound size={12} /> Security / Password Reset
                  </label>
                  {pwResetSuccess && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">{pwResetSuccess}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all outline-none text-slate-700"
                        placeholder="New temporary password"
                      />
                    </div>
                    <button
                      onClick={handleResetPassword}
                      disabled={isResettingPw || resetPassword.length < 6}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-500 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {isResettingPw ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
                      Override
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Min 6 characters. Share this temporary password with the user directly.</p>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-6 py-2.5 text-sm font-bold text-white premium-gradient rounded-xl shadow-lg shadow-[#800000]/20 hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
