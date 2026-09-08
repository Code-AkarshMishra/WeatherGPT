import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Home as HomeIcon,
  CloudSun,
  ShieldAlert,
  LayoutDashboard,
  Info,
  User,
  LogOut,
  LogIn,
  ChevronRight,
  Radio,
} from 'lucide-react';
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

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Keyboard accessibility: Close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        if (onMenuToggle) onMenuToggle(false);
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
        if (onMenuToggle) onMenuToggle(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen, onMenuToggle]);

  // Lock body scroll when mobile menu is open
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

  const handleToggle = useCallback(() => {
    setMobileMenuOpen((prev) => {
      const next = !prev;
      if (onMenuToggle) onMenuToggle(next);
      return next;
    });
  }, [onMenuToggle]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: t('home', 'Home'), icon: HomeIcon, exact: true },
    { to: '/weather', label: t('weather', 'Weather & Atmospheric'), icon: CloudSun },
    { to: '/alerts', label: t('alerts', 'Alerts & MoES'), icon: ShieldAlert, badge: 'Live' },
    { to: '/dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard },
    { to: '/about', label: t('about', 'About'), icon: Info },
  ];

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        {/* Hamburger — mobile only */}
        <button
          className={`navbar-hamburger${mobileMenuOpen ? ' open' : ''}`}
          onClick={handleToggle}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          id="hamburger-btn"
          type="button"
        >
          {mobileMenuOpen ? (
            <X size={22} style={{ color: 'var(--color-primary)' }} />
          ) : (
            <Menu size={22} />
          )}
        </button>

        {/* Logo */}
        <NavLink to="/" className="navbar-logo" aria-label="WeatherGPT Home" onClick={() => setMobileMenuOpen(false)}>
          <span className="navbar-logo-icon">🌤️</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="logo-text">{t('appName')}</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary, #0284c7)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {t('appSubtitle', 'MoES • IMD')}
            </span>
          </div>
        </NavLink>

        <div className="navbar-spacer" />

        {/* Desktop Nav links */}
        <ul className="navbar-nav" role="list">
          {navLinks.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.exact}
                className={({ isActive }) => `navbar-nav-link${isActive ? ' active' : ''}`}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop & Header Controls */}
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
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
              className="btn btn-primary desktop-only"
              id="login-btn"
              style={{ minHeight: 40, padding: 'var(--space-1) var(--space-3)' }}
            >
              {t('login')}
            </NavLink>
          )}
        </div>
      </nav>

      {/* Mobile Navigation Full-Featured Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 'var(--navbar-height, 60px)',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(10px)',
              zIndex: 'calc(var(--z-navbar, 100) - 1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <motion.div
              className="mobile-drawer-content"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-bg-navbar, #0f172a)',
                borderBottom: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-xl)',
                padding: '16px 20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxHeight: 'calc(100vh - 80px)',
                overflowY: 'auto',
              }}
            >
              {/* Radar status banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: '0.78rem',
                  color: 'var(--color-success, #10b981)',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Radio size={14} className="animate-pulse" />
                  <span>{t('radarOnline', 'MoES Live Radar Online')}</span>
                </div>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>IMD ML-2 Active</span>
              </div>

              {/* Mobile Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Menu Navigation
                </span>

                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = link.exact
                    ? location.pathname === link.to
                    : location.pathname.startsWith(link.to);

                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 12,
                        textDecoration: 'none',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        background: isActive ? 'var(--color-primary-glow, rgba(56, 189, 248, 0.12))' : 'var(--color-bg-card)',
                        border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.92rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={18} style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                        <span>{link.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {link.badge && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            {link.badge}
                          </span>
                        )}
                        <ChevronRight size={16} style={{ opacity: 0.5 }} />
                      </div>
                    </NavLink>
                  );
                })}
              </div>

              {/* User authentication and mobile controls */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {user ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-card)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{user.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{user.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: 'var(--color-danger)',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <LogOut size={14} />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <NavLink
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '10px',
                        borderRadius: 10,
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                      }}
                    >
                      <LogIn size={15} />
                      <span>{t('login')}</span>
                    </NavLink>
                    <NavLink
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px',
                        borderRadius: 10,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                      }}
                    >
                      <span>{t('register', 'Sign Up')}</span>
                    </NavLink>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
