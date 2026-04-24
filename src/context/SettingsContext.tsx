import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface PlatformSettings {
  navVisibility: Record<string, boolean>;
  gateways: { paystack: boolean; kora: boolean };
  republishConfig: { enabled: boolean; paid: boolean; amount: number };
  pubPrice: number;
  subPrice: number;
  aiModel: string;
}

const DEFAULTS: PlatformSettings = {
  navVisibility: { apa_validation: true, writing: true, formatting: true, references: true, integrity: true, reviews: true, journals: true },
  gateways: { paystack: true, kora: true },
  republishConfig: { enabled: false, paid: false, amount: 0 },
  pubPrice: 5000,
  subPrice: 15000,
  aiModel: 'gpt-5.4',
};

const SettingsContext = createContext<PlatformSettings>(DEFAULTS);
export const useSettings = () => useContext(SettingsContext);

function applyPatch(prev: PlatformSettings, data: Record<string, any>): PlatformSettings {
  const next = { ...prev };
  if (data.nav_visibility)   next.navVisibility   = data.nav_visibility;
  if (data.gateways)         next.gateways         = data.gateways;
  if (data.republish_config) next.republishConfig  = data.republish_config;
  if (data.pub_price  !== undefined) next.pubPrice  = data.pub_price;
  if (data.sub_price  !== undefined) next.subPrice  = data.sub_price;
  if (data.ai_model)         next.aiModel          = data.ai_model;
  return next;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const esRef    = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const connect = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const es = new EventSource(`/api/settings/stream?token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.onmessage = (e) => {
        if (!active) return;
        try {
          const data = JSON.parse(e.data);
          setSettings(prev => applyPatch(prev, data));
        } catch { /* ignore malformed / heartbeat */ }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (active) retryRef.current = setTimeout(connect, 5000);
      };
    };

    connect();

    // Reconnect when user logs in or out (token changes)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') { esRef.current?.close(); connect(); }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}
