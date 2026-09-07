import { createContext, useContext, useState, useEffect } from 'react';
import { LANGUAGES, STRINGS } from '../i18n/locales';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('weathergpt_lang') || localStorage.getItem('lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('weathergpt_lang', lang);
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = (key, fallback) => {
    if (!key) return '';
    return STRINGS[lang]?.[key] || STRINGS.en?.[key] || fallback || key;
  };

  const setLanguage = (newLang) => {
    if (STRINGS[newLang]) {
      setLang(newLang);
    }
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLanguage,
        t,
        languages: LANGUAGES,
        currentLanguage,
        availableLanguages: LANGUAGES.map((l) => l.code),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
};
