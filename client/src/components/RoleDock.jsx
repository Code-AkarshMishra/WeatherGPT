import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Sprout,
  Microscope,
  Plane,
  Anchor,
  ShieldAlert,
  Globe,
  Building2,
  Sparkles,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import '../styles/roledock.css';

const ROLE_ICON_MAP = {
  citizen: User,
  farmer: Sprout,
  researcher: Microscope,
  aviation: Plane,
  marine: Anchor,
  flood_disaster: ShieldAlert,
  climate_analyst: Globe,
  urban_planner: Building2,
};

const DEFAULT_ROLES_DATA = [
  {
    roleId: 'citizen',
    name: 'Citizen',
    description: 'Everyday forecasts, rain alerts, and simple outdoor tips.',
    features: [
      { label: "Today's Weather", query: 'What is the weather like today? Should I carry an umbrella?', icon: '☂️' },
      { label: 'Week Forecast', query: 'What is the 7-day weather forecast?', icon: '📅' },
      { label: 'Storm Alert', query: 'Are there any storm or severe weather alerts for my area?', icon: '⛈️' },
      { label: 'Air Quality', query: 'What is the air quality like today?', icon: '💨' },
    ],
  },
  {
    roleId: 'farmer',
    name: 'Farmer',
    description: 'Crop advisory, sowing windows, irrigation, and pest hazard alerts.',
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
    description: 'Meteorological anomaly tracking, climate baselines, and monsoon trends.',
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
    description: 'Cruising turbulence, flight hazard briefings, icing, and runway ceiling.',
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
    description: 'Wave state, coastal winds, cyclone tracks, and fishing safety.',
    features: [
      { label: 'Sea Conditions', query: 'What are the current sea state and wave height conditions?', icon: '🌊' },
      { label: 'Cyclone Alert', query: 'Are there any active cyclone or tropical storm alerts?', icon: '🌀' },
      { label: 'Fishing Safety', query: 'Is it safe for fishing boats to go out today?', icon: '🎣' },
      { label: 'Port Conditions', query: 'What are the wind and sea conditions at the nearest port?', icon: '🚢' },
    ],
  },
  {
    roleId: 'flood_disaster',
    name: 'Disaster / Flood',
    description: 'Flood risk mapping, evacuation triggers, and river level surge warnings.',
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
    description: 'Long-term decadal trends, ENSO phase shifts, and heatwave analysis.',
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
    description: 'Urban heat islands, stormwater drainage capacity, and green infrastructure.',
    features: [
      { label: 'Urban Heat', query: 'What is the urban heat island intensity for this city today?', icon: '🌡️' },
      { label: 'Flood Risk', query: 'Which urban zones are at highest flood/waterlogging risk?', icon: '🏘️' },
      { label: 'Green Cover', query: 'What green infrastructure interventions would help most?', icon: '🌳' },
      { label: 'Storm Drain', query: 'Is the stormwater drainage system adequate for today\'s rainfall?', icon: '🔧' },
    ],
  },
];

export default function RoleDock({ selectedRole, onRoleChange, onFeatureSelect }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES_DATA);
  const [hoveredRoleId, setHoveredRoleId] = useState(null);

  useEffect(() => {
    api.get('/api/roles')
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setRoles(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const activeRoleData = roles.find((r) => r.roleId === selectedRole) || roles[0];
  const activeFeatures = activeRoleData?.features || [];

  return (
    <div className="role-dock-container">
      {/* Dock Header */}
      {/* Sleek Professional Role Bar */}
      <div className="role-dock-header">
        <div className="role-dock-title">
          <Sparkles className="role-dock-sparkle" size={13} />
          <span>Operational Role</span>
        </div>
        <span className="role-dock-hint">
          Click to switch specialized intelligence context
        </span>
      </div>

      {/* Role Items Horizontal Dock */}
      <div className="role-dock-scroll">
        {roles.map((role) => {
          const isActive = role.roleId === selectedRole;
          const isHovered = hoveredRoleId === role.roleId;
          const IconComp = ROLE_ICON_MAP[role.roleId] || User;

          return (
            <div
              key={role.roleId}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredRoleId(role.roleId)}
              onMouseLeave={() => setHoveredRoleId(null)}
            >
              <motion.button
                className={`role-dock-item${isActive ? ' active' : ''}`}
                onClick={() => onRoleChange(role.roleId)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.div
                    className="role-dock-active-bg"
                    layoutId="roleDockActivePill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="role-dock-item-content">
                  <span className="role-dock-icon">
                    <IconComp size={14} />
                  </span>
                  <span>{role.name}</span>
                </div>
              </motion.button>

              {/* Floating Tooltip on Hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    className="role-floating-tooltip"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    <div className="role-floating-arrow" />
                    <div className="role-floating-header">
                      <div className="role-floating-title">
                        <IconComp size={15} style={{ color: 'var(--color-primary)' }} />
                        <span>{role.name}</span>
                      </div>
                      <span className="role-floating-badge">
                        {isActive ? 'Active Context' : 'Click to Select'}
                      </span>
                    </div>

                    <p className="role-floating-desc">{role.description}</p>

                    {role.features && role.features.length > 0 && (
                      <div>
                        <div className="role-floating-features-title">Suggested Inquiries</div>
                        <div className="role-floating-chips">
                          {role.features.map((feat, idx) => (
                            <button
                              key={idx}
                              className="role-floating-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isActive) onRoleChange(role.roleId);
                                onFeatureSelect(feat.query);
                              }}
                            >
                              <span>{feat.icon} {feat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
