import { motion } from 'framer-motion';
import {
  Sprout,
  Anchor,
  Plane,
  ShieldAlert,
  ArrowRight,
  Mic,
  Radio,
} from 'lucide-react';

export default function MoESWelcomeHub({ selectedRole, onRoleChange, onSelectQuery }) {
  const targetedQueries = [
    {
      role: 'farmer',
      badge: 'Agriculture',
      color: '#16a34a',
      bgLight: 'rgba(22, 163, 74, 0.09)',
      icon: Sprout,
      title: 'Kisan Advisory',
      promptLabel: 'Rain outlook & irrigation timing',
      query: 'What is the 3-day precipitation outlook and recommended irrigation timing?',
      desc: 'Soil moisture, rain window & crop care.',
    },
    {
      role: 'marine',
      badge: 'Marine',
      color: '#0284c7',
      bgLight: 'rgba(2, 132, 199, 0.09)',
      icon: Anchor,
      title: 'Marine Safety',
      promptLabel: 'Sea state & squall warning',
      query: 'What is the sea state, wave height, and squall warning for coastal fishing boats?',
      desc: 'Sea state, wave swell & small craft alerts.',
    },
    {
      role: 'flood_disaster',
      badge: 'Disaster',
      color: '#dc2626',
      bgLight: 'rgba(220, 38, 38, 0.09)',
      icon: ShieldAlert,
      title: 'Disaster Warning',
      promptLabel: 'Active cyclone & severe alerts',
      query: 'Are there any active cyclone warnings, flood hazards, or severe weather alerts for my region?',
      desc: 'IMD color-coded warnings & flood risks.',
    },
    {
      role: 'aviation',
      badge: 'Aviation',
      color: '#7c3aed',
      bgLight: 'rgba(124, 58, 237, 0.09)',
      icon: Plane,
      title: 'Aviation Briefing',
      promptLabel: 'METAR & turbulence briefing',
      query: 'Provide pre-flight METAR briefing, cruising turbulence, and runway visibility.',
      desc: 'METAR/TAF briefings, turbulence & visibility.',
    },
  ];

  const handleCardClick = (item) => {
    if (onRoleChange) onRoleChange(item.role);
    if (onSelectQuery) onSelectQuery(item.query);
  };

  return (
    <motion.div
      className="moes-welcome-container"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '4px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
      }}
    >
      {/* Official Clean MoES/IMD Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 3,
          padding: '0',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 9px',
            borderRadius: 9999,
            background: 'rgba(30, 136, 229, 0.08)',
            border: '1px solid rgba(30, 136, 229, 0.2)',
            color: 'var(--color-primary)',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <Radio size={10} />
          Ministry of Earth Sciences • India Meteorological Department
        </span>

        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          WeatherGPT Meteorological Intelligence
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            color: 'var(--color-text-secondary)',
            maxWidth: 580,
            lineHeight: 1.35,
          }}
        >
          Real-time atmospheric observations, NWP numerical forecasts (GFS/WRF), and operational early warning decision support.
        </p>
      </div>

      {/* 4 Targeted Professional Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 8,
        }}
      >
        {targetedQueries.map((item, idx) => {
          const Icon = item.icon;
          const isCurrent = selectedRole === item.role;
          return (
            <div
              key={idx}
              onClick={() => handleCardClick(item)}
              style={{
                background: 'var(--color-bg-card)',
                border: isCurrent
                  ? `1.5px solid ${item.color}`
                  : '1px solid var(--color-border)',
                borderRadius: 9,
                padding: '9px 11px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease',
                boxShadow: isCurrent
                  ? `0 3px 12px ${item.color}22`
                  : '0 1px 3px rgba(0,0,0,0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = item.color;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Header: Icon + Title + Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: item.bgLight,
                      color: item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={12} />
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.60rem',
                    fontWeight: 600,
                    color: item.color,
                    padding: '1px 5px',
                    borderRadius: 9999,
                    background: item.bgLight,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {item.badge}
                </span>
              </div>

              {/* Description */}
              <p
                style={{
                  margin: 0,
                  fontSize: '0.71rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.3,
                }}
              >
                {item.desc}
              </p>

              {/* Clickable prompt hint */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: 4,
                  borderTop: '1px solid var(--color-border-light)',
                  fontSize: '0.69rem',
                  fontWeight: 600,
                  color: item.color,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '88%' }}>
                  "{item.promptLabel}"
                </span>
                <ArrowRight size={10} style={{ flexShrink: 0 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Voice accessibility hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          fontSize: '0.69rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}
      >
        <Mic size={11} style={{ color: 'var(--color-primary)' }} />
        <span>Voice & Multilingual: Query in English, हिन्दी, or Hinglish. Audio readout available for all meteorological updates.</span>
      </div>
    </motion.div>
  );
}
