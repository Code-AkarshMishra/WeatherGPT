import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) {
    return (
      <div className="app-shell" style={{ background: 'var(--color-bg)' }}>
        <Navbar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-4)',
            paddingTop: 'var(--navbar-height)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h1 style={{ fontSize: 'var(--font-size-xl)' }}>{t('loginTitle')}</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('loginDesc')}
          </p>
          <Link to="/login" className="btn btn-primary" style={{ minHeight: 44, padding: '10px 24px' }}>
            {t('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ background: 'var(--color-bg)' }}>
      <Navbar />
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-6) var(--space-6)',
          paddingTop: 'calc(var(--navbar-height) + var(--space-6))',
        }}
      >
        <div className="animate-fadeInUp" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)' }}>
              {t('dashTitle')}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
              {t('dashSubtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Conversations Card */}
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl, 16px)',
                padding: 'var(--space-5)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>💬</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
                {t('conversations')}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {t('recentQueries')}
              </p>
              <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}>
                {t('newConversation')}
              </Link>
            </div>

            {/* Profile Card */}
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl, 16px)',
                padding: 'var(--space-5)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>👤</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
                {t('profile')}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
                {user.email}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                <span>{t('name')}: <strong style={{ color: 'var(--color-text-primary)' }}>{user.name}</strong></span>
                <span>{t('preferredRole')}: <strong style={{ color: 'var(--color-text-primary)' }}>{t(user.defaultRole, user.defaultRole)}</strong></span>
              </div>
            </div>

            {/* Active Alerts Card */}
            <div
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl, 16px)',
                padding: 'var(--space-5)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🚨</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)', color: 'var(--color-text-primary)' }}>
                {t('alertsActive')}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {t('nominal')}
              </p>
              <div
                style={{
                  marginTop: 'var(--space-3)',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <span>✅</span>
                <span>{t('lowRisk')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
