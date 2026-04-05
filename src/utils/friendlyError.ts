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

type ErrorContext =
  | 'upload'
  | 'payment'
  | 'auth'
  | 'download'
  | 'save'
  | 'load'
  | 'generic';

export function friendlyError(err: any, context: ErrorContext = 'generic'): string {
  const raw = String(err?.message || err || '').toLowerCase().trim();

  // Network / connectivity
  if (NETWORK_MESSAGES.some(m => raw.includes(m))) {
    return 'Connection lost. Please check your internet connection and try again.';
  }

  // Timeout
  if (TIMEOUT_MESSAGES.some(m => raw.includes(m))) {
    return 'The request took too long. Please try again in a moment.';
  }

  // Auth / session
  if (AUTH_MESSAGES.some(m => raw.includes(m))) {
    return 'Your session has expired. Please log in again.';
  }

  // Server error
  if (SERVER_MESSAGES.some(m => raw.includes(m))) {
    return 'A server error occurred. Our team has been notified. Please try again shortly.';
  }

  // Payment-specific
  if (context === 'payment') {
    if (raw.includes('transaction reference not found') || raw.includes('reference not found')) {
      return 'Payment reference could not be verified. Please refresh and try again.';
    }
    if (raw.includes('insufficient') || raw.includes('balance')) {
      return 'Insufficient balance. Please top up your wallet and try again.';
    }
    if (raw.includes('duplicate') || raw.includes('already')) {
      return 'This transaction has already been processed.';
    }
    if (raw.includes('gateway')) {
      return 'Payment gateway is temporarily unavailable. Please try again in a moment.';
    }
    return 'Payment could not be completed. Please try again or contact support.';
  }

  // Upload-specific
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
    return 'File upload failed. Please check your connection and try again.';
  }

  // Auth-specific
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
    return 'Authentication failed. Please check your credentials and try again.';
  }

  // Download-specific
  if (context === 'download') {
    return 'Download failed. Please check your connection and try again.';
  }

  // Save-specific
  if (context === 'save') {
    return 'Changes could not be saved. Please try again.';
  }

  // Load-specific
  if (context === 'load') {
    return 'Could not load content. Please refresh the page.';
  }

  // If the backend sent a real user-facing message (short, no stack trace), use it
  // A real user message won't contain "at " (stack frame indicator) or be very long
  const original = String(err?.message || '').trim();
  if (original && original.length < 200 && !original.includes(' at ') && !original.includes('\n')) {
    return original;
  }

  return 'Something went wrong. Please try again or contact support if the problem persists.';
}
