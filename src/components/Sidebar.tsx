import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  PenTool,
  BookMarked,
  X,
  GraduationCap,
  Library,
  ShieldCheck,
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { Tab } from '../App';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  profile?: any;
}

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, profile }: SidebarProps) {
  const navItems: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Smart Upload', icon: UploadCloud },
    { id: 'formatting', label: 'Formatting', icon: FileText },
    { id: 'writing', label: 'Writing Assistant', icon: PenTool },
    { id: 'references', label: 'Reference Intel', icon: Library },
    { id: 'integrity', label: 'Integrity Check', icon: ShieldCheck },
    { id: 'journals', label: 'Journal Match', icon: BookMarked },
    { id: 'reviews', label: 'Peer Review', icon: MessageSquare },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-[#0f172a] text-slate-400 flex flex-col border-r border-slate-800/50
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3 text-white font-bold text-xl font-display tracking-tight">
            <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
              <GraduationCap className="text-white" size={24} />
            </div>
            <span>Genius</span>
          </div>
          <button
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="px-4 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            Research Pipeline
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all relative group
                  ${isActive
                    ? 'text-white'
                    : 'hover:text-slate-200 hover:bg-slate-800/50'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute inset-0 bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">
                  <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'} />
                </span>
                <span className="relative z-10 flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="relative z-10 opacity-50" size={16} />}
              </button>
            );
          })}
        </nav>

        <div
          className="m-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-[1.5rem] cursor-pointer hover:bg-slate-800/50 transition-all group"
          onClick={() => setActiveTab('profile')}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center text-rose-500 font-bold border border-slate-600 shadow-inner group-hover:scale-105 transition-transform">
              {profile?.profile?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                {profile?.profile?.name || 'Loading...'}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 truncate uppercase tracking-wider mt-0.5">
                {profile?.profile?.affiliation?.split(' ')[0] || 'Researcher'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
