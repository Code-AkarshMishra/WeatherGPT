import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Navigation, X, Building2 } from 'lucide-react';

const POPULAR_CITIES = [
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
  { name: 'Delhi', state: 'National Capital Territory', lat: 28.6139, lon: 77.2090 },
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lon: 80.3319 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lon: 82.9739 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
];

export default function LocationSelectorModal({ isOpen, onClose, onSelectLocation, currentLocationName = 'Lucknow' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/weather/geocode?city=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSearchResults([{
            name: json.data.name,
            state: json.data.country || 'India',
            lat: json.data.lat,
            lon: json.data.lon,
          }]);
        }
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
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            color: '#f8fafc',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={22} style={{ color: '#ef4444' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Select Location</h3>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Current: {currentLocationName}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                autoFocus
                placeholder="Search city (e.g. Lucknow, Delhi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              style={{
                padding: '0 16px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {/* Use GPS Location Button */}
          <button
            onClick={handleUseGPS}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 10,
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <Navigation size={16} />
            <span>Use My Current GPS Location</span>
          </button>

          {/* Search Results if any */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Search Result
              </span>
              <div style={{ marginTop: 8 }}>
                {searchResults.map((city, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(city.lat, city.lon, city.name)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 10,
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{city.name}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{city.state}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Cities Grid */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Popular Indian Cities
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
              {POPULAR_CITIES.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleSelect(city.lat, city.lon, city.name)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: currentLocationName === city.name ? 'rgba(59, 130, 246, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                    border: `1px solid ${currentLocationName === city.name ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>📍 {city.name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{city.state}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
