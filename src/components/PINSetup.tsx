import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface PINSetupProps {
  onBackToLanding: () => void;
  addToast: (toast: any) => void;
}

export default function PINSetup({ onBackToLanding, addToast }: PINSetupProps) {
  const [step, setStep] = useState<'verify' | 'setup' | 'success'>('verify');
  const [token, setToken] = useState('');
  const [matric, setMatric] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const m = params.get('matric');
    if (t && m) {
      setToken(t);
      setMatric(m);
      setStep('setup');
    } else {
      setError('Invalid or missing setup link. Please check your email or contact your lecturer.');
    }
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirmPin) {
      addToast({ title: 'PIN Mismatch', message: 'Values do not match.', type: 'error' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      addToast({ title: 'Invalid PIN', message: 'PIN must be exactly 4 digits.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/student/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, matric, pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep('success');
      addToast({ title: 'Success', message: 'Your Secure PIN is active.', type: 'success' });
    } catch (err: any) {
      setError(err.message);
      addToast({ title: 'Setup Failed', message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient flex flex-col items-center justify-center p-4 selection:bg-[#800000]/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#800000]/10 blur-[100px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#800000]/10 blur-[100px] rounded-full"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/90 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/50 p-8 sm:p-12 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-[#800000]/5 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-[#800000]/10">
            <img src="/gmijp-logo.png" alt="GMIJP Logo" className="w-12 h-12 object-contain" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Secure Entry</h2>
          <p className="text-slate-500 font-medium text-sm px-4 leading-relaxed">
            Set up your personal 4-digit access PIN to protect your academic records.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'setup' && (
            <motion.form
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSetup}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Create 4-Digit PIN</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#800000] transition-colors" size={18} />
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#800000]/10 transition-all font-mono text-xl tracking-[1em] text-center"
                      placeholder="••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm PIN</label>
                  <div className="relative group">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#800000] transition-colors" size={18} />
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#800000]/10 transition-all font-mono text-xl tracking-[1em] text-center"
                      placeholder="••••"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full premium-gradient text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-[#800000]/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    Activate PIN
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Activation Complete</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Your entry code is now active. You can use it to log in to the Student Portal.
              </p>
              <button
                onClick={onBackToLanding}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Go to Portal
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          GMIJ Publication Portal © 2026 • Secure Infrastructure
        </p>
      </motion.div>
    </div>
  );
}
