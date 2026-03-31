export type PaymentReturnMessage = {
  type: 'payment:return';
  reference?: string;
  status?: string;
  gateway?: string;
  ts?: number;
};

const CHANNEL_NAME = 'gmi_payment_channel';
const STORAGE_KEY = 'gmi_payment_return';

const safeParse = (value: string | null): PaymentReturnMessage | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.type === 'payment:return') return parsed;
  } catch {
    // ignore parse errors
  }
  return null;
};

export const publishPaymentReturn = (message: PaymentReturnMessage) => {
  const payload: PaymentReturnMessage = { ...message, ts: Date.now() };

  // BroadcastChannel (modern browsers)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // ignore
  }

  // LocalStorage fallback (Safari/older)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  // Direct postMessage if opener is available
  try {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch {
    // ignore
  }
};

export const subscribePaymentReturn = (handler: (msg: PaymentReturnMessage) => void) => {
  let channel: BroadcastChannel | null = null;

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event.data as PaymentReturnMessage;
      if (data?.type === 'payment:return') handler(data);
    };
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const data = safeParse(event.newValue);
    if (data) handler(data);
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as PaymentReturnMessage;
    if (data?.type === 'payment:return') handler(data);
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener('message', onMessage);

  return () => {
    try { channel?.close(); } catch { /* ignore */ }
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('message', onMessage);
  };
};
