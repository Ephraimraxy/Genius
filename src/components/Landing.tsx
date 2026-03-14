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
  onStart: () => void;
  onStudentPortal: () => void;
}

export default function Landing({ onStart, onStudentPortal }: LandingProps) {

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#800000] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 h-24 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex items-center justify-center transition-transform hover:scale-110 drop-shadow-sm">
              <img src="/gmijp-logo.png" alt="GMIJP" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Genius</span>
              <span className="text-[10px] font-bold text-[#800000] tracking-[0.3em] uppercase mt-1">Research Portal</span>
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
              onClick={onStudentPortal} 
              className="px-5 py-2 text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg transition-colors uppercase tracking-widest hidden sm:block shadow-sm"
            >
              Student Portal
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-3">
               <button onClick={onStart} className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900">Sign In</button>
               <button onClick={onStart} className="px-6 py-3 bg-[#800000] text-white text-[10px] font-black rounded-xl shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all uppercase tracking-widest">Register</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-slate-900">
          <div className="absolute inset-0 bg-[#800000]/5 z-10"></div>
          <img 
            src="/Banner/NSUK.jpg" 
            alt="University Background" 
            className="w-full h-full object-cover opacity-0 transition-opacity duration-1000 ease-in-out z-0"
            onLoad={(e) => {
              (e.target as HTMLImageElement).classList.remove('opacity-0');
              (e.target as HTMLImageElement).classList.add('opacity-60');
            }}
            onError={(e) => {
              // Fallback to a gradient if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-[#800000]/40 z-[5] -z-10" />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] z-20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white z-25"></div>
        </div>        <div className="max-w-7xl mx-auto px-6 relative z-30 w-full">
           <div className="max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-[1.2rem] font-black text-[#ff4d4d] uppercase tracking-[0.4em] mb-8 drop-shadow-md">Neural Research Environment</h2>
                <h1 className="text-7xl md:text-9xl font-black text-white leading-[1.0] tracking-tight mb-8 font-display drop-shadow-2xl">
                  GENIUS <span className="text-[#ff4d4d]">MINDSPARK</span> <br/>
                  <span className="text-white">MULTIDISCIPLINARY</span>
                </h1>

                <p className="text-xl text-white/80 leading-relaxed mb-12 max-w-2xl font-medium drop-shadow-md">
                  The global benchmark for multidisciplinary research. Transform your ideas with neural-assisted validation, instant DOI registration, and global dissemination.
                </p>

                {/* Simplified Search Bar Interface */}
                <div className="relative max-w-xl mb-12 group">
                  <div className="bg-white rounded-2xl shadow-2xl p-2 flex items-center border border-slate-100 group-hover:border-[#800000]/30 transition-all">
                    <input 
                      type="text" 
                      placeholder="Search for articles, DOIs or journals..." 
                      className="flex-1 bg-transparent px-6 py-3 text-slate-600 font-medium outline-none"
                    />
                    <button className="p-3 text-slate-300 hover:text-slate-600">
                      <Search size={20} />
                    </button>
                    <button onClick={onStart} className="bg-[#800000] p-4 rounded-xl text-white shadow-lg shadow-[#800000]/30 hover:scale-105 transition-all">
                      <ArrowRight size={24} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <button 
                    onClick={onStart}
                    className="px-10 py-5 bg-[#800000] text-white font-black rounded-2xl shadow-2xl shadow-[#800000]/20 hover:shadow-[#800000]/40 transition-all uppercase tracking-[0.2em] text-[11px] border border-white/10"
                  >
                    Get Started
                  </button>

                  <button 
                    onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-4 group cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-100 group-hover:scale-110 transition-all">
                       <Play size={20} fill="#800000" className="text-[#800000] ml-1" />
                    </div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-slate-900 transition-colors">Learn More</span>
                  </button>
                </div>
              </motion.div>
           </div>
        </div>
      </section>

      {/* NEW: Lecturer & Workspace Promotion Section (Addresses User request) */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <Gem size={120} className="text-[#800000]" />
             </div>
             
             <div className="relative z-10 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mb-6">
                   <ShieldCheck size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Lecturer Workspace</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Need a Private Portal?</h3>
                <p className="text-slate-500 font-medium max-w-md leading-relaxed">
                   Are you a lecturer or researcher? Register to create your isolated workspace, manage students, upload rosters, and automate assessments. 
                </p>
             </div>

             <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <button 
                  onClick={onStudentPortal}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-105 transition-all flex items-center gap-3"
                >
                   <Users size={18} />
                   Student Portal
                </button>
                <button 
                  onClick={onStart}
                  className="px-8 py-4 bg-[#800000] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all flex items-center gap-3"
                >
                   <PlusCircle size={18} />
                   Create Workspace
                </button>
             </div>
          </div>
        </div>
      </section>      {/* AboutUs Section */}
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
              
              <h2 className="text-5xl font-black text-slate-900 leading-[0.95] tracking-tighter mb-8 font-display">
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
              <h2 className="text-4xl font-black text-slate-900 mb-6 font-display">Author <span className="text-[#800000]">Guidelines</span></h2>
              <p className="text-slate-500 font-medium leading-relaxed">
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
                onClick={onStart}
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
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4 font-display">Editorial <span className="text-[#800000]">Board</span></h2>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Academic Oversight Committee</p>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">S/N</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Full Name</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Institution</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Department</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
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
                    <tr key={member.sn} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4 text-sm font-black text-[#800000]">{member.sn}</td>
                      <td className="px-8 py-4">
                        <span className="text-sm font-black text-slate-900 group-hover:text-[#800000] transition-colors">{member.name}</span>
                      </td>
                      <td className="px-8 py-4 text-sm font-bold text-slate-500">{member.school}</td>
                      <td className="px-8 py-4 text-sm font-medium text-slate-400 italic">{member.dept}</td>
                      <td className="px-8 py-4">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:bg-[#800000]/10 group-hover:text-[#800000] transition-all">
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
      <footer id="contact" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 border-b border-white/10 pb-20">
          <div className="grid lg:grid-cols-4 gap-16">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <img src="/gmijp-logo.png" alt="GMIJP" className="w-8 h-8 object-contain" />
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
