import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Navbar from '../components/Navbar';

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>{t('registerTitle', 'Create Account')}</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
              {t('registerDesc', 'Join WeatherGPT for personalized weather intelligence')}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} id="register-form">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="name" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                {t('name', 'Full Name')}
              </label>
              <input
                id="name"
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Arjun Sharma"
                required
                autoComplete="name"
              />
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="reg-email" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                {t('email', 'Email Address')}
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                {t('password', 'Password')} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(min. 8 chars)</span>
              </label>
              <input
                id="reg-password"
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
              id="register-submit-btn"
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('signUpBtn', 'Create Account')}...</> : t('signUpBtn', 'Create Account')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('haveAccount', 'Already have an account?')}{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
              {t('signInBtn', 'Sign In')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
