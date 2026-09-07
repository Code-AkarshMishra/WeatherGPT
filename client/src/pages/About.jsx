import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useLanguage } from '../contexts/LanguageContext';

export default function About() {
  const { t } = useLanguage();

  const ROLES = [
    { roleId: 'farmer', icon: '🌾', fallbackName: 'Farmer / Crop Advisory' },
    { roleId: 'citizen', icon: '👤', fallbackName: 'Citizen' },
    { roleId: 'researcher', icon: '🔬', fallbackName: 'Researcher' },
    { roleId: 'aviation', icon: '✈️', fallbackName: 'Aviation' },
    { roleId: 'marine', icon: '⚓', fallbackName: 'Marine' },
    { roleId: 'flood_disaster', icon: '🚨', fallbackName: 'Flood & Disaster' },
    { roleId: 'climate_analyst', icon: '🌍', fallbackName: 'Climate Analyst' },
    { roleId: 'urban_planner', icon: '🏙️', fallbackName: 'Urban Planner' },
  ];

  const FEATURES = [
    {
      icon: '🌐',
      title: t('featureMultilingual', 'Pan-Indian Multilingual'),
      desc: t('featureMultilingualDesc', 'Full dynamic translation across 11 Indian regional languages with Hinglish support.'),
    },
    {
      icon: '📍',
      title: t('featureGps', 'Precision Geolocation Engine'),
      desc: t('featureGpsDesc', 'Auto-detects coordinates for hyper-local observations and farm-level advice.'),
    },
    {
      icon: '⚡',
      title: t('featureMl', 'MoES Severe Weather Predictor'),
      desc: t('featureMlDesc', 'Random Forest classifier for heavy precipitation, cyclonic wind, and heat hazards.'),
    },
    {
      icon: '🔊',
      title: t('featureVoice', 'Regional Voice Accessibility'),
      desc: t('featureVoiceDesc', 'Real-time neural audio broadcast in local Indian languages for rural accessibility.'),
    },
    {
      icon: '🌙',
      title: t('theme', 'Dark & Light Mode'),
      desc: t('darkMode', 'Persistent dual-theme visual design optimized for outdoor and night viewing.'),
    },
    {
      icon: '📡',
      title: t('radarOnline', 'Doppler Radar Network'),
      desc: t('nominal', 'Ministry of Earth Sciences live telemetry integrated with grounded AI models.'),
    },
  ];

  return (
    <div className="app-shell" style={{ background: 'var(--color-bg)' }}>
      <Navbar />
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-6)',
          paddingTop: 'calc(var(--navbar-height) + var(--space-6))',
        }}
      >
        <div className="animate-fadeInUp" style={{ maxWidth: 860, margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl, 16px)',
              padding: '28px 32px',
              boxShadow: 'var(--shadow-md)',
              marginBottom: 'var(--space-8)',
            }}
          >
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
              {t('aboutTitle')}
            </h1>
            <p style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              {t('aboutSubtitle')}
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-relaxed)', margin: 0 }}>
              {t('aboutMissionDesc')}
            </p>
          </div>

          {/* Available Roles */}
          <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
            {t('availableRoles')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            {ROLES.map((r) => (
              <div
                key={r.roleId}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  padding: 'var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>{r.icon}</span>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', margin: 'var(--space-2) 0 var(--space-1)', color: 'var(--color-text-primary)' }}>
                  {t(r.roleId, r.fallbackName)}
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {t(r.roleId + 'Desc', '')}
                </p>
              </div>
            ))}
          </div>

          {/* Key Features */}
          <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
            {t('coreFeatures')}
          </h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            {FEATURES.map((f, i) => (
              <li
                key={i}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  padding: 'var(--space-3) var(--space-4)',
                  display: 'flex',
                  gap: 'var(--space-3)',
                  alignItems: 'flex-start',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{f.title}</strong>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2, margin: 0, lineHeight: 1.4 }}>
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <Link
              to="/"
              className="btn btn-primary"
              style={{
                fontSize: 'var(--font-size-md)',
                padding: '12px 28px',
                borderRadius: 'var(--radius-full, 9999px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{t('home')} & {t('appName')}</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
