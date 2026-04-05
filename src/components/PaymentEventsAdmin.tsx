import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, Search, ShieldAlert, CreditCard, Filter } from 'lucide-react';
import { friendlyError } from '../utils/friendlyError';

type PaymentEvent = {
  id: number;
  reference: string;
  gateway: string;
  event_type: string;
  amount: number;
  payload: any;
  created_at: string;
  transaction_type?: string;
  transaction_status?: string;
  transaction_amount?: number;
  user_name?: string;
  user_email?: string;
};

const formatAmount = (value: number) => `₦${Number(value || 0).toLocaleString()}`;

const eventBadge = (eventType: string) => {
  const normalized = String(eventType || '').toLowerCase();
  if (normalized.includes('refund')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (normalized === 'overpaid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized === 'partial') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

export default function PaymentEventsAdmin() {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [gateway, setGateway] = useState('');
  const [eventType, setEventType] = useState('');

  const token = useMemo(() => localStorage.getItem('token'), []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (gateway) params.set('gateway', gateway);
      if (eventType) params.set('event_type', eventType);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/payment-events?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load payment events');
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch (err: any) {
      setError(friendlyError(err, 'load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEvents();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Payment Events</h2>
            <p className="text-sm text-slate-500 font-medium">Track gateway callbacks, partials, overpayments, and refunds.</p>
          </div>
          <button
            onClick={fetchEvents}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEvents()}
              placeholder="Search reference or user email..."
              className="w-full bg-transparent outline-none text-sm font-medium text-slate-600"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <Filter size={16} className="text-slate-400" />
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-transparent outline-none text-sm font-medium text-slate-600"
            >
              <option value="">All event types</option>
              <option value="payment">Payment</option>
              <option value="partial">Partial</option>
              <option value="overpaid">Overpaid</option>
              <option value="refund_requested">Refund Requested</option>
              <option value="refund_failed">Refund Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <CreditCard size={16} className="text-slate-400" />
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-full bg-transparent outline-none text-sm font-medium text-slate-600"
            >
              <option value="">All gateways</option>
              <option value="paystack">Paystack</option>
              <option value="kora">Kora</option>
              <option value="paymentpoint">PaymentPoint</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={fetchEvents}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition"
          >
            Apply Filters
          </button>
          {loading && <span className="text-xs text-slate-400 font-bold">Loading events...</span>}
          {error && <span className="text-xs text-rose-600 font-bold">{error}</span>}
        </div>
      </div>

      <div className="space-y-4">
        {events.length === 0 && !loading && (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
            <ShieldAlert className="mx-auto mb-3 text-slate-300" size={32} />
            <p className="font-bold">No payment events found.</p>
          </div>
        )}

        {events.map((event) => (
          <div key={`${event.id}-${event.event_type}`} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${eventBadge(event.event_type)}`}>
                    {event.event_type || 'event'}
                  </span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{event.gateway || 'gateway'}</span>
                  <span className="text-xs text-slate-500 font-bold">{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="text-lg font-black text-slate-900 mt-2">{event.reference}</p>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {event.user_name || 'Unknown User'} • {event.user_email || 'No email'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Event Amount</p>
                <p className="text-2xl font-black text-slate-900">{formatAmount(event.amount)}</p>
                {event.transaction_type && (
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {event.transaction_type} • {event.transaction_status || 'unknown'}
                  </p>
                )}
              </div>
            </div>

            {event.payload && (
              <details className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500">
                <summary className="cursor-pointer font-bold text-slate-600">View payload</summary>
                <pre className="whitespace-pre-wrap text-[11px] mt-3 overflow-auto max-h-64">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
