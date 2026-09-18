import { useState } from 'react';
import Navbar from '../components/Navbar';
import WeatherAtmosphericCard from '../components/WeatherAtmosphericCard';
import WeatherMap from '../components/WeatherMap';
import AviationBriefing from '../components/AviationBriefing';
import CropCalendar from '../components/CropCalendar';
import UrbanWeatherIndex from '../components/UrbanWeatherIndex';
import ClimateTrendsChart from '../components/ClimateTrendsChart';
import MultiCityComparison from '../components/MultiCityComparison';
import AgrometExportModal from '../components/AgrometExportModal';
import NWPEnsemblePanel from '../components/NWPEnsemblePanel';
import PWAInstallBanner from '../components/PWAInstallBanner';
import { useWeather } from '../hooks/useWeather';
import { useGeolocation } from '../hooks/useGeolocation';
import { useLanguage } from '../contexts/LanguageContext';
import { Layers, Thermometer, TrendingUp, Grid, Plane, Sprout, Building2, Download, Cpu } from 'lucide-react';
import '../styles/atmospheric.css';

export default function WeatherPage() {
  const { t } = useLanguage();
  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);
  const [overrideCity, setOverrideCity] = useState(null);
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'map' | 'aviation' | 'agri' | 'urban' | 'climate' | 'metros'
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const lat = overrideLat ?? (geoLat || 26.8467);
  const lon = overrideLon ?? (geoLon || 80.9462);

  const { data, loading, error, refetch } = useWeather(lat, lon, overrideCity);

  const handleLocationChange = (newLat, newLon, newCity = null) => {
    setOverrideLat(newLat);
    setOverrideLon(newLon);
    setOverrideCity(newCity);
  };

  const cityName = data?.locationName || overrideCity || 'Lucknow, UP';

  const TABS = [
    { id: 'card', label: t('weather.currentWeather', 'Telemetry'), icon: Thermometer },
    { id: 'nwp', label: t('nwp.title', 'NWP Numerical Forecasting'), icon: Cpu },
    { id: 'map', label: t('radar.title', 'Doppler Radar & GIS'), icon: Layers },
    { id: 'climate', label: t('climate.title', 'Historical Climate Trends'), icon: TrendingUp },
    { id: 'aviation', label: t('aviation.title', 'Aviation Briefing'), icon: Plane },
    { id: 'agri', label: t('agri.title', 'GKMS Agriculture'), icon: Sprout },
    { id: 'urban', label: t('urban.title', 'Urban Heat Index'), icon: Building2 },
    { id: 'metros', label: t('metros.title', 'Pan-India Metros'), icon: Grid },
  ];

  return (
    <div className="app-shell weather-page-shell">
      <Navbar />

      <main className="weather-page-main">
        <div className="weather-page-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 16px 48px' }}>
          
          {/* Subheader View Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '16px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {t('weather.currentWeather')}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {t('weather.activeStation')}: <strong style={{ color: 'var(--color-primary)' }}>{cityName}</strong> ({lat.toFixed(2)}°N, {lon.toFixed(2)}°E)
              </span>
            </div>

            {/* Agromet PDF Download CTA */}
            <button
              onClick={() => setExportModalOpen(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: 'var(--color-success)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={14} />
              <span>{t('agri.downloadPdf', 'Download IMD Agromet Bulletin (PDF)')}</span>
            </button>
          </div>

          {/* View Tab Buttons Bar */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 12,
                    border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    background: isActive ? 'var(--color-primary)' : 'var(--color-bg-card)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab View */}
          {activeTab === 'card' && (
            <WeatherAtmosphericCard
              data={data}
              loading={loading}
              onLocationChange={handleLocationChange}
              isFullScreen={true}
              showFullDetails={true}
            />
          )}

          {activeTab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <WeatherMap
                lat={lat}
                lon={lon}
                weatherData={data}
                disasterRisk={data?.disasterRisk}
                onLocationSelect={(newLat, newLon) => handleLocationChange(newLat, newLon)}
                height="540px"
                showCycloneTrack={true}
              />
            </div>
          )}

          {activeTab === 'aviation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <AviationBriefing />
            </div>
          )}

          {activeTab === 'nwp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <NWPEnsemblePanel
                city={cityName}
                lat={lat}
                lon={lon}
                currentTemp={data?.temperature || 28}
                currentRainProb={data?.rainProbability || 35}
              />
            </div>
          )}

          {activeTab === 'agri' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CropCalendar
                currentTemp={data?.temperature || 28}
                currentRainProb={data?.rainProbability || 30}
              />
            </div>
          )}

          {activeTab === 'urban' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <UrbanWeatherIndex
                currentCity={cityName}
                temp={data?.temperature || 32}
                rainProb={data?.rainProbability || 45}
              />
            </div>
          )}

          {activeTab === 'climate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ClimateTrendsChart city={cityName} />
            </div>
          )}

          {activeTab === 'metros' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <MultiCityComparison
                onSelectCity={(item) => {
                  if (item.lat && item.lon) {
                    handleLocationChange(item.lat, item.lon, item.city);
                    setActiveTab('card');
                  }
                }}
              />
            </div>
          )}

        </div>
      </main>

      {/* Agromet GKMS PDF & WhatsApp Export Modal */}
      <AgrometExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        weatherData={data}
        currentCity={cityName}
      />

      <PWAInstallBanner />
    </div>
  );
}
