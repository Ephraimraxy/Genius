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
      <nav className="fixed top-0 w-full z-50 glass-morph hover:bg-white/50 transition-colors border-b border-white/10 h-16">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-lg shadow-[#800000]/20 group-hover:rotate-12 transition-transform">
              <BookOpen className="text-white" size={18} />
            </div>
            <div>
              <span className="text-lg font-black text-slate-900 tracking-tighter">GMIJ</span>
              <span className="text-[10px] font-bold text-[#800000] ml-2 uppercase tracking-widest hidden sm:inline">Registry</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {['About', 'Guidelines', 'Editorial', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black text-slate-500 hover:text-[#800000] transition-colors uppercase tracking-[0.2em]">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={onStart} 
              className="px-5 py-2 text-[10px] font-black text-slate-900 hover:bg-slate-100 rounded-lg transition-colors uppercase tracking-widest"
            >
              Sign In
            </button>
            <button 
              onClick={onStart}
              className="px-6 py-2 premium-gradient text-white text-[10px] font-black rounded-lg shadow-xl shadow-[#800000]/20 hover:shadow-[#800000]/40 transition-all uppercase tracking-[0.15em]"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[#800000]/5 z-10"></div>
          <img 
            src="/Banner/NSUK.jpg" 
            alt="University Background" 
            className="w-full h-full object-cover grayscale opacity-20 blur-[2px]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/40 to-white z-20"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-30 w-full mb-20">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "circOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#800000]/10 border border-[#800000]/20 rounded-full mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#800000] animate-pulse"></div>
                <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.2em]">Neural Research Engine V2.4</span>
              </div>

              <h1 className="text-7xl lg:text-8xl font-black text-slate-900 leading-[0.95] tracking-tighter mb-8 font-display">
                GENIUS <br />
                <span className="text-gradient">MINDSPARK</span>
              </h1>

              <p className="text-xl text-slate-600 leading-relaxed mb-12 max-w-xl font-medium">
                The global benchmark for multidisciplinary research. Experience neural-assisted validation, instant DOI registration, and global dissemination.
              </p>

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={onStart}
                  className="px-10 py-5 premium-gradient text-white font-black rounded-2xl shadow-2xl shadow-[#800000]/20 hover:shadow-[#800000]/40 transition-all uppercase tracking-widest text-sm flex items-center gap-3 group"
                >
                  Publish Manuscript
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-10 py-5 bg-white border border-slate-200 text-slate-900 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-sm">
                  View Journals
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="hidden lg:block relative"
            >
              <div className="glass-morph p-12 rounded-[3.5rem] border-white/20 relative z-10 overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-[#800000] rounded-2xl text-white shadow-xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">Authenticated Entry</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Research Identity Verification</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-white/50 border border-white/40 rounded-2xl animate-pulse"></div>
                  ))}
                </div>

                <div className="mt-10 p-6 bg-slate-900 rounded-3xl text-center">
                  <p className="text-white font-black text-lg mb-2">Ready to contribute?</p>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Connect your workstation</p>
                </div>
              </div>

              {/* Decorative blobs */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#800000]/10 rounded-full blur-[100px] z-0"></div>
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] z-0"></div>
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
