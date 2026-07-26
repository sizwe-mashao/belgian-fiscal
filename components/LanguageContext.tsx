"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "EN" | "FR" | "NL" | "DE";

export const LANGS: Lang[] = ["EN", "FR", "NL", "DE"];

const STORAGE_KEY = "obbe-lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as string[]).includes(value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The first render is always EN. Reading storage during render — or in the
  // useState initialiser — would give the client different markup from the
  // server, which React rejects as a hydration mismatch.
  const [lang, setLangState] = useState<Lang>("EN");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // A single catch-up render on mount is the point: storage cannot be read
      // any earlier without the server and client disagreeing.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isLang(stored)) setLangState(stored);
    } catch {
      // Storage throws in some private-browsing modes; keep the default.
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort: the choice still holds for this session.
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error(
      "useLanguage must be used inside a LanguageProvider — add it in app/layout.tsx."
    );
  }
  return context;
}
