import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CreditCard, ArrowRight, Loader2, Lock, Gift, Star, CheckCircle2, Copy, Building2 } from 'lucide-react';

interface BankAccount {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
}

interface SubscriptionModalProps {
  profile: any;
  onSuccess: () => void;
  addToast: (msg: string, type: any) => void;
}

export default function SubscriptionModal({ profile, onSuccess, addToast }: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
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

      // Display the virtual account details for bank transfer
      setBankAccounts(data.bankAccounts || []);
      setPaymentRef(data.reference);
      setPaymentAmount(data.amount || price);
      addToast('Virtual account generated. Transfer to activate.', 'info');
      
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied!`, 'success');
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
        {/* Left Visual Side */}
        <div className="w-full md:w-5/12 premium-gradient p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-black/10 rounded-full blur-2xl"></div>
          </div>

          <div className="relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-md mb-4 md:mb-6 shadow-lg border border-white/20">
              <Gift className="text-white" size={20} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-2 md:mb-3">Unlock Your <br className="hidden md:block" />Workspace</h2>
            <p className="text-white/80 text-xs md:text-sm font-medium leading-relaxed">
              Activate your lecturer portal to start managing students and exams with AI intelligence.
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
        <div className="w-full md:w-7/12 p-6 md:p-14 flex flex-col justify-center bg-white">
          {bankAccounts.length === 0 ? (
            <>
              {/* Initial state — show pricing & activate button */}
              <div className="mb-4 md:mb-10 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mb-3 animate-bounce">
                  <Star size={10} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Premium Plan</span>
                </div>
                <h3 className="text-slate-900 text-2xl md:text-3xl font-black tracking-tight mb-2">Annual Access</h3>
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
                className="w-full premium-gradient text-white py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-xs md:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-xl md:shadow-2xl shadow-[#800000]/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <CreditCard size={18} />
                    Activate Now
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Bank transfer details — shown after API call succeeds */}
              <div className="mb-6 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mb-3">
                  <Building2 size={10} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Bank Transfer</span>
                </div>
                <h3 className="text-slate-900 text-xl md:text-2xl font-black tracking-tight mb-1">Transfer to Activate</h3>
                <p className="text-slate-500 text-xs font-medium">
                  Send exactly <span className="font-black text-slate-900">₦{paymentAmount.toLocaleString()}</span> to any account below.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {bankAccounts.map((acct, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-[#800000]/20 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{acct.bankName}</span>
                      <button 
                        onClick={() => copyToClipboard(acct.accountNumber, 'Account number')}
                        className="text-slate-400 hover:text-[#800000] transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-2xl font-black text-slate-900 tracking-wider mb-1">{acct.accountNumber}</p>
                    <p className="text-xs font-bold text-slate-500">{acct.accountName}</p>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                  ⏳ Your workspace will be activated automatically once payment is confirmed (usually within 1–5 minutes). Reference: <span className="font-black">{paymentRef}</span>
                </p>
              </div>

              <button
                onClick={() => {
                  addToast('Checking payment status...', 'info');
                  setTimeout(async () => {
                    try {
                      const verifyRes = await fetch(`/api/payment/verify/${paymentRef}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                      });
                      if (verifyRes.ok) {
                        const vData = await verifyRes.json();
                        if (vData.status === 'success') {
                          addToast('Payment confirmed! Workspace activated.', 'success');
                          onSuccess();
                        } else {
                          addToast('Payment not yet received. Please wait a few minutes after transferring.', 'info');
                        }
                      }
                    } catch {
                      addToast('Could not verify payment. Please try again shortly.', 'error');
                    }
                  }, 1000);
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
              >
                <CheckCircle2 size={16} />
                I've Made the Transfer
              </button>
            </>
          )}

          <p className="mt-4 md:mt-8 text-center text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] px-2 md:px-4">
            Security Guaranteed • Encrypted Processing • Instant Access
          </p>
        </div>
      </motion.div>
    </div>
  );
}
