import { useState } from 'react';
import Navbar from '../components/Navbar';
import WeatherAtmosphericCard from '../components/WeatherAtmosphericCard';
import { useWeather } from '../hooks/useWeather';
import { useGeolocation } from '../hooks/useGeolocation';
import '../styles/atmospheric.css';

export default function WeatherPage() {
  const { lat: geoLat, lon: geoLon } = useGeolocation();
  const [overrideLat, setOverrideLat] = useState(null);
  const [overrideLon, setOverrideLon] = useState(null);

  const lat = overrideLat ?? (geoLat || 26.8467);
  const lon = overrideLon ?? (geoLon || 80.9462);

  const { data, loading, error, refetch } = useWeather(lat, lon);

  const handleLocationChange = (newLat, newLon) => {
    setOverrideLat(newLat);
    setOverrideLon(newLon);
  };

  return (
    <div className="app-shell weather-page-shell">
      <Navbar />

      <main className="weather-page-main">
        <div className="weather-page-inner">
          <WeatherAtmosphericCard
            data={data}
            loading={loading}
            onLocationChange={handleLocationChange}
            isFullScreen={true}
            showFullDetails={true}
          />
        </div>
      </main>
    </div>
  );
}
