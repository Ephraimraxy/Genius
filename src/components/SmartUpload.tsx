import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle, Trash2, ArrowRight, Eye, Plus, Save, Pencil, User, Copy, Clock, PartyPopper, Zap } from 'lucide-react';
import FilePreviewModal from './FilePreviewModal';
import { openPaymentPopup } from './paymentPopup';
import { subscribePaymentReturn } from './paymentChannel';

declare global {
  interface Window {
    PaystackPop: any;
    Korapay: any;
  }
}

import { ToastType } from './ToastSystem';

export default function SmartUpload({ 
  onUploadComplete, 
  addToast,
  profile,
  onNavigate,
  onQuickPublish
}: { 
  onUploadComplete: (id: number) => void,
  addToast: (message: string, type?: ToastType) => void,
  profile?: any,
  onNavigate?: (tab: string) => void,
  onQuickPublish?: () => void
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [isConfirmingDetails, setIsConfirmingDetails] = useState(false);
  const [researcherName, setResearcherName] = useState(profile?.name || '');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [isPaying, setIsPaying] = useState(false);
  const [paperId, setPaperId] = useState<number | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [paidSoFar, setPaidSoFar] = useState<number | null>(null);
  const [remainingAmount, setRemainingAmount] = useState<number | null>(null);
  const [overpaidAmount, setOverpaidAmount] = useState<number | null>(null);
  const [creditApplied, setCreditApplied] = useState(false);
  const [creditUsed, setCreditUsed] = useState<number | null>(null);
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreedGuidelines, setAgreedGuidelines] = useState(false);
  const [agreedRefund, setAgreedRefund] = useState(false);
  const [gatewaysStatus, setGatewaysStatus] = useState<{ paystack: boolean; kora: boolean } | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'paystack' | 'kora' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildStructuralAudit = (validationResult: any) => {
    if (!validationResult) return null;
    const missingRaw = Array.isArray(validationResult?.sections?.missing) ? validationResult.sections.missing : [];
    const missing = missingRaw.map((item: any) => String(item || '').toLowerCase());
    const baseSections = ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion'];

    if (missing.length === 0 && !Array.isArray(validationResult?.sections?.found)) {
      return [{
        name: 'Structure Check',
        status: validationResult.isValid ? 'ok' : 'warning',
        msg: validationResult.isValid ? '' : 'Structure requires review.'
      }];
    }

    return baseSections.map((name) => {
      const key = name.toLowerCase();
      const isMissing = missing.some((value: string) => value.includes(key));
      return {
        name,
        status: isMissing ? 'error' : 'ok',
        msg: isMissing ? 'Section not detected in manuscript.' : ''
      };
    });
  };

  useEffect(() => {
    if (metadata) {
      setEditedMetadata(JSON.parse(JSON.stringify(metadata)));
    }
  }, [metadata]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/payment/gateways')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const status = {
          paystack: data?.paystack !== false,
          kora: data?.kora !== false
        };
        setGatewaysStatus(status);
      })
      .catch(() => {
        if (!isMounted) return;
        setGatewaysStatus({ paystack: true, kora: true });
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateMetadata = async () => {
    if (!paperId || !editedMetadata) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${(import.meta as any).env.VITE_API_URL || ''}/api/papers/${paperId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: editedMetadata.title,
          authors: editedMetadata.authors,
          abstract: editedMetadata.abstract
        })
      });
      if (!res.ok) throw new Error('Failed to save changes');
      const data = await res.json();
      setMetadata(data.metadata);
      setIsEditing(false);
      addToast('Manuscript details synchronized!', 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateAuthor = (idx: number, updates: any) => {
    const newAuthors = [...editedMetadata.authors];
    newAuthors[idx] = { ...newAuthors[idx], ...updates };
    setEditedMetadata({ ...editedMetadata, authors: newAuthors });
  };

  const addAuthor = () => {
    setEditedMetadata({
      ...editedMetadata,
      authors: [...(editedMetadata.authors || []), { name: 'New Author', email: '', department: '' }]
    });
  };

  const removeAuthor = (idx: number) => {
    const newAuthors = editedMetadata.authors.filter((_: any, i: number) => i !== idx);
    setEditedMetadata({ ...editedMetadata, authors: newAuthors });
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      const verifyPayment = async () => {
        setIsPaying(true);
        try {
          const res = await fetch(`/api/payment/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const data = await res.json();
          if (data.status === 'success') {
            setHasPaid(true);
            addToast('Neural Registry Unlocked. Payment Verified!', 'success');
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            addToast('Payment verification failed. Please contact support.', 'error');
          }
        } catch (e) {
          addToast('Network error during verification.', 'error');
        } finally {
          setIsPaying(false);
        }
      };
      verifyPayment();
    } else {
      // No URL reference — check for unused publication credit from a previous payment
      (async () => {
        try {
          const res = await fetch('/api/payment/credit', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const data = await res.json();
          if (data.hasCredit) {
            setHasPaid(true);
          }
        } catch (e) { /* silent */ }
      })();
    }
  }, []);

  useEffect(() => {
    fetch('/api/settings/price').then(res => res.json()).then(data => setPrice(data.price));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResearcherName(profile?.name || '');
    setPendingFile(file);
    setIsConfirmingDetails(true);
  };

  const proceedWithUpload = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    setIsConfirmingDetails(false);
    setSelectedFile(file);
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('researcherName', researcherName);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setMetadata(data.metadata);
      setPaperId(data.id);
      onUploadComplete(data.id);

      // Inform user and auto-navigate after a brief delay
      addToast('Submission received. Editorial screening and refinement are now underway.', 'success');
      
      if (onNavigate) {
        setTimeout(() => {
          onNavigate('apa_validation');
        }, 4000);
      }

      // Now validate structure
      setIsUploading(false);
      setIsValidating(true);

      const valRes = await fetch(`/api/manuscript/validate-apa/${data.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phase: 0 })
      });
      if (valRes.ok) {
        const valData = await valRes.json();
        setValidation(buildStructuralAudit(valData.validation));
        addToast('Manuscript ingestion and audit complete!', 'success');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  };

  const handlePayment = async () => {
    if (!agreedGuidelines || !agreedRefund) {
      setShowAgreement(true);
      return;
    }
    if (gatewaysStatus && !gatewaysStatus.paystack && !gatewaysStatus.kora) {
      setError('All payment gateways are currently disabled. Please contact support.');
      return;
    }
    if (!selectedGateway) {
      setError('Select a payment gateway to continue.');
      return;
    }
    setIsPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount: price, gateway: selectedGateway, mode: 'checkout' })
      });
      const data = await res.json();
      if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
        setHasPaid(true);
        setCreditApplied(true);
        setCreditUsed(Number(data.credit_used || 0) || null);
        setIsVerifying(false);
        setBankAccounts([]);
        setCheckoutUrl(null);
        setPaymentRef(data.reference || null);
        addToast('Wallet credit applied. You can now upload your manuscript.', 'success');
        return;
      }
      if (data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        setPaidSoFar(null);
        setRemainingAmount(null);
        setOverpaidAmount(null);
        setPopupBlocked(false);
        setCreditApplied(Boolean(data.credit_applied));
        setCreditUsed(Number(data.credit_used || 0) || null);
        if (data.remaining_amount !== undefined) {
          setRemainingAmount(Number(data.remaining_amount));
          if (Number(data.remaining_amount) > 0 && Number(data.credit_used || 0) > 0) {
            setPaidSoFar(Number(data.credit_used));
          }
        }
        if (data.publicKey && data.reference) {
          openCheckoutPopup(data);
        } else if (data.checkout_url) {
          openCheckoutPopup(data.checkout_url);
        }
        setPaymentRef(data.reference || ''); 
        setIsVerifying(true);
        setExpiresAt(new Date(Date.now() + 30 * 60000).toISOString());
        addToast('Secure checkout opened. Complete your payment to proceed.', 'info');
        return;
      }
      if (data.bankAccounts && data.bankAccounts.length > 0) {
        setBankAccounts(data.bankAccounts);
        setPaymentRef(data.reference);
        setIsVerifying(true);
        setExpiresAt(new Date(Date.now() + 30 * 60000).toISOString());
        setCreditApplied(Boolean(data.credit_applied));
        setCreditUsed(Number(data.credit_used || 0) || null);
        if (data.remaining_amount !== undefined) {
          setRemainingAmount(Number(data.remaining_amount));
          if (Number(data.remaining_amount) > 0 && Number(data.credit_used || 0) > 0) {
            setPaidSoFar(Number(data.credit_used));
          }
        }
        addToast('Virtual accounts created. Transfer the exact amount to proceed.', 'info');
      } else if (data.authorization_url) {
        setCheckoutUrl(data.authorization_url);
        setPaidSoFar(null);
        setRemainingAmount(null);
        setOverpaidAmount(null);
        setPopupBlocked(false);
        setCreditApplied(Boolean(data.credit_applied));
        setCreditUsed(Number(data.credit_used || 0) || null);
        if (data.remaining_amount !== undefined) {
          setRemainingAmount(Number(data.remaining_amount));
          if (Number(data.remaining_amount) > 0 && Number(data.credit_used || 0) > 0) {
            setPaidSoFar(Number(data.credit_used));
          }
        }
        if (data.publicKey && data.reference) {
          openCheckoutPopup(data);
        } else if (data.authorization_url) {
          openCheckoutPopup(data.authorization_url);
        }
        setPaymentRef(data.reference || '');
        setIsVerifying(true);
        setExpiresAt(new Date(Date.now() + 30 * 60000).toISOString());
        addToast('Secure checkout opened. Complete your payment to proceed.', 'info');
      } else {
        throw new Error(data.error || 'Payment gateway error. Please try again.');
      }
    } catch (err: any) {
      setError(err.message);
      addToast(err.message || 'Payment initialization failed', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handlePaystackSDK = (data: any) => {
    if (!window.PaystackPop) {
      addToast('Paystack SDK not loaded yet. Please wait or refresh.', 'error');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: data.publicKey,
      email: data.email,
      amount: Math.round(data.amount * 100), // in kobo
      currency: data.currency || 'NGN',
      ref: data.reference,
      onClose: () => {
        addToast('Payment window closed.', 'info');
      },
      callback: (response: any) => {
        console.log('Paystack success response:', response);
        verifyPaymentOnce();
      }
    });
    handler.openIframe();
  };

  const handleKoraSDK = (data: any) => {
    if (!window.Korapay) {
      addToast('Kora SDK not loaded yet. Please wait or refresh.', 'error');
      return;
    }

    window.Korapay.initialize({
      key: data.publicKey,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency || "NGN",
      customer: {
        email: data.email,
        name: researcherName || ""
      },
      onClose: () => {
        addToast('Payment window closed.', 'info');
      },
      onSuccess: (response: any) => {
        console.log('Kora success response:', response);
        verifyPaymentOnce();
      }
    });
  };

  const openCheckoutPopup = (data: any) => {
    if (selectedGateway === 'paystack') {
      handlePaystackSDK(data);
    } else if (selectedGateway === 'kora') {
      handleKoraSDK(data);
    } else if (data.checkout_url) {
      // Fallback
      window.open(data.checkout_url, '_blank', 'width=600,height=700');
    }
  };

  const handlePayRemaining = async () => {
    if (!paymentRef) return;
    setIsTopupLoading(true);
    try {
      const res = await fetch('/api/payment/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reference: paymentRef, gateway: selectedGateway })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Top-up failed');

      if (data.credit_used) setCreditUsed(Number(data.credit_used));
      if (data.remaining_amount !== undefined) setRemainingAmount(Number(data.remaining_amount));

      if (data.credit_applied && Number(data.remaining_amount || 0) === 0) {
        setHasPaid(true);
        addToast('Wallet credit applied. You can now upload your manuscript.', 'success');
        return;
      }

      if (data.publicKey && data.reference) {
        openCheckoutPopup(data);
      } else if (data.checkout_url) {
        openCheckoutPopup(data.checkout_url);
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

  const verifyPaymentOnce = async () => {
    if (!paymentRef) return;
    try {
      const res = await fetch(`/api/payment/verify/${paymentRef}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const paidSoFarValue = Number(data?.paid_so_far || 0);
      const remainingValue = Number(data?.remaining_amount || Math.max(price - paidSoFarValue, 0));
      const overpaidValue = Number(data?.overpaid || 0);

      if (data.status === 'success') {
        setHasPaid(true);
        setIsVerifying(false);
        setBankAccounts([]);
        setExpiresAt(null);
        if (paidSoFarValue > 0) setPaidSoFar(paidSoFarValue);
        setRemainingAmount(0);
        if (overpaidValue > 0) setOverpaidAmount(overpaidValue);
        addToast('Payment confirmed! You can now upload your manuscript.', 'success');
      } else if (data.status === 'partially_paid') {
        setPaidSoFar(paidSoFarValue);
        setRemainingAmount(remainingValue);
        addToast(`Partial payment detected. Remaining ₦${remainingValue.toLocaleString()}.`, 'error');
      }
    } catch {
      // silent
    }
  };

// Poll for payment confirmation after virtual accounts are shown
  useEffect(() => {
    if (!isVerifying || !paymentRef) return;
    const interval = setInterval(async () => {
      void verifyPaymentOnce();
    }, 8000);
    return () => clearInterval(interval);
  }, [isVerifying, paymentRef]);

  useEffect(() => {
    if (!paymentRef) return;
    const unsubscribe = subscribePaymentReturn((message) => {
      if (message.reference && message.reference !== paymentRef) return;
      void verifyPaymentOnce();
    });
    return unsubscribe;
  }, [paymentRef, price]);

  // Countdown Timer Effect
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const exp = new Date(expiresAt).getTime();
      const difference = exp - now;

      if (difference <= 0) {
        clearInterval(timer);
        setIsVerifying(false);
        setBankAccounts([]);
        setPaymentRef(null);
        setExpiresAt(null);
        setPaidSoFar(null);
        setRemainingAmount(null);
        setOverpaidAmount(null);
        setPopupBlocked(false);
        setCreditApplied(false);
        setCreditUsed(null);
        setError('Virtual account expired. Please initialize checkout again.');
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-10 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-display">Manuscript Ingestion</h2>
          <p className="text-lg text-slate-500 mt-2 font-medium">Upload research documents for neural metadata extraction and structural auditing.</p>
        </div>
        {metadata && (
          <button
            onClick={() => { setMetadata(null); setValidation(null); }}
            className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-bold border border-rose-100 hover:bg-rose-100 transition-all shadow-sm shadow-rose-100/50"
          >
            <Trash2 size={18} />
            Reset Session
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!hasPaid ? (
          <motion.div
            key="payment-gate"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[3rem] border border-slate-200 p-20 shadow-2xl shadow-slate-200/50 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#800000]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="w-24 h-24 bg-[#800000]/10 rounded-3xl flex items-center justify-center mb-8 relative z-10">
              <span className="text-[#800000] text-5xl font-black">₦</span>
            </div>
            
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight relative z-10">Publication Fee Required</h3>
            <p className="text-slate-500 max-w-lg mb-12 text-lg font-medium relative z-10">
              To maintain our global neural registry and instant DOI assignment, a one-time fee is required per manuscript ingestion.
            </p>

            <div className="bg-slate-50 rounded-3xl p-8 mb-12 w-full max-w-md border border-slate-100 relative z-10">
               <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ingestion Fee</span>
                  <span className="text-2xl font-black text-[#800000]">₦{price.toLocaleString()}</span>
               </div>
               <div className="h-px bg-slate-200 w-full mb-4"></div>
               <div className="flex items-center gap-3 text-emerald-600">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Instant Portal Unlock</span>
               </div>
            </div>

            {gatewaysStatus && bankAccounts.length === 0 && (
              <div className="w-full max-w-md mb-10 relative z-10">
                {!gatewaysStatus.paystack && !gatewaysStatus.kora ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
                    All payment gateways are currently disabled. Please contact support.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Payment Method</label>
                    <div className="grid gap-3">
                      {gatewaysStatus.paystack && (
                        <button
                          type="button"
                          onClick={() => setSelectedGateway('paystack')}
                          disabled={isPaying}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                            selectedGateway === 'paystack'
                              ? 'border-[#800000] bg-[#800000]/5 text-[#800000]'
                              : 'border-slate-200 text-slate-700 hover:border-[#800000]/40'
                          }`}
                        >
                          Paystack
                          <span className="block text-[11px] text-slate-400 font-medium mt-1">Card, bank transfer, USSD, and more</span>
                        </button>
                      )}
                      {gatewaysStatus.kora && (
                        <button
                          type="button"
                          onClick={() => setSelectedGateway('kora')}
                          disabled={isPaying}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                            selectedGateway === 'kora'
                              ? 'border-[#800000] bg-[#800000]/5 text-[#800000]'
                              : 'border-slate-200 text-slate-700 hover:border-[#800000]/40'
                          }`}
                        >
                          Kora Checkout
                          <span className="block text-[11px] text-slate-400 font-medium mt-1">Card, bank transfer, pay with bank</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-3">Available methods are controlled by Super Admin settings.</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 relative z-10 max-w-md w-full">
                <AlertCircle size={18} className="text-rose-500 shrink-0" />
                <p className="text-sm font-bold text-rose-700">{error}</p>
              </div>
            )}

            {remainingAmount !== null && remainingAmount > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold max-w-md w-full space-y-3">
                <div>
                  Partial payment detected. Paid ₦{(paidSoFar || 0).toLocaleString()}. Remaining ₦{remainingAmount.toLocaleString()}.
                </div>
                <button
                  onClick={handlePayRemaining}
                  disabled={isTopupLoading}
                  className="w-full bg-amber-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {isTopupLoading ? 'Processing...' : 'Pay Remaining Balance'}
                </button>
              </div>
            )}

            {creditUsed !== null && creditUsed > 0 && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-700 text-sm font-bold max-w-md w-full">
                Wallet credit applied: ₦{creditUsed.toLocaleString()}.
              </div>
            )}

            {overpaidAmount !== null && overpaidAmount > 0 && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm font-bold max-w-md w-full">
                Overpayment of ₦{overpaidAmount.toLocaleString()} recorded. Support will reconcile or credit this amount.
              </div>
            )}

            {checkoutUrl ? (
              <div className="w-full max-w-lg relative z-10 space-y-6">
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center shadow-sm">
                  <h3 className="text-xl font-black text-indigo-900 mb-2">Checkout Details</h3>
                  <p className="text-sm font-medium text-indigo-700 mb-6">A secure Paystack payment window has been opened. Please complete your transaction.</p>
                  <button
                    onClick={() => openCheckoutPopup(checkoutUrl)}
                    className="inline-block px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/30"
                  >
                    Open Payment Gateway
                  </button>
                  {popupBlocked && (
                    <div className="mt-3 text-[11px] text-slate-500">
                      Popup blocked? <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="underline">Open in new tab</a>
                    </div>
                  )}
                </div>

                {isVerifying && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="animate-spin text-[#800000]" size={20} />
                    <span className="text-sm font-bold text-slate-500">Listening for payment confirmation...</span>
                  </div>
                )}
              </div>
            ) : bankAccounts.length > 0 ? (
              <div className="w-full max-w-lg relative z-10 space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-emerald-600 animate-pulse" />
                    <div>
                      <p className="text-sm font-black text-emerald-800">Transfer ₦{price.toLocaleString()} to complete</p>
                      <p className="text-xs text-emerald-600 font-medium">Payment will auto-confirm after transfer.</p>
                    </div>
                  </div>
                  <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg flex flex-col items-center justify-center border border-emerald-200 shadow-sm min-w-[70px]">
                     <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-70 mb-0.5">Expires In</span>
                     <span className="font-mono text-sm font-black grid place-items-center w-full">{timeLeft}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {bankAccounts.map((acct: any, idx: number) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acct.bankName || 'Bank Account'}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(acct.accountNumber);
                            addToast('Account number copied!', 'success');
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-all border border-slate-100"
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      <p className="text-3xl font-black text-slate-900 tracking-wider font-mono">{acct.accountNumber}</p>
                      <p className="text-xs font-bold text-slate-500 mt-2">{acct.accountName || 'GMIJP Publication'}</p>
                    </div>
                  ))}
                </div>

                {isVerifying && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="animate-spin text-[#800000]" size={20} />
                    <span className="text-sm font-bold text-slate-500">Listening for payment confirmation...</span>
                  </div>
                )}
              </div>
            ) : (
              selectedGateway && (
                <button
                  onClick={handlePayment}
                  disabled={isPaying || (!!gatewaysStatus && !gatewaysStatus.paystack && !gatewaysStatus.kora)}
                  className="px-12 py-5 premium-gradient text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-[#800000]/30 hover:scale-105 transition-all flex items-center gap-4 disabled:opacity-50 relative z-10"
                >
                  {isPaying ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <span className="text-xl font-bold">₦</span>
                      {selectedGateway === 'kora' ? 'Open Kora Checkout' : 'Generate Transfer Account'}
                    </>
                  )}
                </button>
              )
            )}
          </motion.div>
        ) : !metadata ? (
          <motion.div
            key="upload-zone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`
              relative group border-2 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center text-center transition-all duration-500
              ${isUploading
                ? 'border-indigo-400 bg-indigo-50/30'
                : 'border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/50 cursor-pointer shadow-xl shadow-slate-200/20'}
            `}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />

            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Neural Analysis in Progress</h3>
                <p className="text-slate-500 max-w-sm font-medium leading-relaxed">
                  Extracting semantic entities, mapping citations, and validating document architecture...
                </p>
              </div>
            ) : (
              <>
                <div className="w-28 h-28 premium-gradient rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-500">
                  <UploadCloud className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Drop manuscript here</h3>
                <p className="text-slate-500 mb-10 text-lg font-medium">Supports .docx and .pdf up to 50MB</p>
                <button className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl shadow-slate-900/20 hover:bg-indigo-600 transition-all group/btn flex items-center gap-3">
                  Browse Workstation
                  <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex items-center gap-2 text-rose-600 font-bold bg-rose-50 px-6 py-3 rounded-xl border border-rose-100"
                  >
                    <AlertCircle size={20} />
                    {error}
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analysis-results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Success Banner */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-emerald-50 via-emerald-50 to-teal-50 rounded-[2.5rem] border border-emerald-200 p-8 md:p-10 shadow-lg shadow-emerald-100/50 flex flex-col md:flex-row items-center gap-6 md:gap-8"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-100 rounded-3xl flex items-center justify-center shrink-0">
                <PartyPopper size={36} className="text-emerald-600" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl md:text-2xl font-black text-emerald-900 tracking-tight">Manuscript Uploaded Successfully!</h3>
                <p className="text-emerald-700 font-medium mt-1 text-sm md:text-base">
                  Your document has been ingested and analyzed. Please check your email inbox for your official <strong>Acceptance Letter</strong>. You can review the extracted metadata below, then proceed to <strong>Writing Assistant</strong> to refine your manuscript prose.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {onQuickPublish && (
                  <button
                    onClick={() => {
                      onQuickPublish();
                    }}
                    className="shrink-0 px-8 py-4 bg-[#800000] hover:bg-red-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all flex items-center gap-3"
                  >
                    <Zap size={18} fill="white" />
                    Instant Quick Publish
                  </button>
                )}
                {onNavigate && (
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`/api/papers/${paperId}/status`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                          },
                          body: JSON.stringify({ status: 'writing_assistant' })
                        });
                        onNavigate('apa_validation');
                      } catch (e) {
                        console.error('Failed to move to APA validation', e);
                      }
                    }}
                    className="shrink-0 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-600/30 hover:scale-105 transition-all flex items-center gap-3"
                  >
                    Send to APA Rule Engine
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Extracted Metadata Card */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-10 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-30"></div>

                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <FileText size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Extracted Intelligence</h3>
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated Extraction Results</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => isEditing ? handleUpdateMetadata() : setIsEditing(true)}
                      disabled={isSaving}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${
                        isEditing 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20' 
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={18} /> : (isEditing ? <Save size={18} /> : <Pencil size={18} />)}
                      {isEditing ? 'Save Changes' : 'Quick Edit'}
                    </button>
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 size={18} /> Verified Analysis
                    </div>
                  </div>
                </div>

                {selectedFile && (
                  <button
                    onClick={() => setIsPreviewOpen(true)}
                    className="mb-8 flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all group w-full"
                  >
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                      <Eye size={18} />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider flex-1 text-left">Preview Original Manuscript</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">{selectedFile.name.split('.').pop()}</span>
                  </button>
                )}

                <div className="space-y-8 relative z-10">
                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Manuscript Title</label>
                    {isEditing ? (
                      <input 
                        value={editedMetadata?.title || ''}
                        onChange={(e) => setEditedMetadata({...editedMetadata, title: e.target.value})}
                        className="w-full text-2xl font-bold text-slate-900 p-6 bg-white border-2 border-indigo-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-50 outline-none"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-slate-900 p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all leading-snug">
                        {metadata.title || 'Untitled Research'}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Corresponding Authors</label>
                        {isEditing && (
                          <button onClick={addAuthor} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:text-indigo-500">
                             <Plus size={12} /> Add
                          </button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-3">
                          {editedMetadata?.authors?.map((author: any, idx: number) => (
                            <div key={idx} className="p-4 bg-white border-2 border-indigo-100 rounded-2xl relative group/author">
                              <input 
                                value={typeof author === 'string' ? author : author.name}
                                onChange={(e) => updateAuthor(idx, { name: e.target.value })}
                                placeholder="Author Name"
                                className="w-full font-bold text-slate-900 border-none p-0 focus:ring-0 text-sm mb-1"
                              />
                              <div className="flex gap-2">
                                <input 
                                  value={(typeof author !== 'string' && author.email) || ''}
                                  onChange={(e) => updateAuthor(idx, { email: e.target.value })}
                                  placeholder="Email"
                                  className="flex-1 text-[10px] text-slate-500 border-none p-0 focus:ring-0"
                                />
                                <input 
                                  value={(typeof author !== 'string' && author.department) || ''}
                                  onChange={(e) => updateAuthor(idx, { department: e.target.value })}
                                  placeholder="Dept"
                                  className="flex-1 text-[10px] text-slate-500 border-none p-0 focus:ring-0 text-right"
                                />
                              </div>
                              <button 
                                onClick={() => removeAuthor(idx)}
                                className="absolute -right-2 -top-2 p-1.5 bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover/author:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-800 font-bold space-y-2">
                          {metadata.authors && Array.isArray(metadata.authors) ? metadata.authors.map((author: any, i: number) => (
                            <div key={i} className="flex flex-col">
                                <span>{typeof author === 'string' ? author : author.name}</span>
                                {typeof author !== 'string' && (author.email || author.department || author.institution) && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {[author.department, author.faculty, author.institution, author.email].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                            </div>
                          )) : 'Anonymous Researcher'}
                        </div>
                      )}
                    </div>
                    <div className="group">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Professional Affiliations</label>
                      <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-600 font-medium italic">
                        {metadata.affiliations?.join('; ') || 'Not specified'}
                      </div>
                    </div>
                  </div>

                  <div className="group">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Abstract Summary</label>
                    {isEditing ? (
                      <textarea 
                        value={editedMetadata?.abstract || ''}
                        onChange={(e) => setEditedMetadata({...editedMetadata, abstract: e.target.value})}
                        className="w-full h-48 p-8 bg-white border-2 border-indigo-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-50 outline-none text-slate-600 text-lg leading-relaxed font-serif"
                      />
                    ) : (
                      <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] group-hover:bg-white group-hover:border-indigo-200 transition-all text-slate-600 text-lg leading-relaxed font-serif">
                        {metadata.abstract || 'No abstract content detected in the manuscript.'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">Neural Keywords</label>
                    <div className="flex flex-wrap gap-2">
                      {metadata.keywords?.map((kw: string) => (
                        <span key={kw} className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-default">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Structural Validation Panel */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl">
                    <CheckCircle2 size={20} className="text-indigo-600" />
                  </div>
                  Structural Audit
                </h3>

                {isValidating ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                    <p className="font-bold uppercase tracking-widest text-xs">Checking Consistency</p>
                  </div>
                ) : validation ? (
                  <div className="space-y-4">
                    {validation.map((section: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group"
                      >
                        <div className={`
                          flex items-center justify-between p-4 rounded-2xl border transition-all
                          ${section.status === 'ok' ? 'bg-emerald-50/30 border-emerald-100 group-hover:bg-emerald-50' :
                            section.status === 'warning' ? 'bg-amber-50/30 border-amber-100 group-hover:bg-amber-50' :
                              'bg-rose-50/30 border-rose-100 group-hover:bg-rose-50'}
                        `}>
                          <span className="text-sm font-bold text-slate-700">{section.name}</span>
                          {section.status === 'ok' && <CheckCircle2 className="text-emerald-500" size={20} />}
                          {section.status === 'warning' && <AlertCircle className="text-amber-500" size={20} />}
                          {section.status === 'error' && <AlertCircle className="text-rose-500" size={20} />}
                        </div>
                        {section.msg && (
                          <div className={`
                            mt-2 ml-4 p-3 rounded-xl text-xs font-bold border-l-4
                            ${section.status === 'error' ? 'bg-rose-50 text-rose-600 border-rose-500' : 'bg-amber-50 text-amber-600 border-amber-500'}
                          `}>
                            {section.msg}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                    <p className="text-sm font-medium">Audit Results Unavailable</p>
                  </div>
                )}

                <div className="mt-10 pt-8 border-t border-slate-100">
                  <div className="bg-slate-900 rounded-2xl p-6 text-white text-center mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Readiness Score</p>
                    <p className="text-4xl font-bold tracking-tight">84<span className="text-indigo-400">%</span></p>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-indigo-500 h-full w-[84%]"></div>
                    </div>
                  </div>

                  {/* Gateway Selection */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => setSelectedGateway('paystack')}
                      className={`
                        p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
                        ${selectedGateway === 'paystack' 
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-md scale-[1.02]' 
                          : 'border-slate-100 bg-white hover:border-slate-200'}
                      `}
                    >
                      <Zap size={24} className={selectedGateway === 'paystack' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${selectedGateway === 'paystack' ? 'text-indigo-900' : 'text-slate-500'}`}>Paystack</span>
                    </button>
                    <button
                      onClick={() => setSelectedGateway('kora')}
                      className={`
                        p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
                        ${selectedGateway === 'kora' 
                          ? 'border-[#800000] bg-[#800000]/5 shadow-md scale-[1.02]' 
                          : 'border-slate-100 bg-white hover:border-slate-200'}
                      `}
                    >
                      <CreditCard size={24} className={selectedGateway === 'kora' ? 'text-[#800000]' : 'text-slate-400'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${selectedGateway === 'kora' ? 'text-slate-900' : 'text-slate-500'}`}>Kora</span>
                    </button>
                  </div>

                  <button 
                    onClick={handlePayment}
                    disabled={isPaying || !selectedGateway}
                    className="w-full py-4 premium-gradient text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#800000]/20 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isPaying ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <span className="text-lg font-bold">₦</span>
                        {selectedGateway ? `Pay with ${selectedGateway === 'paystack' ? 'Paystack' : 'Kora'}` : 'Select Gateway'}
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-wider">
                    {selectedGateway ? `Secure Payment via ${selectedGateway === 'paystack' ? 'Paystack' : 'Kora'}` : "Select a secure channel to proceed"}
                  </p>
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {/* Detail Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <User size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">Confirm Identity</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Acceptance Letter Details</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Name (Editable)</label>
                  <input 
                    type="text" 
                    value={researcherName}
                    onChange={(e) => setResearcherName(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email Address (Registry Default)</label>
                  <div className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed italic">
                    {profile?.email}
                  </div>
                  <p className="text-[9px] font-bold text-amber-600 mt-2 italic flex items-center gap-1">
                    <AlertCircle size={10} /> To ensure integrity, the account email cannot be changed.
                  </p>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  onClick={() => setIsConfirmingDetails(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all border border-slate-100"
                >
                  Cancel
                </button>
                <button 
                  onClick={proceedWithUpload}
                  className="flex-3 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/20"
                >
                  Verify & Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Call for Papers Agreement Modal */}
      <AnimatePresence>
        {showAgreement && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col my-auto"
            >
              <div className="p-10 pb-0 shrink-0">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-[#800000]/10 text-[#800000] rounded-2xl flex items-center justify-center">
                    <AlertCircle size={30} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Author Agreement</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">GMIJP Submission Guidelines</p>
                  </div>
                </div>
              </div>

              <div className="p-10 py-0 overflow-y-auto max-h-[50vh] scroll-smooth">
                <div className="prose prose-slate prose-sm max-w-none space-y-4">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 font-medium text-slate-600 space-y-4 leading-relaxed">
                    <h4 className="font-black text-[#800000] uppercase tracking-wider text-xs">Call for Papers</h4>
                    <p>Genius Multidisciplinary International Journal Publication wish to invite and welcome articles to be published in its bi-annual (January – June and July – December edition). More specifically, the journal provides coverage for contemplary research and issues across the globe from various disciplines. To ensure high quality of articles published in the journal, all submitted manuscripts shall undergo a double-blind peer-review process.</p>
                    
                    <h4 className="font-black text-[#800000] uppercase tracking-wider text-xs">Guideline for Authors</h4>
                    <ul className="list-decimal list-inside space-y-2">
                      <li>The title page should contain the title of the article; capitalize the first letter of each word in the title and name(s), Email addresses, and phone numbers of the authors.</li>
                      <li>All manuscripts must include a brief informative abstract not exceeding 200 words describing the Background, method, results and conclusion.</li>
                      <li>Key words (maximum of 5) should be provided below the abstract.</li>
                      <li>Introduction: should articulate the problem and provide sufficient background info.</li>
                      <li>Methods: should be concise, but provide sufficient details of design.</li>
                      <li>Results: should be presented in tables and figures in a logical sequence.</li>
                      <li>Discussion: should be made in relation to hypotheses/questions.</li>
                      <li>Conclusion: should be precise and based on the outcome of the study.</li>
                    </ul>

                    <h4 className="font-black text-[#800000] uppercase tracking-wider text-xs">Submission Requirements</h4>
                    <p>Manuscripts should follow recent APA format 7th edition. Maximum of 4,500 words (including references) using Times New Roman, font 12 and 1.5 line spacing.</p>
                    
                    <h4 className="font-black text-[#800000] uppercase tracking-wider text-xs">Assessment Fees</h4>
                    <p>Any article submitted to GMIJP shall attract N5,000.00 ($12 USD) non-refundable fee for Paper Assessment. If accepted, a publication fee of N30,000.00 ($51 USD) applies.</p>
                  </div>
                </div>
              </div>

              <div className="p-10 pt-8 shrink-0 space-y-6">
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={agreedGuidelines}
                      onChange={(e) => setAgreedGuidelines(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      I have read and adhered to all Author Guidelines and formatting requirements.
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={agreedRefund}
                      onChange={(e) => setAgreedRefund(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      I understand the assessment fee is non-refundable regardless of the peer-review outcome.
                    </span>
                  </label>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowAgreement(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Close & Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (agreedGuidelines && agreedRefund) {
                        setShowAgreement(false);
                        handlePayment();
                      }
                    }}
                    disabled={!agreedGuidelines || !agreedRefund}
                    className="flex-[2] py-4 bg-[#800000] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#800000]/20 hover:scale-105 transition-all disabled:opacity-30"
                  >
                    I Accept & Proceed to Pay
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
