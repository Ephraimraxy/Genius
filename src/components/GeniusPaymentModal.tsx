import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Loader2, CheckCircle2, ShieldUser, Copy, Clock, AlertCircle, ChevronRight, Zap } from 'lucide-react';
import { openPaymentPopup } from './paymentPopup';
import { subscribePaymentReturn } from './paymentChannel';
import { friendlyError } from '../utils/friendlyError';

declare global {
  interface Window {
    PaystackPop: any;
    Korapay: any;
  }
}

interface GeniusPaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  amount: number | string;
  courseName: string;
  courseId: string;
  token: string | null;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  type?: 'attendance' | 'material' | 'assessment' | 'audio' | 'portal_entry' | 'republish';
  onPaymentReference?: (ref: string) => void; // Called with the reference just before onSuccess for republish
}

type Gateway = 'paystack' | 'kora';

export default function GeniusPaymentModal({ onClose, onSuccess, amount, courseName, courseId, token, addToast, type = 'attendance', onPaymentReference }: GeniusPaymentModalProps) {
  const MAX_AUTO_RETRY = 1;
  // Guard: once the user explicitly closes this modal, suppress any further onClose/onSuccess calls
  const closedRef = React.useRef(false);
  const safeClose = React.useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  const [gatewaysStatus, setGatewaysStatus] = useState<{ paystack: boolean, kora: boolean } | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(Number(amount) || 0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [isExpired, setIsExpired] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
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

  // Fetch active gateways configuration on mount
  useEffect(() => {
    fetch('/api/payment/gateways')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
           setGatewaysStatus(data);
           // Always show the selection screen; never auto-select silently
        } else {
           setGatewaysStatus({ paystack: true, kora: true }); // Fallback
        }
      })
      .catch((err) => {
        console.error('Failed to fetch gateway config:', err);
        setGatewaysStatus({ paystack: true, kora: true }); // Fallback
      });
  }, []);

  // Initialize the transaction once gateway is chosen
  const initializePayment = async (selectedGateway: Gateway, options: { isRetry?: boolean } = {}) => {
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
      let endpoint = '/api/payment/attendance/initialize';
      let body: any = { amount, course_id: courseId, gateway: selectedGateway };

      if (type === 'material') {
        endpoint = '/api/payment/material/initialize';
        body = { amount, resource_id: parseInt(courseId), gateway: selectedGateway, mode: 'inline' };
      } else if (type === 'assessment') {
        endpoint = '/api/payment/assessment/initialize';
        body = { amount, exam_id: parseInt(courseId), gateway: selectedGateway, mode: 'inline' };
      } else if (type === 'audio') {
        addToast('Audio payments are temporarily unavailable while the secure flow is being finalized.', 'info');
        safeClose();
        return;
      } else if (type === 'portal_entry') {
        endpoint = '/api/payment/portal-entry/initialize';
        body = { amount, gateway: selectedGateway, mode: 'inline' };
      } else if (type === 'republish') {
        endpoint = '/api/payment/initialize';
        body = { amount, type: 'republish', gateway: selectedGateway, mode: 'inline' };
      } else {
        // Attendance
        body = { amount, course_id: courseId, gateway: selectedGateway, mode: 'inline' };
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
        const displayAmount = Number(data.amount_naira ?? amount ?? data.amount ?? 0);
        setPaymentAmount(displayAmount);
        setExpiresAt(data.expires_at);
        if (data.remaining_amount !== undefined) {
          setRemainingAmount(Number(data.remaining_amount));
          if (Number(data.remaining_amount) > 0 && Number(data.credit_used || 0) > 0) {
            setPaidSoFar(Number(data.credit_used));
          }
        }
        if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
          addToast('Wallet credit applied. Access unlocked.', 'success');
          completeVerifiedPayment();
          return;
        }
      } else {
        addToast(data.error || 'Failed to initialize payment', 'error');
        safeClose();
      }
    } catch (err: any) {
      addToast(friendlyError(err, 'payment'), 'error');
      safeClose();
    } finally {
      setLoading(false);
    }
  };

  const handleGatewaySelect = (selectedGateway: Gateway) => {
    setGateway(selectedGateway);
    initializePayment(selectedGateway);
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

    if (gateway === 'paystack' && window.PaystackPop && data?.publicKey) {
      const fallbackAmount = Number(data?.amount_naira ?? paymentAmount ?? amount ?? 0);
      const amountKobo = Number(data?.amount_kobo ?? data?.amount ?? 0) || Math.round(fallbackAmount * 100);
      const email = data?.email || data?.customer?.email || '';
      const handler = window.PaystackPop.setup({
        key: data.publicKey,
        email,
        amount: amountKobo,
        currency: data.currency || 'NGN',
        ref: reference,
        onClose: () => {
          if (isConfirmed || isPaymentCancelled) return;
          if (!isAutoRetrying && autoRetryCount < MAX_AUTO_RETRY && gateway) {
            setIsAutoRetrying(true);
            setAutoRetryCount((count) => count + 1);
            addToast('Checkout closed. Reinitializing a fresh reference...', 'info');
            if (retryMode === 'topup') {
              void handlePayRemaining().finally(() => setIsAutoRetrying(false));
            } else {
              void initializePayment(gateway, { isRetry: true }).finally(() => setIsAutoRetrying(false));
            }
            return;
          }
          setNeedsNewReference(true);
          addToast('Payment window closed. Generate a new checkout to retry.', 'info');
        },
        callback: () => {
          void verifyPaymentStatus(true, reference);
        }
      });
      handler.openIframe();
      return;
    }

    if (gateway === 'kora' && window.Korapay && data?.publicKey) {
      const amountNaira = Number(data?.amount_naira ?? data?.amount ?? paymentAmount ?? amount ?? 0);
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
          if (isConfirmed || isPaymentCancelled) return;
          if (!isAutoRetrying && autoRetryCount < MAX_AUTO_RETRY && gateway) {
            setIsAutoRetrying(true);
            setAutoRetryCount((count) => count + 1);
            addToast('Checkout closed. Reinitializing a fresh reference...', 'info');
            if (retryMode === 'topup') {
              void handlePayRemaining().finally(() => setIsAutoRetrying(false));
            } else {
              void initializePayment(gateway, { isRetry: true }).finally(() => setIsAutoRetrying(false));
            }
            return;
          }
          setNeedsNewReference(true);
          addToast('Payment window closed. Generate a new checkout to retry.', 'info');
        },
        onSuccess: () => {
          void verifyPaymentStatus(true, reference);
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
    if (!paymentRef || !token || !gateway) return;
    setRetryMode('topup');
    setIsTopupLoading(true);
    try {
      const res = await fetch('/api/payment/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reference: paymentRef, gateway, mode: 'inline' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Top-up failed');

      if (data.credit_used) {
        setCreditUsed(Number(data.credit_used));
      }
      if (data.remaining_amount !== undefined) {
        setRemainingAmount(Number(data.remaining_amount));
      }
      setCheckoutData(data);
      // Update paymentRef to topup reference so polling and callbacks verify the correct transaction
      if (data.reference && data.reference !== paymentRef) {
        setPaymentRef(data.reference);
      }

      if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
        addToast('Wallet credit applied. Access unlocked.', 'success');
        completeVerifiedPayment();
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
      addToast(friendlyError(err, 'payment'), 'error');
    } finally {
      setIsTopupLoading(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!paymentRef || !token) return;
    setIsCancelling(true);
    try {
      const response = await fetch('/api/payment/abandon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
      addToast(friendlyError(err, 'payment'), 'error');
    } finally {
      setIsCancelling(false);
    }
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

  const completeVerifiedPayment = (ref?: string) => {
    if (isConfirmed) return;
    setIsConfirmed(true);
    if (onPaymentReference && (ref || paymentRef)) {
      onPaymentReference(ref || paymentRef);
    }
    addToast('Payment confirmed.', 'success');
    onSuccess();
  };

  const verifyPaymentStatus = async (silent = false, refOverride?: string) => {
    const ref = refOverride || paymentRef;
    if (!ref || !token || isConfirmed) return;

    if (!silent) {
      setIsVerifying(true);
    }

    try {
      const response = await fetch(`/api/payment/verify/${ref}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to verify payment right now.');
      }

      const paidSoFarValue = Number(data?.paid_so_far || 0);
      const remainingValue = Number(data?.remaining_amount || Math.max(paymentAmount - paidSoFarValue, 0));
      const overpaidValue = Number(data?.overpaid || 0);

      if (data.status === 'success' || data.status === 'consumed') {
        if (paidSoFarValue > 0) setPaidSoFar(paidSoFarValue);
        setRemainingAmount(0);
        if (overpaidValue > 0) setOverpaidAmount(overpaidValue);
        completeVerifiedPayment();
        return;
      }

      if (data.status === 'partially_paid') {
        setPaidSoFar(paidSoFarValue);
        setRemainingAmount(remainingValue);
        if (!silent) {
          addToast(`Underpayment detected. Remaining ₦${remainingValue.toLocaleString()}.`, 'error');
        }
        return;
      }

      if (!silent) {
        addToast('Payment is still pending bank confirmation. Please check again shortly.', 'info');
      }
    } catch (err: any) {
      if (!silent) {
        addToast(friendlyError(err, 'payment'), 'error');
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

  useEffect(() => {
    if (paymentRef) setNeedsNewReference(false);
  }, [paymentRef]);

  useEffect(() => {
    if (!paymentRef || !token || isConfirmed) return;
    const unsubscribe = subscribePaymentReturn((message) => {
      if (message.reference && message.reference !== paymentRef) return;
      void verifyPaymentStatus(true);
    });
    return unsubscribe;
  }, [paymentRef, token, isConfirmed]);

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
        <div className="md:w-5/12 bg-gradient-to-br from-[#800000] to-red-900 p-8 md:p-10 text-white flex flex-col items-center md:items-start text-center md:text-left relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-900/40 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
          
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md relative z-10 border border-white/20">
            <ShieldUser size={24} className="text-white" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight leading-tight relative z-10">
            {type === 'portal_entry' ? 'Portal Access' : type === 'attendance' ? 'Sign Attendance' : type === 'material' ? 'Unlock Material' : type === 'audio' ? 'Unlock Audio' : type === 'republish' ? 'Republish Manuscript' : 'Unlock Assessment'}
          </h2>
          <p className="text-red-100 mb-8 font-medium leading-relaxed relative z-10 text-sm">
            Pay the required token to access <span className="font-bold text-white">{courseName}</span>.
          </p>

          <div className="space-y-4 w-full relative z-10 mt-auto">
            <div className="flex items-center gap-3 text-red-100 text-sm">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium">Automatic roster update</span>
            </div>
            <div className="flex items-center gap-3 text-red-100 text-sm">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium">{gateway ? gatewayLabel : 'Secure Payment Gateway'}</span>
            </div>
            <div className="flex items-center gap-3 text-red-100 text-sm">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <span className="font-medium">Valid for today's session only</span>
            </div>
          </div>
        </div>

        {/* Right Side: Action & Details */}
        <div className="flex-1 p-8 md:p-10 flex flex-col bg-white overflow-y-auto relative">
          <button
            onClick={safeClose}
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          {/* ── STEP 1: Gateway Selection ── */}
          {!gateway ? (
            <div className="flex-1 flex flex-col justify-center">
              {!gatewaysStatus ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-[#800000] mb-4" size={40} />
                  <p className="text-slate-500 font-bold animate-pulse text-sm">Checking available payment methods...</p>
                </div>
              ) : !gatewaysStatus.paystack && !gatewaysStatus.kora ? (
                <div className="text-center py-8">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                     <AlertCircle size={32} />
                   </div>
                   <h3 className="text-xl font-black text-slate-900 mb-2">Payments Disabled</h3>
                   <p className="text-slate-500 text-sm font-medium mb-8">All payment gateways are currently inactive. Please contact your administrator.</p>
                   <button onClick={safeClose} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors w-full">
                     Close Window
                   </button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-slate-900 mb-1">Choose Payment Gateway</h3>
                  <p className="text-slate-500 text-sm font-medium mb-8">Select your preferred payment provider to continue.</p>

                  <div className="space-y-4">
                    {/* Paystack Option */}
                    {gatewaysStatus.paystack && (
                      <button
                        onClick={() => handleGatewaySelect('paystack')}
                        className="w-full group flex items-center gap-5 p-5 rounded-2xl border-2 border-slate-100 hover:border-red-400 hover:bg-red-50/40 transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0 group-hover:bg-[#800000] transition-colors">
                          <CreditCard size={22} className="text-[#800000] group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-slate-900 text-base">Standard Gateway</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Secure checkout via card, transfer or USSD</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-red-500 transition-colors" />
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
                    Both gateways are secure. Select either to open a secure payment window.
                  </p>
                </>
              )}
            </div>
          ) : loading ? (
            /* ── Loading ── */
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-[#800000] mb-4" size={40} />
              <p className="text-slate-500 font-bold animate-pulse text-sm">Generating secure transaction via {gateway === 'kora' ? 'Kora' : 'Paystack'}...</p>
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
                onClick={safeClose}
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
                    Via <span className="font-bold text-[#800000]">{gateway === 'kora' ? 'Kora' : 'Paystack'}</span>
                    {' — '}Complete payment to {type === 'attendance' ? "log today's attendance" : type === 'republish' ? 'trigger republication' : "gain instant access"}.
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{type === 'attendance' ? 'Course' : type === 'material' ? 'Material ID' : type === 'republish' ? 'Paper ID' : 'Assessment ID'}</p>
                  <p className="font-bold text-slate-700">{courseId}</p>
                </div>
              </div>

              {/* Bank Transfer Instructions */}
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Complete your payment of ₦{formattedAmount}:</p>

                {remainingAmount !== null && remainingAmount > 0 && (() => {
                  const paid = paidSoFar || 0;
                  const total = paymentAmount;
                  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                  return (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Partial Payment Detected</span>
                          <span className="text-[10px] font-black text-amber-600">{pct}% received</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden mb-3">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white rounded-xl p-2 border border-amber-100">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Required</p>
                            <p className="font-black text-slate-700 text-sm">₦{total.toLocaleString()}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 border border-emerald-100">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Received</p>
                            <p className="font-black text-emerald-600 text-sm">₦{paid.toLocaleString()}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 border border-rose-100">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Outstanding</p>
                            <p className="font-black text-rose-600 text-sm">₦{remainingAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4">
                        <button
                          onClick={handlePayRemaining}
                          disabled={isTopupLoading}
                          className="w-full bg-amber-600 text-white py-3 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isTopupLoading ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Pay Outstanding ₦${remainingAmount.toLocaleString()}`}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {creditUsed !== null && creditUsed > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Wallet Credit Applied</p>
                    <p className="font-black text-[#800000] text-sm">₦{creditUsed.toLocaleString()} deducted from your wallet balance.</p>
                  </div>
                )}

                {overpaidAmount !== null && overpaidAmount > 0 && (() => {
                  const expectedFmt = paymentAmount.toLocaleString();
                  const overpaidFmt = overpaidAmount.toLocaleString();
                  return (
                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden">
                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Confirmed — Overpayment Detected</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white rounded-xl p-2 border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Expected</p>
                            <p className="font-black text-slate-700 text-sm">₦{expectedFmt}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 border border-amber-100">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Excess Paid</p>
                            <p className="font-black text-amber-600 text-sm">+₦{overpaidFmt}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4 text-xs text-emerald-700 font-medium leading-relaxed">
                        Your access has been granted. The excess ₦{overpaidFmt} will be credited to your wallet automatically and can be used for future payments.
                      </div>
                    </div>
                  );
                })()}
                
                {(checkoutUrl || (checkoutData && checkoutData.publicKey)) ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                    <p className="text-sm font-bold text-slate-700 mb-4">A secure {gateway === 'kora' ? 'Kora' : 'Paystack'} checkout window has been opened.</p>
                    <button
                      onClick={() => {
                        if (checkoutData) {
                          openInlineCheckout(checkoutData);
                        } else {
                          openCheckoutPopup(checkoutUrl);
                        }
                      }}
                      className="inline-block px-6 py-3 bg-[#800000] text-white rounded-xl font-bold hover:bg-red-900 transition"
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
                    {needsNewReference && gateway && (
                      <div className="mt-3 text-[11px] text-amber-600 font-bold">
                        This reference was already used.{' '}
                        <button
                          onClick={() => initializePayment(gateway)}
                          className="underline"
                        >
                          Generate a new checkout
                        </button>
                      </div>
                    )}
                  </div>
                ) : <div className="space-y-3">
                  {bankAccounts.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-100">
                      Initializing secure payment window...
                    </p>
                  ) : (
                    bankAccounts.map((acct, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border-2 border-red-50 hover:border-red-100 transition-all group flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block mb-1">{acct.bankName}</span>
                          <span className="text-xl font-mono font-black tracking-widest text-slate-900">{acct.accountNumber}</span>
                          <span className="block text-xs text-slate-500 font-medium mt-1">{acct.accountName}</span>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(acct.accountNumber)}
                          className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#800000] hover:bg-red-50 transition-colors"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    ))
                  )}
                  {paymentRef && (
                    <div className="text-center">
                      <button
                        onClick={handleCancelPayment}
                        disabled={isCancelling}
                        className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline underline-offset-2 disabled:opacity-50"
                      >
                        {isCancelling ? 'Cancelling...' : 'Cancel payment'}
                      </button>
                    </div>
                  )}
                </div>}
              </div>

              {/* Change Gateway Link */}
              {gatewaysStatus && gatewaysStatus.paystack && gatewaysStatus.kora && (
                <div className="mb-4 text-center">
                  <button
                    onClick={() => {
                      setGateway(null);
                      setBankAccounts([]);
                      setCheckoutUrl(null);
                      setPaymentRef('');
                      setPaymentAmount(Number(amount) || 0);
                      setExpiresAt(null);
                      setTimeLeft('--:--');
                      setIsExpired(false);
                      setIsConfirmed(false);
                      setPaidSoFar(null);
                      setRemainingAmount(null);
                      setOverpaidAmount(null);
                      setPopupBlocked(false);
                      setCreditApplied(false);
                      setCreditUsed(null);
                      setInlineRef(null);
                      setNeedsNewReference(false);
                      setCheckoutData(null);
                      setAutoRetryCount(0);
                      setIsAutoRetrying(false);
                      setIsPaymentCancelled(false);
                      setRetryMode('init');
                    }}
                    className="text-xs text-slate-400 hover:text-[#800000] underline underline-offset-2 transition-colors"
                  >
                    Switch gateway
                  </button>
                </div>
              )}

              {/* Verification Button */}
              <div className="mt-auto">
                <button
                  onClick={() => void verifyPaymentStatus(false)}
                  disabled={isVerifying || isExpired || (bankAccounts.length === 0 && !checkoutUrl && !(checkoutData && checkoutData.publicKey)) || isConfirmed}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-[#800000] transition-all disabled:opacity-50"
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
