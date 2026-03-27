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
  doi = "Pending",
  volume = "—",
  issue = "—",
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
      const s = String(raw);
      return s.replace(/^\["?|"?\]$/g, '').replace(/","/g, ', ');
    }
  };

  const authorNames = formatAuthors(authors);

  // Ultra-aggressive dynamic sizing logic
  const titleLength = title.length;
  const titleSizeClass = 
    titleLength > 300 ? 'text-[14px] md:text-lg' : 
    titleLength > 200 ? 'text-lg md:text-xl' : 
    titleLength > 150 ? 'text-xl md:text-2xl' : 
    'text-3xl md:text-4xl';
  
  const authorsLength = authorNames.length;
  const authorsSizeClass = authorsLength > 150 ? 'text-[10px] md:text-xs' : authorsLength > 80 ? 'text-xs md:text-base' : 'text-lg md:text-xl';

  const compactMode = titleLength > 120 || authorsLength > 80;

  return (
    <div className="flex items-center justify-center p-2 sm:p-4 bg-slate-100 min-h-[500px] w-full overflow-hidden">
      <div className="relative w-full max-w-[1122px] aspect-[1.414/1] bg-white shadow-2xl overflow-hidden font-serif print:shadow-none print:m-0 flex flex-col" id="publication-certificate">
        
        {/* SVG Background Layer (Absolute Positioned) */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 1122 794" className="w-full h-full">
            <rect x="20" y="20" width="1082" height="754" fill="none" stroke="#800000" strokeWidth="4" />
            <rect x="35" y="35" width="1052" height="724" fill="none" stroke="#800000" strokeWidth="1" />
            <path d="M20 100 V20 H100" fill="none" stroke="#800000" strokeWidth="8" />
            <path d="M1022 20 H1102 V100" fill="none" stroke="#800000" strokeWidth="8" />
            <path d="M20 694 V774 H100" fill="none" stroke="#800000" strokeWidth="8" />
            <path d="M1022 774 H1102 V694" fill="none" stroke="#800000" strokeWidth="8" />
            <circle cx="561" cy="420" r="300" fill="#800000" fillOpacity="0.015" />
          </svg>
        </div>

        {/* Content Layer (Flexbox to force footer into view) */}
        <div className={`relative z-10 w-full h-full flex flex-col ${compactMode ? 'p-6 md:p-10' : 'p-12 md:p-16'} text-center overflow-hidden`}>
          
          {/* 1. Header Section (Shrink Allowed) */}
          <div className={`shrink-0 w-full flex justify-between items-center ${compactMode ? 'gap-2 mb-2 md:mb-4' : 'gap-4 mb-6 md:mb-10'}`}>
            <img src={publisherLogo} alt="GMIJP" className={`${compactMode ? 'w-12 h-12 md:w-16 md:h-16' : 'w-16 h-16 md:w-24 md:h-24'} object-contain`} />
            <div className="flex-1">
              <h1 className={`${compactMode ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'} font-black text-slate-900 uppercase tracking-tight leading-tight`}>
                Genius Multidisciplinary<br />
                International Journal Publication
              </h1>
              <p className="text-[8px] md:text-xs font-bold text-[#800000] mt-0.5 tracking-[0.2em] uppercase">
                Academic Excellence & Global Reach
              </p>
            </div>
            <img src={institutionLogo} alt="NSUK" className={`${compactMode ? 'w-12 h-12 md:w-16 md:h-16' : 'w-16 h-16 md:w-24 md:h-24'} object-contain`} />
          </div>

          {/* 2. Main Body (Scrollable or Clipped if absolutely necessary, but intended to fit) */}
          <div className="flex-1 flex flex-col justify-center items-center gap-2 md:gap-4 max-w-5xl mx-auto overflow-hidden min-h-0">
            <div className="space-y-1">
              <h2 className={`${compactMode ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl'} font-extrabold text-[#800000] tracking-tighter uppercase font-display italic leading-none`}>
                Certificate of Publication
              </h2>
              <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-[#800000] to-transparent mx-auto rounded-full"></div>
            </div>

            <div className="w-full flex-1 flex flex-col justify-center gap-2 md:gap-4 min-h-0">
              <p className={`${compactMode ? 'text-xs md:text-sm' : 'text-sm md:text-lg'} text-slate-500 font-medium italic underline decoration-slate-100 underline-offset-4`}>
                This is to certify that the research paper titled
              </p>
              
              <div className="max-h-[40%] overflow-hidden flex items-center justify-center">
                <h3 className={`${titleSizeClass} font-black text-slate-900 leading-[1.2] px-2 md:px-10 break-words balance-text`}>
                  "{title}"
                </h3>
              </div>

              <div className="py-1 md:py-2">
                <p className={`${compactMode ? 'text-[10px] md:text-xs' : 'text-sm md:text-lg'} text-slate-500 font-medium mb-1`}>authored by</p>
                <div className="max-h-[20%] overflow-hidden">
                  <h4 className={`${authorsSizeClass} font-bold text-slate-900 underline decoration-[#800000] decoration-2 underline-offset-4 inline-block px-4 max-w-full italic`}>
                    {authorNames}
                  </h4>
                </div>
              </div>

              <p className={`${compactMode ? 'text-[10px] md:text-sm' : 'text-sm md:text-lg'} text-slate-600 leading-relaxed px-4 md:px-16`}>
                has been accepted and successfully published in the <strong>{journalName}</strong>. 
                The work demonstrates significant scholarly merit and professional integrity.
              </p>
            </div>
          </div>

          {/* 3. Footer Section (Forced to stay at bottom) */}
          <div className={`shrink-0 w-full grid grid-cols-3 items-end gap-2 md:gap-4 mt-2 md:mt-6 pt-4 border-t border-slate-100`}>
            {/* Left: Secretary Column */}
            <div className="text-center">
              <div className={`${compactMode ? 'mb-1 h-10 md:h-12' : 'mb-2 h-16 md:h-20'} flex flex-col items-center justify-end`}>
                {signatureImage ? (
                  <img src={signatureImage} alt="Signature" className={`${compactMode ? 'max-h-8' : 'max-h-16'} object-contain mix-blend-multiply`} />
                ) : (
                  <svg width="60" height="25" viewBox="0 0 120 50" className="text-blue-700 opacity-60">
                    <path d="M10,35 Q30,10 50,35 T90,35 T110,20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M15,25 C35,45 75,5 95,25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </div>
              <div className="w-full h-px bg-slate-300 mb-1"></div>
              <p className="text-[10px] md:text-xs font-black text-slate-900 leading-tight">{secretaryName}</p>
              <p className="text-[6px] md:text-[8px] font-bold text-[#800000] uppercase tracking-widest leading-tight">Secretary, Editorial Board</p>
            </div>

            {/* Center: Official Seal */}
            <div className="flex flex-col items-center justify-center">
              <div className={`relative group ${compactMode ? 'w-14 h-14 md:w-16 md:h-16' : 'w-20 h-20 md:w-28 md:h-28'}`}>
                <div className="absolute inset-0 rounded-full border-2 md:border-4 border-[#800000]/10"></div>
                <div className="absolute inset-0 rounded-full border border-dashed border-[#800000]/30 animate-[spin_30s_linear_infinite]"></div>
                <div className="absolute inset-2 md:inset-3 rounded-full bg-[#800000]/5 flex items-center justify-center p-2">
                   <img src={publisherLogo} alt="Seal" className="w-full h-full object-contain grayscale opacity-40" />
                </div>
              </div>
              <p className="text-[5px] md:text-[6px] font-black text-[#800000] mt-1 uppercase tracking-[0.2em]">Official Archive Seal</p>
            </div>

            {/* Right: Technical Metadata Column */}
            <div className="text-right space-y-0.5 md:space-y-1">
              <div className="space-y-0.5">
                <p className="text-[7px] md:text-[10px] font-black text-[#800000] tracking-tight whitespace-nowrap">DOI: <span className="text-slate-900">{doi}</span></p>
                <p className="text-[6px] md:text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                  Vol. {volume} · No. {issue}
                </p>
              </div>
              
              <div className="pt-1">
                 <p className="text-[8px] md:text-xs font-bold text-slate-600">Issued: <span className="text-slate-900">{date}</span></p>
                 <p className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">ID: {certificateId}</p>
              </div>

              <div className="hidden md:block mt-1">
                 <div className="bg-slate-50 border border-slate-100 p-1 rounded inline-flex items-center gap-1">
                    <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-[5px] font-bold text-slate-300 uppercase text-center p-0.5">
                       Secure QR
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right Banner */}
        <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[200%] h-8 md:h-12 bg-[#800000] text-white flex items-center justify-center font-bold text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg rotate-45 translate-x-[25%] translate-y-[25%] border-b border-light-200">
            Verified Record
          </div>
        </div>
      </div>
    </div>
  );
}
