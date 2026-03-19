import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  PenTool,
  BookMarked,
  X,
  Library,
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
  ClipboardCheck,
  Info,
  GraduationCap,
  Database,
  Volume2,
  Video
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
  profile,
}: SidebarProps) {
  if (!profile) return null; // Prevent flash of default items

  const userRole = profile?.user?.role;
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';
  const isLecturer = userRole === 'tenant_admin';
  const isStudent = userRole === 'student';
  const isAdmin = isSuperAdmin; // Strictly Super Admin 
  const isAnyAdmin = isSuperAdmin || isLecturer;

  // ─── SUPER ADMIN NAV (Genius Platform) ──────────────────────────
  const superAdminNavItems: { id: Tab; label: string; icon: React.ComponentType<any>; section?: string }[] = [
    { id: 'dashboard', label: 'Platform Stats', icon: LayoutDashboard, section: 'Overview' },
    { id: 'tenants', label: 'Tenant Directory', icon: Users, section: 'SaaS Management' },
    { id: 'reviewQueue', label: 'Global Reviews', icon: ClipboardList },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'tokenStatus', label: 'Token Tracking', icon: CreditCard },
    { id: 'reviewQueue', label: 'Review Queue', icon: FileText },
    { id: 'settings', label: 'System Settings', icon: Settings, section: 'Core' },
  ];

  // ─── LECTURER NAV (Academic Workspace) ──────────────────────
  const lecturerNavItems: { id: Tab; label: string; icon: React.ComponentType<any> | React.ReactNode; section?: string }[] = [
    { id: 'dashboard', label: 'Workspace Stats', icon: <img src="/gmijp-logo.png" alt="Logo" className="w-5 h-5 object-contain rounded-full bg-white p-0.5" />, section: 'Management' },
    { id: 'storage', label: 'Resource Hub', icon: Database },
    { id: 'lectureRecords', label: 'Manage Records', icon: Volume2, section: 'Academic' },
    { id: 'videoLectures', label: 'Video Lectures', icon: Video },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList },
    { id: 'materials', label: 'Lecture Materials', icon: BookOpen },
    { id: 'tests', label: 'Tests', icon: ClipboardCheck },
    { id: 'assignments', label: 'Assignments', icon: FileUp },
    { id: 'exams', label: 'Exams', icon: GraduationCap },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'Preferences' },
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
    { id: 'materials', label: 'Lecture Materials', icon: BookMarked },
    { id: 'tests', label: 'Tests', icon: ClipboardCheck },
    { id: 'assignments', label: 'Assignments', icon: FileUp },
    { id: 'performance', label: 'Performance', icon: BarChart3, section: 'Records' },
    { id: 'guidelines', label: 'Guidelines', icon: Info },
  ];

  // Determine active navigation list based on user role
  let navItems = researcherNavItems;
  if (isSuperAdmin) {
    navItems = superAdminNavItems;
  } else if (isStudent) {
    navItems = studentNavItems;
  } else if (isLecturer) {
    navItems = lecturerNavItems;
  }

  // Group items by section
  let currentSection = '';

  return (
    <>
      {/* ─── MOBILE BOTTOM APP BAR ─── */}
      <div className={`
        lg:hidden fixed bottom-0 left-0 w-full z-50 flex flex-col
        ${isAdmin ? 'bg-[#0a0f1e] border-amber-900/20' : isLecturer ? 'bg-[#1e3a8a] border-blue-900/30' : 'bg-[#0f172a] border-slate-800/50'} 
        border-t transition-all pt-1 shadow-2xl
      `} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center overflow-x-auto px-1.5 py-1.5 gap-0.5 touch-pan-x hide-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-w-[64px] p-1.5 rounded-xl transition-all relative shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-nav"
                    className={`absolute inset-0 rounded-xl ${
                      isStudent ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : isLecturer ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'bg-[#800000] shadow-lg shadow-[#800000]/20'
                    }`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 mb-0.5">
                  {typeof Icon === 'function' || (typeof Icon === 'object' && 'render' in Icon) ? (
                    <Icon size={18} className={isActive ? 'text-white' : ''} />
                  ) : (
                    <div className="w-[18px] h-[18px] flex items-center justify-center">{Icon as React.ReactNode}</div>
                  )}
                </span>
                <span className="relative z-10 text-[10px] font-bold text-center truncate w-full tracking-tight">
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
        ${isAdmin ? 'bg-[#0a0f1e]' : isLecturer ? 'bg-[#0a192f]' : 'bg-[#0f172a]'} 
        ${isAdmin ? 'text-slate-400' : isLecturer ? 'text-white' : 'text-slate-400'}
        ${isAdmin ? 'border-r border-amber-900/20' : isLecturer ? 'border-r border-blue-900/50 shadow-2xl' : 'border-r border-slate-800/50'}
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className={`h-20 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between px-8'}`}>
          <div className="flex items-center gap-3 text-white font-bold text-xl font-display tracking-tight">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg shrink-0 ${isLecturer ? 'bg-indigo-50 border border-indigo-100' : 'bg-white shadow-slate-200'} p-2.5`}>
              <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full rounded-full object-contain scale-110" />
            </div>
            {!isCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
                <span className={`leading-tight text-lg text-white`}>Genius</span>
                {isAdmin && <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.25em] -mt-0.5">Admin</span>}
                {isLecturer && <span className="text-[8px] font-black text-blue-300 uppercase tracking-[0.25em] -mt-0.5">Workspace</span>}
              </motion.div>
            )}
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden lg:flex p-2 rounded-lg transition-colors ml-2 ${isLecturer ? 'text-blue-300 hover:text-white hover:bg-blue-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
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
                    isAdmin ? 'text-amber-500/70' : isLecturer ? 'text-blue-300/70' : 'text-slate-500'
                  }`}>
                    {item.section}
                  </div>
                )}
                <motion.button
                  whileHover={{ x: isCollapsed ? 0 : 5, scale: isCollapsed ? 1.05 : 1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 md:px-4 py-2.5 rounded-xl md:rounded-2xl text-sm font-semibold transition-all relative group
                    ${isCollapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'text-white font-bold'
                      : isLecturer ? 'text-blue-100/60 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
                  `}
                  title={isCollapsed ? item.label : ''}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className={`absolute inset-0 rounded-2xl shadow-lg border border-white/10 ${
                        isAdmin ? 'bg-gradient-to-r from-amber-900/80 to-[#800000] shadow-amber-900/20' : isLecturer ? 'bg-white/10 backdrop-blur-md shadow-xl shadow-black/20' : 'bg-[#800000] shadow-[#800000]/20'
                      }`}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 shrink-0">
                    {typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && 'render' in Icon) ? (
                      <Icon size={20} className={isActive ? 'text-white' : `${isAdmin ? 'text-slate-500 group-hover:text-amber-400' : isLecturer ? 'text-blue-200/50 group-hover:text-white' : 'text-slate-500 group-hover:text-white'} transition-all group-hover:scale-110`} />
                    ) : (
                      <div className="w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110">{Icon as React.ReactNode}</div>
                    )}
                  </span>
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`relative z-10 flex-1 text-left truncate ${isActive ? 'font-black' : ''}`}>
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && !isCollapsed && (
                    <motion.div 
                      layoutId="activePill"
                      className={`relative z-10 w-1.5 h-1.5 rounded-full ${isLecturer ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-white/50'}`}
                    />
                  )}
                </motion.button>
              </React.Fragment>
            );
          })}
        </nav>

        <div
          className={`
            m-4 mt-0 p-4 border rounded-[1.5rem] cursor-pointer transition-all group shrink-0
            ${isAdmin ? 'bg-amber-900/10 border-amber-800/30 hover:bg-amber-900/20' : isLecturer ? 'bg-blue-800/50 border-blue-700/50 hover:bg-blue-800/80' : isStudent ? 'bg-indigo-900/20 border-indigo-800/30 hover:bg-indigo-900/30' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}
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
                <p className={`text-sm font-bold truncate transition-colors ${isLecturer ? 'text-white' : 'text-white'}`}>
                  {profile?.user?.name?.trim() || profile?.user?.email?.trim() || 'Verified Scholar'}
                </p>
                <p className={`text-[10px] truncate mb-1 ${isLecturer ? 'text-blue-300' : 'text-slate-500'}`}>{profile?.user?.email || 'Connected'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isAdmin ? 'bg-amber-500/20 text-amber-400' : isLecturer ? 'bg-blue-500/30 text-blue-100' : isStudent ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                    {isAdmin ? 'Admin' : isLecturer ? 'Lecturer' : isStudent ? 'Student Profile' : 'Researcher'}
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
