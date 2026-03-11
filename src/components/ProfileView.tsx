import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, MapPin, BookOpen, Quote, TrendingUp, Edit3, Award, ExternalLink } from 'lucide-react';

export default function ProfileView({ profile }: { profile: any }) {
  if (!profile) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium tracking-wide">Retrieving Scholar Profile...</p>
      </div>
    </div>
  );

  const { profile: userProfile, papers } = profile;
  const metrics = userProfile.metrics || { citations: 0, hIndex: 0, i10Index: 0 };
  const publications = userProfile.publications || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>

        <div className="relative">
          <div className="w-32 h-32 rounded-3xl premium-gradient text-white flex items-center justify-center text-4xl font-bold shadow-2xl shadow-indigo-500/30">
            {userProfile.name?.split(' ').map((n: string) => n[0]).join('') || 'DR'}
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100">
            <Award className="text-amber-500" size={20} />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">{userProfile.name}</h2>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100 inline-block w-fit mx-auto md:mx-0">
              Verified Researcher
            </span>
          </div>

          <p className="text-lg text-slate-500 flex items-center justify-center md:justify-start gap-2 font-medium">
            <MapPin size={20} className="text-indigo-400" /> {userProfile.affiliation}
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
            {['Machine Learning', 'Climate Tech', 'AI Ethics', 'Data Science'].map(tag => (
              <span key={tag} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-2xl text-sm font-bold border border-slate-200/60 hover:border-indigo-200 hover:bg-white transition-all cursor-default">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0 relative z-10">
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200">
            <Edit3 size={18} />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Citations', value: metrics.citations, icon: Quote, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'h-index', value: metrics.hIndex, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'i10-index', value: metrics.i10Index, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' }
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
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Publications List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-3">
            <GraduationCap className="text-indigo-600" size={24} />
            <h3 className="text-2xl font-bold text-slate-800 font-display">Scientific Contributions</h3>
          </div>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{publications.length} Papers</span>
        </div>

        <div className="divide-y divide-slate-100">
          {publications.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                <BookOpen className="text-slate-300" size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-800">No publications added</h4>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">Your verified publications will appear here once they are indexed or manually added.</p>
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
