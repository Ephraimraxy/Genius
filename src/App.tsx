import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react'; // Refined animations
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
import { Menu, LogOut, Bell, Search, ShieldCheck } from 'lucide-react';

export type Tab = 'dashboard' | 'upload' | 'formatting' | 'writing' | 'references' | 'integrity' | 'journals' | 'reviews' | 'profile' | 'transactions' | 'records';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activePaperId, setActivePaperId] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showLanding, setShowLanding] = useState(!token);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setProfile(null);
  };

  const onAuthSuccess = (newToken: string, user: any) => {
    setToken(newToken);
    setShowLanding(false);
  };

  if (showLanding && !token) {
    return <Landing onStart={() => setShowLanding(false)} />;
  }

  if (!token) {
    return <Auth onAuthSuccess={onAuthSuccess} />;
  }

  const isAdmin = profile?.user?.role === 'admin';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} />;
      case 'upload': return <SmartUpload onUploadComplete={(id) => setActivePaperId(id)} />;
      case 'formatting': return <FormattingEngine activePaperId={activePaperId} />;
      case 'writing': return <WritingAssistant activePaperId={activePaperId} />;
      case 'references': return <ReferenceIntelligence activePaperId={activePaperId} />;
      case 'integrity': return <IntegrityChecks activePaperId={activePaperId} />;
      case 'journals': return <JournalRecommendations activePaperId={activePaperId} />;
      case 'reviews': return <PeerReviewSimulation activePaperId={activePaperId} />;
      case 'transactions': return <TransactionHistory profile={profile} />;
      case 'records': return <PublicationRecords profile={profile} />;
      case 'profile': return <ProfileView profile={profile} />;
      default: return <DashboardOverview onNavigate={setActiveTab} profile={profile} setActivePaperId={setActivePaperId} />;
    }
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        profile={profile}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 h-20 flex items-center justify-between px-8 lg:px-12 shrink-0 z-10">
          <div className="flex items-center gap-6">
            <button
              className="lg:hidden p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 capitalize font-display tracking-tight flex items-center gap-2">
                {activeTab === 'dashboard' ? (isAdmin ? 'Admin Console' : 'Analytics Overview') : activeTab.replace(/([A-Z])/g, ' $1').trim()}
                {isAdmin && <ShieldCheck className="text-amber-500" size={24} />}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                Genius Portal / {activeTab}
              </p>
            </div>

            {activePaperId && !['dashboard', 'profile'].includes(activeTab) && (
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
            <div className="hidden sm:flex items-center bg-slate-100 rounded-2xl px-4 py-2 mr-2 border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="Search research..." className="bg-transparent border-none outline-none text-sm ml-2 w-48 font-medium" />
            </div>

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
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-lg transition-all group-hover:scale-110 ${isAdmin ? 'premium-gradient shadow-[#800000]/20' : 'bg-slate-100 text-[#800000]'}`}>
                {(profile?.user?.name || profile?.user?.email)?.split(' ').map((n: string) => n[0]).join('') || 'U'}
              </div>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 lg:p-12 scroll-smooth bg-slate-50/30">
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
      <ChatWidget profile={profile} />
    </div>
  );
}
