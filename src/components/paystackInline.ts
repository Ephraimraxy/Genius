export interface PaystackInlineOptions {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref: string;
  onClose?: () => void;
  onSuccess?: (transaction?: any) => void;
}

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export function openPaystackInline(options: PaystackInlineOptions): boolean {
  const PaystackPop = window.PaystackPop;
  if (!PaystackPop) return false;

  const legacyOptions = {
    key: options.key,
    email: options.email,
    amount: options.amount,
    currency: options.currency || 'NGN',
    ref: options.ref,
    onClose: options.onClose,
    callback: options.onSuccess,
  };

  try {
    if (typeof PaystackPop === 'function') {
      const popup = new PaystackPop();

      if (typeof popup?.newTransaction === 'function') {
        popup.newTransaction({
          ...legacyOptions,
          onSuccess: options.onSuccess,
          onCancel: options.onClose,
        });
        return true;
      }

      if (typeof popup?.open === 'function') {
        popup.open({
          ...legacyOptions,
          onSuccess: options.onSuccess,
          onCancel: options.onClose,
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('Paystack v2 inline checkout failed; trying legacy inline checkout.', err);
  }

  if (typeof PaystackPop.setup === 'function') {
    const handler = PaystackPop.setup(legacyOptions);
    if (typeof handler?.open === 'function') {
      handler.open();
      return true;
    }
    if (typeof handler?.openIframe === 'function') {
      handler.openIframe();
      return true;
    }
  }

  return false;
}
