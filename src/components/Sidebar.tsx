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
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Database,
  History
} from 'lucide-react';
import { Tab } from '../App';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  profile?: any;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  isCollapsed, 
  setIsCollapsed, 
  profile 
}: SidebarProps) {
  const isAdmin = profile?.user?.role === 'admin';
  
  const navItems: { id: Tab; label: string; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Smart Upload', icon: UploadCloud },
    { id: 'formatting', label: 'Formatting', icon: FileText },
    { id: 'writing', label: 'Writing Assistant', icon: PenTool },
    { id: 'references', label: 'Reference Intel', icon: Library },
    { id: 'integrity', label: 'Integrity Check', icon: ShieldCheck },
    { id: 'journals', label: 'Journal Match', icon: BookMarked },
    { id: 'reviews', label: 'Peer Review', icon: MessageSquare },
    { id: 'records', label: 'Pub. Records', icon: History },
    { id: 'transactions', label: 'Transactions', icon: FileText },
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
        bg-[#0f172a] text-slate-400 flex flex-col border-r border-slate-800/50
        transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'w-24' : 'w-72'}
      `}>
        <div className={`h-20 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between px-8'}`}>
          <div className="flex items-center gap-3 text-white font-bold text-xl font-display tracking-tight">
            <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#800000]/20 shrink-0">
              <GraduationCap className="text-white" size={24} />
            </div>
            {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Genius</motion.span>}
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>

          <button
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className={`flex-1 py-8 space-y-2 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-3' : 'px-4'}`}>
          {!isCollapsed && (
            <div className="px-4 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              Research Pipeline
            </div>
          )}
          
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
                  ${isCollapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'text-white'
                    : 'hover:text-slate-200 hover:bg-slate-800/50'}
                `}
                title={isCollapsed ? item.label : ''}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute inset-0 bg-[#800000] rounded-2xl shadow-lg shadow-[#800000]/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">
                  <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                </span>
                {!isCollapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex-1 text-left truncate">
                    {item.label}
                  </motion.span>
                )}
                {isActive && !isCollapsed && <ChevronRight className="relative z-10 opacity-50" size={16} />}
              </button>
            );
          })}

          {isAdmin && (
            <>
              {!isCollapsed && (
                <div className="px-4 mt-8 mb-4 text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">
                  Admin Console
                </div>
              )}
              <button
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all group
                  ${isCollapsed ? 'justify-center' : ''}
                  hover:text-white hover:bg-slate-800/50
                `}
                title={isCollapsed ? "System Logs" : ""}
              >
                <Database size={20} className="text-amber-500" />
                {!isCollapsed && <span>System Status</span>}
              </button>
            </>
          )}
        </nav>

        <div
          className={`
            m-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-[1.5rem] cursor-pointer hover:bg-slate-800/50 transition-all group
            ${isCollapsed ? 'p-2 flex justify-center' : ''}
          `}
          onClick={() => setActiveTab('profile')}
        >
          <div className="flex items-center gap-3">
            <div className={`
              rounded-xl flex items-center justify-center text-white font-bold border border-slate-600 shadow-inner group-hover:scale-105 transition-transform shrink-0
              ${isAdmin ? 'premium-gradient' : 'bg-slate-700'}
              ${isCollapsed ? 'w-10 h-10' : 'w-11 h-11'}
            `}>
              {(profile?.user?.name || profile?.user?.email || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">
                  {profile?.user?.name || profile?.user?.email || 'Loading...'}
                </p>
                <p className="text-[10px] text-slate-500 truncate mb-1">{profile?.user?.email}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isAdmin ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-700 text-slate-400'}`}>
                    {isAdmin ? 'Admin' : 'Researcher'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
