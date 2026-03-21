import React from 'react';
import { Mail, Phone, Globe, MapPin } from 'lucide-react';

interface AcceptanceLetterProps {
  manuscriptId: number;
  title: string;
  authors: string;
  recipientName?: string;
  date?: string;
}

export default function AcceptanceLetter({ manuscriptId, title, authors, recipientName, date = new Date().toLocaleDateString('en-GB') }: AcceptanceLetterProps) {
  // Smart author formatting: handle JSON arrays, stringified arrays, or plain text
  const formatAuthors = (raw: string): string => {
    if (!raw) return 'Researcher';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(', ');
      }
      return String(parsed);
    } catch {
      // Already a plain string - just clean up any stray brackets
      return raw.replace(/^\["?|"?\]$/g, '').replace(/","/g, ', ');
    }
  };

  const displayName = recipientName || formatAuthors(authors);

  return (
    <div className="bg-white p-12 max-w-[800px] mx-auto shadow-2xl min-h-[1050px] font-serif text-slate-800 print:shadow-none print:p-8" id="acceptance-letter">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#800000] pb-6 mb-8 relative">
        <img src="/gmijp-logo.png" alt="GMIJP Logo" className="w-20 h-20 object-contain shrink-0" />
        
        <div className="text-center flex-1 mx-4">
          <h1 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tight">
            Genius Multidisciplinary<br />
            International Journal Publication
          </h1>
          <h2 className="text-base font-bold text-[#800000]">NASARAWA STATE UNIVERSITY, KEFFI</h2>
        </div>

        <img src="/Nasarawa-State-University.jpg" alt="NSUK Logo" className="w-20 h-20 object-contain shrink-0" />
      </div>

      <div className="flex justify-between items-start mb-8">
        <div className="text-left py-2 px-4 bg-slate-50 rounded-lg border border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
           <p className="text-xs font-bold text-emerald-600 uppercase">Official Acceptance</p>
        </div>
        <div className="text-right">
           <p className="text-sm font-bold text-slate-600">{date}</p>
        </div>
      </div>

      {/* Salutation */}
      <div className="mb-8">
        <p className="font-bold text-lg mb-1">Dear {displayName},</p>
      </div>

      {/* Subject */}
      <div className="mb-8">
        <h3 className="font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-wide">
          Subject: Acceptance of Publication in Genius Multidisciplinary International Journal Publication
        </h3>
      </div>

      {/* Content */}
      <div className="space-y-6 text-justify leading-relaxed text-sm">
        <p>
          I hope this letter finds you well. On behalf of the editorial board of the Genius Multidisciplinary 
          International Journal Publication, I am pleased to inform you that your research paper titled 
          <span className="font-black text-slate-900 block my-3 italic">"{title}"</span>
          has been accepted for publication in our journal.
        </p>

        <p>
          We would like to extend our congratulations on the quality of your work. Your research makes a 
          significant contribution to the field, and we believe it will be of great interest to our readership. 
          We appreciate the time and effort you have invested in this research project.
        </p>

        <p>
          <strong>The final version of your manuscript:</strong> Please make any required revisions as per the feedback 
          provided by the peer reviewers and ensure that your paper adheres to the formatting guidelines 
          specified in our author instructions. We would like to take this opportunity to express our 
          appreciation for your valuable contribution to the journal. Your research will undoubtedly inspire 
          and inform fellow researchers in the field.
        </p>

        <p>
          We hope to continue collaborating with you in the future. Should you have any questions or require 
          further assistance, please do not hesitate to contact us. We are here to support you throughout 
          the publication process.
        </p>

        <p>
          Thank you once again for choosing the Genius Multidisciplinary International Journal as the platform 
          to share your research. We look forward to a successful collaboration.
        </p>
      </div>

      {/* Sign-off */}
      <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end">
        <div>
          <p className="font-bold text-slate-900">Best regards,</p>
          <div className="my-4 h-16 w-38 overflow-hidden opacity-80">
            {/* Signature Area */}
            <svg width="150" height="60" viewBox="0 0 150 60" className="text-blue-600">
               <path d="M10,40 Q30,10 50,40 T90,40 T130,20" fill="none" stroke="currentColor" strokeWidth="2" />
               <path d="M20,30 C40,50 80,10 100,30" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          <p className="font-black text-slate-900 tracking-tight">Dr. Danjuma Namo</p>
          <p className="text-xs font-bold text-[#800000]">Secretary (GMIJP)</p>
        </div>

        <div className="text-[9px] text-slate-400 font-bold space-y-1 text-right italic">
           <div className="flex items-center gap-1 justify-end"><Mail size={10} /> enquiries@gmijp.edu.ng</div>
           <div className="flex items-center gap-1 justify-end"><Globe size={10} /> www.gmijp.edu.ng</div>
           <div className="flex items-center gap-1 justify-end"><MapPin size={10} /> Nasarawa State University, Keffi</div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-12 text-center border-t border-slate-100 pt-4">
        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">
          Genius Multidisciplinary International Journal Publication • Research Excellence
        </p>
      </div>
    </div>
  );
}
