import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * useWeather — fetches weather data for given lat/lon.
 * Automatically re-fetches when coordinates change with:
 * - Cache-first instant rendering (sessionStorage)
 * - Transparent 2-stage auto-retry before error display
 * - Zero UI-breaking flashes
 */
export function useWeather(lat, lon) {
  const [data, setData] = useState(() => {
    if (!lat || !lon) return null;
    try {
      const key = `wgpt_weather_${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
      const cached = sessionStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const retryCount = useRef(0);

  const fetchWeather = useCallback(async (latitude, longitude, isRetry = false) => {
    if (!latitude || !longitude) return;
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }
    
    try {
      const res = await api.get('/api/weather', { params: { lat: latitude, lon: longitude }, timeout: 8000 });
      if (res.data?.data) {
        setData(res.data.data);
        setError(null);
        retryCount.current = 0;
        try {
          const key = `wgpt_weather_${Number(latitude).toFixed(2)}_${Number(longitude).toFixed(2)}`;
          sessionStorage.setItem(key, JSON.stringify(res.data.data));
        } catch {}
      }
    } catch (err) {
      // Auto-retry once silently after 1.5s if first attempt failed
      if (retryCount.current < 2) {
        retryCount.current += 1;
        setTimeout(() => {
          fetchWeather(latitude, longitude, true);
        }, 1500);
      } else {
        setError(err.response?.data?.error || 'Weather station unreachable. Retrying...');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lat && lon) {
      retryCount.current = 0;
      fetchWeather(lat, lon);
    }
  }, [lat, lon, fetchWeather]);

  return { data, loading, error, refetch: () => { retryCount.current = 0; fetchWeather(lat, lon); } };
}
