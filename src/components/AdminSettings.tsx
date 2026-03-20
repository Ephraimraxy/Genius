import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Banknote, Database, CheckCircle, AlertCircle, RefreshCw, Save, Server, Shield, Activity, CreditCard, BookOpen, Hash, Layers } from 'lucide-react';

export default function AdminSettings() {
  const [pubPrice, setPubPrice] = useState<number>(5000);
  const [newPubPrice, setNewPubPrice] = useState<string>('5000');
  const [subPrice, setSubPrice] = useState<number>(15000);
  const [newSubPrice, setNewSubPrice] = useState<string>('15000');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Journal Settings State
  const [journalVolume, setJournalVolume] = useState<string>('1');
  const [journalIssue, setJournalIssue] = useState<string>('1');
  const [journalIssn, setJournalIssn] = useState<string>('2971-7760');
  const [maxManuscripts, setMaxManuscripts] = useState<string>('10');
  const [maxIssues, setMaxIssues] = useState<string>('3');
  const [maxPages, setMaxPages] = useState<string>('20');
  const [origJournal, setOrigJournal] = useState({ 
    volume: '1', issue: '1', issn: '2971-7760',
    maxManuscripts: '10', maxIssues: '3', maxPages: '20'
  });
  const [savingJournal, setSavingJournal] = useState(false);
  const [savedJournal, setSavedJournal] = useState(false);

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
        setOrigJournal({ 
          volume: data.current_volume, 
          issue: data.current_issue, 
          issn: data.journal_issn,
          maxManuscripts: data.max_manuscripts_per_issue.toString(),
          maxIssues: data.max_issues_per_volume.toString(),
          maxPages: data.max_pages_per_manuscript.toString()
        });
      })
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
          max_pages_per_manuscript: parseInt(maxPages)
        })
      });
      if (res.ok) {
        setOrigJournal({ 
          volume: journalVolume, 
          issue: journalIssue, 
          issn: journalIssn,
          maxManuscripts,
          maxIssues,
          maxPages
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
    maxPages !== origJournal.maxPages;

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
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-wider">Increment yearly</p>
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
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-wider">Increment per batch</p>
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
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Current: 10 per issue</p>
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
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Current: 3 issues per "Chapter"</p>
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
                <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Limit for automated check</p>
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

