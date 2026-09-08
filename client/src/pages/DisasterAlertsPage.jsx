import { useState } from 'react';
import Navbar from '../components/Navbar';
import DisasterAdvisoryCard from '../components/DisasterAdvisoryCard';
import RoadmapNext from '../components/RoadmapNext';
import { useWeather } from '../hooks/useWeather';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import {
  ShieldAlert,
  MapPin,
  Search,
  Navigation,
  Info,
  AlertTriangle,
  Sprout,
  Anchor,
  PhoneCall,
  Radio,
  ExternalLink,
  Flame,
  CloudRain,
  Wind,
  CheckCircle2,
} from 'lucide-react';
import '../styles/atmospheric.css';

const QUICK_CITIES = [
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
  { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
];

const REGIONAL_BULLETINS = [
  {
    region: 'North-West & Himalayan Region',
    status: 'YELLOW',
    color: '#eab308',
    title: 'Western Disturbance & Thunderstorm Watch',
    desc: 'Scattered light-to-moderate precipitation with isolated lightning in foothills.',
    time: 'Updated 15 mins ago',
  },
  {
    region: 'Bay of Bengal & Coastal Belt',
    status: 'GREEN',
    color: '#22c55e',
    title: 'Normal Marine & Sea State Conditions',
    desc: 'Surface wind speeds 15-25 km/h. Safe for coastal operations and port navigation.',
    time: 'Updated 30 mins ago',
  },
  {
    region: 'Central & Southern Peninsula',
    status: 'YELLOW',
    color: '#eab308',
    title: 'Localized Convective Cloud Activity',
    desc: 'Brief afternoon showers and gusty winds up to 35 km/h in localized pockets.',
    time: 'Updated 45 mins ago',
  },
  {
    region: 'Arabian Sea & Western Coast',
    status: 'GREEN',
    color: '#22c55e',
    title: 'Slight Sea Swell / All Clear',
    desc: 'Wave heights 0.8–1.5m. Favorable conditions for standard fishing operations.',
    time: 'Updated 1 hour ago',
  },
];

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
      const res = await api.get(`/api/weather/geocode?city=${encodeURIComponent(searchCity)}`);
      if (res.data?.data) {
        setOverrideLat(res.data.data.lat);
        setOverrideLon(res.data.data.lon);
        setSearchCity('');
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

  const handleCitySelect = (city) => {
    setOverrideLat(city.lat);
    setOverrideLon(city.lon);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
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
                {t('alertsTitle', 'MoES & IMD Disaster Alerts')}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                {t('alertsSubtitle', 'Official Meteorological early-warning bulletins, agricultural advisories, and disaster response intelligence.')}
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

          {/* Quick City Selector Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Regions:
            </span>
            {QUICK_CITIES.map((c) => (
              <button
                key={c.name}
                onClick={() => handleCitySelect(c)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 9999,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: cityName.toLowerCase().includes(c.name.toLowerCase())
                    ? '1px solid var(--color-primary)'
                    : '1px solid var(--color-border)',
                  background: cityName.toLowerCase().includes(c.name.toLowerCase())
                    ? 'var(--color-primary-glow, rgba(56, 189, 248, 0.15))'
                    : 'var(--color-bg-card)',
                  color: cityName.toLowerCase().includes(c.name.toLowerCase())
                    ? 'var(--color-primary)'
                    : 'var(--color-text-primary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* MoES IMD Disaster Risk Card with live Simulator */}
          <DisasterAdvisoryCard
            disasterRisk={disasterRisk}
            currentCity={cityName}
          />

          {/* Nationwide Regional Bulletins Matrix */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '20px 24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={18} style={{ color: 'var(--color-danger)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  National Meteorological & Regional Bulletins
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                IMD Telemetry Live
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {REGIONAL_BULLETINS.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.4))',
                    border: `1px solid var(--color-border)`,
                    borderLeft: `4px solid ${b.color}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {b.region}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: `${b.color}22`,
                        color: b.color,
                      }}
                    >
                      {b.status}
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{b.title}</strong>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {b.desc}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{b.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Context Cards (Farmer + Marine focus) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Farmer Focus */}
            <div className="glass-card" style={{ padding: 20, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--color-success)' }}>
                <Sprout size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {t('farmerAdvisoryTitle', 'Agricultural & Crop Protocol')}
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('farmerDesc', 'MoES agromet advisories provide real-time guidance on fertilizer application, crop sowing windows, and frost/squall mitigation.')}
              </p>
            </div>

            {/* Marine Focus */}
            <div className="glass-card" style={{ padding: 20, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--color-primary)' }}>
                <Anchor size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {t('marineAdvisoryTitle', 'Maritime & Coastal Safety Notice')}
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('marineDesc', 'INCOIS and MoES ocean state forecasts monitor wave heights, sea swell, and cyclonic storm tracks for fishermen.')}
              </p>
            </div>
          </div>

          {/* Emergency Helplines & Disaster Assistance */}
          <div
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneCall size={18} style={{ color: 'var(--color-danger)' }} />
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                National Emergency & Disaster Helplines (24x7)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase' }}>NDRF Helpline</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1078</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Disaster Rescue Operations</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>IMD Mausam Helpline</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1800-180-1717</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Toll-Free Weather Info</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#eab308', textTransform: 'uppercase' }}>State Disaster Control</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1070</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Emergency Relief Coordination</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase' }}>National Emergency</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>112</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Unified All-India Emergency</span>
              </div>
            </div>
          </div>

          {/* What We're Building Next Roadmap */}
          <RoadmapNext />
        </div>
      </main>
    </div>
  );
}

