import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LANGUAGES, STRINGS, SPEECH_LOCALES } from '../i18n/locales';

const LanguageContext = createContext(null);

/**
 * Resolves a dotted key path like 'weather.current.temperature' in a nested or flat object.
 * Strictly returns only string or number scalars (never objects/functions/arrays).
 */
function resolveKey(obj, path) {
  if (!obj || !path) return undefined;

  // 1. Direct flat key lookup
  if (obj[path] !== undefined && typeof obj[path] !== 'object') {
    return obj[path];
  }

  // 2. Dotted nested lookup
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  // Never return an object or array to React children
  if (typeof current === 'string' || typeof current === 'number') {
    return current;
  }

  // If current is an object that has a 'title' or 'name' property, return that as a helpful default
  if (current && typeof current === 'object') {
    if (typeof current.name === 'string') return current.name;
    if (typeof current.title === 'string') return current.title;
  }

  return undefined;
}

/**
 * Interpolates template strings like "Temperature: {{temp}}°C"
 */
function interpolate(template, params) {
  if (!template || !params || typeof params !== 'object') return template;
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return params[key] !== undefined ? params[key] : `{{${key}}}`;
  });
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('weathergpt_lang') || localStorage.getItem('lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('weathergpt_lang', lang);
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
    const langObj = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.setAttribute('dir', langObj?.dir || 'ltr');
  }, [lang]);

  const t = useCallback(
    (key, fallbackOrParams, maybeParams) => {
      if (!key) return '';

      let fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined;
      let params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;

      // 1. Try current language
      let value = resolveKey(STRINGS[lang], key);

      // 2. Fallback to English
      if (value === undefined && lang !== 'en') {
        value = resolveKey(STRINGS.en, key);
      }

      // 3. Fallback to provided fallback string or key itself
      if (value === undefined) {
        value = fallback !== undefined ? fallback : key.split('.').pop() || key;
      }

      return interpolate(value, params);
    },
    [lang]
  );

  const setLanguage = useCallback((newLang) => {
    if (STRINGS[newLang] || LANGUAGES.some((l) => l.code === newLang)) {
      setLang(newLang);
    }
  }, []);

  const currentLanguage = useMemo(
    () => LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0],
    [lang]
  );

  const speechLocale = useMemo(
    () => SPEECH_LOCALES[lang] || SPEECH_LOCALES.en || 'en-IN',
    [lang]
  );

  // Locale-aware Date / Time / Number formatters
  const formatDate = useCallback(
    (date, options = {}) => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(speechLocale, {
          dateStyle: options.dateStyle || 'medium',
          ...options,
        }).format(d);
      } catch {
        return String(date);
      }
    },
    [speechLocale]
  );

  const formatTime = useCallback(
    (date, options = {}) => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(speechLocale, {
          timeStyle: options.timeStyle || 'short',
          ...options,
        }).format(d);
      } catch {
        return String(date);
      }
    },
    [speechLocale]
  );

  const formatNumber = useCallback(
    (num, options = {}) => {
      try {
        return new Intl.NumberFormat(speechLocale, options).format(Number(num));
      } catch {
        return String(num);
      }
    },
    [speechLocale]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLanguage,
        t,
        languages: LANGUAGES,
        currentLanguage,
        speechLocale,
        availableLanguages: LANGUAGES.map((l) => l.code),
        formatDate,
        formatTime,
        formatNumber,
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
