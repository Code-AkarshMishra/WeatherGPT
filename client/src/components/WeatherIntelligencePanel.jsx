import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Wind,
  Droplets,
  Eye,
  Gauge as PressureIcon,
  ShieldAlert,
  Compass,
  Volume2,
  VolumeX,
  CloudRain,
  CloudSun,
  Sun,
  CloudLightning,
  CloudFog,
  Cloud,
} from 'lucide-react';
import RiskGauge from './RiskGauge';
import HourlyTempSpline from './HourlyTempSpline';
import DailyForecastCard from './DailyForecastCard';
import { weatherAudio } from '../services/weatherAudio';
import '../styles/weather.css';

export function calculateDynamicRiskScore(weatherData) {
  if (!weatherData) return 25;
  const rainProb = Number(weatherData.rainProbability ?? weatherData.rain_probability ?? 40);
  const windSpeed = Number(weatherData.windSpeed ?? weatherData.wind_speed ?? weatherData.wind_speed_kmh ?? 10);
  const temp = Number(weatherData.temperature ?? 25);
  const imdColor = (weatherData.disasterRisk?.imdColorCode || weatherData.disaster_risk?.imd_color_code || 'GREEN').toUpperCase();

  const rainScore = (rainProb / 100) * 35;
  const windScore = Math.min(30, (windSpeed / 60) * 30);
  let tempScore = 0;
  if (temp > 38) tempScore = Math.min(15, (temp - 38) * 3);
  else if (temp < 8) tempScore = Math.min(15, (8 - temp) * 2);
  const alertBoost = imdColor === 'RED' ? 35 : imdColor === 'ORANGE' ? 22 : imdColor === 'YELLOW' ? 12 : 0;

  const total = Math.round(rainScore + windScore + tempScore + alertBoost);
  return Math.max(5, Math.min(98, total));
}

function getWeatherConditionGraphic(condition) {
  const condLower = (condition || '').toLowerCase();
  if (condLower.includes('rain') || condLower.includes('drizzle')) return { Icon: CloudRain, color: '#38bdf8' };
  if (condLower.includes('thunder') || condLower.includes('storm')) return { Icon: CloudLightning, color: '#f59e0b' };
  if (condLower.includes('clear') || condLower.includes('sun')) return { Icon: Sun, color: '#facc15' };
  if (condLower.includes('fog') || condLower.includes('mist')) return { Icon: CloudFog, color: '#cbd5e1' };
  return { Icon: CloudSun, color: '#94a3b8' };
}

/** Generates a list of early weather update bulletins from live weather data */
function generateWeatherUpdates(weatherData, imdColor, imdRisk) {
  const updates = [];
  const rain = Number(weatherData?.rainProbability ?? weatherData?.rain_probability ?? 40);
  const wind = Number(weatherData?.windSpeed ?? weatherData?.wind_speed ?? 10);
  const temp = Number(weatherData?.temperature ?? 28);
  const humidity = Number(weatherData?.humidity ?? 70);
  const visibility = Number(weatherData?.visibility ?? 10);
  const city = weatherData?.locationName || 'your area';
  const now = new Date();
  const hour = now.getHours();

  // Time-based morning/evening advisory
  if (hour >= 5 && hour < 10) {
    updates.push({ icon: '🌅', text: `Morning update for ${city}: ${temp}°C with ${rain}% rain chance. ${rain > 60 ? 'Carry an umbrella today.' : 'Conditions look pleasant for morning activities.'}`, color: '#38bdf8' });
  } else if (hour >= 17 && hour < 21) {
    updates.push({ icon: '🌆', text: `Evening advisory: Temperatures easing to ${temp}°C. ${wind > 30 ? 'Gusty winds expected — secure loose items.' : 'Calm evening conditions expected.'}`, color: '#f59e0b' });
  } else {
    updates.push({ icon: '🕐', text: `Current conditions in ${city}: ${temp}°C, ${humidity}% humidity, ${wind} km/h winds.`, color: '#94a3b8' });
  }

  // Rain probability
  if (rain >= 75) {
    updates.push({ icon: '🌧️', text: `HIGH rain probability (${rain}%) — heavy showers likely in ${city}. Avoid low-lying areas and waterlogged roads.`, color: '#38bdf8' });
  } else if (rain >= 50) {
    updates.push({ icon: '🌦️', text: `Moderate rain expected (${rain}% probability). Light to moderate showers likely in ${city} — carry rain gear.`, color: '#60a5fa' });
  } else if (rain >= 25) {
    updates.push({ icon: '🌂', text: `Low-moderate rain chance (${rain}%) in ${city}. Scattered light showers possible in the evening.`, color: '#93c5fd' });
  } else {
    updates.push({ icon: '☀️', text: `Dry conditions expected in ${city} today with only ${rain}% rain probability. Good day for outdoor activities.`, color: '#facc15' });
  }

  // Wind advisory
  if (wind >= 50) {
    updates.push({ icon: '🌬️', text: `STRONG WIND ALERT: ${wind} km/h winds in ${city}. Avoid open areas, secure outdoor furniture and signboards.`, color: '#f97316' });
  } else if (wind >= 30) {
    updates.push({ icon: '💨', text: `Moderate to strong winds (${wind} km/h) reported. Caution for two-wheelers and cyclists in ${city}.`, color: '#fb923c' });
  } else {
    updates.push({ icon: '🍃', text: `Light breeze at ${wind} km/h — pleasant and comfortable conditions in ${city}.`, color: '#4ade80' });
  }

  // Temperature advisory
  if (temp >= 42) {
    updates.push({ icon: '🔥', text: `HEAT ALERT: Extreme heat (${temp}°C) in ${city}. Stay hydrated, avoid outdoor exposure between 11 AM – 4 PM. Heatstroke risk HIGH.`, color: '#ef4444' });
  } else if (temp >= 37) {
    updates.push({ icon: '🌡️', text: `Hot day ahead in ${city} — ${temp}°C expected. Drink plenty of water. Light cotton clothing recommended.`, color: '#f97316' });
  } else if (temp <= 10) {
    updates.push({ icon: '🧥', text: `Cold conditions in ${city}: ${temp}°C. Wear warm layers. Fog possible in early morning hours.`, color: '#93c5fd' });
  } else {
    updates.push({ icon: '🌤️', text: `Comfortable temperature of ${temp}°C in ${city}. Good conditions for outdoor work and travel.`, color: '#86efac' });
  }

  // Humidity
  if (humidity >= 85) {
    updates.push({ icon: '💧', text: `HIGH HUMIDITY (${humidity}%) — feels very muggy in ${city}. Stay hydrated and limit strenuous outdoor activity.`, color: '#38bdf8' });
  } else if (humidity >= 65) {
    updates.push({ icon: '🌫️', text: `Elevated humidity (${humidity}%) may cause discomfort. Expect a "feels hotter" effect outdoors in ${city}.`, color: '#60a5fa' });
  }

  // Visibility
  if (visibility < 1) {
    updates.push({ icon: '🌁', text: `LOW VISIBILITY ALERT: Only ${visibility} km in ${city}. Extreme caution for road travel. Fog lights mandatory.`, color: '#fbbf24' });
  } else if (visibility < 5) {
    updates.push({ icon: '🌫️', text: `Reduced visibility (${visibility} km) in ${city} — drive slowly and maintain safe distances.`, color: '#fcd34d' });
  }

  // IMD alert
  if (imdColor !== 'GREEN') {
    const alertMap = {
      YELLOW: { icon: '🟡', msg: `IMD YELLOW ALERT active for ${city}. Be alert — adverse weather conditions expected. Monitor local updates.`, color: '#eab308' },
      ORANGE: { icon: '🟠', msg: `IMD ORANGE ALERT: Severe weather warning for ${city}. Prepare for heavy rain, strong winds, or thunderstorms.`, color: '#f97316' },
      RED:    { icon: '🔴', msg: `IMD RED ALERT — EXTREME WEATHER WARNING for ${city}. Do NOT venture outdoors unless absolutely necessary.`, color: '#ef4444' },
    };
    const a = alertMap[imdColor];
    if (a) updates.push({ icon: a.icon, text: a.msg, color: a.color });
  }

  // Farmer advisory from IMD if present
  const farmerAdvisory = imdRisk?.farmerAdvisory?.en || imdRisk?.statusText;
  if (farmerAdvisory) {
    updates.push({ icon: '🌾', text: `Farmer Advisory: ${farmerAdvisory}`, color: '#86efac' });
  }

  // Always return at least 2 items
  if (updates.length < 2) {
    updates.push({ icon: '📡', text: `Live weather intelligence active for ${city}. All systems nominal.`, color: '#94a3b8' });
  }

  return updates;
}

/** Live scrolling Early Weather Updates ticker */
function EarlyWeatherUpdates({ weatherData, imdColor, imdRisk }) {
  const updates = generateWeatherUpdates(weatherData, imdColor, imdRisk);
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIdx(prev => (prev + 1) % updates.length);
        setVisible(true);
      }, 350);
    }, 7000);
    return () => clearInterval(intervalRef.current);
  }, [updates.length]);

  const current = updates[activeIdx] || updates[0];
  const alertColor = imdColor === 'RED' ? '#ef4444' : imdColor === 'ORANGE' ? '#f97316' : imdColor === 'YELLOW' ? '#eab308' : '#22c55e';

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: `1px solid rgba(56, 189, 248, 0.2)`,
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: alertColor, boxShadow: `0 0 8px ${alertColor}` }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase' }}>
            Early Weather Updates
          </span>
        </div>
        {imdColor !== 'GREEN' && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
            background: `${alertColor}22`, color: alertColor, border: `1px solid ${alertColor}`,
            letterSpacing: 0.5,
          }}>
            IMD {imdColor}
          </span>
        )}
      </div>

      {/* Scrolling Bulletin */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 8, minHeight: 46 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{current.icon}</span>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: '#e2e8f0',
            margin: 0,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
          }}
        >
          {current.text}
        </p>
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        {updates.map((_, i) => (
          <div
            key={i}
            onClick={() => { setActiveIdx(i); setVisible(true); clearInterval(intervalRef.current); }}
            style={{
              width: i === activeIdx ? 14 : 5,
              height: 4,
              borderRadius: 9999,
              background: i === activeIdx ? '#38bdf8' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function WeatherIntelligencePanel({
  weatherData,
  loading,
  onOpenLocationModal,
}) {
  const [isMuted, setIsMuted] = useState(weatherAudio.getMuted());

  const handleAudioToggle = () => {
    const newMuted = weatherAudio.toggleMute();
    setIsMuted(newMuted);
  };

  if (loading && !weatherData) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="spinner" style={{ width: 28, height: 28, marginBottom: 12 }} />
        <span>Loading live weather intelligence...</span>
      </div>
    );
  }

  const data = weatherData || {
    locationName: 'Satrikh',
    country: 'IN',
    temperature: 30,
    feelsLike: 37,
    condition: 'Clouds',
    weatherMain: 'Clouds',
    humidity: 85,
    windSpeed: 8,
    visibility: 10,
    rainProbability: 45,
    disasterRisk: { imdColorCode: 'GREEN', riskAssessment: 'Low', statusTextHi: 'सामान्य स्थिति' },
  };

  const cityName = data.locationName || 'Satrikh';
  const temp = data.temperature ?? 30;
  const feelsLike = data.feelsLike ?? 37;
  const condition = data.condition || 'Clouds';
  const weatherTitle = data.weatherMain || (condition === 'storm' ? 'Thunderstorm' : condition.toUpperCase());
  const imdRisk = data.disasterRisk;
  const imdColor = imdRisk?.imdColorCode || 'GREEN';
  const riskScore = calculateDynamicRiskScore(data);
  const rainProb = data.rainProbability ?? 45;

  const { Icon: ConditionIcon, color: graphicColor } = getWeatherConditionGraphic(condition);

  return (
    <div
      className="weather-intelligence-panel"
      style={{
        display: 'block',
        padding: '16px 18px 24px',
        color: '#f9fafb',
      }}
    >
      {/* Hero Location & Primary Temperature Card with Animated Graphic */}
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        {/* Floating Animated Weather Graphic Background */}
        <motion.div
          animate={{ y: [0, -8, 0], scale: [1, 1.03, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 10,
            right: 120,
            opacity: 0.22,
            pointerEvents: 'none',
          }}
        >
          <ConditionIcon size={95} style={{ color: graphicColor }} />
        </motion.div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div>
            <button
              onClick={onOpenLocationModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '4px 10px',
                borderRadius: 9999,
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              <MapPin size={14} style={{ color: '#ef4444' }} />
              <span>📍 {cityName}, {data.country || 'IN'}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ConditionIcon size={22} style={{ color: graphicColor }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#f9fafb' }}>
                {weatherTitle}
              </h2>
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
              Feels like <strong style={{ color: '#38bdf8' }}>{feelsLike}°C</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
            <div className="wx-hero-temp">
              {temp}°C
            </div>
            <button
              onClick={handleAudioToggle}
              style={{
                marginTop: 8,
                background: isMuted ? 'rgba(255, 255, 255, 0.08)' : 'rgba(34, 197, 94, 0.15)',
                border: `1px solid ${isMuted ? 'rgba(255, 255, 255, 0.15)' : '#22c55e'}`,
                color: isMuted ? '#9ca3af' : '#4ade80',
                borderRadius: 9999,
                padding: '3px 9px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              <span>{isMuted ? 'Audio Off' : 'Audio On'}</span>
            </button>
          </div>
        </div>

        {/* Optimized Rain Probability Bar */}
        <div style={{ marginTop: 14, background: 'rgba(15, 23, 42, 0.5)', padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <Droplets size={13} style={{ color: '#38bdf8' }} /> Precipitation Probability
            </span>
            <span style={{ fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              {rainProb}%
            </span>
          </div>
          <div style={{ height: 6, background: '#374151', borderRadius: 9999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${rainProb}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #0284c7)',
                borderRadius: 9999,
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Compact Secondary Weather Metrics Grid */}
      <div className="wx-metrics-grid" style={{ marginBottom: 14 }}>
        <div style={{ background: 'rgba(31, 41, 55, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '9px 10px' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Droplets size={12} style={{ color: '#38bdf8' }} /> Humidity
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.humidity ?? 85}%</div>
        </div>

        <div style={{ background: 'rgba(31, 41, 55, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '9px 10px' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Wind size={12} style={{ color: '#38bdf8' }} /> Wind
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.windSpeed ?? 8} km/h</div>
        </div>

        <div style={{ background: 'rgba(31, 41, 55, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '9px 10px' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={12} style={{ color: '#38bdf8' }} /> Visibility
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{data.visibility ?? 10} km</div>
        </div>

        <div style={{ background: 'rgba(31, 41, 55, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '9px 10px' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PressureIcon size={12} style={{ color: '#38bdf8' }} /> Rain
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{rainProb}%</div>
        </div>
      </div>

      {/* Mini Speedometer Gauge & Early Weather Updates — Side by Side */}
      <div className="wx-gauge-grid" style={{ marginBottom: 14 }}>
        <RiskGauge
          score={riskScore}
          label="Risk Assessment"
          level={imdRisk?.riskAssessment || 'Low'}
          imdColor={imdColor}
          compact={true}
        />

        {/* Early Weather Updates Live Ticker */}
        <EarlyWeatherUpdates weatherData={data} imdColor={imdColor} imdRisk={imdRisk} />
      </div>

      {/* 24-Hour Forecast Spline Chart */}
      <div
        style={{
          background: 'rgba(31, 41, 55, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af' }}>
          <Compass size={14} style={{ color: '#38bdf8' }} />
          <span>24-HOUR FORECAST TREND</span>
        </div>
        <HourlyTempSpline
          hourly={data.hourlyForecast || []}
          sunriseTime={data.sunriseFormatted}
          sunsetTime={data.sunsetFormatted}
          currentTemp={temp}
        />
      </div>

      {/* 7-Day Forecast Outlook */}
      <div
        style={{
          background: 'rgba(31, 41, 55, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#9ca3af' }}>
          7-DAY WEATHER OUTLOOK
        </div>
        <DailyForecastCard daily={data.dailyForecast || []} />
      </div>
    </div>
  );
}

