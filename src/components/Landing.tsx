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
  LogIn,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#800000] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-morph hover:bg-white/50 transition-colors border-b border-white/10 h-16">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-lg shadow-[#800000]/20 group-hover:rotate-12 transition-transform">
              <GraduationCap className="text-white" size={18} />
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
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] z-20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white z-25"></div>
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
              <div className="glass-morph p-10 rounded-[3.5rem] border-white/20 relative z-10 overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-[#800000] rounded-2xl text-white shadow-xl">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Registry Status</h3>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Neural AI Active</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Integrity Audits', value: '24.1k', color: 'text-indigo-600' },
                    { label: 'DOI Assignments', value: '18.5k', color: 'text-[#800000]' },
                    { label: 'Peer Review Cycles', value: '12.2k', color: 'text-emerald-600' }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-white/60 border border-white/40 rounded-2xl flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                      <span className={`text-sm font-black ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-5 bg-slate-900 rounded-[2rem] text-center border border-slate-700">
                  <p className="text-white font-black text-sm mb-1 uppercase tracking-tight">System Integrity: 100%</p>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">ISO 27001 Certified Registry</p>
                </div>
              </div>

              {/* Decorative blobs */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#800000]/10 rounded-full blur-[100px] z-0"></div>
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] z-0"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-32 relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-black text-slate-900 mb-8 font-display">
                Strategic <span className="text-gradient">Partnership</span> & Vision
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 font-medium">
                Genius collaborates with Nasarawa State University’s Research, Measurement, and Evaluation Unit in the Department of Educational Foundation and consults global academics. Registered under CAC (No. 3591627), our team comprises highly qualified professionals from various fields dedicated to academic excellence.
              </p>
              
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-3">
                    <Globe className="text-[#800000]" size={20} />
                    Our Mission
                  </h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    To provide a comprehensive and inclusive platform for learning and research, empowering scholars and professionals to achieve academic excellence and innovation across diverse fields, while fostering global collaboration and knowledge-sharing.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {['Excellence', 'Inclusivity', 'Innovation', 'Collaboration', 'Integrity', 'Empowerment', 'Sustainability'].map(val => (
                    <span key={val} className="px-4 py-2 bg-[#800000]/5 text-[#800000] text-[10px] font-black uppercase tracking-widest rounded-full border border-[#800000]/10">
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-6"
            >
              {[
                { label: 'Published Papers', value: '2.5k+' },
                { label: 'Global Citations', value: '850k+' },
                { label: 'Expert Reviewers', value: '450+' },
                { label: 'Impact Factor', value: '8.42' }
              ].map((stat, i) => (
                <div key={i} className="p-10 bg-slate-900 rounded-[2.5rem] text-white text-center shadow-2xl">
                  <p className="text-4xl font-black mb-2">{stat.value}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Author Guidelines Section */}
      <section id="guidelines" className="py-32 bg-slate-50/50 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-4 font-display">Author <span className="text-gradient">Guidelines</span></h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Essential steps before manuscript submission</p>
            <div className="w-20 h-1.5 premium-gradient mx-auto rounded-full mt-6"></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[
                "Manuscript should not be more than 15 pages (including abstract, tables and references) of A4 size using 12 font size.",
                "Each paper should be double line spaced.",
                "Reference style: each author should use the latest reference style of his or her field.",
                "Publisher should meet with an expert in their field for vetting before upload.",
                "Authors should include their email and phone number.",
                "Ensure that your document is in PDF format."
              ].map((point, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#800000]/5 flex items-center justify-center shrink-0 group-hover:bg-[#800000] group-hover:text-white transition-colors">
                    <span className="text-[10px] font-black">{i + 1}</span>
                  </div>
                  <p className="text-slate-700 font-medium leading-relaxed italic">{point}</p>
                </motion.div>
              ))}
            </div>

            <div className="glass-morph p-10 rounded-[2.5rem] border-[#800000]/10 flex flex-col justify-between">
              <div>
                <CheckCircle2 className="text-[#800000] mb-6" size={48} />
                <h3 className="text-2xl font-black text-slate-900 mb-4">Submission Ready?</h3>
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  Ensure all points are met to accelerate the peer-review process and increase publication probability.
                </p>
              </div>
              <button 
                onClick={onStart}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
              >
                Proceed to Upload
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Board Section */}
      <section id="editorial" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-4 font-display">Editorial <span className="text-gradient">Board</span></h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Distinguished Academic Oversight Committee</p>
            <div className="w-20 h-1.5 premium-gradient mx-auto rounded-full mt-6"></div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">S/N</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Full Name</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Institution</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Faculty / Department</th>
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
                        <span className="text-sm font-black text-slate-900">{member.name}</span>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">{member.school}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-500 italic">{member.dept}</td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
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
      <footer id="contact" className="bg-white border-t border-slate-100 py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-16 mb-20">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-[#800000]/20">
                  <GraduationCap className="text-white" size={24} />
                </div>
                <span className="text-3xl font-black text-slate-900 tracking-tighter">GMIJ PUBLICATION</span>
              </div>
              <p className="text-slate-500 font-medium leading-relaxed max-w-md mb-10 italic">
                The global benchmark for multidisciplinary research excellence. We empower authors with state-of-the-art tools for validation and dissemination.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#800000]">
                    <Phone size={18} />
                  </div>
                  <span className="text-sm font-black">+2348164064212</span>
                </div>
                <div className="flex items-center gap-4 text-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#800000]">
                    <Mail size={18} />
                  </div>
                  <span className="text-sm font-black">geniusmultidisciplinary@gmail.com</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8">Quick Links</h4>
              <ul className="space-y-4">
                <li><a href="#about" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">About GMIJP</a></li>
                <li><a href="#guidelines" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">Author Guidelines</a></li>
                <li><a href="#editorial" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">Editorial Board</a></li>
                <li><a href="#contact" className="text-sm font-bold text-slate-500 hover:text-[#800000] transition-colors">Contact Support</a></li>
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
