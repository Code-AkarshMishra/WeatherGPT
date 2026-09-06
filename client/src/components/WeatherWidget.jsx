import { useState, useRef } from 'react';
import { useWeather } from '../hooks/useWeather';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingSkeleton from './LoadingSkeleton';
import '../styles/weather.css';

const CONDITION_ICONS = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  storm: '⛈️',
  snow: '❄️',
};

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

export default function WeatherWidget({ lat, lon, onLocationChange }) {
  const { data, loading, error, refetch } = useWeather(lat, lon);
  const { t } = useLanguage();
  const [searchValue, setSearchValue] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const searchRef = useRef(null);

  const condition = data ? getConditionFromIcon(data.weatherIcon) : 'clear';

  const handleGeocode = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    setGeocoding(true);
    try {
      // Use OWM geocoding via our backend proxy
      const res = await fetch(`/api/weather/geocode?city=${encodeURIComponent(searchValue)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) onLocationChange(json.data.lat, json.data.lon);
      }
    } catch {
      // fallback: just pass city name as-is; the backend can handle geocoding
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onLocationChange(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }
  };

  // Always render — show skeleton until data
  return (
    <div
      className="weather-widget"
      data-condition={condition}
      role="region"
      aria-label="Current weather"
      aria-live="polite"
    >
      {loading ? (
        <div className="weather-skeleton">
          <LoadingSkeleton width={120} height={20} />
          <LoadingSkeleton width={60} height={32} />
          <LoadingSkeleton width={40} height={40} />
          <LoadingSkeleton width={80} height={20} />
          <LoadingSkeleton width={80} height={20} />
          <LoadingSkeleton width={100} height={20} />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>⚠️</span>
          <span>{t('errorFetch')}</span>
          <button onClick={refetch} className="btn btn-ghost" style={{ height: 32, padding: '0 var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          {/* Location */}
          <div className="weather-location">
            <span className="weather-location-icon">📍</span>
            <span className="weather-location-name">{data.locationName}, {data.country}</span>
          </div>

          <div className="weather-divider" aria-hidden="true" />

          {/* Icon */}
          <span className="weather-icon" aria-label={data.description} title={data.description}>
            {CONDITION_ICONS[condition] || '🌤️'}
          </span>

          {/* Temperature */}
          <div className="weather-temp">
            <span className="weather-temp-main">{data.temperature}°C</span>
            <span className="weather-temp-feels">{t('feelsLike')}: {data.feelsLike}°C</span>
          </div>

          <div className="weather-divider" aria-hidden="true" />

          {/* Stats */}
          <div className="weather-stats">
            <div className="weather-stat">
              <span className="weather-stat-label">{t('humidity')}</span>
              <span className="weather-stat-value">{data.humidity}%</span>
            </div>
            <div className="weather-stat">
              <span className="weather-stat-label">{t('wind')}</span>
              <span className="weather-stat-value">{data.windSpeed} km/h</span>
            </div>
          </div>

          <div className="weather-divider" aria-hidden="true" />

          {/* Rain probability */}
          <div className="rain-prob">
            <span className="rain-prob-label">{t('rainChance')}</span>
            <div className="rain-prob-bar" role="meter" aria-valuenow={data.rainProbability} aria-valuemin={0} aria-valuemax={100}>
              <div className="rain-prob-fill" style={{ width: `${data.rainProbability}%` }} />
            </div>
            <span className="rain-prob-value">{data.rainProbability}%</span>
          </div>

          {/* Manual override */}
          <div className="weather-override">
            <form onSubmit={handleGeocode} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                ref={searchRef}
                className="weather-search-input"
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t('searchLocation')}
                aria-label="Search location"
                id="weather-search"
              />
              <button
                type="submit"
                className="weather-btn-gps"
                disabled={geocoding}
                aria-label="Search location"
              >
                {geocoding ? '...' : '🔍'}
              </button>
            </form>
            <button
              className="weather-btn-gps"
              onClick={handleUseMyLocation}
              title={t('useLocation')}
              aria-label={t('useLocation')}
              id="use-location-btn"
            >
              📍
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
