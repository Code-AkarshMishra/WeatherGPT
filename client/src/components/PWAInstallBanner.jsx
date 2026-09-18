import { useState, useEffect } from 'react';
import { Download, X, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function PWAInstallBanner() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install prompt if not previously dismissed
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        maxWidth: 480,
        width: 'calc(100% - 32px)',
        background: 'var(--color-bg-card, #131d31)',
        border: '1px solid var(--color-primary)',
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        animation: 'slideUp 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--color-primary-glow, rgba(56, 189, 248, 0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
          }}
        >
          🌤️
        </div>
        <div>
          <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', display: 'block' }}>
            {t('pwa.installTitle')}
          </strong>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
            {t('pwa.installDesc')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleInstall}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: 'var(--color-primary)',
            border: 'none',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('pwa.installBtn')}
        </button>

        <button
          onClick={handleDismiss}
          aria-label={t('pwa.notNow')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
