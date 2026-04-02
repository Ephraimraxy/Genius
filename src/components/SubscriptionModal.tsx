import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CreditCard, ArrowRight, Loader2, Lock, Gift, Star, CheckCircle2, Copy, Building2 } from 'lucide-react';
import { openPaymentPopup } from './paymentPopup';
import { subscribePaymentReturn } from './paymentChannel';

declare global {
  interface Window {
    PaystackPop: any;
    Korapay: any;
  }
}

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

type Gateway = 'paystack' | 'kora';

export default function SubscriptionModal({ profile, onSuccess, addToast }: SubscriptionModalProps) {
  const MAX_AUTO_RETRY = 1;
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [gatewaysStatus, setGatewaysStatus] = useState<{ paystack: boolean; kora: boolean } | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [paidSoFar, setPaidSoFar] = useState<number | null>(null);
  const [remainingAmount, setRemainingAmount] = useState<number | null>(null);
  const [overpaidAmount, setOverpaidAmount] = useState<number | null>(null);
  const [creditApplied, setCreditApplied] = useState(false);
  const [creditUsed, setCreditUsed] = useState<number | null>(null);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [inlineRef, setInlineRef] = useState<string | null>(null);
  const [needsNewReference, setNeedsNewReference] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [retryMode, setRetryMode] = useState<'init' | 'topup'>('init');
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaymentCancelled, setIsPaymentCancelled] = useState(false);
  const price = profile?.subscriptionPrice || 15000;

  useEffect(() => {
    fetch('/api/payment/gateways')
      .then(res => res.json())
      .then(data => {
        setGatewaysStatus({
          paystack: data?.paystack !== false,
          kora: data?.kora !== false
        });
      })
      .catch(() => setGatewaysStatus({ paystack: true, kora: true }));
  }, []);

  useEffect(() => {
    setInlineRef(null);
    setNeedsNewReference(false);
    setAutoRetryCount(0);
    setIsAutoRetrying(false);
    setIsPaymentCancelled(false);
    setRetryMode('init');
  }, [selectedGateway]);

  const handleSubscribe = async (options: { isRetry?: boolean } = {}) => {
    setLoading(true);
    if (!options.isRetry) {
      setAutoRetryCount(0);
    }
    setIsPaymentCancelled(false);
    setRetryMode('init');
    setInlineRef(null);
    setNeedsNewReference(false);
    setCheckoutData(null);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount: price, type: 'subscription', gateway: selectedGateway, mode: 'inline' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed to initialize.');

      // Display checkout or virtual accounts
      setCheckoutData(data);
      setBankAccounts(data.bankAccounts || []);
      setCheckoutUrl(data.checkout_url || null);
      setPaidSoFar(null);
      setRemainingAmount(null);
      setOverpaidAmount(null);
      setPopupBlocked(false);
      setCreditApplied(Boolean(data.credit_applied));
      setCreditUsed(Number(data.credit_used || 0) || null);
      const checkoutUrl = data.checkout_url || data.authorization_url;
      if (data.publicKey && data.reference) {
        openInlineCheckout(data);
      } else if (checkoutUrl) {
        openInlineCheckout(data);
      }
      setPaymentRef(data.reference);
      const displayAmount = Number(data.amount_naira ?? price ?? 0);
      setPaymentAmount(displayAmount);
      if (data.remaining_amount !== undefined) {
        setRemainingAmount(Number(data.remaining_amount));
        if (Number(data.remaining_amount) > 0 && Number(data.credit_used || 0) > 0) {
          setPaidSoFar(Number(data.credit_used));
        }
      }
      if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
        addToast('Wallet credit applied. Workspace activating...', 'success');
        setTimeout(onSuccess, 1500);
        return;
      }
      addToast('Secure payment window opened. Complete your payment to activate.', 'info');
      
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCheckoutPopup = (url?: string | null) => {
    if (!url) return;
    const popup = openPaymentPopup(url, {
      onBlocked: () => setPopupBlocked(true)
    });
    if (!popup) setPopupBlocked(true);
  };

  const openInlineCheckout = (data: any) => {
    const reference = data?.reference;
    if (!reference) {
      addToast('Missing payment reference. Please retry.', 'error');
      return;
    }

    if (isPaymentCancelled || needsNewReference) {
      setNeedsNewReference(true);
      addToast('This checkout was cancelled. Generate a new reference to retry.', 'info');
      return;
    }

    if (inlineRef && inlineRef === reference) {
      setNeedsNewReference(true);
      addToast('This checkout was already opened. Generate a new reference to retry.', 'info');
      return;
    }

    setInlineRef(reference);
    setNeedsNewReference(false);

    if (selectedGateway === 'paystack' && window.PaystackPop && data?.publicKey) {
      const fallbackAmount = Number(data?.amount_naira ?? price ?? 0);
      const amountKobo = Number(data?.amount_kobo ?? data?.amount ?? 0) || Math.round(fallbackAmount * 100);
      const email = data?.email || data?.customer?.email || '';
      const handler = window.PaystackPop.setup({
        key: data.publicKey,
        email,
        amount: amountKobo,
        currency: data.currency || 'NGN',
        ref: reference,
        onClose: () => {
          if (isPaymentCancelled) return;
          if (!isAutoRetrying && autoRetryCount < MAX_AUTO_RETRY) {
            setIsAutoRetrying(true);
            setAutoRetryCount((count) => count + 1);
            addToast('Checkout closed. Reinitializing a fresh reference...', 'info');
            if (retryMode === 'topup') {
              void handlePayRemaining().finally(() => setIsAutoRetrying(false));
            } else {
              void handleSubscribe({ isRetry: true }).finally(() => setIsAutoRetrying(false));
            }
            return;
          }
          setNeedsNewReference(true);
          addToast('Payment window closed. Generate a new checkout to retry.', 'info');
        },
        callback: () => {
          checkPaymentStatusOnce();
        }
      });
      handler.openIframe();
      return;
    }

    if (selectedGateway === 'kora' && window.Korapay && data?.publicKey) {
      const amountNaira = Number(data?.amount_naira ?? data?.amount ?? price ?? 0);
      const email = data?.email || data?.customer?.email || '';
      const name = data?.name || data?.customer?.name || '';
      window.Korapay.initialize({
        key: data.publicKey,
        reference,
        amount: amountNaira,
        currency: data.currency || 'NGN',
        customer: {
          email,
          name
        },
        onClose: () => {
          if (isPaymentCancelled) return;
          if (!isAutoRetrying && autoRetryCount < MAX_AUTO_RETRY) {
            setIsAutoRetrying(true);
            setAutoRetryCount((count) => count + 1);
            addToast('Checkout closed. Reinitializing a fresh reference...', 'info');
            if (retryMode === 'topup') {
              void handlePayRemaining().finally(() => setIsAutoRetrying(false));
            } else {
              void handleSubscribe({ isRetry: true }).finally(() => setIsAutoRetrying(false));
            }
            return;
          }
          setNeedsNewReference(true);
          addToast('Payment window closed. Generate a new checkout to retry.', 'info');
        },
        onSuccess: () => {
          checkPaymentStatusOnce();
        }
      });
      return;
    }

    const checkoutUrl = data?.checkout_url || data?.authorization_url;
    if (checkoutUrl) {
      openCheckoutPopup(checkoutUrl);
      return;
    }

    addToast('Unable to open checkout. Please retry.', 'error');
  };

  const handlePayRemaining = async () => {
    if (!paymentRef) return;
    setRetryMode('topup');
    setIsTopupLoading(true);
    try {
      const res = await fetch('/api/payment/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reference: paymentRef, gateway: selectedGateway, mode: 'inline' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Top-up failed');

      if (data.credit_used) setCreditUsed(Number(data.credit_used));
      if (data.remaining_amount !== undefined) setRemainingAmount(Number(data.remaining_amount));
      setCheckoutData(data);

      if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
        addToast('Wallet credit applied. Workspace activating...', 'success');
        setTimeout(onSuccess, 1500);
        return;
      }

      if (data.publicKey && data.reference) {
        openInlineCheckout(data);
      } else if (data.checkout_url || data.authorization_url) {
        openInlineCheckout(data);
      }
      if (data.bankAccounts) {
        setBankAccounts(data.bankAccounts);
      }
    } catch (err: any) {
      addToast(err.message || 'Top-up failed. Please try again.', 'error');
    } finally {
      setIsTopupLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!paymentRef) return;
    setIsCancelling(true);
    try {
      const response = await fetch('/api/payment/abandon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reference: paymentRef, reason: 'user_cancel' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to cancel payment');
      setIsPaymentCancelled(true);
      setNeedsNewReference(true);
      setRetryMode('init');
      addToast('Payment cancelled. Reference marked abandoned.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Unable to cancel payment.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const checkPaymentStatusOnce = async () => {
    if (!paymentRef) return;
    try {
      const res = await fetch(`/api/payment/verify/${paymentRef}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const paidSoFarValue = Number(data?.paid_so_far || 0);
      const remainingValue = Number(data?.remaining_amount || Math.max(paymentAmount - paidSoFarValue, 0));
      const overpaidValue = Number(data?.overpaid || 0);

      if (data.status === 'success') {
        if (paidSoFarValue > 0) setPaidSoFar(paidSoFarValue);
        setRemainingAmount(0);
        if (overpaidValue > 0) setOverpaidAmount(overpaidValue);
        addToast('Payment detected! Workspace activating...', 'success');
        setTimeout(onSuccess, 1500);
      } else if (data.status === 'partially_paid') {
        setPaidSoFar(paidSoFarValue);
        setRemainingAmount(remainingValue);
        addToast(`Partial payment detected. Remaining ₦${remainingValue.toLocaleString()}.`, 'error');
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  };

  useEffect(() => {
    let pollInterval: any;
    if (paymentRef && (bankAccounts.length > 0 || checkoutUrl || (checkoutData && checkoutData.publicKey))) {
      pollInterval = setInterval(() => {
        void checkPaymentStatusOnce();
      }, 10000); // Poll every 10 seconds
    }
    return () => clearInterval(pollInterval);
  }, [paymentRef, bankAccounts, checkoutUrl, paymentAmount]);

  useEffect(() => {
    if (!paymentRef) return;
    const unsubscribe = subscribePaymentReturn((message) => {
      if (message.reference && message.reference !== paymentRef) return;
      void checkPaymentStatusOnce();
    });
    return unsubscribe;
  }, [paymentRef, paymentAmount]);

  useEffect(() => {
    if (paymentRef) setNeedsNewReference(false);
  }, [paymentRef]);

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
        className="relative w-full max-w-2xl bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-indigo-600/20 border border-white/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto md:overflow-visible"
      >
        {/* Left Visual Side */}
        <div className="w-full md:w-5/12 bg-gradient-to-br from-indigo-600 to-blue-800 p-6 md:p-10 text-white flex flex-col justify-between relative overflow-hidden">
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

          <div className="relative z-10 pt-6 md:pt-10">
            <div className="space-y-3 md:space-y-4">
              {[
                'Unlimited Student Rosters',
                'Exams, Tests & Assignments',
                'Attendance Management',
                'Proctoring & Anti-Cheat',
                'Performance Analytics',
                '12 Months Full Access'
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
        <div className="w-full md:w-7/12 p-6 md:p-10 flex flex-col justify-center bg-white">
          {bankAccounts.length === 0 && !checkoutUrl && !checkoutData ? (
            <>
              {/* Initial state — show pricing & activate button */}
              <div className="mb-4 md:mb-6 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-[#FFD700] border border-[#FFD700]/30 mb-2 md:mb-3 animate-pulse shadow-lg">
                  <Star size={10} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Premium Plan</span>
                </div>
                <h3 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-2 md:mb-4">Annual Access</h3>
                <p className="text-slate-500 text-[10px] md:text-sm font-medium">Complete payment to activate full system capabilities.</p>
              </div>

              <div className="bg-slate-50 rounded-[1.5rem] p-4 md:p-8 mb-4 md:mb-10 border border-slate-100 relative overflow-hidden group hover:border-indigo-600/20 transition-all">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-slate-400 text-sm md:text-base font-bold">₦</span>
                  <span className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">
                    {price.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm md:text-base font-bold">/year</span>
                </div>
                <p className="text-[8px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Secure payment handled by <span className="text-indigo-600">{selectedGateway === 'paystack' ? 'Paystack' : 'Kora Checkout'}</span> secure gateway.
                </p>
              </div>

              
              {gatewaysStatus && (
                <div className="mb-8 w-full">
                   <div className="flex items-center gap-2 mb-4 bg-indigo-50/50 px-4 py-2 rounded-2xl border border-indigo-100/50 w-fit">
                      <ShieldCheck size={14} className="text-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Choose Gateway</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      {gatewaysStatus.paystack && (
                        <button
                          type="button"
                          onClick={() => setSelectedGateway('paystack')}
                          className={`p-5 rounded-3xl border-2 transition-all text-left group ${
                            selectedGateway === 'paystack' 
                              ? 'border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-600/10' 
                              : 'border-slate-100 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedGateway === 'paystack' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100'}`}>
                                <CreditCard size={20} />
                             </div>
                             {selectedGateway === 'paystack' && <CheckCircle2 size={16} className="text-indigo-600" />}
                          </div>
                          <p className="font-black text-slate-900 text-sm">Paystack</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-1 leading-tight">Cards, USSD, Transfer</p>
                        </button>
                      )}
                      {gatewaysStatus.kora && (
                        <button
                          type="button"
                          onClick={() => setSelectedGateway('kora')}
                          className={`p-5 rounded-3xl border-2 transition-all text-left group ${
                            selectedGateway === 'kora' 
                              ? 'border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-600/10' 
                              : 'border-slate-100 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedGateway === 'kora' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100'}`}>
                                <Building2 size={20} />
                             </div>
                             {selectedGateway === 'kora' && <CheckCircle2 size={16} className="text-indigo-600" />}
                          </div>
                          <p className="font-black text-slate-900 text-sm">Kora</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-1 leading-tight">Instant Bank Transfer</p>
                        </button>
                      )}
                   </div>
                </div>
              )}
              <button onClick={handleSubscribe} disabled={loading || !selectedGateway} className="w-full bg-gradient-to-br from-indigo-600 to-blue-800 text-white py-3.5 md:py-6 rounded-xl md:rounded-3xl font-black text-[10px] md:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 md:gap-4 shadow-xl md:shadow-2xl shadow-indigo-600/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
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
              {/* Checkout or Bank transfer details — shown after API call succeeds */}
              {remainingAmount !== null && remainingAmount > 0 && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold space-y-3">
                  <div>
                    Partial payment detected. Paid ₦{(paidSoFar || 0).toLocaleString()}. Remaining ₦{remainingAmount.toLocaleString()}.
                  </div>
                  <button
                    onClick={handlePayRemaining}
                    disabled={isTopupLoading}
                    className="w-full bg-amber-600 text-white py-2.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-amber-700 transition disabled:opacity-50"
                  >
                    {isTopupLoading ? 'Processing...' : 'Pay Remaining Balance'}
                  </button>
                </div>
              )}

              {creditUsed !== null && creditUsed > 0 && (
                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 text-xs font-bold">
                  Wallet credit applied: ₦{creditUsed.toLocaleString()}.
                </div>
              )}

              {overpaidAmount !== null && overpaidAmount > 0 && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold">
                  Overpayment of ₦{overpaidAmount.toLocaleString()} detected. A refund will be initiated automatically.
                </div>
              )}

              {(checkoutUrl || (checkoutData && checkoutData.publicKey)) ? (
                <div className="mb-6 text-center md:text-left bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                  <h3 className="text-slate-900 text-xl font-black mb-2">Checkout Details</h3>
                  <p className="text-sm text-slate-600 mb-4">A secure Paystack payment window has been opened. Please complete your transaction.</p>
                  <button
                    onClick={() => {
                      if (checkoutData) {
                        openInlineCheckout(checkoutData);
                      } else {
                        openCheckoutPopup(checkoutUrl);
                      }
                    }}
                    className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                  >
                    Open Payment Gateway
                  </button>
                  <div className="mt-3">
                    <button
                      onClick={handleCancelPayment}
                      disabled={isCancelling || !paymentRef}
                      className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline underline-offset-2 disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel payment'}
                    </button>
                  </div>
                  {checkoutUrl && popupBlocked && (
                    <div className="mt-3 text-[11px] text-slate-500">
                      Popup blocked? <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="underline">Open in new tab</a>
                    </div>
                  )}
                  {needsNewReference && (
                    <div className="mt-3 text-[11px] text-amber-600 font-bold">
                      This reference was already used.{' '}
                      <button
                        onClick={handleSubscribe}
                        className="underline"
                      >
                        Generate a new checkout
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
                <p className="text-[10px] font-bold text-indigo-700 leading-relaxed">
                  ⏳ Your workspace will be activated automatically once payment is confirmed (usually within 1–5 minutes). Reference: <span className="font-black">{paymentRef}</span>
                </p>
              </div>

              <button
                onClick={() => {
                  addToast('Checking payment status...', 'info');
                  setTimeout(() => {
                    void checkPaymentStatusOnce();
                  }, 1000);
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-blue-800 transition-all"
              >
                <CheckCircle2 size={16} />
                I've Made the Transfer
              </button>
            </>
          )}

          <p className="mt-4 md:mt-6 text-center text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] px-2 md:px-4">
            Security Guaranteed • Encrypted Processing • Instant Access
          </p>
        </div>
      </motion.div>
    </div>
  );
}
