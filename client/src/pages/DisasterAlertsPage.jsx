import { useState } from 'react';
import Navbar from '../components/Navbar';
import DisasterAdvisoryCard from '../components/DisasterAdvisoryCard';
import RoadmapNext from '../components/RoadmapNext';
import { useWeather } from '../hooks/useWeather';
import { useGeolocation } from '../hooks/useGeolocation';
import { ShieldAlert, MapPin, Search, Navigation, Info, AlertTriangle, Sprout, Anchor } from 'lucide-react';
import '../styles/atmospheric.css';

export default function DisasterAlertsPage() {
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
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 24,
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(20px)',
              color: '#ffffff',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span
                  style={{
                    padding: '6px 12px',
                    borderRadius: 9999,
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ShieldAlert size={14} /> MoES & IMD INTELLIGENCE
                </span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Active Location: <strong style={{ color: '#ffffff' }}>{cityName}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Disaster & Severe-Weather Risk Center
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                MoES Machine Learning Decision Matrix, IMD Color Alerts, Farmer & Marine Advisories.
              </p>
            </div>

            {/* City Search & GPS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleUseGPS}
                className="atmospheric-btn"
                title="Use GPS Location"
                aria-label="Use GPS"
              >
                <Navigation size={18} />
              </button>

              <form onSubmit={handleGeocode} className="atmospheric-search-form">
                <MapPin size={15} style={{ color: '#ef4444' }} />
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="Change city..."
                  style={{ width: 140 }}
                />
                <button type="submit" disabled={geocoding}>
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
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#4ade80' }}>
                <Sprout size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>कृषि मौसम सलाह (Farmer Priority)</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0 }}>
                MoES disaster intelligence actively monitors soil saturation, 3-hour precipitation bursts, and squall velocity to prevent Kharif/Rabi crop lodging and fertilizer runoff.
              </p>
            </div>

            {/* Marine Focus */}
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#38bdf8' }}>
                <Anchor size={18} />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>तटीय एवं समुद्री सुरक्षा (Marine Priority)</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0 }}>
                Dedicated coastal surge and sea-chop monitoring alerts artisanal fishermen and small craft operators before gale-force winds reach nearshore waters.
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
