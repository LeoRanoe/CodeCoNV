"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type AppLanguage = "en" | "nl";

type LanguageContextValue = {
  language: AppLanguage;
  locale: "en-US" | "nl-NL";
  setLanguage: (language: AppLanguage) => void;
  text: (english: string, dutch: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function subscribeLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("codeco-language-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("codeco-language-change", callback);
  };
}

// CODECO works in Dutch on site. English stays available, but it is a deliberate
// choice now instead of what everybody gets on a fresh device or after clearing data.
//
// Devices that used the app before Dutch became the default carry an "en" value that
// nobody ever chose: it was simply what the app started in. Only a language picked in
// the switcher counts as a choice, so those devices open in Dutch and stay in whatever
// the supervisor picks afterwards.
const chosenLanguageKey = "codeco-language-choice";

function languageSnapshot(): AppLanguage {
  const chosen = window.localStorage.getItem(chosenLanguageKey);
  return chosen === "en" || chosen === "nl" ? chosen : "nl";
}

/**
 * `fixed` pins a surface to one language regardless of the switcher: the contractor's shared
 * link is Dutch throughout, even on a device where Supervisie was switched to English.
 */
export function LanguageProvider({ children, fixed }: { children: React.ReactNode; fixed?: AppLanguage }) {
  const chosen = useSyncExternalStore<AppLanguage>(subscribeLanguage, languageSnapshot, () => "nl");
  const language = fixed ?? chosen;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === "en" ? "en-US" : "nl-NL",
    setLanguage: (nextLanguage) => {
      window.localStorage.setItem(chosenLanguageKey, nextLanguage);
      window.localStorage.setItem("codeco-language", nextLanguage);
      window.dispatchEvent(new Event("codeco-language-change"));
    },
    text: (english, dutch) => language === "en" ? english : dutch,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, text } = useLanguage();
  return (
    <label className={`language-switcher ${compact ? "compact" : ""}`}>
      <span>{text("Language", "Taal")}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)} aria-label={text("Interface language", "Interfacetaal")}>
        <option value="en">English</option>
        <option value="nl">Nederlands</option>
      </select>
    </label>
  );
}
