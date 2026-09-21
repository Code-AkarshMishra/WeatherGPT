import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import DisasterAdvisoryCard from '../components/DisasterAdvisoryCard';
import WeatherMap from '../components/WeatherMap';
import CropCalendar from '../components/CropCalendar';
import MultiCityComparison from '../components/MultiCityComparison';
import AlertSubscriptionModal from '../components/AlertSubscriptionModal';
import SpeakButton from '../components/SpeakButton';
import PWAInstallBanner from '../components/PWAInstallBanner';
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
  Bell,
  Layers,
  Sparkles,
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

function formatLocalizedBulletin(b, t) {
  if (!b) return { regionName: '', statusBadge: '', title: '', desc: '', time: '' };

  // 1. Region name
  const regionRaw = (b.region || '').toLowerCase();
  let regionName = b.region;
  if (regionRaw.includes('north-west') || regionRaw.includes('himalayan')) {
    regionName = t('regions.northwest', b.region);
  } else if (regionRaw.includes('gangetic') || regionRaw.includes('indo-gangetic')) {
    regionName = t('regions.indogangetic', b.region);
  } else if (regionRaw.includes('western')) {
    regionName = t('regions.western', b.region);
  } else if (regionRaw.includes('southern')) {
    regionName = t('regions.southern', b.region);
  } else if (regionRaw.includes('north-east') || regionRaw.includes('northeast')) {
    regionName = t('regions.northeast', b.region);
  } else if (regionRaw.includes('eastern')) {
    regionName = t('regions.eastern', b.region);
  } else if (regionRaw.includes('bengal')) {
    regionName = t('regions.bayofbengal', b.region);
  } else if (regionRaw.includes('arabian')) {
    regionName = t('regions.arabiansea', b.region);
  }

  // 2. Status badge
  const statusKey = (b.status || 'GREEN').toLowerCase();
  const statusBadge = t(`alerts.tierBadges.${statusKey}`, b.status);

  // 3. Title localization
  let title = b.title;
  if (statusKey === 'green') {
    const lowerTitle = (b.title || '').toLowerCase();
    let condition = '';
    if (lowerTitle.includes('clear')) condition = t('clear', 'Clear Sky');
    else if (lowerTitle.includes('cloud')) condition = t('clouds', 'Clouds');
    else if (lowerTitle.includes('rain')) condition = t('rain', 'Rain');
    else if (lowerTitle.includes('drizzle')) condition = t('drizzle', 'Drizzle');
    else if (lowerTitle.includes('thunder')) condition = t('thunderstorm', 'Thunderstorm');
    else if (lowerTitle.includes('fog') || lowerTitle.includes('mist')) condition = t('fog', 'Fog');

    title = condition
      ? `${t('alerts.normalConditions', 'Normal Conditions')} — ${condition}`
      : t('alerts.normalConditions', 'Normal Conditions');
  } else if (statusKey === 'yellow') {
    title = t('alerts.watchActive', 'Watch Active');
  } else if (statusKey === 'orange') {
    title = t('alerts.alertActive', 'Alert — Heavy Weather Activity');
  } else if (statusKey === 'red') {
    title = t('alerts.severeWarning', 'SEVERE WARNING — Extreme Conditions');
  }

  // 4. Description localization
  let desc = b.desc;
  const tempMatch = b.desc?.match(/Temperature\s*(\d+)°C/i);
  const windMatch = b.desc?.match(/Wind\s*(\d+)\s*km\/h/i);
  const rainMatch = b.desc?.match(/Rain probability\s*(\d+)%/i);
  if (tempMatch && windMatch && rainMatch) {
    const temp = tempMatch[1];
    const wind = windMatch[1];
    const rain = rainMatch[1];
    const statusText = statusKey === 'green' ? t('alerts.noWarningClear', 'No Warning / All Clear') : '';
    desc = `${t('weather.temperature', 'Temperature')} ${temp}°C, ${t('weather.wind', 'Wind')} ${wind} km/h, ${t('weather.rainProbability', 'Rain probability')} ${rain}%. ${statusText}`.trim();
  }

  // 5. Time localization
  let time = b.time;
  if (b.time && b.time.toLowerCase().includes('updated')) {
    const timeVal = b.time.replace(/updated\s*/i, '');
    time = `${t('alerts.updatedAt', 'Updated')} ${timeVal}`;
  }

  return { regionName, statusBadge, title, desc, time };
}

export default function DisasterAlertsPage() {
  const { t, lang } = useLanguage();
  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);
  const [searchCity, setSearchCity] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [bulletins, setBulletins] = useState([]);
  const [imdWarnings, setImdWarnings] = useState([]);
  const [loadingBulletins, setLoadingBulletins] = useState(false);

  const lat = overrideLat ?? (geoLat || 26.8467);
  const lon = overrideLon ?? (geoLon || 80.9462);

  const { data, loading, refetch } = useWeather(lat, lon);

  // Fetch dynamic regional bulletins from backend IMD service
  useEffect(() => {
    const fetchBulletinsAndWarnings = async () => {
      setLoadingBulletins(true);
      try {
        const [bulletinRes, warningRes] = await Promise.allSettled([
          api.get('/api/weather/regional-bulletins'),
          api.get('/api/weather/imd-warnings'),
        ]);

        if (bulletinRes.status === 'fulfilled' && bulletinRes.value.data?.data) {
          setBulletins(bulletinRes.value.data.data);
        }
        if (warningRes.status === 'fulfilled' && warningRes.value.data?.data) {
          setImdWarnings(warningRes.value.data.data);
        }
      } catch (err) {
        console.warn('Error fetching IMD feeds:', err);
      } finally {
        setLoadingBulletins(false);
      }
    };

    fetchBulletinsAndWarnings();
  }, []);

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
        <div className="weather-page-inner" style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 24, margin: '0 auto', padding: '16px 16px 48px' }}>
          
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
                  <ShieldAlert size={14} /> {t('alerts.title')}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {t('weather.activeStation')}: <strong style={{ color: 'var(--color-text-primary)' }}>{cityName}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                {t('alerts.title')}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                {t('alerts.subtitle')}
              </p>
            </div>

            {/* Actions: Subscribe & City Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSubscriptionOpen(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: 'var(--color-danger)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Bell size={16} />
                <span>{t('alerts.proactiveAlertBtn')}</span>
              </button>

              <button
                onClick={handleUseGPS}
                className="atmospheric-btn"
                title={t('weather.useGPS')}
                aria-label={t('weather.useGPS')}
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
                  placeholder={t('searchCity', 'Search city or district...')}
                  style={{ width: 140, color: 'var(--color-text-primary)' }}
                />
                <button
                  type="submit"
                  disabled={geocoding}
                  style={{ background: 'var(--color-primary)' }}
                  aria-label={t('common.search')}
                >
                  <Search size={14} />
                </button>
              </form>
            </div>
          </div>

          {/* Quick City Selector Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('common.inspect')}:
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

          {/* GIS Interactive Weather & Cyclone Map */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {t('radar.title')}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {t('radar.subtitle')}
              </span>
            </div>
            <WeatherMap
              lat={lat}
              lon={lon}
              weatherData={data}
              disasterRisk={disasterRisk}
              onLocationSelect={(newLat, newLon) => {
                setOverrideLat(newLat);
                setOverrideLon(newLon);
              }}
              height="440px"
              showCycloneTrack={true}
            />
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
                  {t('alerts.regionalBulletins')}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                {t('alerts.liveTelemetry')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {bulletins.length > 0
                ? bulletins.map((b, idx) => {
                    const { regionName, statusBadge, title, desc, time } = formatLocalizedBulletin(b, t);
                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.4))',
                          border: `1px solid var(--color-border)`,
                          borderLeft: `4px solid ${b.color || '#22c55e'}`,
                          borderRadius: 12,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            {regionName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: `${b.color || '#22c55e'}22`,
                              color: b.color || '#22c55e',
                            }}
                          >
                            {statusBadge}
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>{title}</strong>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                          {desc}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{time}</span>
                          <SpeakButton text={`${title}. ${desc}`} size="small" />
                        </div>
                      </div>
                    );
                  })
                : (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      {t('common.loading')}
                    </div>
                  )}
            </div>
          </div>

          {/* Pan-India Multi-City Comparison Matrix */}
          <MultiCityComparison
            onSelectCity={(cityItem) => {
              if (cityItem.lat && cityItem.lon) {
                setOverrideLat(cityItem.lat);
                setOverrideLon(cityItem.lon);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          />

          {/* GKMS Agromet Crop Calendar */}
          <CropCalendar
            currentTemp={data?.temperature || 28}
            currentRainProb={data?.rainProbability || 30}
          />

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
                {t('alerts.helplinesTitle')}
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase' }}>NDRF</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1078</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('alerts.ndrfRescue')}</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>{t('alerts.imdMausamTitle', 'IMD Mausam')}</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1800-180-1717</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('alerts.imdMausam')}</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#eab308', textTransform: 'uppercase' }}>{t('alerts.stateControlTitle', 'State Control')}</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>1070</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('alerts.stateControl')}</span>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase' }}>{t('alerts.emergencyTitle', 'Emergency')}</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>112</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('alerts.nationalEmergency')}</span>
              </div>
            </div>
          </div>

          <RoadmapNext />
        </div>
      </main>

      {/* Proactive Alert Subscription Modal */}
      <AlertSubscriptionModal
        isOpen={subscriptionOpen}
        onClose={() => setSubscriptionOpen(false)}
        currentCity={cityName}
      />

      <PWAInstallBanner />
    </div>
  );
}
