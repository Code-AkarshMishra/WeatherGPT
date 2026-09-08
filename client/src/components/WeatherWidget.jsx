import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  MapPin,
  Search,
  Navigation,
  Droplets,
  Wind,
  Volume2,
  VolumeX,
  Maximize2,
} from 'lucide-react';
import { useWeather } from '../hooks/useWeather';
import { useLanguage } from '../contexts/LanguageContext';
import { weatherAudio } from '../services/weatherAudio';
import LoadingSkeleton from './LoadingSkeleton';
import api from '../services/api';
import '../styles/weather.css';

function renderConditionIcon(condition) {
  switch (condition) {
    case 'clear':
      return <Sun size={24} style={{ color: '#f59e0b' }} />;
    case 'cloudy':
      return <Cloud size={24} style={{ color: '#94a3b8' }} />;
    case 'rain':
      return <CloudRain size={24} style={{ color: '#38bdf8' }} />;
    case 'storm':
      return <CloudLightning size={24} style={{ color: '#a855f7' }} />;
    case 'snow':
      return <Snowflake size={24} style={{ color: '#e0f2fe' }} />;
    default:
      return <Sun size={24} style={{ color: '#f59e0b' }} />;
  }
}

// Map OpenWeatherMap icon codes to our condition strings
function getConditionFromIcon(icon) {
  if (!icon) return 'clear';
  const code = icon.slice(0, 2);
  const codeMap = {
    '01': 'clear', '02': 'cloudy', '03': 'cloudy', '04': 'cloudy',
    '09': 'rain', '10': 'rain', '11': 'storm', '13': 'snow', '50': 'cloudy',
  };
  return codeMap[code] || 'clear';
}

export default function WeatherWidget({
  lat,
  lon,
  onLocationChange,
  externalData,
  externalLoading,
}) {
  const navigate = useNavigate();
  const weatherHook = useWeather(externalData ? null : lat, externalData ? null : lon);
  const data = externalData || weatherHook.data;
  const loading = externalLoading !== undefined ? externalLoading : weatherHook.loading;
  const error = weatherHook.error;
  const refetch = weatherHook.refetch;

  const { t } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [isMuted, setIsMuted] = useState(weatherAudio.getMuted());
  const searchRef = useRef(null);

  const condition = data ? getConditionFromIcon(data.weatherIcon) : 'clear';

  useEffect(() => {
    const unsub = weatherAudio.subscribe((muted) => setIsMuted(muted));
    return unsub;
  }, []);

  const handleAudioToggle = (e) => {
    e.stopPropagation();
    const newMuted = weatherAudio.toggleMute();
    setIsMuted(newMuted);
  };

  const handleForecastClick = () => {
    navigate('/weather');
  };

  const handleGeocode = async (e) => {
    e.preventDefault();
    const city = searchValue.trim();
    if (!city) return;
    setGeocoding(true);
    try {
      const res = await api.get('/api/weather/geocode', {
        params: { city },
      });
      if (res.data?.data) {
        const { lat, lon, name } = res.data.data;
        onLocationChange(lat, lon, name || city);
        setShowSearchModal(false);
        setSearchValue('');
      }
    } catch {
      // fallback
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseMyLocation = (e) => {
    e?.stopPropagation();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onLocationChange(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }
  };

  const POPULAR_CITIES = [
    { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
    { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  ];

  const handleSpeakAlert = (e) => {
    e.stopPropagation();
    if (!data?.disasterRisk || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = data.disasterRisk.spokenTextHi || data.disasterRisk.spokenTextEn;
    const utterance = new SpeechSynthesisUtterance(text);
    const hasHindi = /[\u0900-\u097F]/.test(text);
    const voices = window.speechSynthesis.getVoices();
    if (hasHindi) {
      utterance.lang = 'hi-IN';
      const hiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hiVoice) utterance.voice = hiVoice;
    } else {
      utterance.lang = 'en-IN';
    }
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      <div
        className="weather-widget"
        data-condition={condition}
        role="region"
        aria-label="Current weather"
        aria-live="polite"
      >
        {loading && !data ? (
          <div className="weather-skeleton">
            <LoadingSkeleton width={110} height={20} />
            <LoadingSkeleton width={50} height={28} />
            <LoadingSkeleton width={80} height={20} />
          </div>
        ) : error && !data ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ color: '#f59e0b' }}>⚡</span>
            <span>Switching to regional MoES radar station:</span>
            {POPULAR_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => onLocationChange(c.lat, c.lon)}
                className="btn btn-ghost"
                style={{ height: 26, padding: '0 8px', fontSize: '11px', borderRadius: 12, border: '1px solid var(--color-border)' }}
              >
                {c.name}
              </button>
            ))}
            <button onClick={refetch} className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: '11px' }}>
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="weather-widget-inner">
            {/* Left: Location & PM2.5 badge */}
            <div
              className="weather-widget-left"
              onClick={handleForecastClick}
              title="Click to view MIUI atmospheric forecast"
            >
              <div className="weather-location">
                <span className="weather-location-icon">
                  <MapPin size={15} style={{ color: '#ef4444' }} />
                </span>
                <span className="weather-location-name">{data.locationName}</span>
              </div>

              {data.airQuality && (
                <div
                  className="aqi-pill-badge widget-aqi"
                  style={{ borderColor: data.airQuality.color }}
                  title={`Air Quality: ${data.airQuality.label}`}
                >
                  <span className="aqi-icon-tag">PM2.5</span>
                  <span className="aqi-val-tag">{data.airQuality.pm2_5}</span>
                </div>
              )}

              {data.disasterRisk && (
                <div
                  className="aqi-pill-badge widget-aqi"
                  title={`MoES IMD Warning: ${data.disasterRisk.statusText} — Click to hear voice readout`}
                  onClick={handleSpeakAlert}
                  style={{
                    cursor: 'pointer',
                    borderColor:
                      data.disasterRisk.imdColorCode === 'RED'
                        ? '#ef4444'
                        : data.disasterRisk.imdColorCode === 'ORANGE'
                        ? '#f97316'
                        : data.disasterRisk.imdColorCode === 'YELLOW'
                        ? '#eab308'
                        : '#22c55e',
                  }}
                >
                  <span className="aqi-icon-tag" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Volume2 size={10} /> IMD
                  </span>
                  <span
                    className="aqi-val-tag"
                    style={{
                      color:
                        data.disasterRisk.imdColorCode === 'RED'
                          ? '#f87171'
                          : data.disasterRisk.imdColorCode === 'ORANGE'
                          ? '#fb923c'
                          : data.disasterRisk.imdColorCode === 'YELLOW'
                          ? '#facc15'
                          : '#4ade80',
                    }}
                  >
                    {data.disasterRisk.imdColorCode}
                  </span>
                </div>
              )}
            </div>

            {/* Center: Condition Icon & Temperature */}
            <div
              className="weather-widget-center"
              onClick={handleForecastClick}
              title="Click for 24h & 7-day forecast"
            >
              <span className="weather-icon" aria-label={data.description} title={data.description}>
                {renderConditionIcon(condition)}
              </span>

              <div className="weather-temp">
                <span className="weather-temp-main">{data.temperature}°C</span>
                <span className="weather-temp-feels desktop-only">
                  {data.tempMin ?? data.temperature}° ~ {data.tempMax ?? data.temperature}°
                </span>
              </div>
            </div>

            {/* Desktop only: Humidity & Wind stats */}
            <div className="weather-stats desktop-only">
              <div className="weather-stat" title="Humidity">
                <span className="weather-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Droplets size={11} /> {t('humidity')}
                </span>
                <span className="weather-stat-value">{data.humidity}%</span>
              </div>
              <div className="weather-stat" title="Wind Speed">
                <span className="weather-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Wind size={11} /> {t('wind')}
                </span>
                <span className="weather-stat-value">{data.windSpeed} km/h</span>
              </div>
            </div>

            {/* Rain chance: Compact pill on tablet, full bar on desktop */}
            <div
              className="rain-prob tablet-hide"
              onClick={handleForecastClick}
              style={{ cursor: 'pointer' }}
              title="Rain probability"
            >
              <span className="rain-prob-label">{t('rainChance')}</span>
              <div className="rain-prob-bar" role="meter" aria-valuenow={data.rainProbability} aria-valuemin={0} aria-valuemax={100}>
                <div className="rain-prob-fill" style={{ width: `${data.rainProbability}%` }} />
              </div>
              <span className="rain-prob-value">{data.rainProbability}%</span>
            </div>

            {/* Right: Sound toggle, Search trigger, and MIUI Forecast CTA */}
            <div className="weather-widget-right">
              {/* Sound toggle */}
              <motion.button
                type="button"
                className={`weather-action-btn ${!isMuted ? 'active-audio' : ''}`}
                onClick={handleAudioToggle}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                title={isMuted ? 'Unmute Ambient Sound' : 'Mute Ambient Sound'}
                aria-label="Toggle weather sound"
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                {!isMuted && <span className="audio-wave-dot" />}
              </motion.button>

              {/* GPS Button */}
              <motion.button
                type="button"
                className="weather-action-btn"
                onClick={handleUseMyLocation}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                title={t('useLocation')}
                aria-label={t('useLocation')}
              >
                <Navigation size={14} />
              </motion.button>

              {/* Search Modal Trigger on Mobile / Form on Desktop */}
              <div className="weather-desktop-search">
                <form onSubmit={handleGeocode} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    ref={searchRef}
                    className="weather-search-input"
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={t('searchLocation')}
                    aria-label="Search location"
                  />
                  <button type="submit" className="weather-search-submit" disabled={geocoding}>
                    {geocoding ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Search size={13} />}
                  </button>
                </form>
              </div>

              {/* Mobile Search Icon */}
              <button
                type="button"
                className="weather-action-btn mobile-search-btn"
                onClick={() => setShowSearchModal(true)}
                title="Search City"
              >
                <Search size={14} />
              </button>

              {/* Prominent Forecast Button */}
              <motion.button
                type="button"
                className="weather-forecast-cta"
                onClick={handleForecastClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="View Full Weather Dashboard"
              >
                <Maximize2 size={13} />
                <span className="forecast-btn-text">Forecast</span>
              </motion.button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile Search Dialog */}
      {showSearchModal && (
        <div className="weather-search-modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="weather-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="weather-search-modal-header">
              <h3>Search City Weather</h3>
              <button onClick={() => setShowSearchModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGeocode} className="weather-search-modal-form">
              <input
                type="text"
                autoFocus
                placeholder="Enter city (e.g. Lucknow, Delhi, Mumbai)..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              <button type="submit" disabled={geocoding}>
                {geocoding ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

