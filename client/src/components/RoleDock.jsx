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
import { useLanguage } from '../contexts/LanguageContext';
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
  const { t } = useLanguage();
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
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        transition: 'background 200ms ease, border-color 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
        <span>{t('selectRole')}:</span>
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
            background: 'var(--color-bg-alt, #1f2937)',
            border: '1px solid var(--color-border)',
            borderRadius: 9999,
            padding: '6px 14px',
            color: 'var(--color-text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease',
          }}
        >
          <ActiveIcon size={14} style={{ color: 'var(--color-primary)' }} />
          <span>{t(activeRoleData.roleId, activeRoleData.name)}</span>
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
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                zIndex: 100,
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('selectRole')}
              </div>

              {roles.map((role) => {
                const isSelected = role.roleId === selectedRole;
                const Icon = ROLE_ICON_MAP[role.roleId] || User;
                const localizedName = t(role.roleId, role.name);
                const localizedDesc = t(role.roleId + 'Desc', role.description);

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
                      background: isSelected ? 'var(--color-primary-glow, rgba(56, 189, 248, 0.12))' : 'transparent',
                      border: 'none',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--color-border-light)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 8,
                        background: isSelected ? 'var(--color-primary)' : 'var(--color-border-light)',
                        color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Icon size={14} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{localizedName}</span>
                        {isSelected && <Check size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.3, marginTop: 2 }}>
                        {localizedDesc}
                      </p>
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
