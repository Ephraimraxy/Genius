import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, X, Send, ShieldCheck, Sparkles, Loader2,
  Headset, ArrowLeft, User, Bot, ChevronRight
} from 'lucide-react';

type Channel = 'online' | 'ai';

const ROLE_LABEL: Record<string, string> = {
  user: 'Researcher',
  tenant_admin: 'Lecturer',
  student: 'Student',
  admin: 'Admin',
  super_admin: 'Super Admin',
};
const ROLE_COLOR: Record<string, string> = {
  user: 'bg-violet-100 text-violet-700',
  tenant_admin: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-rose-100 text-rose-700',
  super_admin: 'bg-rose-100 text-rose-700',
};

export default function ChatWidget({ profile, forcedOpenThread = null }: { profile: any; forcedOpenThread?: number | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>('online');

  // Online support state
  const [messages, setMessages] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // AI support state
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile?.user?.role === 'admin' || profile?.user?.role === 'super_admin';

  // Force-open a specific thread (from UserManagement / Notifications)
  useEffect(() => {
    if (forcedOpenThread !== null) {
      setIsOpen(true);
      setChannel('online');
      setActiveThread(forcedOpenThread);
    }
  }, [forcedOpenThread]);

  // Polling for online channel
  useEffect(() => {
    if (!isOpen || channel !== 'online') return;
    fetchOnline();
    const iv = setInterval(fetchOnline, 15000);
    return () => clearInterval(iv);
  }, [isOpen, channel, activeThread]);

  // Load AI history when switching to AI tab
  useEffect(() => {
    if (!isOpen || channel !== 'ai') return;
    fetchAiHistory();
  }, [isOpen, channel]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, activeThread]);
  useEffect(() => {
    aiScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiHistory, isOpen]);

  const token = () => localStorage.getItem('token') || '';

  const fetchOnline = async () => {
    try {
      const url = isAdmin && !activeThread
        ? '/api/chat/inbox'
        : `/api/chat/history?channel=online${activeThread ? `&userId=${activeThread}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (isAdmin && !activeThread) setInbox(Array.isArray(data) ? data : []);
      else setMessages(Array.isArray(data) ? data : []);
    } catch { }
  };

  const fetchAiHistory = async () => {
    try {
      const res = await fetch('/api/chat/history?channel=ai', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (Array.isArray(data)) setAiHistory(data);
    } catch { }
  };

  const handleSendOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content: text, targetUserId: isAdmin ? activeThread : undefined })
      });
      fetchOnline();
    } catch { }
    setSending(false);
  };

  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const text = aiInput.trim();
    setAiInput('');
    const userMsg = { role: 'user' as const, content: text };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    try {
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();
      const aiMsg = { role: 'ai' as const, content: data.reply || data.error || 'Sorry, something went wrong.' };
      setAiMessages(prev => [...prev, aiMsg]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'ai', content: 'Connection error. Please try again.' }]);
    }
    setAiLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveThread(null);
  };

  // Merged AI messages: history + session messages
  const allAiMessages = [
    ...aiHistory.map((m: any) => ({ role: m.sender_role === 'ai' ? 'ai' : 'user', content: m.content })),
    ...aiMessages.filter(m => !aiHistory.find((h: any) => h.content === m.content))
  ] as { role: 'user' | 'ai'; content: string }[];

  return (
    <div className="fixed bottom-28 sm:bottom-8 right-4 sm:right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[300px] sm:w-[420px] h-[55vh] sm:h-[620px] max-h-[820px] bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className={`shrink-0 px-5 pt-5 pb-0 ${
              isAdmin ? 'bg-gradient-to-br from-slate-900 to-[#800000]'
              : channel === 'ai' ? 'bg-gradient-to-br from-indigo-900 to-violet-700'
              : 'bg-gradient-to-br from-slate-800 to-slate-600'
            } text-white`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Back button for admin thread view */}
                  {isAdmin && activeThread && channel === 'online' ? (
                    <button onClick={() => setActiveThread(null)} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                      <ArrowLeft size={18} />
                    </button>
                  ) : (
                    <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-md shrink-0">
                      {channel === 'ai' ? <Sparkles size={18} /> : isAdmin ? <ShieldCheck size={18} /> : <Headset size={18} />}
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-sm tracking-tight">
                      {channel === 'ai' ? 'Intelligent Support'
                        : isAdmin && activeThread ? 'User Thread'
                        : isAdmin ? 'Online Support — Inbox'
                        : 'Online Support'}
                    </h4>
                    <div className="flex items-center gap-1.5 opacity-70 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${channel === 'ai' ? 'bg-violet-300' : 'bg-emerald-400'}`} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        {channel === 'ai' ? 'AI Powered' : 'Live'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-white/15 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* ── Channel Toggle ──────────────────────────────────────── */}
              {(!isAdmin || !activeThread) && (
                <div className="flex bg-white/10 rounded-xl p-1 mb-0">
                  {(['online', 'ai'] as Channel[]).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                        channel === ch ? 'bg-white text-slate-900 shadow' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {ch === 'online' ? <Headset size={12} /> : <Sparkles size={12} />}
                      {ch === 'online' ? 'Online Support' : 'Intelligent AI'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Content ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">

              {/* ONLINE SUPPORT — ADMIN INBOX */}
              {channel === 'online' && isAdmin && !activeThread && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                  {inbox.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                      <MessageCircle size={36} className="opacity-20 mb-3" />
                      <p className="text-sm font-bold">No conversations yet</p>
                      <p className="text-xs mt-1 font-medium">Messages from users will appear here</p>
                    </div>
                  ) : (
                    inbox.map(thread => (
                      <button
                        key={thread.user_id}
                        onClick={() => { setActiveThread(thread.user_id); fetchOnline(); }}
                        className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all flex items-start gap-3 group"
                      >
                        <div className="w-10 h-10 shrink-0 bg-slate-100 rounded-full flex items-center justify-center font-black text-sm text-slate-700">
                          {(thread.user_name || thread.user_email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {thread.user_name || thread.user_email}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              {new Date(thread.last_message_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[thread.user_role] || 'bg-slate-100 text-slate-500'}`}>
                              {ROLE_LABEL[thread.user_role] || thread.user_role}
                            </span>
                            <p className={`text-xs truncate font-medium flex-1 ${thread.unread_count > 0 ? 'text-indigo-700 font-bold' : 'text-slate-500'}`}>
                              {thread.last_message}
                            </p>
                            {thread.unread_count > 0 && (
                              <span className="bg-[#800000] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                {thread.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{thread.user_email}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 mt-2 shrink-0 transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* ONLINE SUPPORT — CHAT THREAD (user or admin in a thread) */}
              {channel === 'online' && (!isAdmin || activeThread) && (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/60">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                          <MessageCircle size={28} className="text-slate-400" />
                        </div>
                        <h5 className="font-black text-slate-800 text-sm mb-1">
                          {isAdmin ? 'Start Conversation' : 'How can we help?'}
                        </h5>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[200px]">
                          {isAdmin
                            ? 'Send a message to start this conversation.'
                            : 'Send us a message and a support agent will respond shortly.'}
                        </p>
                      </div>
                    ) : (
                      messages.map((m, i) => {
                        const isOwn = isAdmin
                          ? m.sender_role === 'admin' || m.sender_role === 'super_admin'
                          : m.sender_role !== 'admin' && m.sender_role !== 'super_admin' && m.sender_role !== 'ai';
                        return (
                          <div key={i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs font-medium leading-relaxed shadow-sm ${
                              isOwn
                                ? 'bg-slate-900 text-white rounded-tr-sm'
                                : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
                            }`}>
                              {!isOwn && (
                                <div className="flex items-center gap-1.5 mb-1 opacity-50">
                                  <ShieldCheck size={9} />
                                  <span className="text-[9px] font-black uppercase tracking-widest">Support</span>
                                </div>
                              )}
                              {m.content}
                              <div className={`text-[9px] mt-1.5 ${isOwn ? 'text-white/40 text-right' : 'text-slate-400'}`}>
                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={scrollRef} />
                  </div>
                  <form onSubmit={handleSendOnline} className="shrink-0 p-3 border-t border-slate-100 bg-white">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1.5 border border-slate-100 focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-200 transition-all">
                      <input
                        type="text" value={input} onChange={e => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent border-none outline-none px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400"
                      />
                      <button type="submit" disabled={sending || !input.trim()}
                        className="p-2.5 bg-slate-900 text-white rounded-xl disabled:opacity-40 hover:bg-slate-700 transition-all">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* INTELLIGENT SUPPORT — AI CHAT */}
              {channel === 'ai' && (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/40">
                    {allAiMessages.length === 0 && !aiLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mb-3">
                          <Sparkles size={28} className="text-violet-600" />
                        </div>
                        <h5 className="font-black text-slate-800 text-sm mb-1">Genius AI Support</h5>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[210px]">
                          Ask me anything about the platform — features, how-tos, grading, materials, exams and more.
                        </p>
                      </div>
                    ) : (
                      <>
                        {allAiMessages.map((m, i) => {
                          const isAi = m.role === 'ai';
                          return (
                            <div key={i} className={`flex ${isAi ? 'justify-start' : 'justify-end'} gap-2`}>
                              {isAi && (
                                <div className="w-7 h-7 shrink-0 bg-violet-100 rounded-full flex items-center justify-center mt-0.5">
                                  <Bot size={14} className="text-violet-600" />
                                </div>
                              )}
                              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs font-medium leading-relaxed shadow-sm whitespace-pre-wrap ${
                                isAi
                                  ? 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
                                  : 'bg-indigo-600 text-white rounded-tr-sm'
                              }`}>
                                {m.content}
                              </div>
                              {!isAi && (
                                <div className="w-7 h-7 shrink-0 bg-indigo-100 rounded-full flex items-center justify-center mt-0.5">
                                  <User size={14} className="text-indigo-600" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {aiLoading && (
                          <div className="flex justify-start gap-2">
                            <div className="w-7 h-7 shrink-0 bg-violet-100 rounded-full flex items-center justify-center">
                              <Bot size={14} className="text-violet-600" />
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div ref={aiScrollRef} />
                  </div>
                  <form onSubmit={handleSendAi} className="shrink-0 p-3 border-t border-slate-100 bg-white">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1.5 border border-slate-100 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                      <input
                        type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                        placeholder="Ask the AI anything..."
                        disabled={aiLoading}
                        className="flex-1 bg-transparent border-none outline-none px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 disabled:opacity-60"
                      />
                      <button type="submit" disabled={aiLoading || !aiInput.trim()}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-all">
                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                    <p className="text-[9px] text-center text-slate-400 mt-1.5 font-medium">Powered by GPT-4o · Responses may not be 100% accurate</p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all ${
          isOpen ? 'bg-slate-800 rotate-90' : isAdmin ? 'bg-[#800000] shadow-[#800000]/30' : 'bg-indigo-600 shadow-indigo-600/30'
        }`}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>
    </div>
  );
}
