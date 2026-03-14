import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react'; 
import Sidebar from './components/Sidebar';
import DashboardOverview from './components/DashboardOverview';
import SmartUpload from './components/SmartUpload';
import FormattingEngine from './components/FormattingEngine';
import WritingAssistant from './components/WritingAssistant';
import JournalRecommendations from './components/JournalRecommendations';
import ProfileView from './components/ProfileView';
import ReferenceIntelligence from './components/ReferenceIntelligence';
import IntegrityChecks from './components/IntegrityChecks';
import PeerReviewSimulation from './components/PeerReviewSimulation';
import TransactionHistory from './components/TransactionHistory';
import ChatWidget from './components/ChatWidget';
import Auth from './components/Auth';
import Landing from './components/Landing';
import PublicationRecords from './components/PublicationRecords';
import UserManagement from './components/UserManagement';
import ReviewQueue from './components/ReviewQueue';
import AdminSettings from './components/AdminSettings';
import GlobalLoader from './components/GlobalLoader';
import ToastSystem, { useToasts } from './components/ToastSystem';
import StudentAuth from './components/StudentAuth';
import StudentDashboard from './components/StudentDashboard';
import StudentPerformance from './components/StudentPerformance';
import SecurityGuidelines from './components/SecurityGuidelines';
import CourseManagement from './components/CourseManagement';
import PINSetup from './components/PINSetup';
import SubscriptionModal from './components/SubscriptionModal'; // NEW
import { Menu, LogOut, Bell, Search, ShieldCheck, GraduationCap, Users, FileText, PlusCircle } from 'lucide-react';

export type Tab = 'dashboard' | 'upload' | 'formatting' | 'writing' | 'references' | 'integrity' | 'journals' | 'reviews' | 'profile' | 'transactions' | 'records' | 'users' | 'reviewQueue' | 'settings' | 'courseManagement' | 'tests' | 'assignments' | 'performance' | 'guidelines';

const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  upload: 'Smart Upload',
  formatting: 'Formatting Engine',
  writing: 'Writing Assistant',
  references: 'Reference Intelligence',
  integrity: 'Integrity Checks',
  journals: 'Journal Match',
  reviews: 'Peer Review',
  profile: 'Profile',
  transactions: 'Transactions',
  records: 'Publication Records',
  users: 'User Management',
  reviewQueue: 'Review Queue',
  settings: 'Platform Settings',
  courseManagement: 'Course Management',
  tests: 'Tests & Quizzes',
  assignments: 'Assignments',
  performance: 'Performance Tracking',
  guidelines: 'Security Guidelines'
};

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePaperId, setActivePaperId] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showLanding, setShowLanding] = useState(!token);
  const [showStudentAuth, setShowStudentAuth] = useState(false);
  const [showPortalSelection, setShowPortalSelection] = useState(false);
  const [authRole, setAuthRole] = useState<'researcher' | 'lecturer'>('researcher');
  const [authIsLogin, setAuthIsLogin] = useState(true);
  const [adminViewMode, setAdminViewMode] = useState<'publication' | 'student'>('publication');
  const [adminSimulateRole, setAdminSimulateRole] = useState<'none' | 'researcher' | 'student'>('none');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [openChatUserId, setOpenChatUserId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { toasts, addToast, removeToast } = useToasts();

  useEffect(() => {
    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    if (token) {
      fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.status === 401 || res.status === 403) {
            handleLogout();
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data) setProfile(data);
        })
        .catch(err => console.error('Failed to load profile', err));
    } else {
      setIsSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => setIsSyncing(false), 1500);
    return () => clearTimeout(timer);
  }, [profile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setProfile(null);
  };

  const onAuthSuccess = (newToken: string, user: any) => {
    setToken(newToken);
    setShowLanding(false);
    setShowStudentAuth(false);
  };

  if (currentPath === '/setup-pin') {
    return <PINSetup onBackToLanding={() => { window.history.pushState({}, '', '/'); setCurrentPath('/'); setShowLanding(true); }} addToast={addToast} />;
  }

  if (showLanding && !token && !showStudentAuth) {
    return (
      <>
        <Landing 
            onPublicationHub={() => { setAuthRole('researcher'); setAuthIsLogin(true); setShowLanding(false); }} 
            onSchoolPortal={() => setShowPortalSelection(true)} 
        />
        <AnimatePresence>
          {showPortalSelection && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPortalSelection(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-8 sm:p-12">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#800000]/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 p-3">
                      <img src="/gmijp-logo.png" alt="Genius" className="w-full h-full object-contain rounded-full" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">School Portal</h2>
                    <p className="text-slate-500 font-medium">Choose your access role to continue</p>
                  </div>

                  <div className="grid gap-4">
                    <button
                      onClick={() => {
                        setShowPortalSelection(false);
                        setShowStudentAuth(true);
                      }}
                      className="group p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-3xl transition-all flex items-center gap-6 text-left"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                        <GraduationCap size={28} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-indigo-900">I am a Student</p>
                        <p className="text-sm text-indigo-600 font-medium">Access exams with Matric & PIN</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowPortalSelection(false);
                        setShowLanding(false);
                      }}
                      className="group p-6 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-3xl transition-all flex items-center gap-6 text-left"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#800000] shadow-sm group-hover:scale-110 transition-transform">
                        <PlusCircle size={28} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-rose-900">I am a Lecturer</p>
                        <p className="text-sm text-rose-600 font-medium">Create workspace & manage exams</p>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPortalSelection(false)}
                    className="w-full mt-8 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-xs"
                  >
                    Back to selection
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (showStudentAuth && !token) {
    return <StudentAuth onAuthSuccess={onAuthSuccess} addToast={addToast} onBackToMain={() => { setShowStudentAuth(false); setShowLanding(true); }} />;
  }

  if (!token) {
    return <Auth onAuthSuccess={onAuthSuccess} addToast={addToast} onBackToLanding={() => setShowLanding(true)} role={authRole} initialIsLogin={authIsLogin} />;
  }

  const role = profile?.user?.role;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  const isLecturer = role === 'tenant_admin';
  const isAdmin = isSuperAdmin || isLecturer;
  const isStudent = role === 'student' || (isSuperAdmin && adminSimulateRole === 'student');
  const isSimulatingResearcher = isSuperAdmin && adminSimulateRole === 'researcher';

  const renderContent = () => {
    // Student View (Real or Simulated)
    if (isStudent && activeTab !== 'profile') {
        if (activeTab === 'performance') return <StudentPerformance profile={profile} onNavigate={setActiveTab} />;
        if (activeTab === 'guidelines') return <SecurityGuidelines onNavigate={setActiveTab} />;
        return <StudentDashboard profile={profile} onNavigate={setActiveTab} addToast={addToast} view={activeTab} token={token} />;
    }

    // Lecturer View
    if (isLecturer && activeTab !== 'profile') {
        switch (activeTab) {
            case 'dashboard': return <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} />;
            case 'courseManagement': return <CourseManagement addToast={addToast} token={token} />;
            case 'users': return <UserManagement addToast={addToast} onOpenChat={(userId) => setOpenChatUserId(userId)} />;
            case 'performance': return <StudentPerformance profile={profile} onNavigate={setActiveTab} />;
            default: return <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} />;
        }
    }

    // Super Admin & Researcher View
    switch (activeTab) {
      case 'dashboard': return <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} />;
      case 'courseManagement': return <CourseManagement addToast={addToast} token={token} />;
      case 'upload': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <SmartUpload onUploadComplete={(id) => setActivePaperId(id)} addToast={addToast} />;
      case 'formatting': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <FormattingEngine activePaperId={activePaperId} />;
      case 'writing': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <WritingAssistant activePaperId={activePaperId} />;
      case 'references': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <ReferenceIntelligence activePaperId={activePaperId} />;
      case 'integrity': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <IntegrityChecks activePaperId={activePaperId} />;
      case 'journals': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <JournalRecommendations activePaperId={activePaperId} />;
      case 'reviews': return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <PeerReviewSimulation activePaperId={activePaperId} />;
      case 'transactions': return <TransactionHistory profile={profile} />;
      case 'records': return <PublicationRecords profile={profile} />;
      case 'users': return <UserManagement addToast={addToast} onOpenChat={(userId) => setOpenChatUserId(userId)} />;
      case 'reviewQueue': return <ReviewQueue profile={profile} />;
      case 'settings': return <AdminSettings />;
      case 'profile': return <ProfileView profile={profile} addToast={addToast} onProfileUpdate={() => {
        fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => { if (data) setProfile(data); });
      }} />;
      default: return (isAdmin && !isSimulatingResearcher) ? <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} /> : <StudentDashboard profile={profile} onNavigate={setActiveTab} addToast={addToast} view={activeTab} token={token} />;
    }
  };

  const getHeaderTitle = () => {
    if (isStudent) return 'Student Portal';
    if (activeTab === 'dashboard') return isAdmin ? 'Admin Console' : 'Analytics Overview';
    if (activeTab === 'courseManagement') return 'Course Management';
    return TAB_LABELS[activeTab as keyof typeof TAB_LABELS] || activeTab;
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* Subscription Overlay for Lecturers */}
      {profile?.user?.role === 'tenant_admin' && !profile?.tenant?.is_subscribed && (
        <SubscriptionModal
          profile={profile}
          onSuccess={() => {
            fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } })
              .then(res => res.json())
              .then(data => setProfile(data));
          }}
          addToast={addToast}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        adminViewMode={adminViewMode}
        setAdminViewMode={setAdminViewMode}
        adminSimulateRole={adminSimulateRole}
        setAdminSimulateRole={setAdminSimulateRole}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`backdrop-blur-xl border-b h-20 flex items-center justify-between px-4 lg:px-12 shrink-0 z-10 ${
          isAdmin ? 'bg-slate-900/[0.03] border-slate-200' : 'bg-white/90 border-slate-100'
        }`}>
          <div className="flex items-center gap-4 lg:gap-6">
            <div className={`w-10 h-10 rounded-full flex lg:hidden items-center justify-center shadow-lg shrink-0 ${
              isAdmin ? 'bg-gradient-to-br from-amber-500 to-[#800000] shadow-amber-900/30' : isStudent ? 'bg-indigo-600 shadow-indigo-600/30' : 'premium-gradient shadow-[#800000]/20'
            }`}>
              {isAdmin ? <ShieldCheck className="text-white" size={22} /> : <img src="/gmijp-logo.png" alt="Logo" className="w-6 h-6 rounded-full object-contain" />}
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 capitalize font-display tracking-tight flex items-center gap-2">
                {getHeaderTitle()}
                {isAdmin && <ShieldCheck className="text-amber-500 hidden sm:block" size={24} />}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                {isStudent ? 'Student Assessment' : isAdmin && !isSimulatingResearcher ? `Admin / ${adminViewMode === 'publication' ? 'Journal' : 'Student'} View` : isSimulatingResearcher ? 'Simulated Researcher' : 'Genius Portal'} / {TAB_LABELS[activeTab as keyof typeof TAB_LABELS] || activeTab}
              </p>
            </div>

            {activePaperId && !['dashboard', 'profile', 'users', 'reviewQueue', 'settings'].includes(activeTab) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  Working on Paper #{activePaperId}
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isAdmin && (
              <div className="hidden sm:flex items-center bg-slate-100 rounded-2xl px-4 py-2 mr-2 border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <Search size={18} className="text-slate-400" />
                <input type="text" placeholder="Search research..." className="bg-transparent border-none outline-none text-sm ml-2 w-48 font-medium" />
              </div>
            )}

            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 text-slate-400 hover:text-[#800000] hover:bg-[#800000]/5 rounded-xl transition-all relative"
              >
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
              
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-[60]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Alerts</h4>
                      <span className="text-[10px] font-bold text-[#800000] bg-[#800000]/5 px-2 py-1 rounded-md">1 New</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Bell size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Welcome to Genius Portal</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Your research journey starts here. Explore our AI features!</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-8 bg-slate-200 mx-2"></div>

            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-[#800000] hover:bg-[#800000]/5 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>

            <button onClick={() => setActiveTab('profile')} className="flex items-center gap-2 pl-2 group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-lg transition-all group-hover:scale-110 ${isAdmin ? 'premium-gradient shadow-[#800000]/20 text-white' : 'bg-slate-100 text-[#800000]'}`}>
                {(profile?.user?.name?.trim() || profile?.user?.email?.trim() || 'S').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-12 pb-32 lg:pb-12 scroll-smooth bg-slate-50/30">
          <div className="max-w-7xl mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showPortalSelection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPortalSelection(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-8 sm:p-12">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-[#800000]/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 p-3">
                    <img src="/gmijp-logo.png" alt="Genius" className="w-full h-full object-contain rounded-full" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">School Portal</h2>
                  <p className="text-slate-500 font-medium">Choose your access role to continue</p>
                </div>

                <div className="grid gap-4">
                  <button
                    onClick={() => {
                      setShowPortalSelection(false);
                      setShowStudentAuth(true);
                    }}
                    className="group p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-3xl transition-all flex items-center gap-6 text-left"
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                      <GraduationCap size={28} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-indigo-900">I am a Student</p>
                      <p className="text-sm text-indigo-600 font-medium">Access exams with Matric & PIN</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setAuthRole('lecturer');
                      setAuthIsLogin(false);
                      setShowPortalSelection(false);
                      setShowLanding(false);
                    }}
                    className="group p-6 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-3xl transition-all flex items-center gap-6 text-left"
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#800000] shadow-sm group-hover:scale-110 transition-transform">
                      <PlusCircle size={28} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-rose-900">I am a Lecturer</p>
                      <p className="text-sm text-rose-600 font-medium">Create workspace & manage exams</p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setShowPortalSelection(false)}
                  className="w-full mt-8 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-xs"
                >
                  Back to selection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ChatWidget profile={profile} />
      <ToastSystem toasts={toasts} removeToast={removeToast} />
      <GlobalLoader show={isSyncing} />
    </div>
  );
}