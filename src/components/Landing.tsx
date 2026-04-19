import React, { useState, useEffect, useRef } from 'react';
import { motion, animate, useInView, AnimatePresence } from 'motion/react';
import {
  ArrowRight, Shield, Globe, Users, CheckCircle2, FileText, Mail, MapPin, Phone,
  PlusCircle, FileDown, Gem, ChevronRight, BookOpen, GraduationCap, ClipboardList,
  Clock, Star, AlertCircle, Upload, Eye, BarChart2, Bell, Lock, Zap, Home, X,
  CheckCircle, ArrowLeft, Layers, Building2, CreditCard
} from 'lucide-react';

type Page = 'home' | 'about' | 'guidelines' | 'editorial' | 'contact';
type GuidelinesTab = 'publication' | 'lecturer' | 'student';

interface LandingProps {
  onPublicationHub: () => void;
  onSchoolPortal: () => void;
}

const AnimatedCounter = ({ value }: { value: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-100px' });

  useEffect(() => {
    if (!isInView || !ref.current) return;
    const numericMatch = value.match(/[\d.]+/);
    if (!numericMatch) return;
    let target = parseFloat(numericMatch[0]);
    const suffix = value.replace(numericMatch[0], '');
    const isKValue = value.toLowerCase().includes('k');
    const isDecimal = value.includes('.');
    const controls = animate(0, target, {
      duration: 6, ease: 'easeOut',
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = (isKValue || isDecimal ? latest.toFixed(2) : Math.floor(latest)) + suffix;
      }
    });
    let intervalId: any;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (!ref.current) return;
        target += (isKValue || isDecimal ? 0.01 : 1);
        ref.current.textContent = (isKValue || isDecimal ? target.toFixed(2) : Math.floor(target)) + suffix;
      }, 5000);
    }, 6000);
    return () => { controls.stop(); clearTimeout(timeoutId); if (intervalId) clearInterval(intervalId); };
  }, [isInView, value]);

  return <span ref={ref}>0{value.includes('.') ? '.00' : ''}{value.replace(/[\d.]+/, '')}</span>;
};

const Step = ({ n, title, desc, icon }: { n: number; title: string; desc: string; icon: React.ReactNode }) => (
  <div className="flex gap-5">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 rounded-2xl bg-[#800000] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-lg shadow-[#800000]/30">
        {n}
      </div>
      <div className="w-px flex-1 bg-slate-200 mt-2 mb-2" />
    </div>
    <div className="pb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#800000]">{icon}</span>
        <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">{title}</h4>
      </div>
      <p className="text-slate-500 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

export default function Landing({ onPublicationHub, onSchoolPortal }: LandingProps) {
  const [activePage, setActivePage] = useState<Page>('home');
  const [guideTab, setGuideTab] = useState<GuidelinesTab>('publication');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const navItems: { label: string; page: Page }[] = [
    { label: 'About', page: 'about' },
    { label: 'Guidelines', page: 'guidelines' },
    { label: 'Editorial', page: 'editorial' },
    { label: 'Contact', page: 'contact' },
  ];

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#800000] selection:text-white">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 h-16 md:h-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => setActivePage('home')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border border-slate-100 overflow-hidden bg-white p-2.5">
              <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Genius</span>
              <span className="text-[8px] md:text-[10px] font-bold text-[#800000] tracking-[0.3em] uppercase mt-0.5">Research Portal</span>
            </div>
          </button>

          {/* Centered Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item, i) => (
              <React.Fragment key={item.page}>
                <button
                  onClick={() => setActivePage(item.page)}
                  className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activePage === item.page
                    ? 'bg-[#800000] text-white shadow-lg shadow-[#800000]/20'
                    : 'text-slate-500 hover:text-[#800000] hover:bg-slate-50'
                    }`}
                >
                  {item.label}
                </button>
                {i < navItems.length - 1 && <span className="text-slate-200 font-black text-xs">•</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-lg shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest">
                <FileDown size={14} /> Install App
              </button>
            )}
            <button onClick={onSchoolPortal} className="p-2.5 md:px-5 md:py-2.5 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm">
              <Users size={16} />
              <span className="hidden md:inline">School Portal</span>
            </button>
            <button onClick={onPublicationHub} className="p-2.5 md:px-5 md:py-2.5 bg-[#800000] text-white text-[11px] font-black rounded-xl shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all uppercase tracking-widest flex items-center gap-2">
              <PlusCircle size={16} />
              <span className="hidden md:inline">Publication Hub</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className="pt-16 md:pt-20">
        <AnimatePresence mode="wait">

          {/* ═══════════════════════ HOME ═══════════════════════ */}
          {activePage === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {/* Hero */}
              <section className="relative min-h-[calc(100vh-80px)] flex items-center overflow-hidden bg-slate-900">
                <div className="absolute inset-0 z-0">
                  <img src="/Banner/NSUK.jpg" alt="University" className="w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10" />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900 z-20" />
                </div>
                <div className="max-w-7xl mx-auto px-6 relative z-30 w-full py-20">
                  <div className="max-w-4xl">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-[#ff4d4d] animate-pulse" />
                        <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em]">Neural Verified Research Environment</span>
                      </div>
                      <h1 className="text-5xl md:text-8xl font-black text-white leading-[0.95] tracking-tighter mb-8">
                        GENIUS <span className="text-[#ff4d4d] italic">MINDSPARK</span> <br />
                        <span className="text-white/40">MULTIDISCIPLINARY</span>
                      </h1>
                      <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-12 max-w-2xl font-medium">
                        The global benchmark for multidisciplinary research excellence. Transform your ideas with <span className="text-white border-b border-[#ff4d4d]">neural-assisted validation</span>, instant DOI registration, and global dissemination.
                      </p>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <button onClick={onPublicationHub} className="group relative px-10 py-5 bg-[#800000] text-white font-black rounded-2xl shadow-2xl shadow-[#800000]/40 hover:scale-[1.03] transition-all uppercase tracking-[0.2em] text-[11px] overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          <span className="relative flex items-center justify-center gap-3"><PlusCircle size={18} /> Publication Hub</span>
                        </button>
                        <button onClick={onSchoolPortal} className="px-10 py-5 bg-white text-slate-900 font-black rounded-2xl shadow-2xl hover:bg-slate-50 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 border border-slate-100">
                          <Users size={18} /> Academic Workspace
                        </button>
                        <button onClick={() => setActivePage('guidelines')} className="px-10 py-5 border border-white/20 text-white font-black rounded-2xl hover:bg-white/5 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3">
                          <BookOpen size={18} /> How It Works
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="absolute bottom-12 right-12 z-30 hidden xl:block">
                  <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <Gem className="text-[#ff4d4d]" size={24} />
                    </div>
                    <div className="pr-4">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Compute Engine</p>
                      <p className="text-sm font-bold text-white">Genius Neural Fabric v4.0</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Feature overview */}
              <section className="py-24 bg-white border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="flex flex-col md:flex-row gap-20">
                    <div className="flex-1 space-y-8">
                      <div className="space-y-4">
                        <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.4em]">Neural Publication Hub</span>
                        <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">The Future of<br />Academic Publishing</h3>
                        <p className="text-slate-500 font-medium text-lg leading-relaxed">A seamless, AI-integrated workflow for researchers and journals.</p>
                      </div>
                      <div className="space-y-6 pt-4">
                        {[
                          { t: 'Automated DOI Registry', d: 'Instant global indexing and persistent identification.' },
                          { t: 'AI Manuscript Audit', d: 'Automated integrity and compliance verification.' },
                          { t: 'Neural Peer Selection', d: 'Intelligent matching with specialized reviewers.' },
                        ].map((item, i) => (
                          <div key={i} className="flex gap-6 group">
                            <div className="w-1 h-12 bg-[#800000]/10 rounded-full group-hover:bg-[#800000] transition-colors shrink-0" />
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">{item.t}</h4>
                              <p className="text-sm text-slate-400 font-medium">{item.d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={onPublicationHub} className="inline-flex items-center gap-2 text-[#800000] font-black text-[11px] uppercase tracking-widest pt-4 hover:gap-4 transition-all">
                        Access Portal <ArrowRight size={16} />
                      </button>
                    </div>

                    <div className="flex-1 space-y-8 md:pl-10">
                      <div className="space-y-4">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Academic Workspace</span>
                        <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">Intelligent Classroom<br />Management</h3>
                        <p className="text-slate-500 font-medium text-lg leading-relaxed">Empowering educators with real-time AI assistance.</p>
                      </div>
                      <div className="space-y-6 pt-4">
                        {[
                          { t: 'AI Question Engine', d: 'Generate professional assessments from any lecture material.' },
                          { t: 'Neural Proctoring', d: 'Maintain integrity with intelligent surveillance.' },
                          { t: 'Deep Analytics', d: 'Predictive insights into student learning curves.' },
                        ].map((item, i) => (
                          <div key={i} className="flex gap-6 group">
                            <div className="w-1 h-12 bg-indigo-600/10 rounded-full group-hover:bg-indigo-600 transition-colors shrink-0" />
                            <div>
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">{item.t}</h4>
                              <p className="text-sm text-slate-400 font-medium">{item.d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={onSchoolPortal} className="inline-flex items-center gap-2 text-indigo-600 font-black text-[11px] uppercase tracking-widest pt-4 hover:gap-4 transition-all">
                        Enter Workspace <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stats */}
              <section className="py-20 bg-slate-900">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                      { label: 'Published Papers', value: '2.50k+', icon: <FileText size={20} /> },
                      { label: 'Global Citations', value: '850k+', icon: <Globe size={20} /> },
                      { label: 'Expert Reviewers', value: '450+', icon: <Users size={20} /> },
                      { label: 'Impact Factor', value: '8.42', icon: <Star size={20} /> },
                    ].map((stat, i) => (
                      <div key={i} className="text-center">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-[#ff4d4d] mx-auto mb-4 border border-white/10">{stat.icon}</div>
                        <p className="text-4xl font-black text-white mb-2"><AnimatedCounter value={stat.value} /></p>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* ═══════════════════════ ABOUT ═══════════════════════ */}
          {activePage === 'about' && (
            <motion.div key="about" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }}>
              {/* Hero banner */}
              <div className="bg-slate-900 py-20 px-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20"><img src="/Banner/NSUK.jpg" alt="" className="w-full h-full object-cover" /></div>
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />
                <div className="max-w-7xl mx-auto relative z-10">
                  <p className="text-[10px] font-black text-[#ff4d4d] uppercase tracking-[0.4em] mb-4">Institutional Profile</p>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-6">About <span className="text-[#ff4d4d]">Genius</span></h1>
                  <p className="text-white/60 font-medium text-lg max-w-2xl leading-relaxed">A neural-verified academic ecosystem bridging world-class research publishing and intelligent classroom management under one roof.</p>
                </div>
              </div>

              <div className="max-w-7xl mx-auto px-6 py-20 space-y-24">

                {/* Overview */}
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.4em]">Who We Are</span>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mt-3 mb-6 leading-tight">Two Platforms. <br />One Mission.</h2>
                    <p className="text-slate-600 font-medium leading-relaxed mb-6 text-base">
                      Genius is not a single tool — it is an integrated academic ecosystem with two distinct but connected wings. The <strong>Genius Publication Hub</strong> serves researchers, authors, and editors who need a rigorous, AI-assisted channel for publishing peer-reviewed work. The <strong>Academic Workspace</strong> serves lecturers and students inside institutions, providing AI-generated assessments, proctored exams, attendance tracking, and real-time performance analytics.
                    </p>
                    <p className="text-slate-500 font-medium leading-relaxed text-base">
                      Both wings are powered by the same underlying intelligence layer — the Genius Neural Fabric — which handles everything from manuscript compliance audits to question generation from lecture notes.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Published Papers', value: '2.50k+', icon: <FileText size={18} /> },
                      { label: 'Global Citations', value: '850k+', icon: <Globe size={18} /> },
                      { label: 'Expert Reviewers', value: '450+', icon: <Users size={18} /> },
                      { label: 'Impact Factor', value: '8.42', icon: <Star size={18} /> },
                    ].map((s, i) => (
                      <div key={i} className="p-8 bg-white rounded-3xl border border-slate-100 text-center shadow-lg hover:border-[#800000]/20 transition-all">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#800000] mx-auto mb-4">{s.icon}</div>
                        <p className="text-3xl font-black text-slate-900 mb-1"><AnimatedCounter value={s.value} /></p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partnership */}
                <div className="bg-slate-50 rounded-[3rem] p-12 border border-slate-100">
                  <div className="grid lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Our Foundation</span>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter mt-3 mb-6">Strategic Collaboration & Accreditation</h2>
                      <p className="text-slate-600 font-medium leading-relaxed mb-6">
                        Genius operates in formal collaboration with the <strong>Research, Measurement, and Evaluation Unit</strong> of Nasarawa State University, Keffi (NSUK) — one of Nigeria's premier research institutions. This partnership ensures that every workflow, from submission to publication, meets internationally accepted academic standards.
                      </p>
                      <p className="text-slate-500 font-medium leading-relaxed">
                        We are registered under the Corporate Affairs Commission of Nigeria (<strong>CAC No. 3591627</strong>), staffed by a multidisciplinary team of scholars, technologists, and editorial professionals committed to advancing open, rigorous scholarship.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Core Values</h3>
                      {['Academic Excellence', 'Research Integrity', 'Global Inclusivity', 'Technological Innovation', 'Editorial Independence', 'Author Transparency'].map(v => (
                        <div key={v} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <CheckCircle size={14} className="text-[#800000] shrink-0" />
                          <span className="text-sm font-bold text-slate-700">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Two wings */}
                <div>
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">What Genius <span className="text-[#800000]">Offers</span></h2>
                    <p className="text-slate-500 mt-3 font-medium">Two distinct experiences. Both exceptional.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Publication Hub */}
                    <div className="bg-gradient-to-br from-[#800000] to-[#5a0000] text-white rounded-[2.5rem] p-10 shadow-2xl shadow-[#800000]/20">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                        <FileText size={26} />
                      </div>
                      <h3 className="text-2xl font-black mb-4">Publication Hub</h3>
                      <p className="text-white/70 font-medium leading-relaxed mb-8 text-sm">
                        For researchers, academics, and institutional authors who need a credible, internationally indexed channel for their scholarly output.
                      </p>
                      <ul className="space-y-3">
                        {[
                          'Submit manuscripts in PDF or DOCX format',
                          'AI-powered manuscript audit and compliance check',
                          'Automatic DOI registration upon acceptance',
                          'Neural-matched peer reviewer selection',
                          'Real-time submission status tracking',
                          'Global indexing and citation tracking',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-3 text-sm font-medium text-white/80">
                            <CheckCircle2 size={14} className="mt-0.5 text-white/60 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button onClick={onPublicationHub} className="mt-10 w-full py-4 bg-white text-[#800000] font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-2">
                        Access Publication Hub <ArrowRight size={14} />
                      </button>
                    </div>

                    {/* Academic Workspace */}
                    <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-900/20">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                        <GraduationCap size={26} />
                      </div>
                      <h3 className="text-2xl font-black mb-4">Academic Workspace</h3>
                      <p className="text-white/70 font-medium leading-relaxed mb-8 text-sm">
                        For institutions, lecturers, and students who need a complete, AI-powered classroom management and assessment platform.
                      </p>
                      <ul className="space-y-3">
                        {[
                          'AI-generated tests, exams, and assignments from lecture notes',
                          'Automated student scheduling and email notification',
                          'Neural proctoring with real-time violation detection',
                          'Attendance tracking and digital attendance records',
                          'Gradebook, analytics, and performance reports',
                          'Student portal with material access and exam history',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-3 text-sm font-medium text-white/80">
                            <CheckCircle2 size={14} className="mt-0.5 text-white/60 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button onClick={onSchoolPortal} className="mt-10 w-full py-4 bg-white text-indigo-900 font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-2">
                        Enter Academic Workspace <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════ GUIDELINES ═══════════════════════ */}
          {activePage === 'guidelines' && (
            <motion.div key="guidelines" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }}>
              {/* Banner */}
              <div className="bg-slate-900 py-20 px-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_#800000_0%,_transparent_70%)]" />
                <div className="max-w-7xl mx-auto relative z-10">
                  <p className="text-[10px] font-black text-[#ff4d4d] uppercase tracking-[0.4em] mb-4">Complete Reference</p>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-6">How It <span className="text-[#ff4d4d]">Works</span></h1>
                  <p className="text-white/60 font-medium text-lg max-w-2xl leading-relaxed">Step-by-step guides for researchers, lecturers, and students — covering every flow from account creation to final result.</p>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="bg-white border-b border-slate-100 sticky top-16 md:top-20 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="flex gap-1 py-3">
                    {([
                      { id: 'publication', label: 'Publication Hub', icon: <FileText size={14} /> },
                      { id: 'lecturer', label: 'Lecturer Guide', icon: <GraduationCap size={14} /> },
                      { id: 'student', label: 'Student Guide', icon: <BookOpen size={14} /> },
                    ] as { id: GuidelinesTab; label: string; icon: React.ReactNode }[]).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setGuideTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${guideTab === t.id ? 'bg-[#800000] text-white shadow-lg shadow-[#800000]/20' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="max-w-7xl mx-auto px-6 py-16">
                <AnimatePresence mode="wait">

                  {/* ─── Publication Guide ─── */}
                  {guideTab === 'publication' && (
                    <motion.div key="pub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="grid lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-4">
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Publishing Your <span className="text-[#800000]">Research</span></h2>
                          <p className="text-slate-500 font-medium leading-relaxed pb-6">
                            From preparing your manuscript to receiving your DOI — here is every step explained clearly. Follow this guide in sequence for the smoothest submission experience.
                          </p>

                          <Step n={1} icon={<Building2 size={16} />} title="Create Your Author Account"
                            desc="Click 'Publication Hub' on the navigation bar or the hero buttons. You will be taken to the author login page. If you are a new author, click 'Register' and fill in your full name, email address, and institution. An account gives you access to your submission dashboard, status tracking, and correspondence history." />

                          <Step n={2} icon={<CreditCard size={16} />} title="Complete Publication Payment"
                            desc="Genius operates a pre-payment model to ensure only committed submissions enter the review pipeline. After logging in, you will see a 'Pay to Publish' option. Select your payment method (card, bank transfer, or wallet top-up) and complete the one-time publication fee. Once confirmed, a publication credit is immediately activated on your account — this credit is used when you upload your manuscript." />

                          <Step n={3} icon={<FileText size={16} />} title="Prepare Your Manuscript"
                            desc="Before uploading, ensure your document meets these requirements: maximum 15 pages of A4 size using 12pt font; double line spacing throughout; follow the reference style standard for your field (APA, MLA, Chicago, etc.); include all author names, email addresses, and phone numbers on the title page; your document must be in PDF format (Word .DOCX is also accepted — the system converts it automatically). Manuscripts not meeting these standards may be returned without review." />

                          <Step n={4} icon={<Upload size={16} />} title="Upload Your Manuscript"
                            desc="From your dashboard, click 'New Submission'. Drag and drop your PDF or DOCX file, or click to browse. The system immediately reads your document and extracts the title, abstract, authors, and keywords automatically. Review the extracted information for accuracy and make corrections where needed. Then click 'Submit for Review'." />

                          <Step n={5} icon={<Zap size={16} />} title="AI Manuscript Audit (Automatic)"
                            desc="The moment you submit, the Genius Neural Fabric performs a multi-layer integrity audit of your manuscript. This includes: format and structure validation; plagiarism and originality screening; reference completeness check; language clarity and readability scoring. You do not need to do anything during this stage. Results appear in your dashboard within minutes. If an issue is found, you will receive a clear, specific message explaining what to correct — not a generic rejection." />

                          <Step n={6} icon={<Users size={16} />} title="Peer Review Assignment"
                            desc="Once the AI audit passes, the system matches your manuscript to reviewers from the Editorial Board based on subject expertise, availability, and conflict-of-interest checks. Reviewers receive your anonymised manuscript and are given a structured review form. You will see your manuscript status change from 'Audit Passed' to 'Under Review' on your dashboard." />

                          <Step n={7} icon={<Eye size={16} />} title="Review Outcome & Revision"
                            desc="After reviewers submit their evaluations, the editorial team makes one of three decisions: Accept as-is; Accept with minor revisions (you will receive specific reviewer comments and a deadline to resubmit); or Major revision required (more substantial changes needed before re-review). All reviewer feedback is available in your dashboard under the submission record. If revision is required, upload the revised file and a point-by-point response letter through the same dashboard." />

                          <Step n={8} icon={<Globe size={16} />} title="DOI Registration & Publication"
                            desc="Once accepted, your paper is formatted for publication and assigned a permanent Digital Object Identifier (DOI) — a globally recognised link that makes your work citable and discoverable forever. Your paper is then indexed in the journal's online archive, listed in the current issue, and available for citation worldwide. You will receive a publication confirmation email with your DOI link and a downloadable certificate of publication." />

                          {/* Format requirements */}
                          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 mt-4">
                            <div className="flex items-center gap-3 mb-4">
                              <AlertCircle size={18} className="text-amber-600" />
                              <h3 className="font-black text-amber-800 uppercase tracking-widest text-xs">Manuscript Format Checklist</h3>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              {[
                                'Maximum 15 pages, A4 size, 12pt font',
                                'Double line spacing throughout',
                                'Reference style appropriate to your field',
                                'Author names, emails, and phone numbers on title page',
                                'PDF or DOCX format only (no .doc old Word format)',
                                'Abstract of 150–250 words',
                                'Keywords: 5–8 relevant terms below abstract',
                                'All tables and figures embedded in document',
                              ].map(r => (
                                <div key={r} className="flex items-start gap-2">
                                  <CheckCircle2 size={13} className="text-amber-600 mt-0.5 shrink-0" />
                                  <span className="text-xs font-medium text-amber-800">{r}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                          <div className="bg-slate-900 rounded-3xl p-8 text-white sticky top-36">
                            <h3 className="font-black text-lg mb-6">Ready to Submit?</h3>
                            <div className="space-y-4 mb-8">
                              {[
                                'Document formatted correctly',
                                'Payment credit activated',
                                'Author details included',
                                'PDF or DOCX format confirmed',
                                'References in correct style',
                              ].map(c => (
                                <div key={c} className="flex items-center gap-3">
                                  <div className="w-5 h-5 rounded-full border-2 border-white/20 flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-[#ff4d4d]" />
                                  </div>
                                  <span className="text-white/70 text-sm font-medium">{c}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={onPublicationHub} className="w-full py-4 bg-[#800000] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-[#800000]/30">
                              Proceed to Upload
                            </button>
                            <p className="text-white/30 text-[10px] font-medium text-center mt-4">You will be asked to log in or register</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Lecturer Guide ─── */}
                  {guideTab === 'lecturer' && (
                    <motion.div key="lec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="grid lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-4">
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Lecturer's <span className="text-[#800000]">Complete Guide</span></h2>
                          <p className="text-slate-500 font-medium leading-relaxed pb-6">
                            As a lecturer on the Genius Academic Workspace, you control everything — from setting up your institution's workspace to publishing AI-generated exams and viewing results. This guide walks through every step in order.
                          </p>

                          <Step n={1} icon={<Building2 size={16} />} title="Register Your Workspace (Institution Setup)"
                            desc="Click 'School Portal' on the navigation. On the login screen, select 'Register as Lecturer / Institution'. Fill in your name, email, institution name, and create a password. Once submitted, your personal academic workspace is created. This workspace is private to your institution — only you (as admin) and the students you enrol can access it." />

                          <Step n={2} icon={<Users size={16} />} title="Create Student Categories"
                            desc="Before adding students, create categories (also called 'batches' or 'classes') to organise them. Go to the Resource Hub inside your workspace and create a category — for example '200 Level Computer Science' or 'Batch A 2025'. Categories control which students receive which assessments. A student in one category will not receive exams meant for another." />

                          <Step n={3} icon={<Upload size={16} />} title="Upload Your Student Roster"
                            desc="Navigate to Resource Hub → Materials. Click 'Upload' and choose the 'Roster' type. Upload a CSV or Excel file containing your students' full names, matric numbers, and email addresses. The system automatically creates student accounts, sends each student their login credentials by email, and links them to the category you specify. You can also add students manually one by one if preferred." />

                          <Step n={4} icon={<FileText size={16} />} title="Upload Lecture Materials"
                            desc="Go to Resource Hub → Materials and click Upload → Material. Upload your lecture notes, slides, or documents in PDF, DOCX, or PPTX format. The system extracts all the text from each document. Immediately after upload, an AI fitness check runs in the background — it tests whether the material has enough academic content for question generation. If a material passes, it is marked 'Fit' and selectable for assessments. If it is too short or too shallow, it appears greyed out in the selector with a specific reason why. Upload detailed, comprehensive notes for best results." />

                          <Step n={5} icon={<Zap size={16} />} title="Create a Test or Examination"
                            desc="Navigate to the Tests or Exams section. Fill in: Title (e.g. 'MTH301 Mid-Semester Exam'); Target Category (which class sits this exam); Number of Questions (5–100 for exams, 5–50 for tests); Timer Mode — either a single countdown for the whole exam or a per-question timer; Schedule Window — set when the exam opens ('Starts in: 2 hours') and how long the window stays open ('Ends after: 3 hours'); Instructions for students (included in their email); Difficulty level and Bloom's Taxonomy focus for the AI; Maximum attempts per student (always 1 for official exams); Pool Mode (optional anti-cheating: AI generates a larger bank, each student draws a random subset). Finally, click the material link area and select the lecture materials the AI should read to generate questions." />

                          <Step n={6} icon={<Bell size={16} />} title="Publish — AI Generates & Students Are Notified"
                            desc="Click 'Create Examination & Schedule'. The system immediately: reads all your linked lecture materials; uses GPT-4 to generate the exact number of questions you requested, at the difficulty and taxonomy level you selected; validates every question (ensures 4 options, a correct answer, no duplicates); automatically assigns each student in the category their own personal time slot within your schedule window; sends every student an email with the exam title, their exact start time, end time, and your custom instructions. You will see a success confirmation once all this is complete." />

                          <Step n={7} icon={<Lock size={16} />} title="During the Exam (What Happens)"
                            desc="Students access the exam only within their assigned time slot. The system enforces strict timing — students cannot enter before their slot starts or after it ends. Each student receives a uniquely shuffled version of the questions (and if Pool Mode is on, a different subset of questions). The Neural Proctoring system monitors for tab switches, copy-paste attempts, developer tools usage, and other suspicious behaviour in real time. Any violation triggers a warning or, if critical, an automatic submission." />

                          <Step n={8} icon={<BarChart2 size={16} />} title="View Results and Analytics"
                            desc="After students submit, their scores appear instantly in your dashboard under the exam record. Click 'Results' to see each student's score, the questions they answered, what they got right and wrong, and their time taken. You can download a full class report as PDF. For assignments, you review written responses and file uploads directly in the portal, and enter a grade manually. The student's performance history builds up automatically over time, giving you a longitudinal view of each student's progress across all assessments." />

                          <Step n={9} icon={<ClipboardList size={16} />} title="Creating Assignments"
                            desc="Assignments work differently from tests and exams — there are no AI-generated MCQs and no per-question timer. Navigate to the Assignments section. Set the title, write out the full task description or question in the Instructions field, choose the target category, set a submission deadline, decide whether students submit a file upload, a typed text response, or both, and toggle whether late submissions are allowed. Optionally link lecture materials if you want the AI to help draft the assignment brief from your notes. Students receive a notification email and can submit any time before the deadline from their portal." />

                          {/* Key notes */}
                          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 mt-4">
                            <div className="flex items-center gap-3 mb-5">
                              <AlertCircle size={18} className="text-indigo-600" />
                              <h3 className="font-black text-indigo-800 uppercase tracking-widest text-xs">Important Things to Know</h3>
                            </div>
                            <div className="space-y-3">
                              {[
                                { t: 'Deadline is hard', d: 'Once the exam\'s end date passes, no student can enter — not even by one minute. Set the window generously for your class size.' },
                                { t: 'Material quality matters', d: 'The AI generates questions strictly from what is in your linked documents. Thin or bullet-point-only notes produce weak questions. Upload full lecture notes.' },
                                { t: 'Pool mode is your anti-cheating shield', d: 'With pool mode on, two students sitting side-by-side get different questions in different orders. Always enable it for high-stakes exams.' },
                                { t: 'Category must be correct', d: 'If you leave Target Category on "All", every student in your workspace gets scheduled and notified, regardless of their class.' },
                                { t: 'Max attempts should be 1 for official exams', d: 'Students who finish and see their score will know their weak areas and improve if given a second attempt. Keep it at 1 for anything that counts.' },
                              ].map(n => (
                                <div key={n.t} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-indigo-50 shadow-sm">
                                  <CheckCircle size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                                  <div><span className="font-black text-indigo-900 text-xs">{n.t}: </span><span className="text-indigo-700 text-xs font-medium">{n.d}</span></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                          <div className="bg-indigo-900 rounded-3xl p-8 text-white sticky top-36">
                            <h3 className="font-black text-lg mb-2">Quick Setup Checklist</h3>
                            <p className="text-white/50 text-xs font-medium mb-6">Complete in this order for a smooth start</p>
                            <div className="space-y-3">
                              {[
                                'Register your workspace',
                                'Create student categories',
                                'Upload student roster CSV',
                                'Upload lecture materials',
                                'Create your first test or exam',
                                'Review AI-generated questions',
                                'Publish and notify students',
                                'Monitor results after exam',
                              ].map((s, i) => (
                                <div key={s} className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 text-white font-black text-[10px] flex items-center justify-center shrink-0">{i + 1}</div>
                                  <span className="text-white/70 text-sm font-medium">{s}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={onSchoolPortal} className="mt-8 w-full py-4 bg-white text-indigo-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                              Enter Academic Workspace
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── Student Guide ─── */}
                  {guideTab === 'student' && (
                    <motion.div key="stu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="grid lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-4">
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Student's <span className="text-[#800000]">Complete Guide</span></h2>
                          <p className="text-slate-500 font-medium leading-relaxed pb-6">
                            As a student on the Genius Academic Workspace, you do not create an account yourself — your lecturer enrols you. Everything is built around your enrollment email. Here is exactly what to expect and how to navigate every step.
                          </p>

                          <Step n={1} icon={<Mail size={16} />} title="You Receive an Enrollment Email"
                            desc="When your lecturer uploads your student roster, the system automatically creates your account and sends you an onboarding email. This email contains your login link, your student ID (matric number), and a temporary PIN to access the Student Portal for the first time. Check your inbox and spam folder. If you do not receive it within 24 hours of your lecturer saying they uploaded the roster, contact your lecturer to resend your invitation." />

                          <Step n={2} icon={<Lock size={16} />} title="Log In to the Student Portal"
                            desc="Click 'School Portal' on the navigation. On the login screen, select 'Student Login'. Enter your matric number (or the student ID in your enrollment email) and your PIN. If this is your first login, you may be prompted to set a new PIN for security. Your dashboard loads after login — this is your personal academic hub, unique to your institution." />

                          <Step n={3} icon={<BarChart2 size={16} />} title="Understand Your Dashboard"
                            desc="Your student dashboard shows: all assessments (tests, exams, and assignments) that have been scheduled for you; your upcoming exam slots with exact dates and times; your score history for past assessments; lecture materials your lecturer has made available for study; your attendance records; and any announcements from your lecturer. Everything related to your academic life in this institution appears here." />

                          <Step n={4} icon={<Bell size={16} />} title="Receiving Assessment Notifications"
                            desc="When your lecturer creates and publishes an exam or test, you automatically receive a notification email. This email tells you: the title of the exam or test; your exact personal start time and end time; the duration (how long the timer runs once you start); any special instructions from your lecturer; and a reminder to ensure your internet connection is stable before your slot begins. Save this email — it contains everything you need for the day of the exam." />

                          <Step n={5} icon={<Clock size={16} />} title="Timing — What You Must Know"
                            desc="Your time slot is assigned and enforced by the system. You cannot enter the exam before your start time — you will see a countdown showing when your slot opens. You cannot enter after your end time — the system closes access at the exact moment your slot ends and marks you as 'missed'. The exam timer inside (e.g. 90 minutes) counts down independently — it begins the moment you enter and stops when it runs out or you submit, whichever comes first. Log in a few minutes before your start time to make sure your device is ready." />

                          <Step n={6} icon={<Eye size={16} />} title="Taking Your Exam"
                            desc="When your slot opens, a 'Start Exam' button appears on your dashboard. Click it to enter. The exam goes full-screen — this is required by the proctoring system. Do not exit full-screen during the exam. Your questions are displayed one at a time (or all at once, depending on your lecturer's setting). Select your answer for each question and use the navigation buttons to move between questions. Your answers are saved automatically as you go — you do not need to manually save. When you are done, click 'Submit'. A confirmation screen appears showing your score immediately after submission." />

                          <Step n={7} icon={<Shield size={16} />} title="Proctoring — What Is Being Monitored"
                            desc="The system monitors your exam session in real time for academic integrity. It detects: switching to another browser tab or application; attempting to copy text from the questions; using browser developer tools; extended periods of inactivity; and unusual mouse or keyboard patterns. Each detected violation adds to a risk score. Minor violations trigger a visible warning. If your risk score crosses a critical threshold, the system automatically submits your exam and flags your session for your lecturer's review. The best approach is simply to stay on the exam screen and complete your answers." />

                          <Step n={8} icon={<FileText size={16} />} title="Assignments — How They Work"
                            desc="Assignments are different from exams. There is no timer, no proctoring, and no MCQ format. When your lecturer creates an assignment, you receive a notification email with the task description and the submission deadline. Log in to your dashboard, find the assignment, read the instructions carefully, write your response in the text box or upload your file (Word document, PDF, or image depending on what your lecturer allows), and click Submit before the deadline. If your lecturer allows late submissions, you can still submit after the deadline — but it will be marked as late. Once submitted, your lecturer reviews your work and enters your grade manually." />

                          <Step n={9} icon={<BarChart2 size={16} />} title="Viewing Your Results and Progress"
                            desc="After every exam or test, your score appears immediately on your dashboard. You can click into each result to see: your total score and percentage; which questions you got right and which you got wrong; the correct answers for every question; and your time taken. For assignments, your grade and any feedback from your lecturer appear once graded. Your full academic performance — across all assessments throughout the academic year — is tracked in your profile and available at any time." />

                          <Step n={10} icon={<BookOpen size={16} />} title="Accessing Study Materials"
                            desc="Your lecturer can make lecture notes, slides, and other documents available through the platform. Find them under 'Materials' on your student dashboard. You can preview materials directly in the browser or download them to your device. Some materials may require a payment if your lecturer has enabled paid access for a course. Your dashboard clearly shows which materials are free and which are paid, and you can complete payment directly in the portal without leaving the page." />

                          {/* What to do if things go wrong */}
                          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 mt-4">
                            <div className="flex items-center gap-3 mb-5">
                              <AlertCircle size={18} className="text-rose-600" />
                              <h3 className="font-black text-rose-800 uppercase tracking-widest text-xs">If Something Goes Wrong</h3>
                            </div>
                            <div className="space-y-3">
                              {[
                                { t: 'Did not receive enrollment email', d: 'Contact your lecturer and ask them to resend your invitation from the system. Check your spam folder first.' },
                                { t: 'Forgot your PIN', d: 'On the login screen, click "Forgot PIN" and enter your matric number. A reset link is sent to your registered email.' },
                                { t: 'Exam closed before you could enter', d: 'This means your time slot has passed. Contact your lecturer immediately — only your lecturer can dispute or reassign your slot.' },
                                { t: 'Exam auto-submitted unexpectedly', d: 'This is usually triggered by proctoring violations (tab switch, etc.). Your answers up to that point are saved. Contact your lecturer if you believe it was a technical error.' },
                                { t: 'Cannot access a material', d: 'If it is a paid material, complete payment through your dashboard. If it is free and you still cannot open it, refresh the page or try a different browser.' },
                              ].map(n => (
                                <div key={n.t} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-rose-50 shadow-sm">
                                  <ChevronRight size={14} className="text-rose-500 mt-0.5 shrink-0" />
                                  <div><span className="font-black text-rose-900 text-xs">{n.t}: </span><span className="text-rose-700 text-xs font-medium">{n.d}</span></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                          <div className="bg-slate-900 rounded-3xl p-8 text-white sticky top-36">
                            <h3 className="font-black text-lg mb-2">Student Quick Reference</h3>
                            <p className="text-white/50 text-xs font-medium mb-6">The most important things to remember</p>
                            <div className="space-y-4">
                              {[
                                { icon: <Clock size={14} />, t: 'Enter early', d: 'Log in a few minutes before your exam slot opens.' },
                                { icon: <Shield size={14} />, t: 'Stay full-screen', d: 'Do not switch tabs or apps during the exam.' },
                                { icon: <CheckCircle size={14} />, t: 'Answers auto-save', d: 'You do not need to manually save your answers.' },
                                { icon: <Bell size={14} />, t: 'Check your email', d: 'All exam schedules and notifications come by email.' },
                                { icon: <FileText size={14} />, t: 'Assignment deadline is firm', d: 'Submit before the deadline. Late submissions may not be accepted.' },
                              ].map(r => (
                                <div key={r.t} className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                                  <span className="text-[#ff4d4d] mt-0.5 shrink-0">{r.icon}</span>
                                  <div>
                                    <p className="text-white font-black text-xs">{r.t}</p>
                                    <p className="text-white/50 text-[11px] font-medium mt-0.5">{r.d}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button onClick={onSchoolPortal} className="mt-8 w-full py-4 bg-[#800000] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                              Go to Student Portal
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════ EDITORIAL ═══════════════════════ */}
          {activePage === 'editorial' && (
            <motion.div key="editorial" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }}>
              <div className="bg-slate-900 py-20 px-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_bottom_left,_#800000_0%,_transparent_70%)]" />
                <div className="max-w-7xl mx-auto relative z-10">
                  <p className="text-[10px] font-black text-[#ff4d4d] uppercase tracking-[0.4em] mb-4">Academic Oversight Committee</p>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-6">Editorial <span className="text-[#ff4d4d]">Board</span></h1>
                  <p className="text-white/60 font-medium text-lg max-w-2xl leading-relaxed">Our editorial board is composed of distinguished scholars from institutions across three continents, ensuring rigorous, globally relevant peer review across all disciplines.</p>
                </div>
              </div>

              <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
                {/* Process */}
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { title: 'Submission', desc: 'Author submits manuscript. AI audit runs immediately for format, originality, and structure compliance.', icon: <Upload size={20} /> },
                    { title: 'Editorial Review', desc: 'Chief Editor assigns manuscript to two or more board members whose expertise matches the subject area.', icon: <Eye size={20} /> },
                    { title: 'Decision & Publication', desc: 'Board consensus determines acceptance. Accepted papers receive DOI and are published in the current issue.', icon: <CheckCircle2 size={20} /> },
                  ].map(p => (
                    <div key={p.title} className="p-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="w-12 h-12 bg-[#800000]/10 rounded-2xl flex items-center justify-center text-[#800000] mb-6">{p.icon}</div>
                      <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide mb-3">{p.title}</h3>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Editorial ethics */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-6">Editorial <span className="text-[#800000]">Ethics & Independence</span></h2>
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-500 font-medium leading-relaxed">
                    <p>All submissions are reviewed under a double-blind peer review process — neither the author nor the reviewer knows the identity of the other during the review stage. This eliminates bias and ensures that manuscripts are evaluated purely on the merit of their academic content.</p>
                    <p>Board members declare any conflict of interest before being assigned manuscripts. A member from the same institution as an author, or with prior published collaboration with the author, will not review that manuscript. Editorial decisions are made by consensus of at least two independent reviewers plus the Chief Editor.</p>
                  </div>
                </div>

                {/* Board table */}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-8">Board <span className="text-[#800000]">Members</span></h2>
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">S/N</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Full Name</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Institution</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Department</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Country</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { sn: 1, name: 'Prof. Yahaya A. Adadu', school: 'Nasarawa State University, Keffi', dept: 'Social Sciences', country: 'Nigeria' },
                            { sn: 2, name: 'Prof. Francis A. Akawu', school: 'Nasarawa State University, Keffi', dept: 'Economics', country: 'Nigeria' },
                            { sn: 3, name: 'Prof. IJ Kukwi', school: 'Nasarawa State University, Keffi', dept: 'Education', country: 'Nigeria' },
                            { sn: 4, name: 'Dr.  A Dauda', school: 'Nasarawa State University, Keffi', dept: 'Education', country: 'Nigeria' },
                            { sn: 5, name: 'Prof. H. M Mainoma', school: 'Nasarawa State University, Keffi', dept: 'Accounting', country: 'Nigeria' },
                            { sn: 6, name: 'Dr. Danjuma Namo', school: 'Nasarawa State University, Keffi', dept: 'Education', country: 'Nigeria' },
                            { sn: 7, name: 'Johan Adersson', school: 'University of Freiburg', dept: 'Banking and Finance', country: 'Dutch/Switzerland' },
                            { sn: 8, name: 'Maximilian Weber', school: 'University of Serbia', dept: 'Physics', country: 'Germany' },
                            { sn: 9, name: 'Leonardo Ferrari', school: 'Amity University UEA', dept: 'Accounting', country: 'Italy' },
                            { sn: 10, name: 'Charlotte Dupont', school: 'University of Serbia', dept: 'Mathematics', country: 'United Kingdom' },
                            { sn: 11, name: 'Dr. David M. Shekwolo', school: 'Nigerian Defence Academy', dept: 'Psychology', country: 'Kaduna, Nigeria' },
                            { sn: 12, name: 'Assoc. Prof. Abubakar M. Tafida', school: 'Nasarawa State University, Keffi', dept: 'Psychology', country: 'Nasarawa, Nigeria' },
                            { sn: 13, name: 'Dr. M.M Usman', school: 'Nasarawa State University', dept: 'Accounting', country: 'Nigeria' },
                          ].map(m => (
                            <tr key={m.sn} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-8 py-5 text-sm font-black text-[#800000]">{m.sn}</td>
                              <td className="px-8 py-5"><span className="text-sm font-black text-slate-900 group-hover:text-[#800000] transition-colors">{m.name}</span></td>
                              <td className="px-8 py-5 text-sm font-bold text-slate-500">{m.school}</td>
                              <td className="px-8 py-5 text-sm font-medium text-slate-400 italic">{m.dept}</td>
                              <td className="px-8 py-5">
                                <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:bg-[#800000]/10 group-hover:text-[#800000] transition-all border border-slate-200">{m.country}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════ CONTACT ═══════════════════════ */}
          {activePage === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }}>
              <div className="bg-slate-900 py-20 px-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_#800000_0%,_transparent_70%)]" />
                <div className="max-w-7xl mx-auto relative z-10">
                  <p className="text-[10px] font-black text-[#ff4d4d] uppercase tracking-[0.4em] mb-4">Get In Touch</p>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-6">Contact <span className="text-[#ff4d4d]">Us</span></h1>
                  <p className="text-white/60 font-medium text-lg max-w-2xl leading-relaxed">Questions about your submission, technical support, editorial inquiries, or institutional partnerships — we respond to all correspondence.</p>
                </div>
              </div>

              <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid lg:grid-cols-2 gap-16">

                  {/* Contact Info */}
                  <div className="space-y-10">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-8">Direct <span className="text-[#800000]">Contacts</span></h2>
                      <div className="space-y-4">
                        {[
                          { icon: <Phone size={20} />, label: 'Phone / WhatsApp', value: '+234 816 406 4212', note: 'Available Monday–Friday, 8am–6pm WAT' },
                          { icon: <Mail size={20} />, label: 'Email', value: 'geniusmultidisciplinary@gmail.com', note: 'We aim to respond within 24 hours on working days' },
                          { icon: <MapPin size={20} />, label: 'Collaborating Institution', value: 'Nasarawa State University, Keffi', note: 'Research, Measurement & Evaluation Unit, NSUK' },
                        ].map(c => (
                          <div key={c.label} className="flex items-start gap-5 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-[#800000]/20 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-[#800000]/5 rounded-2xl flex items-center justify-center text-[#800000] shrink-0 group-hover:bg-[#800000] group-hover:text-white transition-all">{c.icon}</div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
                              <p className="font-black text-slate-900 text-base mb-1">{c.value}</p>
                              <p className="text-sm text-slate-400 font-medium">{c.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* When to contact */}
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                      <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">What We Can Help With</h3>
                      <div className="space-y-3">
                        {[
                          { t: 'Submission enquiries', d: 'Status of your manuscript, why a submission was returned, revision guidance.' },
                          { t: 'Payment issues', d: 'Confirming a payment, resolving a failed transaction, or requesting a receipt.' },
                          { t: 'Technical problems', d: 'Cannot log in, upload failing, exam access issues, PDF not reading correctly.' },
                          { t: 'Academic Workspace setup', d: 'Institution onboarding, student roster bulk issues, category setup guidance.' },
                          { t: 'Editorial and peer review', d: 'Reviewer invitations, conflict of interest declarations, editorial timeline.' },
                          { t: 'Institutional partnerships', d: 'Licensing the platform for a school, department, or research centre.' },
                        ].map(i => (
                          <div key={i.t} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <ChevronRight size={14} className="text-[#800000] mt-0.5 shrink-0" />
                            <div>
                              <span className="font-black text-slate-900 text-xs">{i.t}: </span>
                              <span className="text-slate-500 text-xs font-medium">{i.d}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* FAQ */}
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-8">Frequently Asked <span className="text-[#800000]">Questions</span></h2>
                    <div className="space-y-4">
                      {[
                        { q: 'How long does the peer review process take?', a: 'Most manuscripts complete the full review cycle within 4–6 weeks. The AI audit stage completes within minutes of submission. Reviewer assignment follows within 2 business days of a successful audit.' },
                        { q: 'Can I submit a manuscript that is already published elsewhere?', a: 'No. Genius only accepts original, previously unpublished work. Submitting a manuscript under concurrent review at another journal is also a violation of our editorial policy and will result in rejection and possible blacklisting.' },
                        { q: 'What happens to my publication credit if my paper is rejected?', a: 'If your manuscript is rejected after review (not returned for format issues), your publication credit remains active on your account and can be used for a new submission.' },
                        { q: 'As a lecturer, can students access the platform without an email address?', a: 'No. Each student requires a valid email address to receive their enrollment invitation and exam notifications. Ensure your student roster CSV includes a working email for each student.' },
                        { q: 'What browsers work best for taking exams?', a: 'Google Chrome or Microsoft Edge (latest versions) are recommended. The proctoring system requires full-screen mode which is best supported on desktop browsers. Taking exams on a mobile phone is not recommended.' },
                        { q: 'Can a lecturer reset a student\'s missed exam slot?', a: 'Yes. A lecturer can re-publish the assessment or contact support to have a specific student slot reset. Students cannot reset their own slots.' },
                        { q: 'Is my data secure on Genius?', a: 'Yes. All data is encrypted in transit (HTTPS) and at rest. Student exam responses and publication manuscripts are stored in isolated, access-controlled database records. We do not sell or share any user data with third parties.' },
                      ].map((faq, i) => (
                        <details key={i} className="group bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                          <summary className="flex items-center justify-between p-6 cursor-pointer font-black text-slate-900 text-sm list-none">
                            {faq.q}
                            <ChevronRight size={16} className="text-slate-400 group-open:rotate-90 transition-transform shrink-0 ml-4" />
                          </summary>
                          <div className="px-6 pb-6 text-slate-500 text-sm font-medium leading-relaxed border-t border-slate-50 pt-4">
                            {faq.a}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer bar */}
              <div className="bg-slate-900 py-10 px-6 mt-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">&copy; 2026 GMIJ Publication. All rights reserved. CAC No. 3591627</p>
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Shield size={14} className="text-green-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Neural Verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <CheckCircle2 size={14} className="text-[#ff4d4d]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">ISO Certified</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Mobile nav (bottom bar) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-slate-100 shadow-2xl shadow-slate-900/10">
        <div className="flex">
          <button onClick={() => setActivePage('home')} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${activePage === 'home' ? 'text-[#800000]' : 'text-slate-400'}`}>
            <Home size={18} />Home
          </button>
          {navItems.map(item => (
            <button key={item.page} onClick={() => setActivePage(item.page)} className={`flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${activePage === item.page ? 'text-[#800000]' : 'text-slate-400'}`}>
              {item.page === 'about' && <><Users size={18} />{item.label}</>}
              {item.page === 'guidelines' && <><BookOpen size={18} />{item.label}</>}
              {item.page === 'editorial' && <><Layers size={18} />{item.label}</>}
              {item.page === 'contact' && <><Mail size={18} />{item.label}</>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
