import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const ROLES = [
  { icon: '🌾', name: 'Farmer / Crop Advisory', desc: 'Sowing windows, irrigation, pest risk, frost alerts.' },
  { icon: '👤', name: 'Citizen', desc: 'Everyday forecasts, umbrella advice, storm warnings.' },
  { icon: '🔬', name: 'Researcher', desc: 'METAR data, ENSO analysis, climate trend reports.' },
  { icon: '✈️', name: 'Aviation', desc: 'Pre-flight briefings, turbulence, icing, SIGMET.' },
  { icon: '⚓', name: 'Marine', desc: 'Sea state, Beaufort scale, cyclone advisories.' },
  { icon: '🚨', name: 'Flood & Disaster', desc: 'Flood risk, Kerala/Nepal priority, evacuation guidance.' },
  { icon: '🌍', name: 'Climate Analyst', desc: 'Long-term trends, IOD, IPCC scenarios.' },
  { icon: '🏙️', name: 'Urban Planner', desc: 'Urban heat island, stormwater, green infrastructure.' },
];

export default function About() {
  return (
    <div className="app-shell">
      <Navbar />
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--space-6)',
        paddingTop: 'calc(var(--navbar-height) + var(--space-8))',
      }}>
        <div className="animate-fadeInUp" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>About WeatherGPT</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-8)', lineHeight: 'var(--line-height-relaxed)' }}>
            WeatherGPT is a role-based conversational AI platform for weather forecasting, alerts, and disaster-management guidance.
            It targets farmers, citizens, researchers, aviation professionals, mariners, and disaster-management teams across India and South Asia.
          </p>

          <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-4)' }}>Available Roles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            {ROLES.map((r) => (
              <div key={r.name} className="card" style={{ padding: 'var(--space-4)' }}>
                <span style={{ fontSize: '1.75rem' }}>{r.icon}</span>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', margin: 'var(--space-2) 0 var(--space-1)' }}>{r.name}</h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{r.desc}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-4)' }}>Key Features</h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            {[
              ['🌐', 'Multilingual', 'English, Hindi, and Hinglish support — the AI understands code-mixed queries natively.'],
              ['📍', 'Geolocation-aware', 'Auto-detects your location for instant local forecasts. Manual override supported.'],
              ['🧠', 'Intent Extraction', 'Every query is analyzed for intent, location entities, and time references before generating a response.'],
              ['🌧️', 'Rain Probability', 'Live rain prediction from humidity, pressure, and recent precipitation data.'],
              ['🔴', 'Flood Priority', 'Flood & Disaster role cross-checks Kerala and Nepal region data when flood queries are detected.'],
              ['🌙', 'Dark Mode', 'Full light/dark theme with a single toggle — optimized for outdoor use.'],
            ].map(([icon, title, desc]) => (
              <li key={title} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
                <div>
                  <strong style={{ fontSize: 'var(--font-size-sm)' }}>{title}</strong>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ textAlign: 'center' }}>
            <Link to="/" className="btn btn-primary" style={{ fontSize: 'var(--font-size-md)' }}>
              Start Chatting →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
