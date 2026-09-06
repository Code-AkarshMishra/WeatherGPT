import { useLanguage } from '../contexts/LanguageContext';

const LANG_LABELS = {
  en: 'EN',
  hi: 'हि',
};

export default function LanguageToggle() {
  const { lang, setLanguage, availableLanguages } = useLanguage();

  const handleToggle = () => {
    const idx = availableLanguages.indexOf(lang);
    const next = availableLanguages[(idx + 1) % availableLanguages.length];
    setLanguage(next);
  };

  return (
    <button
      className="btn btn-ghost"
      onClick={handleToggle}
      aria-label={`Switch language (current: ${lang})`}
      title="Toggle language"
      id="lang-toggle-btn"
      style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-semibold)',
        padding: 'var(--space-1) var(--space-2)',
        minWidth: 44,
        minHeight: 44,
        letterSpacing: '0.03em',
      }}
    >
      {LANG_LABELS[lang] || lang.toUpperCase()}
    </button>
  );
}
