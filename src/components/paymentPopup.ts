type PopupOptions = {
  onBlocked?: () => void;
  onOpened?: (popup: Window) => void;
};

export const openPaymentPopup = (url: string, options: PopupOptions = {}) => {
  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'popup=yes',
    'noopener',
    'noreferrer'
  ].join(',');

  const popup = window.open(url, 'gmi_payment_popup', features);
  if (!popup) {
    options.onBlocked?.();
    return null;
  }
  options.onOpened?.(popup);
  return popup;
};
