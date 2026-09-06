import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="app-shell">
        <Navbar />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-4)',
          paddingTop: 'var(--navbar-height)',
        }}>
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Sign in to view your dashboard</h1>
          <Link to="/login" className="btn btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--space-6) var(--space-6)',
        paddingTop: 'calc(var(--navbar-height) + var(--space-6))',
      }}>
        <div className="animate-fadeInUp" style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)' }}>
              Welcome back, {user.name.split(' ')[0]} 👋
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
              Your WeatherGPT dashboard
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>💬</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>Chat History</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Your past conversations are saved and accessible here.
              </p>
              <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-3)', display: 'inline-flex' }}>
                New Chat
              </Link>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>👤</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>Profile</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
                {user.email}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                <span>🌐 Language: <strong>{user.preferredLanguage === 'hi' ? 'Hindi' : 'English'}</strong></span>
                <span>🎭 Default Role: <strong>{user.defaultRole}</strong></span>
              </div>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🚨</div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>Active Alerts</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                No active alerts for your area.
              </p>
              <div className="alert alert-success" style={{ marginTop: 'var(--space-3)' }}>
                <span>✅</span>
                <span>All clear</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
