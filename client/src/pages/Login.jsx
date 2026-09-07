import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Navbar from '../components/Navbar';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        paddingTop: 'calc(var(--navbar-height) + var(--space-8))',
      }}>
        <div className="card animate-fadeInUp" style={{ width: '100%', maxWidth: 420, padding: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <span style={{ fontSize: '2.5rem' }}>🌤️</span>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>{t('loginTitle', 'Sign In')}</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
              {t('loginDesc', 'Access your WeatherGPT account')}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} id="login-form">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                {t('email', 'Email Address')}
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                {t('password', 'Password')}
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('signInBtn', 'Sign In')}...</> : t('signInBtn', 'Sign In')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('noAccount', "Don't have an account?")}{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
              {t('signUpBtn', 'Create Account')}
            </Link>
          </p>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
            <Link to="/" style={{ color: 'var(--color-text-secondary)' }}>
              {t('continueGuest', 'Continue as guest →')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
