import { useState } from 'react';
import { Building2, Flame, Droplets, AlertTriangle, ShieldCheck, MapPin, Gauge } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function UrbanWeatherIndex({
  currentCity = 'New Delhi',
  temp = 32,
  rainProb = 45,
}) {
  const { t } = useLanguage();

  // Urban microclimate calculations
  const uhiAnomaly = temp > 35 ? '+3.2°C' : temp > 28 ? '+2.4°C' : '+1.6°C';
  const heatStressCategory =
    temp > 38 ? 'extreme' : temp > 32 ? 'high' : temp > 25 ? 'moderate' : 'low';

  const floodRiskCategory =
    rainProb > 75 ? 'extreme' : rainProb > 50 ? 'high' : rainProb > 25 ? 'moderate' : 'nominal';

  return (
    <div
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 20,
        padding: '22px 24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 9999,
                background: 'rgba(20, 184, 166, 0.15)',
                border: '1px solid rgba(20, 184, 166, 0.35)',
                color: 'var(--color-teal)',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Building2 size={13} /> {t('urban.smartCityIntel', 'SMART CITY INTEL')}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {t('urban.metAnalytics', 'Urban Meteorological Analytics')} &bull; {currentCity}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t('urban.title')}
          </h3>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Urban Heat Island Card */}
        <div
          style={{
            background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.4))',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f97316' }}>
              <Flame size={18} />
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                {t('urban.heatIndex')}
              </strong>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background:
                  heatStressCategory === 'extreme'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : heatStressCategory === 'high'
                    ? 'rgba(249, 115, 22, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                color:
                  heatStressCategory === 'extreme'
                    ? 'var(--color-danger)'
                    : heatStressCategory === 'high'
                    ? '#f97316'
                    : 'var(--color-success)',
              }}
            >
              {t(`urban.heatSeverity.${heatStressCategory}`)}
            </span>
          </div>

          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {uhiAnomaly}{' '}
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t('urban.concreteAnomaly', 'Concrete Urban Anomaly vs Rural Baseline')}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {t('urban.uhiDescription', 'Dense built-up clusters retain nocturnal thermal radiation. Heat mitigation green zones recommended.')}
          </p>
        </div>

        {/* Urban Waterlogging & Drainage Card */}
        <div
          style={{
            background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.4))',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
              <Droplets size={18} />
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                {t('urban.waterloggingRisk')}
              </strong>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background:
                  floodRiskCategory === 'extreme' || floodRiskCategory === 'high'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
                color:
                  floodRiskCategory === 'extreme' || floodRiskCategory === 'high'
                    ? 'var(--color-danger)'
                    : 'var(--color-primary)',
              }}
            >
              {t(`urban.floodSeverity.${floodRiskCategory}`)}
            </span>
          </div>

          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {rainProb}%{' '}
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t('urban.stormwaterIndex', 'Stormwater Runoff Pressure Index')}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {t('urban.vulnerablePockets')}: Underpasses, low-lying storm drain junctions, and transit corridors.
          </p>
        </div>
      </div>
    </div>
  );
}
