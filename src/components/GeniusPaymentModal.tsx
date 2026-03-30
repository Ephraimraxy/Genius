import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Loader2, CheckCircle2, ShieldUser, Copy, Clock, AlertCircle, ChevronRight, Zap } from 'lucide-react';

interface GeniusPaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number | string;
  courseName: string;
  courseId: string;
  token: string | null;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  type?: 'attendance' | 'material' | 'assessment' | 'audio' | 'portal_entry';
}

type Gateway = 'paymentpoint' | 'kora';

export default function GeniusPaymentModal({ onClose, onSuccess, amount, courseName, courseId, token, addToast, type = 'attendance' }: GeniusPaymentModalProps) {
  const [gatewaysStatus, setGatewaysStatus] = useState<{ paymentpoint: boolean, kora: boolean } | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(Number(amount) || 0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [isExpired, setIsExpired] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Fetch active gateways configuration on mount
  useEffect(() => {
    fetch('/api/payment/gateways')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
           setGatewaysStatus(data);
           // Auto-select if only one is enabled
           if (data.paymentpoint && !data.kora) handleGatewaySelect('paymentpoint');
           else if (!data.paymentpoint && data.kora) handleGatewaySelect('kora');
        } else {
           setGatewaysStatus({ paymentpoint: true, kora: true }); // Fallback
        }
      })
      .catch((err) => {
        console.error('Failed to fetch gateway config:', err);
        setGatewaysStatus({ paymentpoint: true, kora: true }); // Fallback
      });
  }, []);

  // Initialize the transaction once gateway is chosen
  const initializePayment = async (selectedGateway: Gateway) => {
    setLoading(true);
    try {
      let endpoint = '/api/payment/attendance/initialize';
      let body: any = { amount, course_id: courseId, gateway: selectedGateway };

      if (type === 'material') {
        endpoint = '/api/payment/material/initialize';
        body = { amount, resource_id: parseInt(courseId), gateway: selectedGateway };
      } else if (type === 'assessment') {
        endpoint = '/api/payment/assessment/initialize';
        body = { amount, exam_id: parseInt(courseId), gateway: selectedGateway };
      } else if (type === 'audio') {
        addToast('Audio payments are temporarily unavailable while the secure flow is being finalized.', 'info');
        onClose();
        return;
      } else if (type === 'portal_entry') {
        endpoint = '/api/payment/portal-entry/initialize';
        body = { amount, gateway: selectedGateway };
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
        setPaymentAmount(Number(data.amount || amount || 0));
        setExpiresAt(data.expires_at);
      } else {
        addToast(data.error || 'Failed to initialize payment', 'error');
        onClose();
      }
    } catch (err: any) {
      addToast(err.message || 'Payment server offline.', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleGatewaySelect = (selectedGateway: Gateway) => {
    setGateway(selectedGateway);
    initializePayment(selectedGateway);
  };

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

  const completeVerifiedPayment = () => {
    if (isConfirmed) return;
    setIsConfirmed(true);
    addToast('Payment confirmed. Access unlocked.', 'success');
    onSuccess();
  };

  const verifyPaymentStatus = async (silent = false) => {
    if (!paymentRef || !token || isConfirmed) return;

    if (!silent) {
      setIsVerifying(true);
    }

    try {
      const response = await fetch(`/api/payment/verify/${paymentRef}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to verify payment right now.');
      }

      if (data.status === 'success' || data.status === 'consumed') {
        completeVerifiedPayment();
        return;
      }

      if (!silent) {
        if (data.status === 'partially_paid') {
          addToast('Underpayment detected. Please complete the exact transfer amount.', 'error');
        } else {
          addToast('Payment is still pending bank confirmation. Please check again shortly.', 'info');
        }
      }
    } catch (err: any) {
      if (!silent) {
        addToast(err.message || 'Unable to verify payment right now.', 'error');
      }
    } finally {
      if (!silent) {
        setIsVerifying(false);
      }
    }
  };

  const gatewayLabel = gateway === 'kora' ? 'Premium Gateway' : 'Standard Gateway';
  const formattedAmount = paymentAmount.toLocaleString();

  useEffect(() => {
    if (!paymentRef || !token || isExpired || isConfirmed) return;

    const interval = window.setInterval(() => {
      void verifyPaymentStatus(true);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [paymentRef, token, isExpired, isConfirmed]);

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
        {/* Left Side: Branding & Info */}
        <div className="md:w-5/12 bg-gradient-to-br from-indigo-600 to-blue-800 p-8 md:p-10 text-white flex flex-col items-center md:items-start text-center md:text-left relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/40 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
          
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md relative z-10 border border-white/20">
            <ShieldUser size={24} className="text-white" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight leading-tight relative z-10">
            {type === 'portal_entry' ? 'Portal Access' : type === 'attendance' ? 'Sign Attendance' : type === 'material' ? 'Unlock Material' : type === 'audio' ? 'Unlock Audio' : 'Unlock Assessment'}
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
              <span className="font-medium">{gateway ? gatewayLabel : 'Secure Payment Gateway'}</span>
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

          {/* ── STEP 1: Gateway Selection ── */}
          {!gateway ? (
            <div className="flex-1 flex flex-col justify-center">
              {!gatewaysStatus ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                  <p className="text-slate-500 font-bold animate-pulse text-sm">Checking available payment methods...</p>
                </div>
              ) : !gatewaysStatus.paymentpoint && !gatewaysStatus.kora ? (
                <div className="text-center py-8">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                     <AlertCircle size={32} />
                   </div>
                   <h3 className="text-xl font-black text-slate-900 mb-2">Payments Disabled</h3>
                   <p className="text-slate-500 text-sm font-medium mb-8">All payment gateways are currently inactive. Please contact your administrator.</p>
                   <button onClick={onClose} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors w-full">
                     Close Window
                   </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-slate-900 mb-1">Choose Payment Gateway</h3>
                  <p className="text-slate-500 text-sm font-medium mb-8">Select your preferred payment provider to continue.</p>

                  <div className="space-y-4">
                    {/* PaymentPoint Option */}
                    {gatewaysStatus.paymentpoint && (
                      <button
                        onClick={() => handleGatewaySelect('paymentpoint')}
                        className="w-full group flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                          <CreditCard size={22} className="text-indigo-600 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-slate-900 text-base">Standard Gateway</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Secure bank transfer via PalmPay / OPay</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </button>
                    )}

                    {/* Kora Option */}
                    {gatewaysStatus.kora && (
                      <button
                        onClick={() => handleGatewaySelect('kora')}
                        className="w-full group flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 transition-colors">
                          <Zap size={22} className="text-emerald-600 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-slate-900 text-base">Premium Gateway</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Ultra-fast bank transfer (Recommended)</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                      </button>
                    )}
                  </div>

                  <p className="text-center text-[10px] text-slate-400 font-medium mt-8">
                    Both gateways are secure. Select either to generate your payment account.
                  </p>
                </>
              )}
            </div>
          ) : loading ? (
            /* ── Loading ── */
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
              <p className="text-slate-500 font-bold animate-pulse text-sm">Generating secure transaction via {gateway === 'kora' ? 'Kora' : 'PaymentPoint'}...</p>
            </div>
          ) : isExpired ? (
            /* ── Expired ── */
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <X size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Transaction Expired</h3>
              <p className="text-slate-500 font-medium text-sm mb-6 max-w-sm">
                The time limit to complete this payment has passed. Please close this window and try again.
              </p>
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : (
            /* ── Payment Details ── */
            <>
              {/* Header Info */}
              <div className="mb-6 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Payment Details</h3>
                  <p className="text-slate-500 text-sm font-medium">
                    Via <span className="font-bold text-indigo-600">{gateway === 'kora' ? 'Kora' : 'PaymentPoint'}</span>
                    {' — '}Complete transfer to {type === 'attendance' ? "log today's attendance" : "gain instant access"}.
                  </p>
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
                      {formattedAmount}
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Transfer exactly ₦{formattedAmount} to:</p>
                
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

              {/* Change Gateway Link */}
              {gatewaysStatus && gatewaysStatus.paymentpoint && gatewaysStatus.kora && (
                <div className="mb-4 text-center">
                  <button
                    onClick={() => {
                      setGateway(null);
                      setBankAccounts([]);
                      setPaymentRef('');
                      setPaymentAmount(Number(amount) || 0);
                      setExpiresAt(null);
                      setTimeLeft('--:--');
                      setIsExpired(false);
                      setIsConfirmed(false);
                    }}
                    className="text-xs text-slate-400 hover:text-indigo-600 underline underline-offset-2 transition-colors"
                  >
                    Switch gateway
                  </button>
                </div>
              )}

              {/* Verification Button */}
              <div className="mt-auto">
                <button
                  onClick={() => void verifyPaymentStatus(false)}
                  disabled={isVerifying || isExpired || bankAccounts.length === 0 || isConfirmed}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  {isVerifying ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  {isConfirmed ? 'Payment Confirmed' : 'Check Payment Status'}
                </button>
                <p className="text-center text-[10px] text-slate-400 font-medium mt-4">
                  Keep this window open while your transfer is being confirmed. Reference: {paymentRef || '...'}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
