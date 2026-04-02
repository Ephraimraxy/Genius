import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Banknote, Database, CheckCircle, AlertCircle, RefreshCw, Save, Server, Shield, Activity, CreditCard, BookOpen, Hash, Layers, Trash2 } from 'lucide-react';

export default function AdminSettings() {
  const [pubPrice, setPubPrice] = useState<number>(5000);
  const [newPubPrice, setNewPubPrice] = useState<string>('5000');
  const [subPrice, setSubPrice] = useState<number>(15000);
  const [newSubPrice, setNewSubPrice] = useState<string>('15000');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Gateways State
  const [gateways, setGateways] = useState({ paystack: true, kora: true });
  const [savingGateways, setSavingGateways] = useState(false);

  // Researcher Nav Visibility State
  const NAV_ITEMS = [
    { key: 'apa_validation', label: 'APA Gatekeeper', desc: 'APA 7th compliance validator' },
    { key: 'writing', label: 'Writing Assistant', desc: 'AI prose enhancement tool' },
    { key: 'formatting', label: 'Formatting', desc: 'Document layout engine' },
    { key: 'references', label: 'Reference Intel', desc: 'Citation and bibliography manager' },
    { key: 'integrity', label: 'Integrity Check', desc: 'Plagiarism and structure scanner' },
    { key: 'reviews', label: 'Peer Review', desc: 'Simulated reviewer evaluation' },
    { key: 'journals', label: 'Journal Match', desc: 'Journal recommendation engine' },
  ] as const;
  const [navVisibility, setNavVisibility] = useState<Record<string, boolean>>({
    apa_validation: true, writing: true, formatting: true, references: true,
    integrity: true, reviews: true, journals: true,
  });
  const [savingNav, setSavingNav] = useState(false);

  // Journal Settings State
  const [journalVolume, setJournalVolume] = useState<string>('1');
  const [journalIssue, setJournalIssue] = useState<string>('1');
  const [journalIssn, setJournalIssn] = useState<string>('2971-7760');
  const [maxManuscripts, setMaxManuscripts] = useState<string>('10');
  const [maxIssues, setMaxIssues] = useState<string>('3');
  const [maxPages, setMaxPages] = useState<string>('20');
  const [journalSignature, setJournalSignature] = useState<string>('');
  const [doiAutoRetryEnabled, setDoiAutoRetryEnabled] = useState<boolean>(true);
  const [doiAutoRetryInterval, setDoiAutoRetryInterval] = useState<string>('20');
  const [origJournal, setOrigJournal] = useState({ 
    volume: '1', issue: '1', issn: '2971-7760',
    maxManuscripts: '10', maxIssues: '3', maxPages: '20',
    signature: '',
    doiAutoRetryEnabled: true,
    doiAutoRetryInterval: '20',
    secretary: 'Dr. Danjuma Namo'
  });
  const [journalSecretary, setJournalSecretary] = useState<string>('Dr. Danjuma Namo');
  const [savingJournal, setSavingJournal] = useState(false);
  const [savedJournal, setSavedJournal] = useState(false);
  const [journalStats, setJournalStats] = useState<{
    papersInCurrentIssue: number;
    maxManuscriptsPerIssue: number;
    remainingInIssue: number;
    issuesInCurrentVolume: number;
    maxIssuesPerVolume: number;
    remainingIssues: number;
    totalPublished: number;
    totalPagesInIssue: number;
    nextStartPage: number;
    papers: Array<{
      serial: number;
      id: number;
      title: string;
      startPage: number;
      endPage: number;
      pageCount: number;
      publishedAt: string;
    }>;
    currentVolume: string;
    currentIssue: string;
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Fetch current prices
    fetch('/api/admin/config/pricing', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setPubPrice(data.publication_price);
        setNewPubPrice(data.publication_price.toString());
        setSubPrice(data.subscription_price);
        setNewSubPrice(data.subscription_price.toString());
      })
      .catch(console.error);

    // Fetch gateway settings
    fetch('/api/admin/config/gateways', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setGateways(data);
      })
      .catch(console.error);

    // Fetch journal settings
    fetch('/api/admin/config/journal', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setJournalVolume(data.current_volume);
        setJournalIssue(data.current_issue);
        setJournalIssn(data.journal_issn);
        setMaxManuscripts(data.max_manuscripts_per_issue.toString());
        setMaxIssues(data.max_issues_per_volume.toString());
        setMaxPages(data.max_pages_per_manuscript.toString());
        setJournalSignature(data.journal_signature || '');
        setDoiAutoRetryEnabled(data.doi_auto_retry_enabled !== false);
        setDoiAutoRetryInterval((data.doi_auto_retry_interval_minutes || 20).toString());
        setOrigJournal({ 
          volume: data.current_volume, 
          issue: data.current_issue, 
          issn: data.journal_issn,
          maxManuscripts: data.max_manuscripts_per_issue.toString(),
          maxIssues: data.max_issues_per_volume.toString(),
          maxPages: data.max_pages_per_manuscript.toString(),
          signature: data.journal_signature || '',
          doiAutoRetryEnabled: data.doi_auto_retry_enabled !== false,
          doiAutoRetryInterval: (data.doi_auto_retry_interval_minutes || 20).toString(),
          secretary: data.journal_secretary || 'Dr. Danjuma Namo'
        });
        setJournalSecretary(data.journal_secretary || 'Dr. Danjuma Namo');
      })
      .catch(console.error);

    // Fetch journal live stats
    fetch('/api/admin/config/journal-stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { if (!data.error) setJournalStats(data); })
      .catch(console.error);

    // Fetch researcher nav visibility
    fetch('/api/admin/config/researcher-nav', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { if (!data.error) setNavVisibility(data); })
      .catch(console.error);

    // Fetch system health
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'error', database: 'unknown' });
    }
    setLoadingHealth(false);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setJournalSignature(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePrice = async (key: 'publication_price' | 'lecturer_subscription_price', value: string) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/config/pricing', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: parsed })
      });
      if (res.ok) {
        if (key === 'publication_price') setPubPrice(parsed);
        else setSubPrice(parsed);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save price', err);
    }
    setSaving(false);
  };

  const handleToggleGateway = async (key: 'paystack' | 'kora') => {
    setSavingGateways(true);
    const newGateways = { ...gateways, [key]: !gateways[key] };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/config/gateways', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newGateways)
      });
      if (res.ok) {
        setGateways(newGateways);
      }
    } catch (err) {
      console.error('Failed to update gateways', err);
    }
    setSavingGateways(false);
  };

  const handleToggleNav = async (key: string) => {
    setSavingNav(true);
    const updated = { ...navVisibility, [key]: !navVisibility[key] };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/config/researcher-nav', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) setNavVisibility(updated);
    } catch (err) {
      console.error('Failed to update nav config', err);
    }
    setSavingNav(false);
  };

  const handleSaveJournal = async () => {
    setSavingJournal(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/config/journal', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          current_volume: journalVolume, 
          current_issue: journalIssue, 
          journal_issn: journalIssn,
          max_manuscripts_per_issue: parseInt(maxManuscripts),
          max_issues_per_volume: parseInt(maxIssues),
          max_pages_per_manuscript: parseInt(maxPages),
          journal_signature: journalSignature,
          journal_secretary: journalSecretary,
          doi_auto_retry_enabled: doiAutoRetryEnabled,
          doi_auto_retry_interval_minutes: parseInt(doiAutoRetryInterval || '20', 10)
        })
      });
      if (res.ok) {
        setOrigJournal({ 
          volume: journalVolume, 
          issue: journalIssue, 
          issn: journalIssn,
          maxManuscripts,
          maxIssues,
          maxPages,
          signature: journalSignature,
          doiAutoRetryEnabled,
          doiAutoRetryInterval,
          secretary: journalSecretary
        });
        setSavedJournal(true);
        setTimeout(() => setSavedJournal(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save journal settings', err);
    }
    setSavingJournal(false);
  };

  const journalChanged = 
    journalVolume !== origJournal.volume || 
    journalIssue !== origJournal.issue || 
    journalIssn !== origJournal.issn ||
    maxManuscripts !== origJournal.maxManuscripts ||
    maxIssues !== origJournal.maxIssues ||
    maxPages !== origJournal.maxPages ||
    journalSignature !== origJournal.signature ||
    doiAutoRetryEnabled !== origJournal.doiAutoRetryEnabled ||
    doiAutoRetryInterval !== origJournal.doiAutoRetryInterval ||
    journalSecretary !== origJournal.secretary;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-[#800000] rounded-[2rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Settings size={180} /></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30">Admin Only</span>
          </div>
          <h2 className="text-4xl font-bold font-display mb-3 tracking-tight">Platform Settings</h2>
          <p className="text-slate-300 text-lg max-w-xl font-medium">Configure publication pricing, journal metadata, system health, and platform parameters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Journal Settings — NEW */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden lg:col-span-2">
          <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-[#800000]/5 to-transparent">
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <BookOpen size={20} className="text-[#800000]" /> Journal Registry Settings
            </h3>
            <p className="text-xs text-slate-500 mt-1">These values are automatically applied to every newly published manuscript.</p>
          </div>
          <div className="p-8">

            {/* Live Stats Banner */}
            {journalStats && (
              <div className="mb-8 space-y-6">
                {/* Top 3 stat cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Issue fill */}
                  <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Current Issue Fill</p>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-black text-indigo-900">{journalStats.papersInCurrentIssue}<span className="text-sm font-bold text-indigo-400">/{journalStats.maxManuscriptsPerIssue}</span></span>
                      <span className="text-xs font-black text-indigo-500">{journalStats.remainingInIssue} slots left</span>
                    </div>
                    <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (journalStats.papersInCurrentIssue / journalStats.maxManuscriptsPerIssue) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-indigo-400 mt-2 font-medium">Vol {journalStats.currentVolume} · Issue {journalStats.currentIssue} · {journalStats.totalPagesInIssue} pages so far</p>
                  </div>
                  {/* Volume fill */}
                  <div className="p-5 bg-violet-50 border border-violet-100 rounded-2xl">
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">Volume Progress</p>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-black text-violet-900">{journalStats.issuesInCurrentVolume}<span className="text-sm font-bold text-violet-400">/{journalStats.maxIssuesPerVolume} issues</span></span>
                      <span className="text-xs font-black text-violet-500">{journalStats.remainingIssues} more to next vol</span>
                    </div>
                    <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (journalStats.issuesInCurrentVolume / journalStats.maxIssuesPerVolume) * 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-violet-400 mt-2 font-medium">Volume {journalStats.currentVolume} — auto-increments when full</p>
                  </div>
                  {/* Total published */}
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Published</p>
                    <span className="text-3xl font-black text-emerald-900">{journalStats.totalPublished}</span>
                    <p className="text-[9px] text-emerald-500 mt-1 font-medium">manuscripts across all volumes</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">Next paper starts p.{journalStats.nextStartPage}</span>
                    </div>
                  </div>
                </div>

                {/* Per-paper page range breakdown */}
                {journalStats.papers.length > 0 && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page Range Breakdown — Vol {journalStats.currentVolume}, Issue {journalStats.currentIssue}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{journalStats.totalPagesInIssue} total pages</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {journalStats.papers.map(p => (
                        <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">{p.serial}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{p.title || `Paper #${p.id}`}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{new Date(p.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {p.pageCount} page{p.pageCount !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-black text-indigo-700 font-mono">
                              {p.pageCount > 0 ? `pp. ${p.startPage}–${p.endPage}` : 'pp. —'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {/* Next slot indicator */}
                      {journalStats.remainingInIssue > 0 && (
                        <div className="flex items-center gap-4 px-5 py-3 bg-slate-50/50 border-t border-dashed border-slate-200">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-black flex items-center justify-center shrink-0">{journalStats.papersInCurrentIssue + 1}</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 italic">Next manuscript — starts at page {journalStats.nextStartPage}</p>
                          </div>
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-400 font-mono">p. {journalStats.nextStartPage}+</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {journalStats.papers.length === 0 && (
                  <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400">No papers published yet in Vol {journalStats.currentVolume}, Issue {journalStats.currentIssue}</p>
                    <p className="text-[10px] text-slate-300 mt-1">First paper will start at page 1</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Volume */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 flex items-center gap-1.5">
                  <Layers size={12} /> Current Volume
                </label>
                <input
                  type="number" min="1" step="1"
                  value={journalVolume}
                  onChange={(e) => setJournalVolume(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all text-center"
                  placeholder="1"
                />
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-wider">
                  {journalStats ? `${journalStats.issuesInCurrentVolume}/${journalStats.maxIssuesPerVolume} issues used this volume` : 'Increment yearly'}
                </p>
              </div>
              {/* Issue */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 flex items-center gap-1.5">
                  <Hash size={12} /> Current Issue Number
                </label>
                <input
                  type="number" min="1" step="1"
                  value={journalIssue}
                  onChange={(e) => setJournalIssue(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all text-center"
                  placeholder="1"
                />
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-wider">
                  {journalStats ? `${journalStats.papersInCurrentIssue}/${journalStats.maxManuscriptsPerIssue} papers — ${journalStats.remainingInIssue} remaining` : 'Increment per batch'}
                </p>
              </div>
              {/* ISSN */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 flex items-center gap-1.5">
                  <Shield size={12} /> Official ISSN
                </label>
                <input
                  type="text"
                  value={journalIssn}
                  onChange={(e) => setJournalIssn(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all text-center font-mono"
                  placeholder="2971-7760"
                />
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-wider">Permanent Journal ID</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pt-6 border-t border-slate-50">
              {/* Manuscripts per Issue */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Manuscripts per Issue</label>
                <input
                  type="number" min="1"
                  value={maxManuscripts}
                  onChange={(e) => setMaxManuscripts(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                  placeholder="10"
                />
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">
                  {journalStats ? `${journalStats.papersInCurrentIssue} published · ${journalStats.remainingInIssue} slots remain in Issue ${journalStats.currentIssue}` : `Current: ${maxManuscripts} per issue`}
                </p>
              </div>
              {/* Issues per Volume */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Issues per Volume</label>
                <input
                  type="number" min="1"
                  value={maxIssues}
                  onChange={(e) => setMaxIssues(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                  placeholder="3"
                />
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">
                  {journalStats ? `Issue ${journalStats.currentIssue} of ${journalStats.maxIssuesPerVolume} · ${journalStats.remainingIssues} more issue${journalStats.remainingIssues !== 1 ? 's' : ''} to next volume` : `Current: ${maxIssues} issues per volume`}
                </p>
              </div>
              {/* Page Limit */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Max Pages per Manuscript</label>
                <input
                  type="number" min="1"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                  placeholder="20"
                />
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Hard gate enforced at upload — currently {maxPages} pages max</p>
              </div>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">DOI Auto-Retry</label>
                  <button
                    onClick={() => setDoiAutoRetryEnabled((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                      doiAutoRetryEnabled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                    type="button"
                  >
                    {doiAutoRetryEnabled ? 'Enabled' : 'Disabled'}
                    <span className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      doiAutoRetryEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        doiAutoRetryEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </span>
                  </button>
                  <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Retry DOI minting automatically.</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Retry Interval (minutes)</label>
                  <input
                    type="number"
                    min={10}
                    value={doiAutoRetryInterval}
                    onChange={(e) => setDoiAutoRetryInterval(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                  />
                  <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Minimum 10 minutes.</p>
                </div>
              </div>

              {/* Signature Upload — NEW */}
              <div className="md:col-span-3 pt-6 border-t border-slate-50">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4 flex items-center gap-1.5">
                  <Shield size={12} /> Official Journal Signature Image
                </label>
                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className="flex-1 w-full">
                    <div className="relative group cursor-pointer mb-6">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                      />
                      <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-[#800000]/30 group-hover:bg-[#800000]/5 transition-all bg-slate-50/50">
                        <Layers className="text-slate-400 group-hover:text-[#800000] transition-colors" size={32} />
                        <p className="text-sm font-bold text-slate-500 group-hover:text-[#800000]">Click or drag to upload signature</p>
                        <p className="text-[10px] text-slate-400 font-medium">PNG or JPG (Recommended: 300x120 transparent)</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Current Secretary Name</label>
                      <input 
                        type="text"
                        value={journalSecretary}
                        onChange={(e) => setJournalSecretary(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                        placeholder="Dr. Danjuma Namo"
                      />
                      <p className="text-[9px] text-slate-400 mt-1 italic">This name appears below the signature on acceptance letters.</p>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-64">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Current Signature Preview</p>
                    <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden p-4 relative">
                      {journalSignature ? (
                        <div className="relative group w-full h-full flex items-center justify-center">
                          <img src={journalSignature} alt="Signature" className="max-w-full max-h-full object-contain mix-blend-multiply" />
                          <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setJournalSignature('');
                            }}
                            className="absolute top-1 right-1 p-1.5 bg-white shadow-xl text-red-500 rounded-lg hover:bg-red-50 transition-all border border-slate-100 z-30"
                            title="Delete Signature"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <AlertCircle size={20} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase italic">No signature set</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3 italic text-center">Appears aligned on Acceptance Letters</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview & Save */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Paper Stamp:</span>
                <span className="text-sm font-black text-[#800000]">ISSN {journalIssn} &bull; Vol {journalVolume} &bull; No {journalIssue}</span>
              </div>
              <button
                onClick={handleSaveJournal}
                disabled={savingJournal || !journalChanged}
                className="flex items-center gap-2 px-8 py-3 bg-[#800000] text-white rounded-xl font-bold text-sm hover:bg-[#600000] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              >
                {savingJournal ? <RefreshCw size={16} className="animate-spin" /> : savedJournal ? <CheckCircle size={16} /> : <Save size={16} />}
                {savingJournal ? 'Saving...' : savedJournal ? 'Saved!' : 'Update Journal Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Publication Pricing */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <Banknote size={20} className="text-emerald-600" /> Publication Pricing (Researcher)
            </h3>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Current Fee</label>
              <p className="text-3xl font-black text-slate-800">₦{pubPrice.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Set New Price (₦)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="500"
                  value={newPubPrice}
                  onChange={(e) => setNewPubPrice(e.target.value)}
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                />
                <button
                  onClick={() => handleSavePrice('publication_price', newPubPrice)}
                  disabled={saving || newPubPrice === pubPrice.toString()}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Pricing */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <CreditCard size={20} className="text-[#800000]" /> Lecturer Subscription Fee
            </h3>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Current Fee</label>
              <p className="text-3xl font-black text-slate-800">₦{subPrice.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Set New Price (₦)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="1000"
                  value={newSubPrice}
                  onChange={(e) => setNewSubPrice(e.target.value)}
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
                />
                <button
                  onClick={() => handleSavePrice('lecturer_subscription_price', newSubPrice)}
                  disabled={saving || newSubPrice === subPrice.toString()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#800000] text-white rounded-xl font-bold text-sm hover:bg-[#600000] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Gateways Config */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden lg:col-span-2">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <Banknote size={20} className="text-indigo-600" /> Active Payment Gateways
            </h3>
            <p className="text-xs text-slate-500 mt-1">Control which gateways users see when initiating a transaction.</p>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paystack Toggle */}
            <div className={`p-6 rounded-2xl border-2 transition-all ${gateways.paystack ? 'border-indigo-100 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <CreditCard size={24} />
                </div>
                <button 
                  onClick={() => handleToggleGateway('paystack')}
                  disabled={savingGateways}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${gateways.paystack ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gateways.paystack ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-1">Paystack</h4>
              <p className="text-xs font-medium text-slate-500">Enable card, bank transfer, and USSD payments.</p>
            </div>

            {/* Kora Toggle */}
            <div className={`p-6 rounded-2xl border-2 transition-all ${gateways.kora ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Banknote size={24} />
                </div>
                <button 
                  onClick={() => handleToggleGateway('kora')}
                  disabled={savingGateways}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${gateways.kora ? 'bg-emerald-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gateways.kora ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-1">Kora (Korapay)</h4>
              <p className="text-xs font-medium text-slate-500">Enable Kora dynamic bank transfer generation for users.</p>
            </div>
          </div>
        </div>

        {/* Researcher Navigation Visibility */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <Layers size={20} className="text-violet-600" /> Researcher Navigation Visibility
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Toggle to hide or reveal pipeline steps for all researchers — updates live instantly.</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
              Object.values(navVisibility).every(v => !v)
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}>
              {Object.values(navVisibility).filter(Boolean).length} / {NAV_ITEMS.length} Visible
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {NAV_ITEMS.map(item => {
              const isVisible = navVisibility[item.key] !== false;
              return (
                <div
                  key={item.key}
                  className={`p-5 rounded-2xl border-2 transition-all ${isVisible ? 'border-violet-100 bg-violet-50/30' : 'border-slate-100 bg-slate-50 opacity-60'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm">{item.label}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggleNav(item.key)}
                      disabled={savingNav}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${isVisible ? 'bg-violet-600' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-8 pb-6 flex items-center gap-2">
            <button
              onClick={() => {
                const allOn: Record<string, boolean> = {};
                NAV_ITEMS.forEach(i => { allOn[i.key] = true; });
                Object.keys(allOn).forEach(k => { if (navVisibility[k] !== allOn[k]) handleToggleNav(k); });
                setNavVisibility(allOn);
              }}
              disabled={savingNav}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl transition-all disabled:opacity-50"
            >
              Show All
            </button>
            <button
              onClick={() => {
                const allOff: Record<string, boolean> = {};
                NAV_ITEMS.forEach(i => { allOff[i.key] = false; });
                fetch('/api/admin/config/researcher-nav', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(allOff),
                }).then(r => r.ok && setNavVisibility(allOff));
              }}
              disabled={savingNav}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
            >
              Hide All
            </button>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <Activity size={20} className="text-blue-600" /> System Health
            </h3>
            <button onClick={fetchHealth} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              <RefreshCw size={16} className={`text-slate-500 ${loadingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="p-8 space-y-5">
            {health ? (
              <>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Server size={18} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-700">Server Status</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    health.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {health.status === 'ok' ? 'Healthy' : 'Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Database size={18} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-700">Database</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    health.database === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {health.database === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-700">Security Layer</span>
                  </div>
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200">
                    Active
                  </span>
                </div>
                {health.timestamp && (
                  <p className="text-[11px] text-slate-400 font-medium text-center pt-2">
                    Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <RefreshCw className="animate-spin text-slate-300 mx-auto mb-3" size={32} />
                <p className="text-sm font-bold text-slate-400">Checking system health...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
