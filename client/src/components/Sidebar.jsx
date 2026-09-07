import { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/sidebar.css';

const DEFAULT_ROLES = [
  {
    roleId: 'citizen',
    name: 'Citizen',
    icon: '👤',
    features: [
      { label: "Today's Weather", query: 'What is the weather like today? Should I carry an umbrella?', icon: '☂️' },
      { label: 'Week Forecast', query: 'What is the 7-day weather forecast?', icon: '📅' },
      { label: 'Storm Alert', query: 'Are there any storm or severe weather alerts for my area?', icon: '⛈️' },
      { label: 'Air Quality', query: 'What is the air quality like today?', icon: '💨' },
    ],
  },
  {
    roleId: 'farmer',
    name: 'Farmer / Crop Advisory',
    icon: '🌾',
    features: [
      { label: 'Crop Advisory', query: 'What crops should I sow this week given the weather?', icon: '🌱' },
      { label: 'Rain Forecast', query: 'Will it rain in the next 3 days? Is irrigation needed?', icon: '🌧️' },
      { label: 'Pest Risk', query: 'What is the pest/disease risk for my crops given current humidity?', icon: '🐛' },
      { label: 'Frost Alert', query: 'Is there a frost risk tonight? How should I protect my crops?', icon: '❄️' },
    ],
  },
  {
    roleId: 'researcher',
    name: 'Researcher',
    icon: '🔬',
    features: [
      { label: 'Climate Trends', query: 'Analyze temperature and rainfall trends for this region.', icon: '📊' },
      { label: 'Anomaly Analysis', query: 'Are current conditions anomalous compared to historical baselines?', icon: '📈' },
      { label: 'Monsoon Analysis', query: 'Analyze the current monsoon pattern and compare to normal.', icon: '🌀' },
      { label: 'ENSO Impact', query: 'How is El Niño/La Niña affecting weather patterns here?', icon: '🌊' },
    ],
  },
  {
    roleId: 'aviation',
    name: 'Aviation',
    icon: '✈️',
    features: [
      { label: 'Pre-Flight Brief', query: 'Give me a pre-flight weather briefing for my route.', icon: '📋' },
      { label: 'Turbulence', query: 'What are the turbulence conditions at cruising altitude?', icon: '〰️' },
      { label: 'Icing Alert', query: 'Are there icing conditions at any altitude on my route?', icon: '🧊' },
      { label: 'Visibility', query: 'What is the current visibility and ceiling at my destination?', icon: '👁️' },
    ],
  },
  {
    roleId: 'marine',
    name: 'Marine',
    icon: '⚓',
    features: [
      { label: 'Sea Conditions', query: 'What are the current sea state and wave height conditions?', icon: '🌊' },
      { label: 'Cyclone Alert', query: 'Are there any active cyclone or tropical storm alerts?', icon: '🌀' },
      { label: 'Fishing Safety', query: 'Is it safe for fishing boats to go out today?', icon: '🎣' },
      { label: 'Port Conditions', query: 'What are the wind and sea conditions at the nearest port?', icon: '🚢' },
    ],
  },
  {
    roleId: 'flood_disaster',
    name: 'Flood & Disaster',
    icon: '🚨',
    features: [
      { label: 'Flood Alerts', query: 'Are there any flood alerts or warnings for this region?', icon: '🔴' },
      { label: 'Kerala Risk', query: 'What is the current flood risk for Kerala? Any alerts?', icon: '⚠️' },
      { label: 'Nepal Floods', query: 'What is the flood situation in Nepal? Any danger zones?', icon: '🏔️' },
      { label: 'Evacuation Guide', query: 'Should residents evacuate? What are the evacuation priorities?', icon: '🏃' },
    ],
  },
  {
    roleId: 'climate_analyst',
    name: 'Climate Analyst',
    icon: '🌍',
    features: [
      { label: 'Climate Trends', query: 'What are the long-term temperature trends for this region?', icon: '📈' },
      { label: 'ENSO Status', query: 'What is the current ENSO status and its impact on the monsoon?', icon: '🌊' },
      { label: 'Extreme Events', query: 'How has the frequency of extreme weather events changed?', icon: '⛈️' },
      { label: 'IOD Impact', query: 'What is the Indian Ocean Dipole status and monsoon impact?', icon: '🌡️' },
    ],
  },
  {
    roleId: 'urban_planner',
    name: 'Urban Planner',
    icon: '🏙️',
    features: [
      { label: 'Urban Heat', query: 'What is the urban heat island intensity for this city today?', icon: '🌡️' },
      { label: 'Flood Risk', query: 'Which urban zones are at highest flood/waterlogging risk?', icon: '🏘️' },
      { label: 'Green Cover', query: 'What green infrastructure interventions would help most?', icon: '🌳' },
      { label: 'Storm Drain', query: 'Is the stormwater drainage system adequate for today\'s rainfall?', icon: '🔧' },
    ],
  },
];

export default function Sidebar({ selectedRole, onRoleChange, onFeatureSelect, isOpen, isExpanded, onToggleExpand }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    api.get('/api/roles')
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setRoles(res.data.data);
        }
      })
      .catch(() => {
        // Keeps DEFAULT_ROLES
      });
  }, []);

  const currentRole = roles.find((r) => r.roleId === selectedRole);
  const features = currentRole?.features || [];

  return (
    <aside
      className={`sidebar${isOpen ? ' open' : ''}${isExpanded ? ' expanded' : ''}`}
      aria-label="Sidebar"
      id="sidebar"
    >
      {/* Role selector */}
      <div className="sidebar-header">
        <div className="sidebar-section-label">{t('selectRole')}</div>
        <div className="role-select-wrapper">
          <select
            className="role-select"
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            aria-label={t('selectRole')}
            id="role-select"
            disabled={loading}
          >
            {loading ? (
              <option>Loading...</option>
            ) : (
              roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.icon} {t(r.roleId, r.name)}
                </option>
              ))
            )}
          </select>
          <span className="role-select-arrow" aria-hidden="true">▼</span>
        </div>
      </div>

      {/* Quick features */}
      <div className="sidebar-features">
        <div className="sidebar-section-label">{t('quickAccess')}</div>
        {features.length > 0 ? (
          <ul className="feature-list stagger" role="list">
            {features.map((feat, idx) => (
              <li key={idx}>
                <button
                  className="feature-chip animate-fadeInUp"
                  onClick={() => onFeatureSelect(feat.query)}
                  title={feat.label}
                  aria-label={`Prefill: ${feat.label}`}
                  id={`feature-chip-${idx}`}
                >
                  <span className="feature-chip-icon" aria-hidden="true">{feat.icon}</span>
                  <span className="feature-chip-label">{feat.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            {loading ? 'Loading features...' : 'Select a role to see quick access features.'}
          </p>
        )}
      </div>

      {/* Tablet expand toggle */}
      <div className="sidebar-footer">
        <button
          className="btn btn-ghost"
          onClick={onToggleExpand}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ width: '100%', fontSize: 'var(--font-size-xs)', minHeight: 44 }}
          id="sidebar-toggle-btn"
        >
          {isExpanded ? '← Collapse' : '→'}
        </button>
      </div>
    </aside>
  );
}
