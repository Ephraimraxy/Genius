import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  ArrowRight, 
  Shield, 
  Globe, 
  Users, 
  CheckCircle2, 
  FileText, 
  Mail, 
  MapPin, 
  Phone,
  ShieldCheck,
  Video,
  Play,
  XCircle,
  PlusCircle,
  Gem
} from 'lucide-react';

interface LandingProps {
  onPublicationHub: () => void;
  onSchoolPortal: () => void;
}

export default function Landing({ onPublicationHub, onSchoolPortal }: LandingProps) {

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#800000] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 h-16 md:h-20 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 drop-shadow-sm border border-slate-100 overflow-hidden bg-white p-1.5">
              <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Genius</span>
              <span className="text-[8px] md:text-[10px] font-bold text-[#800000] tracking-[0.3em] uppercase mt-0.5 md:mt-1">Research Portal</span>
            </div>
          </div>

          {/* Centered Desktop Nav */}
          <div className="hidden lg:flex items-center gap-4">
            {['About', 'Guidelines', 'Editorial', 'Contact'].map((item, i) => (
              <React.Fragment key={item}>
                <a href={`#${item.toLowerCase()}`} className="text-[11px] font-black text-slate-500 hover:text-[#800000] transition-colors uppercase tracking-[0.2em]">
                  {item}
                </a>
                {i < 3 && <span className="text-[#800000] font-black">•</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6">
            <button 
              onClick={onSchoolPortal} 
              className="px-6 py-3 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-xl transition-all uppercase tracking-widest hidden sm:flex items-center gap-2 shadow-sm"
            >
              <Users size={16} />
              School Portal
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <button 
              onClick={onPublicationHub} 
              className="px-6 py-3 bg-[#800000] text-white text-[11px] font-black rounded-xl shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all uppercase tracking-widest flex items-center gap-2"
            >
              <PlusCircle size={16} />
              Publication Hub
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden bg-slate-900">
        <div className="absolute inset-0 z-0">
          <img 
            src="/Banner/NSUK.jpg" 
            alt="University Background" 
            className="w-full h-full object-cover opacity-40 transition-opacity duration-1000 ease-in-out"
          />
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900 z-20" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-30 w-full">
           <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 backdrop-blur-md">
                   <div className="w-2 h-2 rounded-full bg-[#ff4d4d] animate-pulse"></div>
                   <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em]">Neural Verified Research Environment</span>
                </div>

                <h1 className="text-4xl md:text-8xl font-black text-white leading-[0.95] tracking-tighter mb-8 font-display">
                  GENIUS <span className="premium-text-gradient italic">MINDSPARK</span> <br/>
                  <span className="text-white/40 font-sans">MULTIDISCIPLINARY</span>
                </h1>

                <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-12 max-w-2xl font-medium">
                  The global benchmark for multidisciplinary research excellence. Transform your ideas with <span className="text-white border-b border-[#ff4d4d]">neural-assisted validation</span>, instant DOI registration, and global dissemination.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
                  <button 
                    onClick={onPublicationHub}
                    className="group relative px-10 py-5 bg-[#800000] text-white font-black rounded-2xl shadow-2xl shadow-[#800000]/40 transition-all hover:scale-[1.05] active:scale-95 uppercase tracking-[0.2em] text-[11px] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <span className="relative flex items-center justify-center gap-3">
                       <PlusCircle size={18} />
                       Publication Hub
                    </span>
                  </button>

                  <button 
                    onClick={onSchoolPortal}
                    className="px-10 py-5 bg-white text-slate-900 font-black rounded-2xl shadow-2xl hover:bg-slate-50 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3"
                  >
                    <Users size={18} />
                    Academic Workspace
                  </button>
                </div>
              </motion.div>
           </div>
        </div>

        {/* Floating AI Features Badge */}
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
      </section>      {/* Refined AI Feature Showcase - Minimalist & Elegant */}
      <section className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row gap-20">
              {/* Publication Focus */}
              <div className="flex-1 space-y-8">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.4em]">Neural Publication Hub</span>
                    <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                       The Future of <br/>Academic Publishing
                    </h3>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">
                       A seamless, AI-integrated workflow for researchers and journals.
                    </p>
                 </div>

                 <div className="space-y-6 pt-4">
                    {[
                      { t: 'Automated DOI Registry', d: 'Instant global indexing and persistent identification.' },
                      { t: 'AI Manuscript Audit', d: 'Automated integrity and compliance verification.' },
                      { t: 'Neural Peer Selection', d: 'Intelligent matching with specialized reviewers.' }
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

              {/* Workspace Focus */}
              <div className="flex-1 space-y-8 md:pl-10">
                 <div className="space-y-4">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Academic Workspace</span>
                    <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                       Intelligent Classroom <br/>Management
                    </h3>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">
                       Empowering educators with real-time AI assistance.
                    </p>
                 </div>

                 <div className="space-y-6 pt-4">
                    {[
                      { t: 'AI Question Engine', d: 'Generate professional assessments from any material.' },
                      { t: 'Neural Proctoring', d: 'Maintain integrity with intelligent surveillance.' },
                      { t: 'Deep Analytics', d: 'Predictive insights into student learning curves.' }
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
      {/* AboutUs Section */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#800000]/5 border border-[#800000]/10 rounded-full mb-8">
                <span className="text-[10px] font-black text-[#800000] uppercase tracking-[0.2em]">Institutional Profile</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-[1.1] md:leading-[0.95] tracking-tighter mb-6 md:mb-8 font-display">
                Strategic <span className="text-[#800000]">Partnership</span> & Vision
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-10 font-medium">
                Genius collaborates with Nasarawa State University’s Research, Measurement, and Evaluation Unit. Registered under CAC (No. 3591627), our team comprises highly qualified professionals dedicated to academic excellence.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-3">
                    <Globe className="text-[#800000]" size={20} />
                    Our Mission
                  </h3>
                  <p className="text-slate-500 font-medium leading-relaxed text-sm">
                    To provide a comprehensive platform for learning and research, empowering scholars to achieve excellence and innovation across diverse fields.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Core Values</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Excellence', 'Inclusivity', 'Innovation', 'Collaboration', 'Integrity'].map(val => (
                      <span key={val} className="px-4 py-2 bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-100 shadow-sm">
                        {val}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { label: 'Published Papers', value: '2.5k+', icon: <FileText size={20} /> },
                { label: 'Global Citations', value: '850k+', icon: <Globe size={20} /> },
                { label: 'Expert Reviewers', value: '450+', icon: <Users size={20} /> },
                { label: 'Impact Factor', value: '8.42', icon: <CheckCircle2 size={20} /> }
              ].map((stat, i) => (
                <div key={i} className="p-8 bg-white rounded-3xl border border-slate-100 text-center shadow-lg shadow-slate-200/50 hover:border-[#800000]/20 transition-all flex flex-col items-center">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#800000] mb-4">
                     {stat.icon}
                  </div>
                  <p className="text-3xl font-black text-slate-900 mb-1">{stat.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Author Guidelines Section */}
      <section id="guidelines" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 md:mb-6 font-display">Author <span className="text-[#800000]">Guidelines</span></h2>
              <p className="text-sm md:text-slate-500 font-medium leading-relaxed">
                Please review these essential steps before manuscript submission to ensure rapid processing and academic integrity.
              </p>
            </div>
            <div className="w-24 h-1 bg-[#800000] rounded-full hidden md:block"></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
              {[
                "Manuscript should not be more than 15 pages of A4 size using 12 font size.",
                "Each paper should be double line spaced.",
                "Reference style: use the latest reference style of your field.",
                "Publisher should meet with an expert for vetting before upload.",
                "Authors should include their email and phone number.",
                "Ensure that your document is in PDF format."
              ].map((point, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-[#800000]/30 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-[#800000] font-black text-[10px] border border-slate-100 group-hover:bg-[#800000] group-hover:text-white transition-colors">
                    {i + 1}
                  </div>
                  <p className="text-slate-600 font-medium text-sm leading-relaxed">{point}</p>
                </motion.div>
              ))}
            </div>

            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center justify-center space-y-8">
              <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <CheckCircle2 className="text-amber-600" size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-4">Submission Ready?</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Ensure all guidelines are strictly met to accelerate your peer-review cycle.
                </p>
              </div>
              <button 
                onClick={onPublicationHub}
                className="w-full py-4 bg-[#800000] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-[#800000]/20 hover:scale-[1.02] transition-all"
              >
                Proceed to Upload
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Board Section */}
      <section id="editorial" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 font-display">Editorial <span className="text-[#800000]">Board</span></h2>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">Academic Oversight Committee</p>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-800">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">S/N</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Full Name</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Institution</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Department</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { sn: 1, name: "Prof. Yahaya A. Adadu", school: "Nasarawa State University, Keffi", dept: "Social Sciences", country: "Nigeria" },
                    { sn: 2, name: "Prof. Francis A. Akawu", school: "Nasarawa State University, Keffi", dept: "Economics", country: "Nigeria" },
                    { sn: 3, name: "Prof. LJ Kukwi", school: "Nasarawa State University, Keffi", dept: "Education", country: "Nigeria" },
                    { sn: 4, name: "Prof. Saleh A Dauda, Ph.D", school: "Nasarawa State University, Keffi", dept: "Education", country: "Nigeria" },
                    { sn: 5, name: "Prof. Dacid M Shekwolo, Ph.D", school: "Nasarawa State University, Keffi", dept: "Psychology", country: "Nigeria" },
                    { sn: 6, name: "Dr. Danjuma Namo", school: "Nasarawa State University, Keffi", dept: "Education", country: "Nigeria" },
                    { sn: 7, name: "Johan Adersson", school: "University of Freiburg", dept: "Banking and Finance", country: "Dutch/Switzerland" },
                    { sn: 8, name: "Maximilian Weber", school: "University of Serbia", dept: "Physics", country: "Germany" },
                    { sn: 9, name: "Leonardo Ferrari", school: "Amity University UEA", dept: "Accounting", country: "Italy" },
                    { sn: 10, name: "Charlotte Dupont", school: "University of Serbia", dept: "Mathematics", country: "United Kingdom" },
                    { sn: 11, name: "Dr. David M. Shekwolo", school: "Nigerian Defence Academy", dept: "Psychology", country: "Kaduna" },
                    { sn: 12, name: "Assoc. Prof. Abubakar M. Tafida", school: "Nsuk", dept: "Psychology", country: "Nasarawa State" },
                  ].map((member) => (
                    <tr key={member.sn} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-black text-[#800000]">{member.sn}</td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-black text-slate-900 group-hover:text-[#800000] transition-colors">{member.name}</span>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-500">{member.school}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-400 italic">{member.dept}</td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:bg-[#800000]/10 group-hover:text-[#800000] transition-all border border-slate-200">
                          {member.country}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact Section */}
      <footer id="contact" className="py-16 md:py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 border-b border-white/10 pb-12 md:pb-20">
          <div className="grid lg:grid-cols-4 gap-16">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <img src="/gmijp-logo.png" alt="GMIJP" className="w-8 h-8 rounded-full object-contain" />
                </div>
                <span className="text-2xl font-black tracking-tighter uppercase">Genius Publication</span>
              </div>
              <p className="text-slate-400 font-medium leading-relaxed max-w-md mb-10 italic">
                The global benchmark for multidisciplinary research excellence. We empower authors with state-of-the-art tools for validation and dissemination.
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#ff4d4d] border border-white/10 group-hover:bg-[#800000] transition-all">
                    <Phone size={18} />
                  </div>
                  <span className="text-sm font-black">+2348164064212</span>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#ff4d4d] border border-white/10 group-hover:bg-[#800000] transition-all">
                    <Mail size={18} />
                  </div>
                  <span className="text-sm font-black underline-offset-4 hover:underline">geniusmultidisciplinary@gmail.com</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-8 text-[#ff4d4d]">Quick Links</h4>
              <ul className="space-y-4">
                {['About', 'Guidelines', 'Editorial', 'Contact'].map(link => (
                  <li key={link}>
                    <a href={`#${link.toLowerCase()}`} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">{link} GMIJP</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-8 text-[#ff4d4d]">Support & Ethics</h4>
              <ul className="space-y-4">
                {['Editorial Ethics', 'Sponsorship', 'Archive Policy', 'Terms of Service'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            &copy; 2026 GMIJ Publication. All rights reserved.
          </p>
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
      </footer>
    </div>
  );
}
