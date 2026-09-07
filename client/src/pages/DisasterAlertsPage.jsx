import { useState } from 'react';
import Navbar from '../components/Navbar';
import DisasterAdvisoryCard from '../components/DisasterAdvisoryCard';
import RoadmapNext from '../components/RoadmapNext';
import { useWeather } from '../hooks/useWeather';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldAlert, MapPin, Search, Navigation, Info, AlertTriangle, Sprout, Anchor } from 'lucide-react';
import '../styles/atmospheric.css';

export default function DisasterAlertsPage() {
  const { t } = useLanguage();
  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);
  const [searchCity, setSearchCity] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const lat = overrideLat ?? (geoLat || 26.8467);
  const lon = overrideLon ?? (geoLon || 80.9462);

  const { data, loading, refetch } = useWeather(lat, lon);

  const handleGeocode = async (e) => {
    e.preventDefault();
    if (!searchCity.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(`/api/weather/geocode?city=${encodeURIComponent(searchCity)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setOverrideLat(json.data.lat);
          setOverrideLon(json.data.lon);
          setSearchCity('');
        }
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOverrideLat(pos.coords.latitude);
          setOverrideLon(pos.coords.longitude);
        },
        (err) => console.warn(err)
      );
    }
  };

  const cityName = data?.locationName || 'Lucknow';
  const disasterRisk = data?.disasterRisk || {
    city: cityName,
    rainMm: 0,
    windKmph: 10,
    tempC: 26,
    imdColorCode: 'GREEN',
    riskAssessment: 'Low',
    statusText: 'No Warning / All Clear',
    statusTextHi: 'कोई चेतावनी नहीं / सामान्य',
    farmerAdvisory: {
      hi: 'मौसम अनुकूल है। जुताई, बुवाई और सामान्य खाद डालने का कार्य सुचारू रूप से करें।',
      en: 'Favorable weather conditions. Suitable for normal farming and fertilizer application.',
    },
    marineAdvisory: {
      hi: 'समुद्र शांत है। सामान्य मछली पकड़ने और तटीय नौकायन के लिए परिस्थितियां अनुकूल हैं।',
      en: 'Sea state calm to slight. Safe for fishing operations and coastal navigation.',
    },
    actionPoints: [
      'Routine agricultural and outdoor activities can continue unhindered.',
      'Standard moisture conservation is recommended.',
    ],
    spokenTextHi: 'सतर्क रहें। मौसम विभाग का GREEN अलर्ट। मौसम अनुकूल है।',
  };

  return (
    <div className="app-shell weather-page-shell">
      <Navbar />

      <main className="weather-page-main">
        <div className="weather-page-inner" style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Banner */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 24,
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: 'var(--shadow-md)',
              backdropFilter: 'blur(20px)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: 'var(--color-danger)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ShieldAlert size={14} /> {t('alerts', 'MoES & IMD INTELLIGENCE')}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {t('locationSelected', 'Active Location')}: <strong style={{ color: 'var(--color-text-primary)' }}>{cityName}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                {t('alertsTitle')}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                {t('alertsSubtitle')}
              </p>
            </div>

            {/* City Search & GPS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleUseGPS}
                className="atmospheric-btn"
                title={t('useLocation')}
                aria-label={t('useLocation')}
                style={{
                  background: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <Navigation size={18} />
              </button>

              <form
                onSubmit={handleGeocode}
                className="atmospheric-search-form"
                style={{
                  background: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <MapPin size={15} style={{ color: 'var(--color-danger)' }} />
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder={t('searchCity')}
                  style={{ width: 140, color: 'var(--color-text-primary)' }}
                />
                <button
                  type="submit"
                  disabled={geocoding}
                  style={{ background: 'var(--color-primary)' }}
                  aria-label={t('searchCity')}
                >
                  <Search size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* MoES IMD Disaster Risk Card with live Simulator */}
          <DisasterAdvisoryCard
            disasterRisk={disasterRisk}
            currentCity={cityName}
          />

          {/* Strategic Context Cards (Farmer + Marine focus) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Farmer Focus */}
            <div className="glass-card" style={{ padding: 20, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--color-success)' }}>
                <Sprout size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {t('farmerAdvisoryTitle')}
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('farmerDesc')}
              </p>
            </div>

            {/* Marine Focus */}
            <div className="glass-card" style={{ padding: 20, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--color-primary)' }}>
                <Anchor size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {t('marineAdvisoryTitle')}
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('marineDesc')}
              </p>
            </div>
          </div>

          {/* What We're Building Next Roadmap */}
          <RoadmapNext />
        </div>
      </main>
    </div>
  );
}
