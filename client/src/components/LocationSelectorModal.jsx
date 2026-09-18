import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Navigation, X, Building2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

const POPULAR_CITIES = [
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
  { name: 'Delhi', state: 'National Capital Territory', lat: 28.6139, lon: 77.2090 },
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
];

export default function LocationSelectorModal({ isOpen, onClose, onSelectLocation, currentLocationName = 'Lucknow' }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    const city = searchQuery.trim();
    if (!city) return;
    setSearching(true);
    try {
      const res = await api.get('/api/weather/geocode', {
        params: { city },
      });
      if (res.data?.data) {
        const d = res.data.data;
        setSearchResults([{
          name: d.name || city,
          state: d.country || 'India',
          lat: d.lat,
          lon: d.lon,
        }]);
      }
    } catch {
      // Keep static results
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (lat, lon, name) => {
    onSelectLocation(lat, lon, name);
    onClose();
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSelectLocation(pos.coords.latitude, pos.coords.longitude, 'Current Location');
          onClose();
        },
        () => {}
      );
    }
  };

  return (
    <AnimatePresence>
      <div
        className="modal-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-bg-card, #131d31)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--color-text-primary)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <MapPin size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {t('locationSelector.title')}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {t('locationSelector.current')}: <strong style={{ color: 'var(--color-primary)' }}>{currentLocationName}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                autoFocus
                placeholder={t('locationSelector.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  color: 'var(--color-text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              style={{
                padding: '0 18px',
                background: 'var(--color-primary)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.86rem',
              }}
            >
              {searching ? '...' : t('locationSelector.searchBtn')}
            </button>
          </form>

          {/* Use GPS Location Button */}
          <button
            onClick={handleUseGPS}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--color-primary-glow)',
              border: '1px solid var(--color-primary)',
              borderRadius: 12,
              color: 'var(--color-primary)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Navigation size={16} />
            <span>{t('locationSelector.useGPS')}</span>
          </button>

          {/* Search Results if any */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('common.inspect')}
              </span>
              <div style={{ marginTop: 6 }}>
                {searchResults.map((city, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(city.lat, city.lon, city.name)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      background: 'var(--color-success-bg, rgba(34, 197, 94, 0.15))',
                      border: '1px solid var(--color-success, #22c55e)',
                      borderRadius: 10,
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{city.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{city.state}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Cities Grid */}
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('locationSelector.popularCities')}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
              {POPULAR_CITIES.map((city) => {
                const isSelected = currentLocationName.toLowerCase().includes(city.name.toLowerCase()) || city.name.toLowerCase().includes(currentLocationName.toLowerCase());
                return (
                  <button
                    key={city.name}
                    onClick={() => handleSelect(city.lat, city.lon, city.name)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: isSelected ? 'var(--color-primary-glow)' : 'var(--color-bg-card)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 10,
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-xs)',
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>📍 {city.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{city.state}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
