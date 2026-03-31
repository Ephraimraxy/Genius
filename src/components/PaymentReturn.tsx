import React, { useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { publishPaymentReturn } from './paymentChannel';

const extractReference = (params: URLSearchParams) => {
  return (
    params.get('reference') ||
    params.get('trxref') ||
    params.get('tx_ref') ||
    params.get('payment_ref') ||
    params.get('transaction_reference') ||
    params.get('ref') ||
    ''
  );
};

const extractStatus = (params: URLSearchParams) => {
  return (
    params.get('status') ||
    params.get('payment_status') ||
    params.get('transaction_status') ||
    params.get('event') ||
    'unknown'
  );
};

export default function PaymentReturn() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const reference = useMemo(() => extractReference(params), [params]);
  const status = useMemo(() => extractStatus(params), [params]);
  const gateway = useMemo(() => params.get('gateway') || params.get('source') || undefined, [params]);

  useEffect(() => {
    publishPaymentReturn({ type: 'payment:return', reference, status, gateway });
    const timer = setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [reference, status, gateway]);

  const isSuccess = status.toLowerCase().includes('success');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 text-center">
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {isSuccess ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
        </div>
        <h1 className="mt-6 text-2xl font-black text-slate-900">
          {isSuccess ? 'Payment Received' : 'Payment Processing'}
        </h1>
        <p className="mt-2 text-slate-500 text-sm font-medium">
          {isSuccess
            ? 'You can return to the previous window. This tab will close automatically.'
            : 'We are confirming your payment. You can safely return to the previous window.'}
        </p>
        {reference && (
          <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference</p>
            <p className="font-mono text-slate-700 text-sm mt-1 break-all">{reference}</p>
          </div>
        )}
      </div>
    </div>
  );
}
