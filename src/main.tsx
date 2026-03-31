import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PaymentReturn from './components/PaymentReturn.tsx';
import './index.css';

const isPaymentReturn = window.location.pathname === '/payment/return';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPaymentReturn ? <PaymentReturn /> : <App />}
  </StrictMode>,
);

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
  });
}
