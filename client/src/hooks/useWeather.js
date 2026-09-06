import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * useWeather — fetches weather data for given lat/lon.
 * Automatically re-fetches when coordinates change.
 */
export function useWeather(lat, lon) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWeather = useCallback(async (latitude, longitude) => {
    if (!latitude || !longitude) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/weather', { params: { lat: latitude, lon: longitude } });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lat && lon) fetchWeather(lat, lon);
  }, [lat, lon, fetchWeather]);

  return { data, loading, error, refetch: () => fetchWeather(lat, lon) };
}
