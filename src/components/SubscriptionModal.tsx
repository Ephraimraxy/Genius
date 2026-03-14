import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CreditCard, ArrowRight, Loader2, Lock, Gift, Star, CheckCircle2 } from 'lucide-react';

interface SubscriptionModalProps {
  profile: any;
  onSuccess: () => void;
  addToast: (toast: any) => void;
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
      addToast({ title: 'Redirecting', message: 'Connecting to PaymentPoint secure gateway...', type: 'info' });
      
      setTimeout(async () => {
        // Simulate webhook success
        const verifyRes = await fetch(`/api/payment/verify/${data.reference}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (verifyRes.ok) {
            addToast({ title: 'Payment Success', message: 'Workspace activated! Welcome aboard.', type: 'success' });
            onSuccess();
        }
        setLoading(false);
      }, 2500);

    } catch (err: any) {
      addToast({ title: 'Payment Error', message: err.message, type: 'error' });
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
        className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-[#800000]/20 border border-white/20"
      >
        {/* Left Visual Side */}
        <div className="w-full md:w-5/12 premium-gradient p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-black/10 rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-8 shadow-lg border border-white/20">
              <Gift className="text-white" size={28} />
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight mb-4">Unlock Your <br/>Workspace</h2>
            <p className="text-white/80 text-sm font-medium leading-relaxed">
              Activate your lecturer portal to start managing students, exams, and assessments with AI intelligence.
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
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    <CheckCircle2 size={12} className="text-indigo-200" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Action Side */}
        <div className="w-full md:w-7/12 p-8 md:p-14 flex flex-col justify-center bg-white">
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mb-4 animate-bounce">
              <Star size={12} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest">Premium Plan</span>
            </div>
            <h3 className="text-slate-900 text-3xl font-black tracking-tight mb-2">Annual Access</h3>
            <p className="text-slate-500 text-sm font-medium">Complete payment to activate full system capabilities.</p>
          </div>

          <div className="bg-slate-50 rounded-4xl p-8 mb-10 border border-slate-100 relative overflow-hidden group hover:border-[#800000]/20 transition-all">
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-slate-400 text-lg font-bold">₦</span>
              <span className="text-5xl font-black text-slate-900 tracking-tighter">
                {price.toLocaleString()}
              </span>
              <span className="text-slate-400 font-bold">/year</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Secure payment handled by <span className="text-[#800000]">PaymentPoint</span> PCI-DSS gateway.
            </p>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full premium-gradient text-white py-6 rounded-3xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl shadow-[#800000]/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <CreditCard size={20} />
                Activate Now
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] px-4">
            Security Guaranteed • Encrypted Processing • Instant Access
          </p>
        </div>
      </motion.div>
    </div>
  );
}
