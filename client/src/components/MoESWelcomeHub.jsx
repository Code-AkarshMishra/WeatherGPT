import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function MoESWelcomeHub({ selectedRole, onRoleChange, onSelectQuery }) {
  const { t } = useLanguage();

  const SUGGESTED_POPUP_QUESTIONS = [
    {
      icon: '🌾',
      category: t('farmer', 'Crop Advisory'),
      query: 'Is it safe to spray crops or apply fertilizer in my location today?',
    },
    {
      icon: '⛈️',
      category: t('hourlyForecast', 'Forecast'),
      query: 'What is the 24-hour rain and thunderstorm outlook for my location?',
    },
    {
      icon: '🚗',
      category: t('visibility', 'Travel & Visibility'),
      query: 'How is the visibility, fog risk, and road driving condition today?',
    },
    {
      icon: '🌊',
      category: t('marine', 'Marine Safety'),
      query: 'What is the sea state, wave swell, and coastal wind speed for small boats?',
    },
    {
      icon: '⚡',
      category: t('alertsTitle', 'IMD Disaster Alert'),
      query: 'Are there any active IMD severe weather or cyclone warnings nearby?',
    },
    {
      icon: '💧',
      category: t('feelsLike', 'Comfort & Heat'),
      query: 'What is the humidity level and real-feel heat index right now?',
    },
  ];

  return (
    <motion.div
      className="moes-welcome-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px 20px',
        margin: 'auto 0',
        gap: 20,
      }}
    >
      {/* Clean AI Badge & Title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: 'var(--color-primary-glow, rgba(56, 189, 248, 0.12))',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          🌤️
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', letterSpacing: -0.5 }}>
          {t('appName')} {t('aboutSubtitle', 'Meteorological Assistant')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 460, margin: 0, lineHeight: 1.5 }}>
          {t('typeMessage')}
        </p>
      </div>

      {/* Suggested Popup Question Pills Grid */}
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('quickAccess')}
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {SUGGESTED_POPUP_QUESTIONS.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelectQuery && onSelectQuery(item.query)}
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '12px 14px',
                textAlign: 'left',
                color: 'var(--color-text-primary)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                  {item.category}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
                {item.query}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
