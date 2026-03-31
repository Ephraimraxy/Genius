const sanitizePdfText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u201C\u201D]/g, '"') // Fancy double quotes
    .replace(/[\u2018\u2019]/g, "'") // Fancy single quotes
    .replace(/[\u2013\u2014]/g, '-') // En and Em dashes
    .replace(/\u00A0/g, ' ')         // Non-breaking space
    .replace(/[\r\n]+/g, ' ')        // Replace newlines and CRs with spaces
    // Transliterate common Greek characters for academic papers
    .replace(/\u03C7/g, 'chi')       // χ
    .replace(/\u03B1/g, 'alpha')     // α
    .replace(/\u03B2/g, 'beta')      // β
    .replace(/\u03B3/g, 'gamma')     // γ
    .replace(/\u03B4/g, 'delta')     // δ
    .replace(/\u03B5/g, 'epsilon')   // ε
    .replace(/\u03B8/g, 'theta')     // θ
    .replace(/\u03BC/g, 'mu')        // μ
    .replace(/\u03C0/g, 'pi')        // π
    .replace(/\u03C3/g, 'sigma')     // σ
    .replace(/\u03C9/g, 'omega')     // ω
    .replace(/[^\x00-\x7F]/g, '?');  // Fallback for everything else non-ASCII
};
