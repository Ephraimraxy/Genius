import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  PenTool,
  BookMarked,
  X,
  Library, // GraduationCap was removed, Library remains
  ShieldCheck,
  MessageSquare,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  History,
  Users,
  ClipboardList,
  BookOpen,
  CreditCard,
  FileUp,
  BarChart3,
  Trophy,
  ClipboardCheck,
  Info
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
  adminViewMode?: 'publication' | 'student';
  setAdminViewMode?: (mode: 'publication' | 'student') => void;
  adminSimulateRole?: 'none' | 'researcher' | 'student';
  setAdminSimulateRole?: (mode: 'none' | 'researcher' | 'student') => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  isCollapsed, 
  setIsCollapsed, 
  profile,
  adminViewMode,
  setAdminViewMode,
  adminSimulateRole,
  setAdminSimulateRole
}: SidebarProps) {
  const userRole = profile?.user?.role;
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';
  const isLecturer = userRole === 'tenant_admin';
  const isStudent = userRole === 'student';
  const isAdmin = isSuperAdmin || isLecturer;

  // ─── SUPER ADMIN NAV (Genius Platform) ──────────────────────────
  const superAdminNavItems: { id: Tab; label: string; icon: React.ComponentType<any>; section?: string }[] = [
    { id: 'dashboard', label: 'Platform Stats', icon: LayoutDashboard, section: 'Overview' },
    { id: 'users', label: 'Tenant Directory', icon: Users, section: 'SaaS Management' },
    { id: 'reviewQueue', label: 'Global Reviews', icon: ClipboardList },
    { id: 'records', label: 'All Publications', icon: History },
    { id: 'transactions', label: 'Global Revenue', icon: FileText },
    { id: 'settings', label: 'System Settings', icon: Settings, section: 'Core' },
  ];

  // ─── LECTURER NAV (Academic Workspace) ──────────────────────
  const lecturerNavItems: { id: Tab; label: string; icon: React.ComponentType<any> | React.ReactNode; section?: string }[] = [
    { id: 'dashboard', label: 'Workspace Stats', icon: LayoutDashboard, section: 'Overview' },
    { id: 'courseManagement', label: 'Course & Quiz', icon: <img src="/gmijp-logo.png" alt="Logo" className="w-4 h-4 object-contain" />, section: 'Academic' },
    { id: 'users', label: 'Student Roster', icon: Users },
    { id: 'performance', label: 'Class Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Workspace Settings', icon: Settings, section: 'Settings' },
  ];

  // ─── RESEARCHER NAV (Journal Center) ──────────────────────
  const researcherNavItems: { id: Tab; label: string; icon: React.ComponentType<any>; section?: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, section: 'Research Hub' },
    { id: 'upload', label: 'Smart Upload', icon: FileUp, section: 'Manuscript Pipeline' },
    { id: 'formatting', label: 'Formatting', icon: FileText },
    { id: 'writing', label: 'Writing Assistant', icon: PenTool },
    { id: 'references', label: 'Reference Intel', icon: Library },
    { id: 'integrity', label: 'Integrity Check', icon: ShieldCheck },
    { id: 'journals', label: 'Journal Match', icon: BookMarked, section: 'Publishing' },
    { id: 'reviews', label: 'Peer Review', icon: MessageSquare },
    { id: 'records', label: 'Pub. Records', icon: History },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
  ];

  // ─── STUDENT NAV (Student Center) ─────────────────────────
  const studentNavItems: { id: Tab; label: string; icon: React.ComponentType<any>; section?: string }[] = [
    { id: 'dashboard', label: 'Exams', icon: BookOpen, section: 'Course Work' },
    { id: 'tests', label: 'Tests', icon: ClipboardCheck },
    { id: 'assignments', label: 'Assignments', icon: FileUp },
    { id: 'performance', label: 'Performance', icon: BarChart3, section: 'Records' },
    { id: 'guidelines', label: 'Guidelines', icon: Info },
  ];

  // Determine active navigation list based on user role or simulation (for Super Admin)
  let effectiveRole = userRole;
  if (isSuperAdmin && adminSimulateRole && adminSimulateRole !== 'none') {
    effectiveRole = adminSimulateRole === 'researcher' ? 'user' : 'student';
  }

  let navItems = researcherNavItems;
  if (isSuperAdmin && adminSimulateRole === 'none') {
    navItems = adminViewMode === 'student' ? lecturerNavItems : superAdminNavItems;
  } else if (effectiveRole === 'student' || isStudent) {
    navItems = studentNavItems;
  } else if (isLecturer && effectiveRole === 'tenant_admin') {
    navItems = lecturerNavItems;
  }



  // Group items by section
  let currentSection = '';

  return (
    <>
      {/* ─── MOBILE BOTTOM APP BAR ─── */}
      <div className={`
        lg:hidden fixed bottom-0 left-0 w-full z-50 flex flex-col
        ${isAdmin ? 'bg-[#0a0f1e] border-amber-900/20' : 'bg-[#0f172a] border-slate-800/50'} 
        border-t transition-all pt-1 shadow-2xl
      `} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {isAdmin && setAdminViewMode && setAdminSimulateRole && (
          <div className="flex items-center p-2 bg-slate-900/80 border-b border-slate-700/50 gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1 mr-2">Mode:</span>
            
            <button
                onClick={() => { setAdminViewMode('publication'); setAdminSimulateRole('none'); setActiveTab('dashboard'); }}
                className={`flex-none flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                  adminViewMode === 'publication' && adminSimulateRole === 'none' ? 'bg-[#800000] text-white' : 'border border-slate-700 text-slate-400'
                }`}
            >
              Mng Jrnl
            </button>
            <button
                onClick={() => { setAdminViewMode('student'); setAdminSimulateRole('none'); setActiveTab('dashboard'); }}
                className={`flex-none flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                  adminViewMode === 'student' && adminSimulateRole === 'none' ? 'bg-[#800000] text-white' : 'border border-slate-700 text-slate-400'
                }`}
            >
              Mng Stdnt
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1"></div>

            <button
                onClick={() => { setAdminSimulateRole('researcher'); setActiveTab('dashboard'); }}
                className={`flex-none flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                  adminSimulateRole === 'researcher' ? 'bg-emerald-600 text-white' : 'border border-slate-700 text-slate-400'
                }`}
            >
               Sim: Rsrch
            </button>
            <button
                onClick={() => { setAdminSimulateRole('student'); setActiveTab('dashboard'); }}
                className={`flex-none flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                  adminSimulateRole === 'student' ? 'bg-rose-600 text-white' : 'border border-slate-700 text-slate-400'
                }`}
            >
               Sim: Stdnt
            </button>
          </div>
        )}

        <div className="flex items-center overflow-x-auto px-2 py-2 gap-1 touch-pan-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-w-[72px] p-2 rounded-xl transition-all relative shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-nav"
                    className={`absolute inset-0 rounded-xl ${
                      isAdmin ? (adminViewMode === 'student' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-gradient-to-r from-amber-900/80 to-[#800000] shadow-lg shadow-amber-900/20') : isStudent ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-[#800000] shadow-lg shadow-[#800000]/20'
                    }`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 mb-1">
                  <Icon size={20} className={isActive ? 'text-white' : ''} />
                </span>
                <span className="relative z-10 text-[9px] font-bold text-center truncate w-full">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside className={`
        hidden lg:flex flex-col inset-y-0 left-0 z-50 shrink-0
        ${isAdmin ? 'bg-[#0a0f1e]' : 'bg-[#0f172a]'} text-slate-400 border-r ${isAdmin ? 'border-amber-900/20' : 'border-slate-800/50'}
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className={`h-20 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between px-8'}`}>
          <div className="flex items-center gap-3 text-white font-bold text-xl font-display tracking-tight">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
              isAdmin ? 'bg-gradient-to-br from-amber-500 to-[#800000] shadow-amber-900/30' : 'bg-white shadow-[#800000]/20 p-1.5'
            }`}>
              {isAdmin ? <ShieldCheck className="text-white" size={20} /> : <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full rounded-full object-contain" />}
            </div>
            {!isCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
                <span className="leading-tight text-lg">Genius</span>
                {isAdmin && <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.25em] -mt-0.5">Admin</span>}
              </motion.div>
            )}
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

        <nav className={`flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-3' : 'px-4'}`}>
          {navItems.map((item, idx) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const showSection = item.section && item.section !== currentSection;
            if (item.section) currentSection = item.section;

            return (
              <React.Fragment key={item.id}>
                {showSection && !isCollapsed && (
                  <div className={`px-4 ${idx > 0 ? 'mt-7' : ''} mb-3 text-[10px] font-bold uppercase tracking-[0.2em] ${
                    isAdmin ? 'text-amber-500/70' : 'text-slate-500'
                  }`}>
                    {item.section}
                  </div>
                )}
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 md:px-4 py-2.5 rounded-xl md:rounded-2xl text-sm font-semibold transition-all relative group
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
                      className={`absolute inset-0 rounded-2xl shadow-lg ${
                        isAdmin ? 'bg-gradient-to-r from-amber-900/80 to-[#800000] shadow-amber-900/20' : 'bg-[#800000] shadow-[#800000]/20'
                      }`}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">
                    <Icon size={20} className={isActive ? 'text-white' : `${isAdmin ? 'text-slate-500 group-hover:text-amber-400' : 'text-slate-500 group-hover:text-white'} transition-colors`} />
                  </span>
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 flex-1 text-left truncate">
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && !isCollapsed && <ChevronRight className="relative z-10 opacity-50" size={16} />}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

      {/* View Toggle For Admin (Desktop/Collapsed overlay) */}
      {isAdmin && !isCollapsed && setAdminViewMode && setAdminSimulateRole && (
          <div className="mx-4 mt-auto mb-2 space-y-3">
             <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#eab308] mb-1 px-1">Manage Mode:</div>
                <div className="p-1 bg-slate-800/50 rounded-xl flex items-center border border-slate-700/50 shrink-0 shadow-inner">
                  <button
                    onClick={() => { setAdminViewMode('publication'); setAdminSimulateRole('none'); setActiveTab('dashboard'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                      adminViewMode === 'publication' && adminSimulateRole === 'none' ? 'bg-[#800000] text-white shadow-md' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Journal
                  </button>
                  <button
                    onClick={() => { setAdminViewMode('student'); setAdminSimulateRole('none'); setActiveTab('dashboard'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                      adminViewMode === 'student' && adminSimulateRole === 'none' ? 'bg-[#800000] text-white shadow-md' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Student
                  </button>
                </div>
              </div>
              
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-1 px-1">Simulate Role As:</div>
                <div className="p-1 bg-slate-800/50 rounded-xl flex items-center border border-slate-700/50 shrink-0 shadow-inner">
                  <button
                    onClick={() => { setAdminSimulateRole('researcher'); setActiveTab('dashboard'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                      adminSimulateRole === 'researcher' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Researcher
                  </button>
                  <button
                    onClick={() => { setAdminSimulateRole('student'); setActiveTab('dashboard'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                      adminSimulateRole === 'student' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Student
                  </button>
                </div>
              </div>
          </div>
      )}

        <div
          className={`
            m-4 mt-0 p-4 border rounded-[1.5rem] cursor-pointer transition-all group shrink-0
            ${isAdmin ? 'bg-amber-900/10 border-amber-800/30 hover:bg-amber-900/20' : isStudent ? 'bg-indigo-900/20 border-indigo-800/30 hover:bg-indigo-900/30' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}
            ${isCollapsed ? 'p-2 flex justify-center' : ''}
          `}
          onClick={() => setActiveTab('profile')}
        >
          <div className="flex items-center gap-3">
            <div className={`
              rounded-xl flex items-center justify-center text-white font-bold border shadow-inner group-hover:scale-105 transition-transform shrink-0
              ${isAdmin ? 'bg-gradient-to-br from-amber-600 to-[#800000] border-amber-700' : isStudent ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}
              ${isCollapsed ? 'w-10 h-10' : 'w-11 h-11'}
            `}>
              {(profile?.user?.name?.trim() || profile?.user?.email?.trim() || 'S').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-white transition-colors">
                  {profile?.user?.name?.trim() || profile?.user?.email?.trim() || 'Verified Scholar'}
                </p>
                <p className="text-[10px] text-slate-500 truncate mb-1">{profile?.user?.email || 'Connected'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isAdmin ? 'bg-amber-500/20 text-amber-400' : isStudent ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                    {isAdmin ? 'Admin' : isStudent ? 'Student Profile' : 'Researcher'}
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
