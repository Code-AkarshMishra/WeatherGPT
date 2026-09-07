import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, ArrowUpRight } from 'lucide-react';

const SUGGESTED_POPUP_QUESTIONS = [
  {
    icon: '🌾',
    category: 'Crop Advisory',
    query: 'Is it safe to spray crops or apply fertilizer in my location today?',
  },
  {
    icon: '⛈️',
    category: 'Forecast',
    query: 'What is the 24-hour rain and thunderstorm outlook for my location?',
  },
  {
    icon: '🚗',
    category: 'Travel & Visibility',
    query: 'How is the visibility, fog risk, and road driving condition today?',
  },
  {
    icon: '🌊',
    category: 'Marine Safety',
    query: 'What is the sea state, wave swell, and coastal wind speed for small boats?',
  },
  {
    icon: '⚡',
    category: 'IMD Disaster Alert',
    query: 'Are there any active IMD severe weather or cyclone warnings nearby?',
  },
  {
    icon: '💧',
    category: 'Comfort & Heat',
    query: 'What is the humidity level and real-feel heat index right now?',
  },
];

export default function MoESWelcomeHub({ selectedRole, onRoleChange, onSelectQuery }) {
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
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 20px rgba(56, 189, 248, 0.15)',
          }}
        >
          🌤️
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f9fafb', letterSpacing: -0.5 }}>
          WeatherGPT Meteorological Assistant
        </h2>
        <p style={{ fontSize: 13, color: '#9ca3af', maxWidth: 440, margin: 0, lineHeight: 1.5 }}>
          Ask any question about weather forecasts, agricultural crop advisories, marine sea state, or disaster warnings in English, Hindi, or Hinglish.
        </p>
      </div>

      {/* Suggested Popup Question Pills Grid */}
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Suggested Questions
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SUGGESTED_POPUP_QUESTIONS.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelectQuery && onSelectQuery(item.query)}
              style={{
                background: 'rgba(31, 41, 55, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '12px 14px',
                textAlign: 'left',
                color: '#e2e8f0',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(31, 41, 55, 0.7)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8' }}>{item.category}</span>
                <span style={{ fontWeight: 500, lineHeight: 1.3 }}>{item.query}</span>
              </div>
              <ArrowUpRight size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

