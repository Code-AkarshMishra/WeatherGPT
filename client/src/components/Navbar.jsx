import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import '../styles/navbar.css';

export default function Navbar({ onMenuToggle, sidebarOpen }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Hamburger — mobile only */}
      <button
        className="navbar-hamburger"
        onClick={onMenuToggle}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={sidebarOpen}
        id="hamburger-btn"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {/* Logo */}
      <NavLink to="/" className="navbar-logo" aria-label="WeatherGPT Home">
        <span className="navbar-logo-icon">🌤️</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="logo-text">{t('appName')}</span>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', letterSpacing: '0.05em', lineHeight: 1 }}>
            {t('appSubtitle', 'MoES • IMD')}
          </span>
        </div>
      </NavLink>

      <div className="navbar-spacer" />

      {/* Nav links */}
      <ul className="navbar-nav" role="list">
        <li>
          <NavLink to="/" end className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}>
            {t('home')}
          </NavLink>
        </li>
        <li>
          <NavLink to="/weather" className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}>
            {t('weather')}
          </NavLink>
        </li>
        <li>
          <NavLink to="/alerts" className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}>
            {t('alerts')}
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}>
            {t('dashboard')}
          </NavLink>
        </li>
        <li>
          <NavLink to="/about" className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}>
            {t('about')}
          </NavLink>
        </li>
      </ul>

      {/* Controls */}
      <div className="navbar-controls">
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--color-success, #10b981)',
          }}
          title="MoES Live Radar + ML-2 Severe Weather RF Predictor Online"
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success, #10b981)', display: 'inline-block', boxShadow: '0 0 6px var(--color-success, #10b981)' }} />
          <span>{t('radarOnline', 'MoES Live Radar')}</span>
        </div>

        <LanguageToggle />
        <ThemeToggle />

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <NavLink
              to="/dashboard"
              className="btn btn-ghost"
              style={{ padding: 'var(--space-1) var(--space-3)', minHeight: 44 }}
              title={user.name}
              id="profile-btn"
            >
              <span style={{ fontSize: '1.1rem' }}>👤</span>
              <span style={{ fontSize: 'var(--font-size-sm)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name.split(' ')[0]}
              </span>
            </NavLink>
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              id="logout-btn"
              style={{ padding: 'var(--space-1) var(--space-3)', minHeight: 44 }}
            >
              {t('logout')}
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            className="btn btn-primary"
            id="login-btn"
            style={{ minHeight: 44, padding: 'var(--space-2) var(--space-4)' }}
          >
            {t('login')}
          </NavLink>
        )}
      </div>
    </nav>
  );
}
