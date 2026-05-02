import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Cpu,
  DollarSign,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ServerCog,
  User,
  Zap
} from 'lucide-react';
import { Tab } from '../App';

type ServiceView = 'overview' | 'aiUser';

type UsageStats = {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  recentHistory: any[];
  byModel: any[];
  dailyBreakdown: any[];
  perUser: any[];
};

type OpenAICosts = {
  source: string;
  totalCost: number;
  currency: string;
  range: { start: string; end: string };
  buckets: Array<{ date: string; total: number; lineItems: any[] }>;
  byLineItem: Array<{ name: string; amount: number; currency: string }>;
  byProject: Array<{ name: string; amount: number; currency: string }>;
  note?: string;
};

type TwilioBalance = {
  balance: number | null;
  currency: string;
  smsSent: number;
  smsCost: number;
  source: string;
  note?: string;
};

type TwilioUsage = {
  source: string;
  currency: string;
  totalCost: number;
  totalUsage: number;
  range: { start: string; end: string };
  records: any[];
  note?: string;
};

interface ServicesSettingsProps {
  onNavigate: (tab: Tab) => void;
}

const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const money = (value: any, currency = 'USD') => {
  const amount = Number(value || 0);
  const symbol = currency.toUpperCase() === 'USD' ? '$' : `${currency.toUpperCase()} `;
  return `${symbol}${amount.toFixed(amount >= 1 ? 2 : 5)}`;
};

const compactTokens = (value: any) => {
  const total = Number(value || 0);
  return total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString();
};

export default function ServicesSettings({ onNavigate }: ServicesSettingsProps) {
  const [view, setView] = useState<ServiceView>('overview');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [openaiCosts, setOpenaiCosts] = useState<OpenAICosts | null>(null);
  const [twilioBalance, setTwilioBalance] = useState<TwilioBalance | null>(null);
  const [twilioUsage, setTwilioUsage] = useState<TwilioUsage | null>(null);
  const [loading, setLoading] = useState({ usage: false, openai: false, twilioBalance: false, twilioUsage: false });
  const [openaiStart, setOpenaiStart] = useState(dateOffset(-29));
  const [openaiEnd, setOpenaiEnd] = useState(dateOffset(0));
  const [twilioStart, setTwilioStart] = useState(dateOffset(-29));
  const [twilioEnd, setTwilioEnd] = useState(dateOffset(0));
  const [aiHistoryOpen, setAiHistoryOpen] = useState(true);
  const [twilioHistoryOpen, setTwilioHistoryOpen] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetail, setUserDetail] = useState<{ user: any; summary: any; history: any[]; byPurpose: any[] } | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  const token = useMemo(() => localStorage.getItem('token'), []);

  const fetchUsageStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, usage: true }));
    try {
      const res = await fetch('/api/admin/usage-stats', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) setUsageStats(data);
    } finally {
      setLoading(prev => ({ ...prev, usage: false }));
    }
  }, [token]);

  const fetchOpenAICosts = useCallback(async () => {
    setLoading(prev => ({ ...prev, openai: true }));
    try {
      const params = new URLSearchParams({ start: openaiStart, end: openaiEnd });
      const res = await fetch(`/api/admin/openai-costs?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOpenaiCosts(data);
    } finally {
      setLoading(prev => ({ ...prev, openai: false }));
    }
  }, [openaiEnd, openaiStart, token]);

  const fetchTwilioBalance = useCallback(async () => {
    setLoading(prev => ({ ...prev, twilioBalance: true }));
    try {
      const res = await fetch('/api/admin/twilio-balance', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTwilioBalance(data);
    } finally {
      setLoading(prev => ({ ...prev, twilioBalance: false }));
    }
  }, [token]);

  const fetchTwilioUsage = useCallback(async () => {
    setLoading(prev => ({ ...prev, twilioUsage: true }));
    try {
      const params = new URLSearchParams({ start: twilioStart, end: twilioEnd });
      const res = await fetch(`/api/admin/twilio-usage?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTwilioUsage(data);
    } finally {
      setLoading(prev => ({ ...prev, twilioUsage: false }));
    }
  }, [token, twilioEnd, twilioStart]);

  useEffect(() => {
    void fetchUsageStats();
    void fetchOpenAICosts();
    void fetchTwilioBalance();
    void fetchTwilioUsage();
  }, []);

  const openUserDetail = async (user: any) => {
    setSelectedUser(user);
    setUserDetail(null);
    setView('aiUser');
    setLoadingUserDetail(true);
    try {
      const res = await fetch(`/api/admin/usage-stats/user/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) setUserDetail(data);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const goOverview = () => {
    setView('overview');
    setSelectedUser(null);
    setUserDetail(null);
  };

  if (view === 'aiUser') {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
        <button onClick={goOverview} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-violet-700">
          <ArrowLeft size={16} /> Back to Services Settings
        </button>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-7 py-6 border-b border-slate-100 bg-violet-50/40 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center font-black text-violet-700">
              {(selectedUser?.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{selectedUser?.name || 'User AI Usage'}</h2>
              <p className="text-xs font-bold text-slate-400">{selectedUser?.email} · <span className="uppercase">{selectedUser?.role}</span></p>
            </div>
          </div>

          <div className="p-7 space-y-6">
            {loadingUserDetail && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-violet-500" size={28} /></div>}

            {userDetail && (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Calls', value: Number(userDetail.summary.requests).toLocaleString(), color: 'bg-blue-50 border-blue-100 text-blue-700' },
                    { label: 'Total Tokens', value: compactTokens(userDetail.summary.tokens), color: 'bg-amber-50 border-amber-100 text-amber-700' },
                    { label: 'Total Cost', value: money(userDetail.summary.cost), color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                  ].map(item => (
                    <div key={item.label} className={`rounded-2xl border p-5 ${item.color}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</p>
                      <p className="text-2xl font-black">{item.value}</p>
                    </div>
                  ))}
                </div>

                <section className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Used For</h3>
                  <div className="space-y-2">
                    {userDetail.byPurpose.map((purpose: any) => (
                      <div key={purpose.purpose} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <span className="w-44 text-xs font-bold capitalize text-slate-700 truncate">{String(purpose.purpose || 'ai call').replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold text-slate-400">{Number(purpose.calls).toLocaleString()} calls</span>
                        <span className="text-xs font-bold text-slate-400">{compactTokens(purpose.tokens)} tokens</span>
                        <span className="ml-auto text-xs font-black text-emerald-700">{money(purpose.cost)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Real History</h3>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                    {userDetail.history.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-xs font-bold capitalize text-slate-800">{String(item.purpose || 'ai call').replace(/_/g, ' ')}</p>
                          <p className="text-[10px] font-medium text-slate-400">{item.model} · {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-slate-500">{Number(item.total_tokens).toLocaleString()} tokens</span>
                          <span className="text-xs font-black text-emerald-700">{money(item.estimated_cost_usd)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => onNavigate('dashboard')} className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900">
            <ArrowLeft size={16} /> Back to Platform Stats
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <ServerCog size={26} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Services Settings</h1>
              <p className="text-sm font-medium text-slate-500">Live OpenAI organization costs, platform AI usage, and Twilio billing history.</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => { void fetchUsageStats(); void fetchOpenAICosts(); void fetchTwilioBalance(); void fetchTwilioUsage(); }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800"
        >
          <RefreshCw size={14} /> Refresh All
        </button>
      </div>

      <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-violet-50/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><Cpu size={20} className="text-violet-700" /> OpenAI Service</h2>
            <p className="text-xs font-bold text-slate-500">Real organization costs from OpenAI plus local platform usage attribution.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={openaiStart} onChange={e => setOpenaiStart(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" />
            <input type="date" value={openaiEnd} onChange={e => setOpenaiEnd(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" />
            <button onClick={fetchOpenAICosts} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700">
              <Search size={13} /> Query
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Live Org Spend</p>
              {loading.openai ? <Loader2 className="mt-3 animate-spin text-violet-500" /> : <p className="text-3xl font-black text-violet-800 mt-2">{money(openaiCosts?.totalCost, openaiCosts?.currency)}</p>}
              <p className="text-[10px] font-bold text-slate-500 mt-2">{openaiCosts?.range?.start || openaiStart} to {openaiCosts?.range?.end || openaiEnd}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Tracked Requests</p>
              <p className="text-3xl font-black text-blue-800 mt-2">{loading.usage ? '...' : (usageStats?.totalRequests || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Tracked Tokens</p>
              <p className="text-3xl font-black text-amber-800 mt-2">{loading.usage ? '...' : compactTokens(usageStats?.totalTokens)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tracked Cost</p>
              <p className="text-3xl font-black text-emerald-800 mt-2">{loading.usage ? '...' : money(usageStats?.totalCost)}</p>
            </div>
          </div>

          {openaiCosts?.note && <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{openaiCosts.note}</p>}

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">OpenAI Cost By Service</h3>
              <div className="space-y-2">
                {(openaiCosts?.byLineItem || []).map(item => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <span className="text-xs font-bold text-slate-700">{item.name}</span>
                    <span className="text-xs font-black text-violet-700">{money(item.amount, item.currency)}</span>
                  </div>
                ))}
                {openaiCosts?.source === 'live' && openaiCosts.byLineItem.length === 0 && <p className="text-xs font-bold text-slate-400">No OpenAI cost in this date range.</p>}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Platform Usage By User</h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                {(usageStats?.perUser || []).map(userRow => (
                  <button key={userRow.id} onClick={() => openUserDetail(userRow)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center"><User size={15} /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{userRow.name || 'Unknown'}</p>
                        <p className="text-[10px] font-medium text-slate-400 truncate">{userRow.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-bold text-slate-500">{Number(userRow.requests).toLocaleString()} calls</span>
                      <span className="text-xs font-black text-emerald-700">{money(userRow.cost)}</span>
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button onClick={() => setAiHistoryOpen(open => !open)} className="w-full flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-left">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">AI Call History</span>
              <ChevronRight size={16} className={`text-slate-400 transition-transform ${aiHistoryOpen ? 'rotate-90' : ''}`} />
            </button>
            {aiHistoryOpen && (
              <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                {(usageStats?.recentHistory || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-bold capitalize text-slate-800">{String(item.purpose || 'ai call').replace(/_/g, ' ')}</p>
                      <p className="text-[10px] font-medium text-slate-400">{item.model} · {item.user_name || 'System'} · {new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-500">{Number(item.total_tokens).toLocaleString()} tokens</span>
                      <span className="text-xs font-black text-emerald-700">{money(item.estimated_cost_usd)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-blue-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><MessageSquare size={20} className="text-blue-700" /> Twilio Service</h2>
            <p className="text-xs font-bold text-slate-500">Live Twilio balance and usage history by category.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={twilioStart} onChange={e => setTwilioStart(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" />
            <input type="date" value={twilioEnd} onChange={e => setTwilioEnd(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" />
            <button onClick={fetchTwilioUsage} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700">
              <Search size={13} /> Query
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Live Balance</p>
              {loading.twilioBalance ? <Loader2 className="mt-3 animate-spin text-blue-500" /> : <p className="text-3xl font-black text-blue-800 mt-2">{twilioBalance?.balance !== null && twilioBalance?.balance !== undefined ? money(twilioBalance.balance, twilioBalance.currency) : '-'}</p>}
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600">SMS Sent Today</p>
              <p className="text-3xl font-black text-cyan-800 mt-2">{twilioBalance?.smsSent ?? '-'}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Queried Usage Cost</p>
              {loading.twilioUsage ? <Loader2 className="mt-3 animate-spin text-emerald-500" /> : <p className="text-3xl font-black text-emerald-800 mt-2">{money(twilioUsage?.totalCost, twilioUsage?.currency)}</p>}
            </div>
          </div>

          {(twilioBalance?.note || twilioUsage?.note) && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">{twilioBalance?.note || twilioUsage?.note}</p>
          )}

          <div>
            <button onClick={() => setTwilioHistoryOpen(open => !open)} className="w-full flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 text-left">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Twilio Usage History</span>
              <ChevronRight size={16} className={`text-slate-400 transition-transform ${twilioHistoryOpen ? 'rotate-90' : ''}`} />
            </button>
            {twilioHistoryOpen && (
              <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                {(twilioUsage?.records || []).map((record, index) => (
                  <div key={`${record.category}-${index}`} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-bold capitalize text-slate-800">{String(record.category || '').replace(/-/g, ' ')}</p>
                      <p className="text-[10px] font-medium text-slate-400">{record.description} · {record.startDate || twilioUsage?.range.start} to {record.endDate || twilioUsage?.range.end}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-500">{Number(record.usage || record.count || 0).toLocaleString()} {record.usageUnit || record.countUnit}</span>
                      <span className="text-xs font-black text-blue-700">{money(record.price, record.currency)}</span>
                    </div>
                  </div>
                ))}
                {twilioUsage?.source === 'live' && twilioUsage.records.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs font-bold text-slate-400">No Twilio usage found in this date range.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
