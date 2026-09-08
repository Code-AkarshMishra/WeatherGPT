import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Volume2,
  VolumeX,
  MapPin,
  Search,
  Navigation,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Sunrise,
  Sunset,
  ShieldCheck,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import AtmosphericCanvas from './AtmosphericCanvas';
import HourlyTempSpline from './HourlyTempSpline';
import DailyForecastCard from './DailyForecastCard';
import { weatherAudio } from '../services/weatherAudio';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

export default function WeatherAtmosphericCard({
  data,
  loading,
  onLocationChange,
  showFullDetails = true,
}) {
  const { t } = useLanguage();
  const [isMuted, setIsMuted] = useState(weatherAudio.getMuted());
  const [isSearching, setIsSearching] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const condition = data?.condition || 'clear';
  const rainProbability = data?.rainProbability ?? 40;

  // Listen to audio manager mute state
  useEffect(() => {
    const unsub = weatherAudio.subscribe((muted) => setIsMuted(muted));
    return unsub;
  }, []);

  // Update audio condition when data arrives
  useEffect(() => {
    if (data && !isMuted) {
      weatherAudio.setCondition(condition, rainProbability);
    }
  }, [condition, rainProbability, data, isMuted]);

  const handleAudioToggle = () => {
    const newMuted = weatherAudio.toggleMute();
    setIsMuted(newMuted);
  };

  const handleGeocode = async (e) => {
    e.preventDefault();
    const city = searchCity.trim();
    if (!city || !onLocationChange) return;
    setGeocoding(true);
    try {
      const res = await api.get('/api/weather/geocode', {
        params: { city },
      });
      if (res.data?.data) {
        const { lat, lon, name } = res.data.data;
        onLocationChange(lat, lon, name || city);
        setIsSearching(false);
        setSearchCity('');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleUseGPS = () => {
    if (navigator.geolocation && onLocationChange) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onLocationChange(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn(err)
      );
    }
  };

  if (loading && !data) {
    return (
      <div className="atmospheric-card-loading">
        <div className="spinner" />
        <span>{t('loadingAtmosphere', 'Loading live atmospheric weather...')}</span>
      </div>
    );
  }

  if (!data) return null;

  const cityName = data.locationName || 'Lucknow';
  const aqi = data.airQuality || { pm2_5: 25, aqi: 2, label: 'Fair', color: '#84cc16', components: {} };
  const temp = data.temperature ?? 28;
  const tempMin = data.tempMin ?? 25;
  const tempMax = data.tempMax ?? 31;
  const feelsLike = data.feelsLike ?? 31;
  const weatherTitle = data.weatherMain || (condition === 'storm' ? 'Thunderstorm' : condition.toUpperCase());

  return (
    <div className="atmospheric-dashboard-wrapper">
      {/* Full-bleed Live Atmospheric Canvas Background */}
      <AtmosphericCanvas
        condition={condition}
        rainProbability={rainProbability}
        interactive={true}
      />

      {/* Atmospheric Content Layer */}
      <div className="atmospheric-content-layer">
        {/* Top Control Bar: City, Actions & Search */}
        <div className="atmospheric-header">
          <div className="atmospheric-city-group">
            <h1 className="atmospheric-city-name">{cityName}</h1>
            <span className="atmospheric-country">{data.country}</span>
            <span className="atmospheric-live-tag">
              <span className="live-dot" /> {t('liveAtmosphere', 'LIVE ATMOSPHERE')}
            </span>
          </div>

          <div className="atmospheric-actions">
            {/* Ambient Sound Toggle */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleAudioToggle}
              className={`atmospheric-btn ${!isMuted ? 'active-audio' : ''}`}
              title={isMuted ? t('unmuteSound', 'Unmute Ambient Sound') : t('muteSound', 'Mute Ambient Sound')}
              aria-label="Toggle ambient weather sound"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              {!isMuted && <span className="audio-wave-dot" />}
            </motion.button>

            {/* GPS Location Button */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleUseGPS}
              className="atmospheric-btn"
              title={t('useLocation', 'Use GPS Location')}
              aria-label="Use current location"
            >
              <Navigation size={18} />
            </motion.button>

            {/* Inline / Toggle Search */}
            <form onSubmit={handleGeocode} className="atmospheric-search-form">
              <MapPin size={15} style={{ color: '#ef4444' }} />
              <input
                type="text"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder={t('searchCity', 'Search city or district...')}
              />
              <button type="submit" disabled={geocoding}>
                {geocoding ? '...' : <Search size={14} />}
              </button>
            </form>

            {/* Quick link to dedicated MoES Disaster & Severe-Weather Center */}
            {data.disasterRisk && (
              <Link
                to="/alerts"
                className="atmospheric-btn"
                style={{
                  width: 'auto',
                  borderRadius: 9999,
                  padding: '0 12px',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  color: '#ffffff',
                  background:
                    data.disasterRisk.imdColorCode === 'RED'
                      ? 'rgba(239, 68, 68, 0.25)'
                      : data.disasterRisk.imdColorCode === 'ORANGE'
                      ? 'rgba(249, 115, 22, 0.25)'
                      : data.disasterRisk.imdColorCode === 'YELLOW'
                      ? 'rgba(234, 179, 8, 0.25)'
                      : 'rgba(34, 197, 94, 0.2)',
                  border: `1px solid ${
                    data.disasterRisk.imdColorCode === 'RED'
                      ? '#ef4444'
                      : data.disasterRisk.imdColorCode === 'ORANGE'
                      ? '#f97316'
                      : data.disasterRisk.imdColorCode === 'YELLOW'
                      ? '#eab308'
                      : '#22c55e'
                  }`,
                }}
                title="View full MoES Disaster & Severe-Weather Intelligence Center"
              >
                <ShieldAlert size={14} style={{ color: data.disasterRisk.imdColorCode === 'GREEN' ? '#4ade80' : '#facc15' }} />
                <span>IMD {data.disasterRisk.imdColorCode}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Responsive Multi-Column Grid for Landscape / Fluid for Portrait */}
        <div className="atmospheric-dashboard-grid">
          {/* ── LEFT COLUMN: Hero Overview ── */}
          <div className="grid-col-hero">
            <div className="glass-card hero-glass-card">
              {/* AQI Badge */}
              <div className="hero-aqi-row">
                <div className="aqi-pill-badge" style={{ borderColor: aqi.color }}>
                  <span className="aqi-icon-tag">PM 2.5</span>
                  <span className="aqi-val-tag">{aqi.pm2_5}</span>
                </div>
                <span className="aqi-status-text" style={{ color: aqi.color }}>
                  {aqi.label} {t('airQuality', 'Air Quality')}
                </span>
              </div>

              {/* Condition Title */}
              <h2 className="atmospheric-condition-title">{weatherTitle}</h2>

              {/* Min/Max & Feels like */}
              <div className="atmospheric-sub-status">
                <span>{tempMin}° ~ {tempMax}°C</span>
                <span className="atmospheric-dot-sep">•</span>
                <span>{t('feelsLike', 'Feels like')} {feelsLike}°C</span>
              </div>

              {/* Hero Big Temperature */}
              <div className="atmospheric-huge-temp">
                {temp}<span className="atmospheric-huge-unit">°C</span>
              </div>

              {/* Rain Probability Summary */}
              <div className="hero-rain-card">
                <div className="hero-rain-header">
                  <span>{t('precipitationChance', 'Precipitation Chance')}</span>
                  <span className="hero-rain-val">{rainProbability}%</span>
                </div>
                <div className="hero-rain-bar">
                  <div className="hero-rain-fill" style={{ width: `${rainProbability}%` }} />
                </div>
              </div>
            </div>

            {/* Air Pollution Components (Landscape / Portrait Card) */}
            {aqi.components && Object.keys(aqi.components).length > 0 && (
              <div className="glass-card aqi-breakdown-card">
                <div className="card-section-title">
                  <ShieldCheck size={16} />
                  <span>{t('pollutantLevels', 'Pollutant Levels (µg/m³)')}</span>
                </div>
                <div className="pollutant-grid">
                  <div className="pollutant-item">
                    <span className="pollutant-label">PM10</span>
                    <span className="pollutant-val">{aqi.pm10 || '—'}</span>
                  </div>
                  <div className="pollutant-item">
                    <span className="pollutant-label">NO₂</span>
                    <span className="pollutant-val">{Math.round(aqi.components.no2 || 0)}</span>
                  </div>
                  <div className="pollutant-item">
                    <span className="pollutant-label">O₃</span>
                    <span className="pollutant-val">{Math.round(aqi.components.o3 || 0)}</span>
                  </div>
                  <div className="pollutant-item">
                    <span className="pollutant-label">CO</span>
                    <span className="pollutant-val">{Math.round(aqi.components.co || 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER COLUMN: 24-Hour Spline Curve & Metrics Grid ── */}
          <div className="grid-col-center">
            {/* 24-Hour Temperature Spline Curve */}
            <div className="glass-card spline-glass-card">
              <div className="card-section-title">
                <Compass size={16} />
                <span>{t('trend24h', '24-Hour Temperature & Rain Trend')}</span>
              </div>
              <HourlyTempSpline
                hourly={data.hourlyForecast || []}
                sunriseTime={data.sunriseFormatted}
                sunsetTime={data.sunsetFormatted}
                currentTemp={temp}
              />
            </div>

            {/* Detailed Weather Metrics Grid */}
            {showFullDetails && (
              <div className="atmospheric-metrics-grid">
                <div className="metric-chip">
                  <span className="metric-chip-icon"><Droplets size={18} /></span>
                  <div className="metric-chip-info">
                    <span className="metric-chip-label">{t('humidity', 'Humidity')}</span>
                    <span className="metric-chip-val">{data.humidity}%</span>
                  </div>
                </div>

                <div className="metric-chip">
                  <span className="metric-chip-icon"><Wind size={18} /></span>
                  <div className="metric-chip-info">
                    <span className="metric-chip-label">{t('windSpeed', 'Wind Speed')}</span>
                    <span className="metric-chip-val">{data.windSpeed} km/h</span>
                  </div>
                </div>

                <div className="metric-chip">
                  <span className="metric-chip-icon"><Gauge size={18} /></span>
                  <div className="metric-chip-info">
                    <span className="metric-chip-label">{t('pressure', 'Pressure')}</span>
                    <span className="metric-chip-val">{data.pressure} hPa</span>
                  </div>
                </div>

                <div className="metric-chip">
                  <span className="metric-chip-icon"><Eye size={18} /></span>
                  <div className="metric-chip-info">
                    <span className="metric-chip-label">{t('visibility', 'Visibility')}</span>
                    <span className="metric-chip-val">{data.visibility ?? 10} km</span>
                  </div>
                </div>

                {data.sunriseFormatted && (
                  <div className="metric-chip">
                    <span className="metric-chip-icon" style={{ color: '#fbbf24' }}><Sunrise size={18} /></span>
                    <div className="metric-chip-info">
                      <span className="metric-chip-label">{t('sunrise', 'Sunrise')}</span>
                      <span className="metric-chip-val">{data.sunriseFormatted}</span>
                    </div>
                  </div>
                )}

                {data.sunsetFormatted && (
                  <div className="metric-chip">
                    <span className="metric-chip-icon" style={{ color: '#f97316' }}><Sunset size={18} /></span>
                    <div className="metric-chip-info">
                      <span className="metric-chip-label">{t('sunset', 'Sunset')}</span>
                      <span className="metric-chip-val">{data.sunsetFormatted}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: 7-Day Forecast Prediction ── */}
          <div className="grid-col-forecast">
            <div className="glass-card forecast-glass-card">
              <div className="card-section-title">
                <span>{t('dailyForecast', '7-Day Weather Outlook')}</span>
              </div>
              <DailyForecastCard daily={data.dailyForecast || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
