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

export default function ChatWidget({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = profile?.user?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      const interval = setInterval(fetchHistory, 5000); // Poll for new messages
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/chat/history', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch chat history');
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
        body: JSON.stringify({ content: userMessage })
      });
      
      const data = await response.json();
      fetchHistory();
    } catch (err) {
      console.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-2xl shadow-[#800000]/20 border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 premium-gradient text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Headset size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-tight text-white">Genius Mindspark Support</h4>
                  <div className="flex items-center gap-1.5 opacity-80">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Neural AI Active</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-[#800000]/5 rounded-full flex items-center justify-center text-[#800000] mb-4">
                    <Sparkles size={32} />
                  </div>
                  <h5 className="font-black text-slate-900 text-sm mb-2">Neural Intelligence Ready</h5>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Welcome! How can we assist your research journey today? Our AI or admin will respond shortly.
                  </p>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                    m.sender_role === 'user' 
                      ? 'bg-[#800000] text-white rounded-tr-none' 
                      : m.sender_role === 'ai'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-tl-none'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                  }`}>
                    {m.sender_role !== 'user' && (
                      <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                        {m.sender_role === 'ai' ? <Sparkles size={10} /> : <ShieldCheck size={10} />}
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {m.sender_role === 'ai' ? 'Neural AI' : 'Admin'}
                        </span>
                      </div>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={scrollRef}></div>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
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
                  className="p-3 premium-gradient text-white rounded-xl shadow-lg shadow-[#800000]/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
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
