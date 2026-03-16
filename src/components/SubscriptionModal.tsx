import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CreditCard, ArrowRight, Loader2, Lock, Gift, Star, CheckCircle2 } from 'lucide-react';

interface SubscriptionModalProps {
  profile: any;
  onSuccess: () => void;
  addToast: (msg: string, type: any) => void;
}

export default function SubscriptionModal({ profile, onSuccess, addToast }: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const price = profile?.subscriptionPrice || 15000;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount: price, type: 'subscription' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed to initialize.');

      // In a real app, we would redirect to data.authorization_url
      // For this demo, we simulate success after 2 seconds
      addToast('Connecting to PaymentPoint secure gateway...', 'info');
      
      setTimeout(async () => {
        // Simulate webhook success
        const verifyRes = await fetch(`/api/payment/verify/${data.reference}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (verifyRes.ok) {
            addToast('Workspace activated! Welcome aboard.', 'success');
            onSuccess();
        }
        setLoading(false);
      }, 2500);

    } catch (err: any) {
      addToast(err.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-[#800000]/20 border border-white/20 max-h-[90vh] overflow-y-auto md:overflow-visible"
      >
        {/* Left Visual Side (Re-styled: Red on White) */}
        <div className="w-full md:w-5/12 bg-white border-r border-slate-100 p-12 text-slate-900 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-rose-50 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-rose-50/50 rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white border border-rose-100 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm mb-4 md:mb-6">
              <Gift className="text-rose-600" size={20} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-2 md:mb-3 text-[#800000]">Unlock Your <br className="hidden md:block" />Workspace</h2>
            <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed">
              Activate your premium portal to start managing academic records with neural-assisted validation.
            </p>
          </div>

          <div className="relative z-10 pt-12">
            <div className="space-y-4">
              {[
                'Unlimited Student Rosters',
                'AI-Powered Quiz Creation',
                'Proctoring & Anti-Cheat',
                'Performance Analytics'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-50 flex items-center justify-center">
                    <CheckCircle2 size={12} className="text-rose-600" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Action Side */}
        <div className="w-full md:w-7/12 p-6 md:p-14 flex flex-col justify-center bg-white">
          <div className="mb-4 md:mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-3 animate-bounce">
              <Star size={10} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest">Premium Activation</span>
            </div>
            <h3 className="text-slate-900 text-2xl md:text-3xl font-black tracking-tight mb-2">Institutional Access</h3>
            <p className="text-slate-500 text-xs md:text-sm font-medium">Complete payment to activate full system capabilities.</p>
          </div>

          <div className="bg-slate-50 rounded-[1.5rem] p-6 md:p-8 mb-6 md:mb-10 border border-slate-100 relative overflow-hidden group hover:border-[#800000]/20 transition-all">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-slate-400 text-base font-bold">₦</span>
              <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">
                {price.toLocaleString()}
              </span>
              <span className="text-slate-400 font-bold">/year</span>
            </div>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Secure payment handled by <span className="text-[#800000]">PaymentPoint</span> PCI-DSS gateway.
            </p>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-[#800000] text-white py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-xl md:shadow-2xl shadow-[#800000]/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <>
                <CreditCard size={18} />
                ACTIVATE ACCOUNT
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="mt-4 md:mt-8 text-center text-[9px] md:text-[10px] font-bold text-slate-300 uppercase tracking-[0.1em] px-2 md:px-4 leading-relaxed">
            SECURITY GUARANTEED • ENCRYPTED PROCESSING <br/>
            &copy; 2026 GENIUS MINDSPARK
          </p>
        </div>
      </motion.div>
    </div>
  );
}
