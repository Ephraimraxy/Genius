import React, { useEffect, useState } from 'react';
import { ShieldCheck, XCircle, Loader2, ExternalLink } from 'lucide-react';

interface VerifyResult {
  valid: boolean;
  certificateId?: string;
  title?: string;
  authors?: string[];
  doi?: string;
  issn?: string;
  volume?: string;
  issue?: string;
  publishedAt?: string;
  journal?: string;
  error?: string;
}

export default function CertificateVerify({ certificateId }: { certificateId: string }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certificateId) { setLoading(false); return; }
    fetch(`/api/verify/${encodeURIComponent(certificateId)}`)
      .then(r => r.json())
      .then(data => { setResult(data); setLoading(false); })
      .catch(() => { setResult({ valid: false, error: 'Network error. Please try again.' }); setLoading(false); });
  }, [certificateId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <img src="/gmijp-logo.png" alt="GMIJP" className="w-16 h-16 rounded-full mx-auto mb-3 object-contain bg-white p-2 shadow-xl" />
        <h1 className="text-white font-black text-2xl tracking-tight">Certificate Verification</h1>
        <p className="text-slate-400 text-sm mt-1">Genius Multidisciplinary International Journal Publication</p>
      </div>

      <div className="w-full max-w-lg bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-maroon-400 animate-spin" style={{ color: '#c0392b' }} />
            <p className="text-slate-400 text-sm">Verifying certificate…</p>
          </div>
        ) : result?.valid ? (
          <>
            {/* Valid banner */}
            <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-white flex-shrink-0" />
              <div>
                <p className="text-white font-black text-base">Certificate Verified</p>
                <p className="text-emerald-100 text-xs">This certificate is authentic and issued by GMIJP.</p>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Manuscript Title</span>
                <p className="text-white font-semibold text-sm mt-1 leading-snug">{result.title}</p>
              </div>

              {result.authors && result.authors.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Author(s)</span>
                  <p className="text-slate-300 text-sm mt-1">{result.authors.join(', ')}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {result.publishedAt && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Published</span>
                    <p className="text-slate-300 text-sm mt-1">{result.publishedAt}</p>
                  </div>
                )}
                {(result.volume || result.issue) && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vol / Issue</span>
                    <p className="text-slate-300 text-sm mt-1">Vol. {result.volume || '—'}, Issue {result.issue || '—'}</p>
                  </div>
                )}
              </div>

              {result.issn && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">ISSN</span>
                  <p className="text-slate-300 text-sm mt-1">{result.issn}</p>
                </div>
              )}

              {result.doi && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">DOI</span>
                  <a
                    href={result.doi.startsWith('http') ? result.doi : `https://doi.org/${result.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-1 break-all"
                  >
                    {result.doi} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Certificate ID</span>
                <p className="text-slate-400 font-mono text-xs mt-1">{result.certificateId}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Journal</span>
                <p className="text-slate-300 text-sm mt-1">{result.journal}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-red-700 px-6 py-4 flex items-center gap-3">
              <XCircle className="w-7 h-7 text-white flex-shrink-0" />
              <div>
                <p className="text-white font-black text-base">Certificate Invalid</p>
                <p className="text-red-100 text-xs">This certificate could not be verified.</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-400 text-sm">{result?.error || 'No matching certificate was found. It may have been issued by a different system, or the ID may be incorrect.'}</p>
              <p className="text-xs text-slate-600 mt-4">Certificate ID: <span className="font-mono">{certificateId}</span></p>
            </div>
          </>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-6 text-center">
        &copy; {new Date().getFullYear()} Genius Multidisciplinary International Journal Publication. All rights reserved.
      </p>
    </div>
  );
}
