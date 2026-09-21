import { useState } from 'react';
import { Plane, Compass, Wind, Eye, Cloud, Gauge, ArrowUpRight, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AIRPORT_PRESETS = [
  {
    code: 'VIDP',
    name: 'Indira Gandhi Int Airport',
    city: 'New Delhi',
    rwy: '28',
    rwyHeading: 280,
    rawMetar: 'VIDP 180430Z 29012KT 4000 HZ NSC 28/16 Q1013 NOSIG',
    rawTaf: 'TAF VIDP 180300Z 1806/1912 30010KT 5000 HZ NSC BECMG 1814/1816 28006KT 3000 HZ',
    temp: 28,
    dewpoint: 16,
    windDir: 290,
    windSpeedKt: 12,
    visibilityM: 4000,
    qnh: 1013,
    flightCategory: 'VFR',
    ceiling: 'No Significant Clouds (NSC)',
  },
  {
    code: 'VABB',
    name: 'Chhatrapati Shivaji Maharaj Int Airport',
    city: 'Mumbai',
    rwy: '27',
    rwyHeading: 270,
    rawMetar: 'VABB 180430Z 26014KT 6000 FEW025 31/24 Q1011 NOSIG',
    rawTaf: 'TAF VABB 180300Z 1806/1912 26012KT 6000 SCT025 TEMPO 1809/1813 4000 -SHRA',
    temp: 31,
    dewpoint: 24,
    windDir: 260,
    windSpeedKt: 14,
    visibilityM: 6000,
    qnh: 1011,
    flightCategory: 'VFR',
    ceiling: '2,500 ft AGL (Few)',
  },
  {
    code: 'VOBL',
    name: 'Kempegowda Int Airport',
    city: 'Bengaluru',
    rwy: '09',
    rwyHeading: 90,
    rawMetar: 'VOBL 180430Z 08010KT 8000 SCT030 26/18 Q1016 NOSIG',
    rawTaf: 'TAF VOBL 180300Z 1806/1912 09008KT 8000 SCT030 BECMG 1818/1820 00000KT 6000 HZ',
    temp: 26,
    dewpoint: 18,
    windDir: 80,
    windSpeedKt: 10,
    visibilityM: 8000,
    qnh: 1016,
    flightCategory: 'VFR',
    ceiling: '3,000 ft AGL (Scattered)',
  },
  {
    code: 'VECC',
    name: 'Netaji Subhash Chandra Bose Int Airport',
    city: 'Kolkata',
    rwy: '19',
    rwyHeading: 190,
    rawMetar: 'VECC 180430Z 16016G25KT 3000 TSRA BKN018CB 29/25 Q1008 TEMPO 1500 TSRA',
    rawTaf: 'TAF VECC 180300Z 1806/1912 17015KT 4000 TSRA SCT018CB BKN080 TEMPO 1808/1812 2000 TS',
    temp: 29,
    dewpoint: 25,
    windDir: 160,
    windSpeedKt: 16,
    visibilityM: 3000,
    qnh: 1008,
    flightCategory: 'MVFR',
    ceiling: '1,800 ft AGL (Cumulonimbus)',
  },
];

export default function AviationBriefing() {
  const { t } = useLanguage();
  const [selectedAirportCode, setSelectedAirportCode] = useState('VIDP');
  const [runwayHeadingInput, setRunwayHeadingInput] = useState(280);

  const airport = AIRPORT_PRESETS.find((a) => a.code === selectedAirportCode) || AIRPORT_PRESETS[0];

  // Runway Crosswind Vector Calculations
  const windAngleDiff = Math.abs(airport.windDir - runwayHeadingInput);
  const angleRad = (windAngleDiff * Math.PI) / 180;
  const crosswindComponent = Math.round(airport.windSpeedKt * Math.sin(angleRad));
  const headwindComponent = Math.round(airport.windSpeedKt * Math.cos(angleRad));

  const isCrosswindHigh = crosswindComponent > 15;

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
        gap: 18,
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
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: 'var(--color-warning)',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Plane size={13} /> {t('aviation.icaoBadge', 'ICAO & IMD AVIATION INTEL')}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {t('aviation.amsSubtitle', 'Aviation Meteorological Services (AMS)')}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t('aviation.title')}
          </h3>
        </div>

        {/* Airport Switcher Chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {AIRPORT_PRESETS.map((ap) => (
            <button
              key={ap.code}
              onClick={() => {
                setSelectedAirportCode(ap.code);
                setRunwayHeadingInput(ap.rwyHeading);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: selectedAirportCode === ap.code ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                background: selectedAirportCode === ap.code ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-alt, rgba(15, 23, 42, 0.6))',
                color: selectedAirportCode === ap.code ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {ap.code} ({ap.city})
            </button>
          ))}
        </div>
      </div>

      {/* METAR / Station Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {/* Flight Rules Badge */}
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.5))', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('aviation.flightRules')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                background: airport.flightCategory === 'VFR' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: airport.flightCategory === 'VFR' ? 'var(--color-success)' : 'var(--color-warning)',
                fontWeight: 800,
                fontSize: '0.88rem',
              }}
            >
              {airport.flightCategory}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              {airport.flightCategory === 'VFR' ? t('aviation.vfr') : t('aviation.mvfr')}
            </span>
          </div>
        </div>

        {/* Surface Wind */}
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.5))', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('weather.wind')}
          </span>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>
            {airport.windDir}° @ {airport.windSpeedKt} KT
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {t('aviation.magneticHeading', 'Magnetic Heading')}
          </span>
        </div>

        {/* Visibility */}
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.5))', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('weather.visibility')}
          </span>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>
            {airport.visibilityM} {t('common.meters', 'meters')}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {t('aviation.rvrNominal', 'Runway Visual Range Nominal')}
          </span>
        </div>

        {/* Cloud Ceiling */}
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.5))', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {t('aviation.ceiling')}
          </span>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
            {airport.ceiling}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            QNH: {airport.qnh} hPa
          </span>
        </div>
      </div>

      {/* Raw METAR & TAF Code Blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            {t('aviation.rawMetar')}
          </div>
          <code style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--color-primary)', wordBreak: 'break-all' }}>
            {airport.rawMetar}
          </code>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            {t('aviation.rawTaf')}
          </div>
          <code style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--color-warning)', wordBreak: 'break-all' }}>
            {airport.rawTaf}
          </code>
        </div>
      </div>

      {/* Interactive Runway Crosswind Calculator */}
      <div
        style={{
          background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.6))',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={18} style={{ color: 'var(--color-warning)' }} />
            <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
              {t('aviation.runwayCalculator')} ({t('aviation.runway', 'Runway')} {airport.rwy})
            </strong>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
            {t('aviation.vectorFormula', 'Vector Decomposition Formula: Vc = V × sin(Δθ)')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Runway Heading Input */}
          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              {t('aviation.runwayHeading')}
            </label>
            <input
              type="number"
              min="0"
              max="360"
              value={runwayHeadingInput}
              onChange={(e) => setRunwayHeadingInput(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: '0.86rem',
              }}
            />
          </div>

          {/* Headwind / Tailwind */}
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {headwindComponent >= 0 ? t('aviation.headwind') : t('aviation.tailwind')}
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>
              {Math.abs(headwindComponent)} KT
            </div>
          </div>

          {/* Crosswind Component */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: isCrosswindHigh ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
              border: isCrosswindHigh ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: isCrosswindHigh ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {t('aviation.crosswind')}
            </span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isCrosswindHigh ? 'var(--color-danger)' : 'var(--color-warning)', marginTop: 2 }}>
              {crosswindComponent} KT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
