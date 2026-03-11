import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  ArrowRight, 
  BookOpen, 
  Shield, 
  Globe, 
  Users, 
  CheckCircle2, 
  FileText, 
  Mail, 
  MapPin, 
  Phone,
  LayoutDashboard,
  LogIn
} from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#800000] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 h-20">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#800000]/20">
              <BookOpen className="text-white" size={24} />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tighter">GMIJ PUBLICATION</span>
              <p className="text-[10px] font-bold text-[#800000] uppercase tracking-[0.2em] -mt-1">Research Excellence</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-10">
            {['Home', 'About', 'Guideline', 'Publish', 'Editorial Board', 'Contact Us'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-sm font-bold text-slate-600 hover:text-[#800000] transition-colors uppercase tracking-widest px-2">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onStart} 
              className="hidden sm:flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-700 hover:text-[#800000] transition-colors"
            >
              <LogIn size={18} />
              SIGN IN
            </button>
            <button 
              onClick={onStart}
              className="px-6 py-2.5 premium-gradient text-white text-sm font-black rounded-xl shadow-xl shadow-[#800000]/20 hover:scale-105 transition-transform uppercase tracking-wider"
            >
              GENIUS MINDSPARK
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
            <img 
                src="/Banner/NSUK.jpg" 
                alt="University Background" 
                className="w-full h-full object-cover opacity-10"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-slate-50"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#800000]/5 border border-[#800000]/10 rounded-full mb-8"
            >
              <div className="w-2 h-2 rounded-full bg-[#800000] animate-pulse"></div>
              <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.2em]">Open Access Journal Registry</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-8 font-display"
            >
              WELCOME TO <br />
              <span className="text-gradient">GMIJP PORTAL</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-600 leading-relaxed mb-12 max-w-2xl font-medium"
            >
              Genius Multidisciplinary International Journal Publication (GMIJP) is a premier platform for global researchers to share groundbreaking discoveries with neural-assisted validation.
            </motion.p>

            {/* Search Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 max-w-2xl bg-white p-2 rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-100"
            >
              <div className="flex-1 flex items-center px-6">
                <Search className="text-slate-400" size={24} />
                <input 
                  type="text" 
                  placeholder="Search for journal, DOI, or researcher..." 
                  className="w-full h-14 bg-transparent outline-none border-none text-lg ml-3 font-medium placeholder:text-slate-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="hidden sm:flex h-14 px-10 items-center justify-center premium-gradient text-white font-black rounded-full shadow-lg shadow-[#800000]/30 hover:scale-105 transition-transform">
                SEARCH
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#800000]/20 rounded-full blur-3xl -ml-32 -mt-32"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            {[
              { label: 'Published Papers', value: '2.5k+' },
              { label: 'Global Citations', value: '850k+' },
              { label: 'Expert Reviewers', value: '450+' },
              { label: 'Impact Factor', value: '8.42' }
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-black mb-2">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="guideline" className="py-32 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Why Publish with GMIJP?</h2>
            <div className="w-20 h-1.5 premium-gradient mx-auto rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { 
                icon: Globe, 
                title: 'International Reach', 
                desc: 'Indexed by major research databases and accessible in over 120 countries.' 
              },
              { 
                icon: Shield, 
                title: 'Integrity First', 
                desc: 'Every manuscript undergoes rigorous neural-based plagiarism and integrity checks.' 
              },
              { 
                icon: FileText, 
                title: 'Fast-Track Peer Review', 
                desc: 'Initial decisions within 14 days thanks to our simulator-assisted review process.' 
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-slate-100 hover:-translate-y-2 transition-transform">
                <div className="w-14 h-14 bg-[#800000]/5 rounded-2xl flex items-center justify-center mb-8">
                  <feature.icon className="text-[#800000]" size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-4">{feature.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact-us" className="bg-white border-t border-slate-100 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-16 mb-16">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center">
                  <BookOpen className="text-white" size={24} />
                </div>
                <span className="text-2xl font-black text-slate-900 tracking-tighter">GMIJ PUBLICATION</span>
              </div>
              <p className="text-slate-500 font-medium leading-relaxed max-w-md mb-8">
                The global benchmark for multidisciplinary research excellence. We empower authors with state-of-the-art tools for validation and dissemination.
              </p>
              <div className="flex gap-4">
                {['Twitter', 'LinkedIn', 'YouTube'].map(s => (
                  <div key={s} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#800000] hover:bg-[#800000]/5 cursor-pointer transition-colors">
                    <span className="text-[10px] font-black uppercase tracking-tighter">{s[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8">Quick Links</h4>
              <ul className="space-y-4">
                {['Author Guidelines', 'Call for Papers', 'Review Process', 'Privacy Policy'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8">Support & Ethics</h4>
              <ul className="space-y-4">
                {['Editorial Ethics', 'Sponsorship', 'Archive Policy', 'Terms of Service'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:row items-center justify-between gap-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              &copy; 2026 GMIJ Publication. All rights reserved.
            </p>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 text-slate-500">
                <Shield size={14} className="text-green-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Neural Verified</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 size={14} className="text-[#800000]" />
                <span className="text-[10px] font-bold uppercase tracking-widest">ISO 27001 Certified</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
