import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';

export default function LanguageToggle() {
  const { lang, setLanguage, languages, currentLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="language-selector-container" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-language-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        id="lang-selector-btn"
        title="Change language / भाषा बदलें"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 'var(--radius-full, 9999px)',
          background: 'var(--color-bg-card, #1f2937)',
          border: '1px solid var(--color-border, #374151)',
          color: 'var(--color-text-primary, #f9fafb)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 38,
          transition: 'all 150ms ease',
        }}
      >
        <Globe size={15} style={{ color: 'var(--color-primary, #38bdf8)' }} />
        <span style={{ letterSpacing: '0.01em' }}>{currentLanguage.native}</span>
        <ChevronDown size={13} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="language-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 220,
            maxHeight: 380,
            overflowY: 'auto',
            background: 'var(--color-bg-card, #1f2937)',
            border: '1px solid var(--color-border, #374151)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.35))',
            zIndex: 1000,
            padding: '6px 0',
            animation: 'fadeIn 150ms ease both',
          }}
        >
          <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid var(--color-border, #374151)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select Language / भाषा
          </div>

          {languages.map((item) => {
            const isSelected = item.code === lang;
            return (
              <button
                key={item.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: isSelected ? 'var(--color-primary, #38bdf8)' : 'var(--color-text-primary, #f9fafb)',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--color-border-light, rgba(255,255,255,0.06))';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.88rem' }}>{item.native}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted, #9ca3af)' }}>{item.label}</span>
                </div>
                {isSelected && <Check size={16} style={{ color: 'var(--color-primary, #38bdf8)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
