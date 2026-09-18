import { useState } from 'react';
import { Sprout, Calendar, AlertCircle, Droplets, Sun, CheckCircle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AGROMET_SEASONS = [
  {
    id: 'kharif',
    name: 'Kharif Season (Monsoon)',
    hindiName: 'खरीफ मौसम (मानसून)',
    period: 'June – October',
    majorCrops: ['Paddy (Rice)', 'Maize', 'Cotton', 'Soybean', 'Groundnut', 'Pulses (Arhar)'],
    criticalWeatherFactors: 'SW Monsoon onset, break-monsoon spells, waterlogging risk',
    crops: [
      {
        name: 'Paddy / Rice (धान)',
        stage: 'Tillering / Vegetative',
        waterRequirement: 'High (5–7 cm standing water)',
        pestAlert: 'Stem borer & blast risk under high humidity (>85%)',
        advisory: 'Ensure drainage during torrential downpours. Maintain water level during tillering phase.',
        status: 'Optimal',
      },
      {
        name: 'Cotton (कपास)',
        stage: 'Square formation / Flowering',
        waterRequirement: 'Moderate (Avoid water stagnation)',
        pestAlert: 'Whitefly & pink bollworm watch in humid spells',
        advisory: 'Provide field drainage channels to prevent root rot after heavy showers.',
        status: 'Caution',
      },
      {
        name: 'Soybean (सोयाबीन)',
        stage: 'Pod development',
        waterRequirement: 'Moderate',
        pestAlert: 'Girdle beetle and semilooper monitoring',
        advisory: 'Foliar spray of 2% DAP or urea if dry spell exceeds 10 days.',
        status: 'Optimal',
      },
    ],
  },
  {
    id: 'rabi',
    name: 'Rabi Season (Winter)',
    hindiName: 'रबी मौसम (सर्दियां)',
    period: 'October – March',
    majorCrops: ['Wheat', 'Mustard', 'Gram (Chickpea)', 'Barley', 'Potato'],
    criticalWeatherFactors: 'Western Disturbances, frost/coldwave alerts, terminal heat in March',
    crops: [
      {
        name: 'Wheat (गेहूं)',
        stage: 'Crown root initiation / Grain filling',
        waterRequirement: 'Critical CRI irrigation at 21 days',
        pestAlert: 'Yellow rust watch if cloudy and cool conditions persist',
        advisory: 'Apply light irrigation prior to severe cold wave/frost forecast to prevent freezing injury.',
        status: 'Optimal',
      },
      {
        name: 'Mustard (सरसों)',
        stage: 'Pod formation / Siliqua',
        waterRequirement: 'Low to moderate',
        pestAlert: 'Aphid attack probability rises if temp is 15-20°C with overcast skies',
        advisory: 'Spray Dimethoate 30 EC @ 1ml/litre if aphid count exceeds economic threshold level.',
        status: 'Warning',
      },
      {
        name: 'Gram / Chickpea (चना)',
        stage: 'Pod filling',
        waterRequirement: 'Low (sensitive to excess moisture)',
        pestAlert: 'Pod borer (Helicoverpa armigera)',
        advisory: 'Install pheromone traps @ 5/ha for pest population monitoring.',
        status: 'Optimal',
      },
    ],
  },
  {
    id: 'zaid',
    name: 'Zaid Season (Summer)',
    hindiName: 'जायद मौसम (गर्मी)',
    period: 'March – June',
    majorCrops: ['Watermelon', 'Muskmelon', 'Cucumber', 'Fodder Maize', 'Moong Dal'],
    criticalWeatherFactors: 'Heatwaves (Loo), high evapotranspiration rate, dust storms',
    crops: [
      {
        name: 'Moong Dal (ग्रीष्म मूंग)',
        stage: 'Flowering & pod setting',
        waterRequirement: 'Frequent light irrigations',
        pestAlert: 'Thrips and yellow mosaic virus (transmitted by whitefly)',
        advisory: 'Irrigate during morning or evening hours to minimize evapotranspiration losses.',
        status: 'Optimal',
      },
      {
        name: 'Cucurbits / Melons (तरबूज/खरबूजा)',
        stage: 'Fruiting & ripening',
        waterRequirement: 'Drip irrigation recommended',
        pestAlert: 'Fruit fly & powdery mildew under rising heat',
        advisory: 'Cover fruits with dry straw to prevent soil rot and sun scald.',
        status: 'Caution',
      },
    ],
  },
];

export default function CropCalendar({ currentTemp = 28, currentRainProb = 30 }) {
  const { t, lang } = useLanguage();
  const [selectedSeason, setSelectedSeason] = useState('kharif');

  const currentSeasonData = AGROMET_SEASONS.find((s) => s.id === selectedSeason) || AGROMET_SEASONS[0];

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
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: 'var(--color-success)',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Sprout size={13} /> {t('personas.kisan.title', 'GKMS AGROMET ADVISORY')}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {t('personas.kisan.name', 'Gramin Krishi Mausam Sewa & IMD Division')}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {t('nav.agriculture', 'Seasonal Agricultural Weather Calendar & Crop Protocols')}
          </h3>
        </div>

        {/* Season Selector */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--color-bg-alt, rgba(15, 23, 42, 0.6))',
            padding: 4,
            borderRadius: 12,
            border: '1px solid var(--color-border)',
          }}
        >
          {AGROMET_SEASONS.map((season) => (
            <button
              key={season.id}
              onClick={() => setSelectedSeason(season.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: selectedSeason === season.id ? 'var(--color-success)' : 'transparent',
                color: selectedSeason === season.id ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {lang === 'hi' ? season.hindiName.split(' ')[0] : season.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Season Overview Banner */}
      <div
        style={{
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={18} style={{ color: 'var(--color-success)' }} />
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              {lang === 'hi' ? currentSeasonData.hindiName : currentSeasonData.name} ({currentSeasonData.period})
            </strong>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Critical Factors: {currentSeasonData.criticalWeatherFactors}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)' }}>
          Major Crops: {currentSeasonData.majorCrops.slice(0, 3).join(', ')}...
        </div>
      </div>

      {/* Crop Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {currentSeasonData.crops.map((crop, idx) => (
          <div
            key={idx}
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
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>{crop.name}</strong>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background:
                    crop.status === 'Warning'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : crop.status === 'Caution'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(34, 197, 94, 0.15)',
                  color:
                    crop.status === 'Warning'
                      ? 'var(--color-danger)'
                      : crop.status === 'Caution'
                      ? '#eab308'
                      : 'var(--color-success)',
                }}
              >
                {crop.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                <Sun size={13} style={{ color: '#f59e0b' }} />
                <span>Stage: <strong>{crop.stage}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                <Droplets size={13} style={{ color: '#38bdf8' }} />
                <span>Water: {crop.waterRequirement}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--color-text-secondary)' }}>
                <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <span>Pest Watch: {crop.pestAlert}</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 4,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--color-border)',
                fontSize: '0.74rem',
                color: 'var(--color-text-primary)',
                lineHeight: 1.4,
              }}
            >
              <strong>Advisory:</strong> {crop.advisory}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
