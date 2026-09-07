import { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Check,
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
  },
  {
    roleId: 'farmer',
    name: 'Farmer / Crop Advisory',
    description: 'Crop advisory, sowing windows, irrigation, and pest hazard alerts.',
  },
  {
    roleId: 'researcher',
    name: 'Researcher',
    description: 'Meteorological anomaly tracking, climate baselines, and monsoon trends.',
  },
  {
    roleId: 'aviation',
    name: 'Aviation',
    description: 'Cruising turbulence, flight hazard briefings, icing, and runway ceiling.',
  },
  {
    roleId: 'marine',
    name: 'Marine',
    description: 'Wave state, coastal winds, cyclone tracks, and fishing safety.',
  },
  {
    roleId: 'flood_disaster',
    name: 'Flood & Disaster',
    description: 'Flood risk mapping, evacuation triggers, and river level surge warnings.',
  },
  {
    roleId: 'climate_analyst',
    name: 'Climate Analyst',
    description: 'Long-term decadal trends, ENSO phase shifts, and heatwave analysis.',
  },
  {
    roleId: 'urban_planner',
    name: 'Urban Planner',
    description: 'Urban heat islands, stormwater drainage capacity, and green infrastructure.',
  },
];

export default function RoleDock({ selectedRole, onRoleChange }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES_DATA);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    api.get('/api/roles')
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setRoles(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeRoleData = roles.find((r) => r.roleId === selectedRole) || roles[0];
  const ActiveIcon = ROLE_ICON_MAP[activeRoleData.roleId] || User;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        zIndex: 50,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(11, 15, 23, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>
        <Sparkles size={13} style={{ color: '#38bdf8' }} />
        <span>Operational Intelligence Context:</span>
      </div>

      {/* Dropdown Trigger Button */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(31, 41, 55, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 9999,
            padding: '6px 14px',
            color: '#f8fafc',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          <ActiveIcon size={14} style={{ color: '#38bdf8' }} />
          <span>{activeRoleData.name}</span>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', opacity: 0.7 }} />
        </button>

        {/* Dropdown Menu Popup */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 310,
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 14,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                padding: '6px',
                zIndex: 100,
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Select Meteorological Context
              </div>

              {roles.map((role) => {
                const isSelected = role.roleId === selectedRole;
                const Icon = ROLE_ICON_MAP[role.roleId] || User;

                return (
                  <button
                    key={role.roleId}
                    type="button"
                    onClick={() => {
                      onRoleChange(role.roleId);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                      border: 'none',
                      color: isSelected ? '#38bdf8' : '#e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <Icon size={14} style={{ color: isSelected ? '#38bdf8' : '#9ca3af' }} />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{role.name}</span>
                        {isSelected && <Check size={14} style={{ color: '#38bdf8' }} />}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.3 }}>{role.description}</span>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

