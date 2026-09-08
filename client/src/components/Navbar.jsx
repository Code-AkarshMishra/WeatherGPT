import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import '../styles/navbar.css';

export default function Navbar({ onMenuToggle, sidebarOpen }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync with external sidebarOpen prop if provided
  useEffect(() => {
    if (typeof sidebarOpen === 'boolean') {
      setMobileMenuOpen(sidebarOpen);
    }
  }, [sidebarOpen]);

  // Scroll detection for sticky navbar styling
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Auto-close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Keyboard accessibility: Close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        if (onMenuToggle) onMenuToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, onMenuToggle]);

  // Screen resize guard: close drawer when expanding to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => {
      const next = !prev;
      if (onMenuToggle) onMenuToggle(next);
      return next;
    });
  }, [onMenuToggle]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    if (onMenuToggle) onMenuToggle(false);
  }, [onMenuToggle]);

  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        {/* Hamburger button — mobile only */}
        <button
          className={`navbar-hamburger${mobileMenuOpen ? ' is-active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          id="hamburger-btn"
          type="button"
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {/* Logo */}
        <NavLink to="/" className="navbar-logo" aria-label="WeatherGPT Home" onClick={closeMobileMenu}>
          <span className="navbar-logo-icon">🌤️</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="logo-text">{t('appName')}</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {t('appSubtitle', 'MoES • IMD')}
            </span>
          </div>
        </NavLink>

        <div className="navbar-spacer" />

        {/* Nav links (Desktop) */}
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

        {/* Controls (Desktop) */}
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

      {/* ── Mobile Navigation Drawer & Backdrop ───────────────────────── */}
      <div
        className={`navbar-mobile-backdrop${mobileMenuOpen ? ' is-open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      <aside
        id="mobile-nav-drawer"
        className={`navbar-mobile-drawer${mobileMenuOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        {/* Drawer Header */}
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span className="navbar-logo-icon">🌤️</span>
            <div>
              <div className="mobile-drawer-title">{t('appName')}</div>
              <div className="mobile-drawer-subtitle">{t('appSubtitle', 'MoES • IMD')}</div>
            </div>
          </div>
          <button
            className="mobile-drawer-close"
            onClick={closeMobileMenu}
            aria-label="Close menu"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Live Status Badge */}
        <div className="mobile-drawer-status">
          <span className="status-dot" />
          <span>{t('radarOnline', 'MoES Live Radar & Predictor Online')}</span>
        </div>

        {/* Navigation Links */}
        <div className="mobile-drawer-section-title">{t('navigation', 'Navigation')}</div>
        <ul className="mobile-nav-list" role="list">
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span className="mobile-nav-icon">🏠</span>
              <span>{t('home', 'Home AI Assistant')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/weather"
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span className="mobile-nav-icon">🌤️</span>
              <span>{t('weather', 'Live Weather')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/alerts"
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span className="mobile-nav-icon">🚨</span>
              <span>{t('alerts', 'Disaster & Floods')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span className="mobile-nav-icon">📊</span>
              <span>{t('dashboard', 'Telemetry Dashboard')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={closeMobileMenu}
            >
              <span className="mobile-nav-icon">🏛️</span>
              <span>{t('about', 'About MoES / IMD')}</span>
            </NavLink>
          </li>
        </ul>

        {/* Preferences */}
        <div className="mobile-drawer-section-title">{t('preferences', 'Preferences')}</div>
        <div className="mobile-drawer-controls">
          <div className="mobile-control-row">
            <span className="mobile-control-label">🌐 {t('language', 'Language')}</span>
            <LanguageToggle />
          </div>
          <div className="mobile-control-row">
            <span className="mobile-control-label">🌓 {t('theme', 'Theme')}</span>
            <ThemeToggle />
          </div>
        </div>

        {/* User Account / Auth Section */}
        <div className="mobile-drawer-footer">
          {user ? (
            <div className="mobile-user-card">
              <div className="mobile-user-info">
                <div className="mobile-user-avatar">👤</div>
                <div className="mobile-user-details">
                  <div className="mobile-user-name">{user.name}</div>
                  <div className="mobile-user-role">{user.email || 'Citizen User'}</div>
                </div>
              </div>
              <div className="mobile-user-actions">
                <NavLink
                  to="/dashboard"
                  className="btn btn-ghost"
                  onClick={closeMobileMenu}
                >
                  {t('dashboard', 'Dashboard')}
                </NavLink>
                <button
                  className="btn btn-ghost"
                  onClick={handleLogout}
                  style={{ color: 'var(--color-danger, #ef4444)' }}
                >
                  {t('logout', 'Sign Out')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mobile-auth-actions">
              <NavLink
                to="/login"
                className="btn btn-primary"
                onClick={closeMobileMenu}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {t('login', 'Sign In')}
              </NavLink>
              <NavLink
                to="/register"
                className="btn btn-ghost"
                onClick={closeMobileMenu}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {t('register', 'Create Account')}
              </NavLink>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
