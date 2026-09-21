import api from './api';
import axios from 'axios';

const POPULAR_INDIAN_CITIES = {
  lucknow: { lat: 26.8467, lon: 80.9462, name: 'Lucknow', state: 'Uttar Pradesh', country: 'IN' },
  dewa: { lat: 27.0362, lon: 81.1669, name: 'Dewa', state: 'Uttar Pradesh', country: 'IN' },
  barabanki: { lat: 26.9268, lon: 81.1834, name: 'Barabanki', state: 'Uttar Pradesh', country: 'IN' },
  delhi: { lat: 28.6139, lon: 77.2090, name: 'New Delhi', state: 'Delhi', country: 'IN' },
  'new delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi', state: 'Delhi', country: 'IN' },
  mumbai: { lat: 19.0760, lon: 72.8777, name: 'Mumbai', state: 'Maharashtra', country: 'IN' },
  bengaluru: { lat: 12.9716, lon: 77.5946, name: 'Bengaluru', state: 'Karnataka', country: 'IN' },
  bangalore: { lat: 12.9716, lon: 77.5946, name: 'Bengaluru', state: 'Karnataka', country: 'IN' },
  kolkata: { lat: 22.5726, lon: 88.3639, name: 'Kolkata', state: 'West Bengal', country: 'IN' },
  chennai: { lat: 13.0827, lon: 80.2707, name: 'Chennai', state: 'Tamil Nadu', country: 'IN' },
  kanpur: { lat: 26.4499, lon: 80.3319, name: 'Kanpur', state: 'Uttar Pradesh', country: 'IN' },
  varanasi: { lat: 25.3176, lon: 82.9739, name: 'Varanasi', state: 'Uttar Pradesh', country: 'IN' },
  banaras: { lat: 25.3176, lon: 82.9739, name: 'Varanasi', state: 'Uttar Pradesh', country: 'IN' },
  kashi: { lat: 25.3176, lon: 82.9739, name: 'Varanasi', state: 'Uttar Pradesh', country: 'IN' },
  ayodhya: { lat: 26.7991, lon: 82.2047, name: 'Ayodhya', state: 'Uttar Pradesh', country: 'IN' },
  prayagraj: { lat: 25.4358, lon: 81.8463, name: 'Prayagraj', state: 'Uttar Pradesh', country: 'IN' },
  allahabad: { lat: 25.4358, lon: 81.8463, name: 'Prayagraj', state: 'Uttar Pradesh', country: 'IN' },
  agra: { lat: 27.1767, lon: 78.0081, name: 'Agra', state: 'Uttar Pradesh', country: 'IN' },
  jaipur: { lat: 26.9124, lon: 75.7873, name: 'Jaipur', state: 'Rajasthan', country: 'IN' },
  patna: { lat: 25.5941, lon: 85.1376, name: 'Patna', state: 'Bihar', country: 'IN' },
  guwahati: { lat: 26.1445, lon: 91.7362, name: 'Guwahati', state: 'Assam', country: 'IN' },
  hyderabad: { lat: 17.3850, lon: 78.4867, name: 'Hyderabad', state: 'Telangana', country: 'IN' },
  pune: { lat: 18.5204, lon: 73.8567, name: 'Pune', state: 'Maharashtra', country: 'IN' },
  ahmedabad: { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad', state: 'Gujarat', country: 'IN' },
  noida: { lat: 28.5355, lon: 77.3910, name: 'Noida', state: 'Uttar Pradesh', country: 'IN' },
  gurugram: { lat: 28.4595, lon: 77.0266, name: 'Gurugram', state: 'Haryana', country: 'IN' },
  gurgaon: { lat: 28.4595, lon: 77.0266, name: 'Gurugram', state: 'Haryana', country: 'IN' },
};

/**
 * Robust, resilient geocoding service with multi-level fallback:
 * 1. Local instant dictionary
 * 2. Backend /api/weather/geocode endpoint (via Axios instance)
 * 3. Direct client Open-Meteo Geocoding API
 * 4. Direct client Nominatim API
 */
export async function geocodeCity(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim();
  if (!clean) return null;

  const lower = clean.toLowerCase();
  if (POPULAR_INDIAN_CITIES[lower]) {
    return POPULAR_INDIAN_CITIES[lower];
  }

  // 1. Try backend geocode
  try {
    const res = await api.get('/api/weather/geocode', { params: { city: clean }, timeout: 6000 });
    if (res.data?.data) {
      return res.data.data;
    }
  } catch (err) {
    console.warn('Backend geocode failed, attempting browser fallback...', err?.message);
  }

  // 2. Direct browser Open-Meteo fallback
  try {
    const omRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: clean, count: 5, language: 'en', format: 'json' },
      timeout: 5000,
    });
    if (omRes.data?.results && omRes.data.results.length > 0) {
      const results = omRes.data.results;
      const indianMatch = results.find((r) => r.country_code === 'IN' || r.country === 'India');
      const chosen = indianMatch || results[0];
      return {
        lat: chosen.latitude,
        lon: chosen.longitude,
        name: chosen.name,
        country: chosen.country_code || chosen.country || 'IN',
        state: chosen.admin1 || '',
      };
    }
  } catch (e) {
    console.warn('Client Open-Meteo geocode fallback failed:', e?.message);
  }

  // 3. Direct browser Nominatim fallback
  try {
    const nomRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: clean, format: 'json', limit: 1 },
      timeout: 4000,
    });
    if (nomRes.data && nomRes.data.length > 0) {
      const chosen = nomRes.data[0];
      return {
        lat: parseFloat(chosen.lat),
        lon: parseFloat(chosen.lon),
        name: chosen.display_name.split(',')[0],
        country: 'IN',
        state: '',
      };
    }
  } catch (e) {
    console.warn('Client Nominatim fallback failed:', e?.message);
  }

  return null;
}
