import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Loader2, CheckCircle2, ShieldUser, Copy, Clock, AlertCircle } from 'lucide-react';

interface GeniusPaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number | string;
  courseName: string;
  courseId: string;
  token: string | null;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  type?: 'attendance' | 'material' | 'assessment';
}

export default function GeniusPaymentModal({ onClose, onSuccess, amount, courseName, courseId, token, addToast, type = 'attendance' }: GeniusPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [isExpired, setIsExpired] = useState(false);

  // Initialize the transaction on mount
  useEffect(() => {
    const initializePayment = async () => {
      setLoading(true);
      try {
        let endpoint = '/api/payment/attendance/initialize';
        let body: any = { amount, course_id: courseId };

        if (type === 'material') {
          endpoint = '/api/payment/material/initialize';
          body = { amount, resource_id: parseInt(courseId) };
        } else if (type === 'assessment') {
          endpoint = '/api/payment/assessment/initialize';
          body = { amount, exam_id: parseInt(courseId) };
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
          setBankAccounts(data.bankAccounts);
          setPaymentRef(data.reference);
          setExpiresAt(data.expires_at);
        } else {
          addToast(data.error || 'Failed to initialize attendance payment', 'error');
          onClose();
        }
      } catch (err: any) {
        addToast(err.message || 'Payment server offline.', 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [amount, courseId, token, addToast, onClose]);

  // Countdown Timer Logic
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expirationDate = new Date(expiresAt).getTime();
      const distance = expirationDate - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('00:00');
        setIsExpired(true);
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Account number copied!', 'success');
  };

  const verifyPaymentLocally = () => {
    setIsVerifying(true);
    // In a real flow, this could poll the backend for status changes.
    // For now, we mimic the behavior and let the user know verification is happening.
    setTimeout(() => {
      setIsVerifying(false);
      addToast('Transfer logged. You will be marked "Present" once the bank confirms receipt.', 'success');
      onSuccess();
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        {/* Left Side: Branding & Info (School Portal Blue Theme) */}
        <div className="md:w-5/12 bg-gradient-to-br from-indigo-600 to-blue-800 p-8 md:p-10 text-white flex flex-col items-center md:items-start text-center md:text-left relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/40 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
          
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md relative z-10 border border-white/20">
            <ShieldUser size={24} className="text-white" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight leading-tight relative z-10">
            {type === 'attendance' ? 'Sign Attendance' : type === 'material' ? 'Unlock Material' : 'Unlock Assessment'}
          </h2>
          <p className="text-indigo-100 mb-8 font-medium leading-relaxed relative z-10 text-sm">
            Pay the required token to access <span className="font-bold text-white">{courseName}</span>.
          </p>

          <div className="space-y-4 w-full relative z-10 mt-auto">
            <div className="flex items-center gap-3 text-indigo-100 text-sm">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium">Automatic roster update</span>
            </div>
            <div className="flex items-center gap-3 text-indigo-100 text-sm">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium">Secure PaymentPoint gateway</span>
            </div>
            <div className="flex items-center gap-3 text-indigo-100 text-sm">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <span className="font-medium">Valid for today's session only</span>
            </div>
          </div>
        </div>

        {/* Right Side: Action & Details */}
        <div className="flex-1 p-8 md:p-10 flex flex-col bg-white overflow-y-auto relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
              <p className="text-slate-500 font-bold animate-pulse text-sm">Generating secure transaction...</p>
            </div>
          ) : isExpired ? (
             <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                  <X size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Transaction Expired</h3>
              <p className="text-slate-500 font-medium text-sm mb-6 max-w-sm">
                 The time limit to complete this payment has passed. Please close this window and try again to generate a new transaction.
              </p>
              <button 
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                  Close Window
              </button>
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="mb-6 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                   <h3 className="text-2xl font-black text-slate-900">Payment Details</h3>
                   <p className="text-slate-500 text-sm font-medium">Complete transfer to {type === 'attendance' ? "log today's attendance" : "gain instant access"}.</p>
                </div>
                {/* Live Countdown Timer */}
                <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-full border border-rose-100 shrink-0">
                    <Clock size={16} className={timeLeft.startsWith('00') ? 'animate-pulse' : ''} />
                    <span className="font-mono font-black text-sm tracking-widest">{timeLeft}</span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="bg-slate-50 rounded-[1.5rem] p-6 mb-6 border border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Required Token</p>
                    <div className="flex items-baseline gap-1">
                    <span className="text-slate-400 text-sm font-bold">₦</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">
                        {amount}
                    </span>
                    </div>
                </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{type === 'attendance' ? 'Course' : type === 'material' ? 'Material ID' : 'Assessment ID'}</p>
                    <p className="font-bold text-slate-700">{courseId}</p>
                </div>
              </div>

              {/* Bank Transfer Instructions */}
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Transfer exactly ₦{amount} to:</p>
                
                <div className="space-y-3">
                  {bankAccounts.length === 0 ? (
                      <p className="text-sm text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                          Waiting for secure account generation...
                      </p>
                  ) : (
                      bankAccounts.map((acct, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border-2 border-indigo-50 hover:border-indigo-100 transition-all group flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">{acct.bankName}</span>
                            <span className="text-xl font-mono font-black tracking-widest text-slate-900">{acct.accountNumber}</span>
                            <span className="block text-xs text-slate-500 font-medium mt-1">{acct.accountName}</span>
                          </div>
                          <button 
                          onClick={() => copyToClipboard(acct.accountNumber)}
                          className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                          <Copy size={16} />
                          </button>
                      </div>
                      ))
                  )}
                </div>
              </div>

              {/* Verification Button */}
              <div className="mt-auto">
                <button
                  onClick={verifyPaymentLocally}
                  disabled={isVerifying || isExpired || bankAccounts.length === 0}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  {isVerifying ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  I've Made the Transfer
                </button>
                <p className="text-center text-[10px] text-slate-400 font-medium mt-4">
                  Do not close this window until you have clicked the verification button above. Reference: {paymentRef || '...'}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
