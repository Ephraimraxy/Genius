import React from 'react';

interface PublicationCertificateProps {
  title: string;
  authors: string | string[];
  date?: string;
  certificateId?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  journalName?: string;
  publisherLogo?: string;
  institutionLogo?: string;
  secretaryName?: string;
  signatureImage?: string;
}

export default function PublicationCertificate({
  title,
  authors,
  date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  certificateId = `GMIJP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
  doi,
  volume,
  issue,
  journalName = "Genius Multidisciplinary International Journal Publication",
  publisherLogo = "/gmijp-logo.png",
  institutionLogo = "/Nasarawa-State-University.jpg",
  secretaryName = "Dr. Danjuma Namo",
  signatureImage
}: PublicationCertificateProps) {
  
  const formatAuthors = (raw: string | string[]): string => {
    if (!raw) return 'Researcher';
    if (Array.isArray(raw)) return raw.join(', ');
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(a => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
      }
      return String(parsed);
    } catch {
      return raw.replace(/^\["?|"?\]$/g, '').replace(/","/g, ', ');
    }
  };

  const authorNames = formatAuthors(authors);

  return (
    <div className="flex items-center justify-center p-4 bg-slate-100 min-h-screen">
      <div className="relative w-full max-w-[1122px] aspect-[1.414/1] bg-white shadow-2xl overflow-hidden font-serif print:shadow-none" id="publication-certificate">
        {/* SVG Background Layer */}
        <svg viewBox="0 0 1122 794" className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Main Border */}
          <rect x="20" y="20" width="1082" height="754" fill="none" stroke="#800000" strokeWidth="4" />
          <rect x="35" y="35" width="1052" height="724" fill="none" stroke="#800000" strokeWidth="1" />
          
          {/* Decorative Corners */}
          <path d="M20 100 V20 H100" fill="none" stroke="#800000" strokeWidth="8" />
          <path d="M1022 20 H1102 V100" fill="none" stroke="#800000" strokeWidth="8" />
          <path d="M20 694 V774 H100" fill="none" stroke="#800000" strokeWidth="8" />
          <path d="M1022 774 H1102 V694" fill="none" stroke="#800000" strokeWidth="8" />

          {/* Background Watermark/Pattern */}
          <circle cx="561" cy="420" r="300" fill="#800000" fillOpacity="0.02" />
          
          {/* Subtle Guilloche-like pattern in corners */}
          <g opacity="0.1" stroke="#800000" strokeWidth="0.5">
            <rect x="50" y="50" width="60" height="60" fill="none" strokeDasharray="2,2" />
            <rect x="1012" y="50" width="60" height="60" fill="none" strokeDasharray="2,2" />
            <rect x="50" y="684" width="60" height="60" fill="none" strokeDasharray="2,2" />
            <rect x="1012" y="684" width="60" height="60" fill="none" strokeDasharray="2,2" />
          </g>
        </svg>

        {/* Content Layer */}
        <div className="relative z-10 h-full flex flex-col items-center justify-between p-24 text-center">
          {/* Header Section */}
          <div className="w-full flex justify-between items-center mb-10">
            <img src={publisherLogo} alt="GMIJP Logo" className="w-24 h-24 object-contain" />
            <div className="flex-1 px-8">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                Genius Multidisciplinary<br />
                International Journal Publication
              </h1>
              <p className="text-sm font-bold text-[#800000] mt-1 tracking-[0.2em] uppercase">
                Academic Excellence & Global Reach
              </p>
            </div>
            <img src={institutionLogo} alt="NSUK Logo" className="w-24 h-24 object-contain" />
          </div>

          {/* Main Title */}
          <div className="space-y-4">
            <h2 className="text-5xl font-extrabold text-[#800000] tracking-tighter uppercase font-display">
              Certificate of Publication
            </h2>
            <div className="h-1 w-48 bg-[#800000] mx-auto rounded-full"></div>
          </div>

          {/* Body Content */}
          <div className="max-w-4xl space-y-8 mt-6">
            <p className="text-lg text-slate-600 font-medium italic">
              This is to certify that the research paper titled
            </p>
            
            <h3 className="text-3xl font-black text-slate-900 leading-tight px-10">
              "{title}"
            </h3>

            <p className="text-lg text-slate-600 font-medium">
              authored by
            </p>

            <h4 className="text-2xl font-bold text-slate-900 underline decoration-[#800000] decoration-2 underline-offset-8">
              {authorNames}
            </h4>

            <p className="text-lg text-slate-600 leading-relaxed px-16">
              has been accepted and successfully published in the <strong>{journalName}</strong>. 
              The work demonstrates significant scholarly merit and professional integrity.
            </p>
          </div>

          {/* Footer Section */}
          <div className="w-full flex justify-between items-end mt-12 px-10">
            {/* Signature 1 */}
            <div className="text-center">
              <div className="mb-2 h-20 w-48 flex flex-col items-center justify-end">
                {signatureImage ? (
                  <img src={signatureImage} alt="Signature" className="max-h-16 object-contain mix-blend-multiply" />
                ) : (
                  <svg width="120" height="50" viewBox="0 0 120 50" className="text-blue-700 opacity-80">
                    <path d="M10,35 Q30,10 50,35 T90,35 T110,20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M15,25 C35,45 75,5 95,25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
                <div className="w-full h-px bg-slate-300"></div>
              </div>
              <p className="text-sm font-black text-slate-900">{secretaryName}</p>
              <p className="text-[10px] font-bold text-[#800000] uppercase tracking-widest">Secretary, Editorial Board</p>
            </div>

            {/* Seal Area */}
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-[#800000]/20 flex items-center justify-center relative">
                 <div className="absolute inset-0 rounded-full border border-dashed border-[#800000]/40 animate-[spin_20s_linear_infinite]"></div>
                 <div className="w-24 h-24 rounded-full bg-[#800000]/5 flex items-center justify-center p-3">
                    <img src={publisherLogo} alt="Seal" className="w-full h-full object-contain grayscale opacity-60" />
                 </div>
              </div>
              <p className="text-[8px] font-black text-[#800000] mt-2 uppercase tracking-[0.3em]">Official Seal</p>
            </div>

            <div className="text-right space-y-1">
              {doi && <p className="text-xs font-black text-[#800000] tracking-tight">DOI: {doi}</p>}
              {(volume || issue) && (
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  {volume && `Volume ${volume}`} {issue && `· Issue ${issue}`}
                </p>
              )}
              <div className="pt-2">
                 <p className="text-sm font-bold text-slate-600">Issued Date: <span className="text-slate-900">{date}</span></p>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Certificate ID: {certificateId}</p>
              </div>
              <div className="mt-4">
                 <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg inline-block">
                    {/* Placeholder for QR Code */}
                    <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase text-center p-1">
                       Verification Code
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagonal Corner Banner */}
        <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[200%] h-12 bg-[#800000] text-white flex items-center justify-center font-bold text-[10px] uppercase tracking-widest shadow-lg rotate-45 translate-x-[25%] translate-y-[25%]">
            Verified Academic Record
          </div>
        </div>
      </div>
    </div>
  );
}
