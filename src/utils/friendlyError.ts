/**
 * Translates raw/technical error messages into professional, user-friendly text.
 * Never expose stack traces, internal server errors, or "Failed to fetch" to the user.
 */

const NETWORK_MESSAGES = [
  'failed to fetch',
  'networkerror',
  'network error',
  'load failed',
  'network request failed',
  'fetch error',
  'err_network',
  'err_internet_disconnected',
  'err_connection_refused',
];

const TIMEOUT_MESSAGES = [
  'timeout',
  'timed out',
  'request timeout',
  'aborted',
  'signal is aborted',
];

const AUTH_MESSAGES = [
  'unauthorized',
  '401',
  'jwt',
  'token',
  'not authenticated',
  'session expired',
];

const SERVER_MESSAGES = [
  'internal server error',
  '500',
  'bad gateway',
  '502',
  '503',
  'service unavailable',
];

// Raw DB / system messages that should never reach users
const RAW_TECHNICAL = [
  'violates foreign key',
  'violates unique',
  'constraint',
  'syntax error',
  'pg error',
  'relation',
  'column',
  'enoent',
  'econnrefused',
  'pdf-parse',
  'no callable export',
  'stack trace',
  ' at ',        // stack frame indicator
];

type ErrorContext =
  | 'upload'
  | 'payment'
  | 'auth'
  | 'download'
  | 'save'
  | 'load'
  | 'delete'
  | 'assessment'
  | 'submit'
  | 'generic';

export function friendlyError(err: any, context: ErrorContext = 'generic'): string {
  const raw = String(err?.message || err || '').toLowerCase().trim();

  // Network / connectivity
  if (NETWORK_MESSAGES.some(m => raw.includes(m))) {
    return 'Connection lost. Please check your internet and try again.';
  }

  // Timeout
  if (TIMEOUT_MESSAGES.some(m => raw.includes(m))) {
    if (context === 'assessment') {
      return 'The request took too long. AI question generation may still be running — please wait a moment and refresh.';
    }
    return 'The request took too long. Please try again in a moment.';
  }

  // Auth / session
  if (AUTH_MESSAGES.some(m => raw.includes(m))) {
    return 'Your session has expired. Please log in again.';
  }

  // Server error
  if (SERVER_MESSAGES.some(m => raw.includes(m))) {
    return 'A server error occurred. Please try again shortly.';
  }

  // Raw technical leak — never show these verbatim
  if (RAW_TECHNICAL.some(m => raw.includes(m))) {
    if (context === 'delete') return 'This item could not be deleted because some linked records still exist.';
    if (context === 'save') return 'Changes could not be saved. Please try again.';
    return 'Something went wrong on our end. Please try again.';
  }

  // ── Assessment-specific ──────────────────────────────────────────────────
  if (context === 'assessment') {
    if (raw.includes('no material') || raw.includes('no lecture material')) {
      return 'No lecture material is linked to this assessment. Please attach at least one material and try again.';
    }
    if (raw.includes('too short') || raw.includes('material is too short')) {
      return 'The linked material is too short for the AI to generate questions from. Please link a more detailed document.';
    }
    if (raw.includes('no valid questions') || raw.includes('no questions generated')) {
      return 'The AI could not generate valid questions from the linked material. Try linking a richer or more detailed resource.';
    }
    if (raw.includes('ai generation failed') || raw.includes('question generation failed')) {
      return 'AI question generation encountered a problem. Please check your linked materials and try again.';
    }
    if (raw.includes('time window has passed') || raw.includes('window has passed')) {
      return 'Your assigned time window for this assessment has passed. Please contact your lecturer.';
    }
    if (raw.includes('not started yet') || raw.includes('slot has not started')) {
      return 'This assessment has not started yet. Please wait until your scheduled time.';
    }
    if (raw.includes('used all') && raw.includes('attempt')) {
      return 'You have used all your available attempts for this assessment.';
    }
    if (raw.includes('deadline') || raw.includes('has ended')) {
      return 'This assessment has ended. The deadline has passed.';
    }
    if (raw.includes('already published')) {
      return 'This assessment is already published and cannot be published again.';
    }
    if (raw.includes('no questions') || raw.includes('has no questions')) {
      return 'This assessment has no questions yet. Please contact your lecturer.';
    }
  }

  // ── Payment-specific ─────────────────────────────────────────────────────
  if (context === 'payment') {
    if (raw.includes('no publication credit') || raw.includes('publication credit')) {
      return 'No active publication credit found. Please complete payment before uploading.';
    }
    if (raw.includes('transaction reference not found') || raw.includes('reference not found')) {
      return 'Payment reference could not be verified. Please refresh and try again.';
    }
    if (raw.includes('payment not confirmed') || raw.includes('not confirmed')) {
      return 'Your payment has not been confirmed yet. Please wait a moment and try again.';
    }
    if (raw.includes('insufficient') || raw.includes('balance')) {
      return 'Insufficient balance. Please top up your wallet and try again.';
    }
    if (raw.includes('duplicate') || raw.includes('already processed')) {
      return 'This transaction has already been processed.';
    }
    if (raw.includes('gateway')) {
      return 'Payment gateway is temporarily unavailable. Please try again in a moment.';
    }
    if (raw.includes('already paid') || raw.includes('already access')) {
      return 'You have already paid for this item.';
    }
    return 'Payment could not be completed. Please try again or contact support.';
  }

  // ── Upload-specific ───────────────────────────────────────────────────────
  if (context === 'upload') {
    if (raw.includes('corrupt') || raw.includes('body element') || raw.includes('invalid')) {
      return 'The file appears to be corrupted or is not a valid document. Please re-save it and try again.';
    }
    if (raw.includes('too large') || raw.includes('size')) {
      return 'The file is too large. Please reduce the file size and try again.';
    }
    if (raw.includes('type') || raw.includes('format') || raw.includes('unsupported')) {
      return 'Unsupported file format. Please upload a PDF or DOCX file.';
    }
    if (raw.includes('pdf-parse') || raw.includes('no callable')) {
      return 'The PDF could not be read. Please re-save it as a standard PDF and try again.';
    }
    if (raw.includes('duplicate') || raw.includes('already been submitted') || raw.includes('already submitted')) {
      const original = String(err?.message || '').trim();
      if (original && original.length < 300) return original;
      return 'A manuscript with this title has already been submitted. Duplicate submissions are not permitted.';
    }
    // If the server sent a short, readable message, show it directly
    const original = String(err?.message || '').trim();
    if (original && original.length < 200 && !original.includes(' at ') && !original.includes('\n')) {
      return original;
    }
    return 'File upload failed. Please check your connection and try again.';
  }

  // ── Auth-specific ─────────────────────────────────────────────────────────
  if (context === 'auth') {
    if (raw.includes('invalid') || raw.includes('incorrect') || raw.includes('wrong')) {
      return 'Invalid email or password. Please try again.';
    }
    if (raw.includes('exist') || raw.includes('registered') || raw.includes('duplicate')) {
      return 'An account with this email already exists. Please log in instead.';
    }
    if (raw.includes('not found') || raw.includes('no user')) {
      return 'No account found with that email address.';
    }
    if (raw.includes('suspended') || raw.includes('disabled')) {
      return 'Your account has been suspended. Please contact your lecturer.';
    }
    return 'Authentication failed. Please check your credentials and try again.';
  }

  // ── Delete-specific ───────────────────────────────────────────────────────
  if (context === 'delete') {
    if (raw.includes('not found')) return 'The item could not be found. It may have already been deleted.';
    if (raw.includes('permission') || raw.includes('unauthorized') || raw.includes('forbidden')) {
      return 'You do not have permission to delete this item.';
    }
    return 'This item could not be deleted. Please try again.';
  }

  // ── Submit-specific ───────────────────────────────────────────────────────
  if (context === 'submit') {
    if (raw.includes('already submitted')) return 'You have already submitted this assessment.';
    if (raw.includes('time') || raw.includes('expired')) return 'Time is up. Your answers have been recorded as submitted.';
    return 'Submission failed. Please try again or contact your lecturer.';
  }

  // ── Download-specific ─────────────────────────────────────────────────────
  if (context === 'download') {
    return 'Download failed. Please check your connection and try again.';
  }

  // ── Save-specific ─────────────────────────────────────────────────────────
  if (context === 'save') {
    return 'Changes could not be saved. Please try again.';
  }

  // ── Load-specific ─────────────────────────────────────────────────────────
  if (context === 'load') {
    if (raw.includes('not found') || raw.includes('404')) return 'The content you are looking for could not be found.';
    return 'Content could not be loaded. Please refresh the page.';
  }

  // If the backend sent a real user-facing message (short, no stack trace), show it
  const original = String(err?.message || '').trim();
  if (
    original &&
    original.length < 250 &&
    !original.includes(' at ') &&
    !original.includes('\n') &&
    !RAW_TECHNICAL.some(m => original.toLowerCase().includes(m))
  ) {
    return original;
  }

  return 'Something went wrong. Please try again or contact support if the problem persists.';
}
