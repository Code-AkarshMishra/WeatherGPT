import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '../contexts/LanguageContext';
import { Play, Pause, ChevronLeft, ChevronRight, Wind, Layers, Activity, AlertTriangle, Eye, Compass } from 'lucide-react';

// Fix default marker icons (Leaflet + bundler issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const IMD_COLORS = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

// Historic & Real-time Cyclone Track profile (Bay of Bengal / Indian Ocean)
const SAMPLE_CYCLONE_TRACK = [
  { lat: 14.2, lon: 86.5, stage: 'Deep Depression', windKmph: 55, date: '16 Oct 05:30 IST' },
  { lat: 16.0, lon: 87.2, stage: 'Cyclonic Storm', windKmph: 75, date: '16 Oct 17:30 IST' },
  { lat: 18.1, lon: 88.0, stage: 'Severe Cyclonic Storm', windKmph: 105, date: '17 Oct 05:30 IST' },
  { lat: 20.4, lon: 88.8, stage: 'Very Severe Cyclonic Storm', windKmph: 130, date: '17 Oct 17:30 IST' },
  { lat: 22.3, lon: 89.4, stage: 'Landfall / Coastal Crossing', windKmph: 110, date: '18 Oct 02:30 IST' },
  { lat: 24.1, lon: 90.1, stage: 'Depression / Dissipation', windKmph: 45, date: '18 Oct 14:30 IST' },
];

function MapUpdater({ lat, lon, fitCyclone = false, recenterTrigger = 0 }) {
  const map = useMap();
  useEffect(() => {
    if (fitCyclone) {
      const bounds = L.latLngBounds(SAMPLE_CYCLONE_TRACK.map((p) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (lat && lon) {
      map.setView([lat, lon], 7, { animate: true });
    }
  }, [lat, lon, fitCyclone, recenterTrigger, map]);
  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function WeatherMap({
  lat = 26.8467,
  lon = 80.9462,
  weatherData = null,
  disasterRisk = null,
  onLocationSelect = null,
  height = '460px',
  showOverlay = true,
  zoom = 7,
  showCycloneTrack = false,
}) {
  const { t } = useLanguage();
  const [activeLayer, setActiveLayer] = useState('precipitation_new'); // 'precipitation_new' | 'clouds_new' | 'temp_new' | 'wind_new'
  const [enableCycloneLayer, setEnableCycloneLayer] = useState(false);
  const [fitCycloneView, setFitCycloneView] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  // RainViewer Real-time Doppler Radar Timestamps
  const [radarFrames, setRadarFrames] = useState([]);
  const [radarHost, setRadarHost] = useState('https://tilecache.rainviewer.com');
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch real RainViewer radar timestamps
  useEffect(() => {
    let isMounted = true;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.radar?.past && data.radar.past.length > 0) {
          const frames = [...data.radar.past];
          if (data.radar.nowcast && data.radar.nowcast.length > 0) {
            frames.push(...data.radar.nowcast);
          }
          setRadarFrames(frames);
          setRadarHost(data.host || 'https://tilecache.rainviewer.com');
          setCurrentFrameIdx(data.radar.past.length - 1); // latest live frame
        }
      })
      .catch(() => {
        // Fallback default frame
        setRadarFrames([{ time: Math.floor(Date.now() / 1000) - 600, path: '/v2/radar/now' }]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Radar Animation Player Loop
  useEffect(() => {
    let interval = null;
    if (isPlaying && radarFrames.length > 0) {
      interval = setInterval(() => {
        setCurrentFrameIdx((prev) => (prev + 1) % radarFrames.length);
      }, 900);
    }
    return () => clearInterval(interval);
  }, [isPlaying, radarFrames.length]);

  const alertColor = disasterRisk?.imdColorCode
    ? (IMD_COLORS[disasterRisk.imdColorCode] || IMD_COLORS.GREEN)
    : IMD_COLORS.GREEN;

  const alertRadius = disasterRisk?.imdColorCode === 'RED' ? 45000
    : disasterRisk?.imdColorCode === 'ORANGE' ? 28000
    : disasterRisk?.imdColorCode === 'YELLOW' ? 16000
    : 10000;

  const locationName = weatherData?.locationName || t('common.active');
  const temp = weatherData?.temperature;
  const humidity = weatherData?.humidity;
  const condition = weatherData?.description || weatherData?.condition || '';
  const windSpeed = weatherData?.windSpeed;
  const rainProb = weatherData?.rainProbability;

  const OVERLAY_LAYERS = [
    { id: 'precipitation_new', label: t('radar.layers.precipitation', 'Rain Radar'), icon: '🌧️' },
    { id: 'clouds_new', label: t('radar.layers.clouds', 'Cloud Cover'), icon: '☁️' },
    { id: 'temp_new', label: t('radar.layers.temperature', 'Temperature Gradient'), icon: '🌡️' },
    { id: 'wind_new', label: t('radar.layers.wind', 'Wind Stream Vector'), icon: '💨' },
  ];

  const currentRadarPath = radarFrames[currentFrameIdx]?.path;
  const currentRadarTime = radarFrames[currentFrameIdx]?.time
    ? new Date(radarFrames[currentFrameIdx].time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST'
    : 'LIVE';

  const cyclonePolyline = SAMPLE_CYCLONE_TRACK.map((pt) => [pt.lat, pt.lon]);

  const handleToggleCyclone = () => {
    const nextState = !enableCycloneLayer;
    setEnableCycloneLayer(nextState);
    if (nextState) {
      setFitCycloneView(true);
      setTimeout(() => setFitCycloneView(false), 800);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-md)',
        background: '#0b1329',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          padding: '6px 8px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {OVERLAY_LAYERS.map((layer) => {
          const isActive = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 9,
                border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                color: isActive ? '#ffffff' : '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{layer.icon}</span>
              <span>{layer.label}</span>
            </button>
          );
        })}

        {/* Recenter Button */}
        <button
          onClick={() => {
            setFitCycloneView(false);
            setRecenterCount((prev) => prev + 1);
          }}
          title={t('radar.recenter', 'Recenter to Station')}
          style={{
            padding: '6px 12px',
            borderRadius: 9,
            border: '1px solid rgba(56, 189, 248, 0.4)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'rgba(14, 165, 233, 0.15)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          <Compass size={13} />
          <span>{t('radar.recenter', '📍 Recenter')}</span>
        </button>

        {/* Cyclone Toggle Button */}
        <button
          onClick={handleToggleCyclone}
          style={{
            padding: '6px 12px',
            borderRadius: 9,
            border: enableCycloneLayer ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: enableCycloneLayer ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'rgba(255,255,255,0.06)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: enableCycloneLayer ? '0 0 12px rgba(239, 68, 68, 0.5)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Wind size={13} className={enableCycloneLayer ? 'spin-slow' : ''} />
          <span>{t('radar.cycloneToggle', 'Cyclone Track Overlay')}</span>
        </button>
      </div>

      {/* Top Left IMD Alert Badge & Active Layer HUD */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: '80%',
        }}
      >
        {disasterRisk && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(16px)',
              padding: '7px 14px',
              borderRadius: 12,
              border: `1px solid ${alertColor}60`,
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: alertColor,
                boxShadow: `0 0 10px ${alertColor}`,
              }}
            />
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: alertColor }}>
                IMD {disasterRisk.imdColorCode} ALERT &bull; {locationName}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                {disasterRisk.riskAssessment || 'Active Atmospheric Monitoring'}
              </div>
            </div>
          </div>
        )}

        {/* Active Layer Indicator */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.68rem',
            color: '#94a3b8',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            width: 'fit-content',
          }}
        >
          <Layers size={12} style={{ color: '#38bdf8' }} />
          <span>Active Layer: <strong style={{ color: '#f8fafc' }}>{OVERLAY_LAYERS.find((l) => l.id === activeLayer)?.label}</strong></span>
          {enableCycloneLayer && <span style={{ color: '#f87171' }}>&bull; Cyclone Tracking ON</span>}
        </div>
      </div>

      {/* Bottom Doppler Radar Player & Time Slider */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(16px)',
          padding: '8px 14px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? t('radar.pauseAnimation', 'Pause') : t('radar.playAnimation', 'Play')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              border: 'none',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? t('radar.pauseAnimation', 'Pause') : t('radar.playAnimation', 'Play Doppler Loop')}</span>
          </button>

          <button
            onClick={() => setCurrentFrameIdx((prev) => (prev > 0 ? prev - 1 : (radarFrames.length ? radarFrames.length - 1 : 0)))}
            aria-label="Previous Frame"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            onClick={() => setCurrentFrameIdx((prev) => (radarFrames.length ? (prev + 1) % radarFrames.length : 0))}
            aria-label="Next Frame"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
            {currentRadarTime}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            ({radarFrames.length > 0 ? `Frame ${currentFrameIdx + 1}/${radarFrames.length}` : 'Real-time'})
          </span>
        </div>

        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)' }}>
          MoES Doppler &bull; Open-Meteo Synoptic Grid
        </div>
      </div>

      <MapContainer
        center={[lat, lon]}
        zoom={zoom}
        style={{ height, width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        {/* Base Map TileLayer (Clean, Free OpenStreetMap - No API key or watermarks) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &bull; MoES / IMD'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Real-time Precipitation Radar Tiles (RainViewer) */}
        {showOverlay && activeLayer === 'precipitation_new' && currentRadarPath && (
          <TileLayer
            key={`rain-${currentRadarPath}`}
            url={`${radarHost}${currentRadarPath}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.7}
            zIndex={20}
          />
        )}

        {/* Cloud Cover Layer */}
        {showOverlay && activeLayer === 'clouds_new' && (
          <TileLayer
            key="clouds-layer"
            url="https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=b1bb0f42f1a0aa440b17a79d7e2b8e78"
            opacity={0.6}
            zIndex={20}
          />
        )}

        {/* Temperature Gradient Layer */}
        {showOverlay && activeLayer === 'temp_new' && (
          <TileLayer
            key="temp-layer"
            url="https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=b1bb0f42f1a0aa440b17a79d7e2b8e78"
            opacity={0.55}
            zIndex={20}
          />
        )}

        {/* Wind Stream Layer */}
        {showOverlay && activeLayer === 'wind_new' && (
          <TileLayer
            key="wind-layer"
            url="https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=b1bb0f42f1a0aa440b17a79d7e2b8e78"
            opacity={0.6}
            zIndex={20}
          />
        )}

        {/* Current Active Station Marker */}
        <Marker position={[lat, lon]}>
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, padding: 4 }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{locationName}</div>
              {temp !== undefined && (
                <div style={{ margin: '6px 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{temp}°C</span>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>{condition}</span>
                </div>
              )}
              {humidity !== undefined && (
                <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                  💧 {t('weather.humidity')}: {humidity}% &bull; 💨 {t('weather.wind')}: {windSpeed} km/h
                </div>
              )}
              {rainProb !== undefined && (
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 2 }}>
                  🌧️ {t('weather.rainProbability')}: {rainProb}%
                </div>
              )}
              {disasterRisk && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: `${alertColor}20`,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: alertColor,
                    border: `1px solid ${alertColor}50`,
                  }}
                >
                  IMD {disasterRisk.imdColorCode} &bull; {disasterRisk.riskAssessment}
                </div>
              )}
            </div>
          </Popup>
        </Marker>

        {/* Disaster Alert Zone Circle */}
        {disasterRisk && disasterRisk.imdColorCode !== 'GREEN' && (
          <Circle
            center={[lat, lon]}
            radius={alertRadius}
            pathOptions={{
              color: alertColor,
              fillColor: alertColor,
              fillOpacity: 0.12,
              weight: 2.5,
              dashArray: '6 4',
            }}
          />
        )}

        {/* IMD Cyclone Track Overlay */}
        {enableCycloneLayer && (
          <>
            <Polyline
              positions={cyclonePolyline}
              pathOptions={{
                color: '#ef4444',
                weight: 4,
                dashArray: '6 6',
                opacity: 0.9,
              }}
            />
            {SAMPLE_CYCLONE_TRACK.map((pt, idx) => (
              <Circle
                key={idx}
                center={[pt.lat, pt.lon]}
                radius={35000 + idx * 8000}
                pathOptions={{
                  color: idx === 3 ? '#b91c1c' : '#ef4444',
                  fillColor: idx === 3 ? '#ef4444' : '#f87171',
                  fillOpacity: 0.25,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.88rem' }}>
                      🌀 IMD Cyclone Track Node #{idx + 1}
                    </div>
                    <div style={{ margin: '4px 0' }}>Classification: <strong>{pt.stage}</strong></div>
                    <div>Max Sustained Wind: <strong style={{ color: '#ef4444' }}>{pt.windKmph} km/h</strong></div>
                    <div style={{ color: '#64748b', fontSize: '0.74rem', marginTop: 4 }}>Date & Time: {pt.date}</div>
                  </div>
                </Popup>
              </Circle>
            ))}
          </>
        )}

        <MapUpdater lat={lat} lon={lon} fitCyclone={fitCycloneView} recenterTrigger={recenterCount} />
        {onLocationSelect && <MapClickHandler onLocationSelect={onLocationSelect} />}
      </MapContainer>
    </div>
  );
}
