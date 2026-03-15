import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  X, 
  Send, 
  User, 
  ShieldCheck, 
  Sparkles,
  Loader2,
  Headset
} from 'lucide-react';

export default function ChatWidget({ profile, forcedOpenThread = null }: { profile: any, forcedOpenThread?: number | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = profile?.user?.role === 'admin';

  // Force open chat when clicking "Message User" from UserManagement
  useEffect(() => {
    if (forcedOpenThread) {
      setIsOpen(true);
      setActiveThread(forcedOpenThread);
    }
  }, [forcedOpenThread]);

  // Handle polling based on active view
  useEffect(() => {
    if (isOpen) {
      fetchData();
      const interval = setInterval(fetchData, 5000); 
      return () => clearInterval(interval);
    }
  }, [isOpen, activeThread]);

  useEffect(() => {
    if (activeThread || !isAdmin) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeThread, isOpen]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      // If Admin and NO active thread -> Fetch Inbox
      // If Admin and HAS active thread -> Fetch Thread
      // If normal user -> Fetch Thread automatically
      
      const endpoint = (isAdmin && !activeThread) ? '/api/chat/inbox' : `/api/chat/history${activeThread ? `?userId=${activeThread}` : ''}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (isAdmin && !activeThread) {
        setInbox(data);
      } else {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch chat data');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          content: userMessage,
          targetUserId: isAdmin ? activeThread : undefined
        })
      });
      
      await response.json();
      fetchData();
    } catch (err) {
      console.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] sm:w-[400px] h-[60vh] sm:h-[600px] max-h-[800px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-[#800000]/20 border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className={`p-6 ${isAdmin ? 'bg-gradient-to-br from-slate-900 to-[#800000]' : 'premium-gradient'} text-white flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-3">
                {isAdmin && activeThread ? (
                  <button onClick={() => setActiveThread(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors -ml-2">
                    <X size={20} className="rotate-45" /> {/* Back icon hack */}
                  </button>
                ) : (
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    {isAdmin ? <ShieldCheck size={20} /> : <Headset size={20} />}
                  </div>
                )}
                <div>
                  <h4 className="font-black text-sm tracking-tight text-white">
                    {isAdmin ? (activeThread ? 'User Thread' : 'Admin Inbox') : 'Genius Support'}
                  </h4>
                  <div className="flex items-center gap-1.5 opacity-80">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {isAdmin ? (activeThread ? 'Direct Message' : 'Live System') : 'Online'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  if (isAdmin) setActiveThread(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            {isAdmin && !activeThread ? (
              // ADMIN INBOX VIEW
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                {inbox.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <MessageCircle size={32} className="opacity-20 mb-2" />
                    <p className="text-sm font-medium">Inbox is empty</p>
                  </div>
                ) : (
                  inbox.map((thread) => (
                    <button 
                      key={thread.user_id}
                      onClick={() => setActiveThread(thread.user_id)}
                      className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all flex items-start gap-3"
                    >
                      <div className="w-10 h-10 shrink-0 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {thread.user_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900 text-sm truncate">{thread.user_name || thread.user_email}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {new Date(thread.last_message_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate font-medium">{thread.last_message}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              // THREAD / CHAT VIEW
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 bg-[#800000]/5 rounded-full flex items-center justify-center text-[#800000] mb-4">
                        <MessageCircle size={32} />
                      </div>
                      <h5 className="font-black text-slate-900 text-sm mb-2">{isAdmin ? 'Start Conversation' : 'How can we help?'}</h5>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {isAdmin ? 'Send a message to this user directly.' : 'Send us a message and an admin will respond shortly.'}
                      </p>
                    </div>
                  )}
                  
                  {messages.map((m, i) => {
                    // Determine if the message should appear on the right side (user's own message)
                    const isOwnMessage = isAdmin ? m.sender_role === 'admin' : m.sender_role === 'user';
                    
                    return (
                      <div key={i} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                          isOwnMessage 
                            ? (isAdmin ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-[#800000] text-white rounded-tr-none')
                            : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-none'
                        }`}>
                          {!isOwnMessage && (
                            <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                              {m.sender_role === 'admin' ? <ShieldCheck size={10} /> : <User size={10} />}
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {m.sender_role === 'admin' ? 'Admin' : m.sender_name || 'User'}
                              </span>
                            </div>
                          )}
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef}></div>
                </div>

                <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-100 focus-within:ring-2 focus-within:ring-[#800000]/10 transition-all">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent border-none outline-none px-4 text-xs font-medium text-slate-900 placeholder:text-slate-400"
                    />
                    <button 
                      type="submit"
                      disabled={loading || !input.trim()}
                      className={`p-3 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:scale-100 ${isAdmin ? 'bg-slate-900 hover:scale-105' : 'premium-gradient shadow-[#800000]/20 hover:scale-105'}`}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform duration-300 ${
          isOpen ? 'bg-[#1e293b] rotate-90' : 'premium-gradient shadow-[#800000]/30'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
