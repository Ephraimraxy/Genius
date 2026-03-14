import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Quote, TrendingUp, Edit3, Award, ExternalLink, User, Save, X, Mail, Building, Shield, FileText, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';

export default function ProfileView({ profile, addToast, onProfileUpdate }: { profile: any, addToast?: (msg: string, type?: string) => void, onProfileUpdate?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { profile: scholarProfile, papers, user } = profile || {};
  const metrics = scholarProfile?.metrics || { citations: 0, hIndex: 0, i10Index: 0 };
  const publications = scholarProfile?.publications || [];
  const isAdmin = user?.role === 'admin';

  const [editName, setEditName] = useState(user?.name || '');
  const [editAffiliation, setEditAffiliation] = useState(user?.affiliation || '');
  const [editInterests, setEditInterests] = useState<string[]>(metrics.interests || []);
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    setEditName(user?.name || '');
    setEditAffiliation(user?.affiliation || '');
    setEditInterests((scholarProfile?.metrics || {}).interests || []);
  }, [user, scholarProfile]);

  if (!profile) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium tracking-wide">Retrieving Scholar Profile...</p>
      </div>
    </div>
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: editName,
          affiliation: editAffiliation,
          interests: editInterests,
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast?.('Profile updated successfully!', 'success');
        setIsEditing(false);
        onProfileUpdate?.();
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (err: any) {
      addToast?.(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && !editInterests.includes(newInterest.trim())) {
      setEditInterests([...editInterests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setEditInterests(editInterests.filter(i => i !== interest));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
          {/* Avatar */}
          <div className="relative">
            <div className={`w-32 h-32 rounded-3xl text-white flex items-center justify-center text-4xl font-bold shadow-2xl ${isAdmin ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] shadow-slate-900/30' : 'premium-gradient shadow-[#800000]/30'}`}>
              {(user?.name?.trim() || user?.email?.trim() || 'S').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100">
              {isAdmin ? <Shield className="text-amber-500" size={20} /> : <Award className="text-amber-500" size={20} />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
              {isEditing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-4xl font-black text-slate-900 tracking-tight font-display bg-transparent border-b-2 border-indigo-400 outline-none pb-1 w-full md:w-auto"
                  placeholder="Your full name"
                />
              ) : (
                <h2 className="text-4xl font-black text-slate-900 tracking-tight font-display">{user?.name || 'Scholar'}</h2>
              )}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mx-auto md:mx-0 w-fit ${
                isAdmin
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200'
              }`}>
                {isAdmin ? 'System Administrator' : 'Verified Researcher'}
              </span>
            </div>

            {/* Session Email */}
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              <Mail size={16} className="text-[#800000]" />
              <span className="text-sm font-bold text-[#800000]">{user?.email}</span>
            </div>

            {/* Affiliation */}
            <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
              <Building size={18} className="text-slate-400" />
              {isEditing ? (
                <input
                  value={editAffiliation}
                  onChange={(e) => setEditAffiliation(e.target.value)}
                  className="text-lg text-slate-600 font-medium bg-transparent border-b-2 border-indigo-400 outline-none pb-1 w-full md:w-auto"
                  placeholder="Your institution or affiliation"
                />
              ) : (
                <p className="text-lg text-slate-500 font-medium">{user?.affiliation || 'No affiliation set'}</p>
              )}
            </div>

            {/* Research Interests / Tags */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Research Interests</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {(isEditing ? editInterests : (metrics.interests || [])).map((tag: string) => (
                  <span key={tag} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-2xl text-sm font-bold border border-slate-200/60 hover:border-indigo-200 hover:bg-white transition-all cursor-default flex items-center gap-2">
                    {tag}
                    {isEditing && (
                      <button onClick={() => removeInterest(tag)} className="text-rose-400 hover:text-rose-600">
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addInterest()}
                      placeholder="Add interest..."
                      className="px-4 py-2 bg-white border-2 border-dashed border-indigo-300 rounded-2xl text-sm font-bold outline-none w-36 focus:border-indigo-500"
                    />
                    <button onClick={addInterest} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all">
                      <Plus size={16} />
                    </button>
                  </div>
                )}
                {!isEditing && (metrics.interests || []).length === 0 && (
                  <span className="text-sm font-medium text-slate-300 italic">Click "Edit Profile" to add your research interests</span>
                )}
              </div>
            </div>
          </div>

          {/* Edit / Save Buttons */}
          <div className="shrink-0 flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 premium-gradient text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-[#800000]/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(user?.name || '');
                    setEditAffiliation(user?.affiliation || '');
                    setEditInterests(metrics.interests || []);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  <X size={18} /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200"
              >
                <Edit3 size={18} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Details Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
        <h3 className="text-lg font-bold text-slate-800 font-display mb-6 flex items-center gap-2">
          <User size={20} className="text-[#800000]" />
          Account Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</p>
            <p className="text-sm font-bold text-slate-900">{user?.name || 'Not set'}</p>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email (Login)</p>
            <p className="text-sm font-bold text-[#800000]">{user?.email || 'Missing Record'}</p>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Role</p>
            <p className={`text-sm font-bold ${isAdmin ? 'text-amber-600' : 'text-indigo-600'}`}>
              {isAdmin ? 'System Administrator' : 'Researcher'}
            </p>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Affiliation</p>
            <p className="text-sm font-bold text-slate-900">{user?.affiliation || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid (Researcher only) */}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Total Citations', value: metrics.citations, icon: Quote, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'h-index', value: metrics.hIndex, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'i10-index', value: metrics.i10Index, icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 group hover:shadow-md transition-all"
            >
              <div className={`p-4 ${item.bg} ${item.color} rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                <item.icon size={26} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{item.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Admin Platform Summary */}
      {isAdmin && profile?.adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Platform Users', value: profile.adminStats.totalUsers, icon: User, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'All Manuscripts', value: profile.adminStats.totalPapers, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Published', value: profile.adminStats.publishedPapers, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 group hover:shadow-md transition-all"
            >
              <div className={`p-4 ${item.bg} ${item.color} rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                <item.icon size={26} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{item.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Publications List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-1 shrink-0 shadow-sm border border-slate-100 overflow-hidden">
              <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 font-display">
              {isAdmin ? 'Administrative Record' : 'Scientific Contributions'}
            </h3>
          </div>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{publications.length} Papers</span>
        </div>

        <div className="divide-y divide-slate-100">
          {publications.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1.5 shrink-0 opacity-40 shadow-sm border border-slate-100 overflow-hidden">
                  <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain" />
                </div>
              </div>
              <h4 className="text-xl font-bold text-slate-800">No publications yet</h4>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                {isAdmin ? 'Published papers from your administrative oversight will appear here.' : 'Your verified publications will appear here once they are indexed.'}
              </p>
            </div>
          ) : publications.map((pub: any, i: number) => (
            <motion.div
              key={i}
              whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.5)" }}
              className="p-10 transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 text-2xl mb-2 group-hover:text-indigo-600 transition-colors leading-tight">
                    {pub.title}
                  </h4>
                  <p className="text-slate-500 mb-6 font-medium">
                    Published on {new Date(pub.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-2 text-sm font-bold bg-slate-100 text-slate-600 px-4 py-2 rounded-xl border border-slate-200">
                      DOI: {pub.doi}
                      <ExternalLink size={14} className="opacity-50" />
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                      <Quote size={16} /> Verified Citations: 0
                    </span>
                  </div>
                </div>

                <button className="shrink-0 p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                  <ExternalLink size={24} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
