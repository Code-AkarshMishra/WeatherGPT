import { useState } from 'react';
import { Sprout, Calendar, AlertCircle, Droplets, Sun, CheckCircle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function CropCalendar({ currentTemp = 28, currentRainProb = 30 }) {
  const { t, lang } = useLanguage();
  const [selectedSeason, setSelectedSeason] = useState('kharif');

  const seasons = [
    {
      id: 'kharif',
      tabLabel: t('agri.seasons.kharif', 'Kharif').split(' ')[0],
      name: t('agri.seasons.kharif', 'Kharif Season (Monsoon)'),
      period: t('agri.periods.kharif', 'June – October'),
      majorCrops: t('agri.cropsList.kharif', 'Paddy (Rice), Maize, Cotton, Soybean, Groundnut, Pulses'),
      criticalWeatherFactors: t('agri.critical.kharif', 'SW Monsoon onset, break-monsoon spells, waterlogging risk'),
      crops: [
        {
          name: t('agri.cropNames.paddy', 'Paddy / Rice (धान)'),
          stage: t('agri.cropStages.paddy', 'Tillering / Vegetative'),
          waterRequirement: t('agri.cropWater.paddy', 'High (5–7 cm standing water)'),
          pestAlert: t('agri.cropPest.paddy', 'Stem borer & blast risk under high humidity (>85%)'),
          advisory: t('agri.cropAdvisory.paddy', 'Ensure drainage during torrential downpours. Maintain water level during tillering phase.'),
          status: 'Optimal',
        },
        {
          name: t('agri.cropNames.cotton', 'Cotton (कपास)'),
          stage: t('agri.cropStages.cotton', 'Square formation / Flowering'),
          waterRequirement: t('agri.cropWater.cotton', 'Moderate (Avoid water stagnation)'),
          pestAlert: t('agri.cropPest.cotton', 'Whitefly & pink bollworm watch in humid spells'),
          advisory: t('agri.cropAdvisory.cotton', 'Provide field drainage channels to prevent root rot after heavy showers.'),
          status: 'Caution',
        },
        {
          name: t('agri.cropNames.soybean', 'Soybean (सोयाबीन)'),
          stage: t('agri.cropStages.soybean', 'Pod development'),
          waterRequirement: t('agri.cropWater.soybean', 'Moderate'),
          pestAlert: t('agri.cropPest.soybean', 'Girdle beetle and semilooper monitoring'),
          advisory: t('agri.cropAdvisory.soybean', 'Foliar spray of 2% DAP or urea if dry spell exceeds 10 days.'),
          status: 'Optimal',
        },
      ],
    },
    {
      id: 'rabi',
      tabLabel: t('agri.seasons.rabi', 'Rabi').split(' ')[0],
      name: t('agri.seasons.rabi', 'Rabi Season (Winter)'),
      period: t('agri.periods.rabi', 'October – March'),
      majorCrops: t('agri.cropsList.rabi', 'Wheat, Mustard, Gram (Chickpea), Barley, Potato'),
      criticalWeatherFactors: t('agri.critical.rabi', 'Western Disturbances, frost/coldwave alerts, terminal heat in March'),
      crops: [
        {
          name: t('agri.cropNames.wheat', 'Wheat (गेहूं)'),
          stage: t('agri.cropStages.wheat', 'Crown root initiation / Grain filling'),
          waterRequirement: t('agri.cropWater.wheat', 'Critical CRI irrigation at 21 days'),
          pestAlert: t('agri.cropPest.wheat', 'Yellow rust watch if cloudy and cool conditions persist'),
          advisory: t('agri.cropAdvisory.wheat', 'Apply light irrigation prior to severe cold wave/frost forecast to prevent freezing injury.'),
          status: 'Optimal',
        },
        {
          name: t('agri.cropNames.mustard', 'Mustard (सरसों)'),
          stage: t('agri.cropStages.mustard', 'Pod formation / Siliqua'),
          waterRequirement: t('agri.cropWater.mustard', 'Low to moderate'),
          pestAlert: t('agri.cropPest.mustard', 'Aphid attack probability rises if temp is 15-20°C with overcast skies'),
          advisory: t('agri.cropAdvisory.mustard', 'Spray Dimethoate 30 EC @ 1ml/litre if aphid count exceeds economic threshold level.'),
          status: 'Warning',
        },
        {
          name: t('agri.cropNames.gram', 'Gram / Chickpea (चना)'),
          stage: t('agri.cropStages.gram', 'Pod filling'),
          waterRequirement: t('agri.cropWater.gram', 'Low (sensitive to excess moisture)'),
          pestAlert: t('agri.cropPest.gram', 'Pod borer (Helicoverpa armigera)'),
          advisory: t('agri.cropAdvisory.gram', 'Install pheromone traps @ 5/ha for pest population monitoring.'),
          status: 'Optimal',
        },
      ],
    },
    {
      id: 'zaid',
      tabLabel: t('agri.seasons.zaid', 'Zaid').split(' ')[0],
      name: t('agri.seasons.zaid', 'Zaid Season (Summer)'),
      period: t('agri.periods.zaid', 'March – June'),
      majorCrops: t('agri.cropsList.zaid', 'Watermelon, Muskmelon, Cucumber, Fodder Maize, Moong Dal'),
      criticalWeatherFactors: t('agri.critical.zaid', 'Heatwaves (Loo), high evapotranspiration rate, dust storms'),
      crops: [
        {
          name: t('agri.cropNames.moong', 'Moong Dal (ग्रीष्म मूंग)'),
          stage: t('agri.cropStages.moong', 'Flowering & pod setting'),
          waterRequirement: t('agri.cropWater.moong', 'Frequent light irrigations'),
          pestAlert: t('agri.cropPest.moong', 'Thrips and yellow mosaic virus (transmitted by whitefly)'),
          advisory: t('agri.cropAdvisory.moong', 'Irrigate during morning or evening hours to minimize evapotranspiration losses.'),
          status: 'Optimal',
        },
        {
          name: t('agri.cropNames.cucurbits', 'Cucurbits / Melons (तरबूज/खरबूजा)'),
          stage: t('agri.cropStages.cucurbits', 'Fruiting & ripening'),
          waterRequirement: t('agri.cropWater.cucurbits', 'Drip irrigation recommended'),
          pestAlert: t('agri.cropPest.cucurbits', 'Fruit fly & powdery mildew under rising heat'),
          advisory: t('agri.cropAdvisory.cucurbits', 'Cover fruits with dry straw to prevent soil rot and sun scald.'),
          status: 'Caution',
        },
      ],
    },
  ];

  const currentSeasonData = seasons.find((s) => s.id === selectedSeason) || seasons[0];

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
          {seasons.map((season) => (
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
              {season.tabLabel}
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
              {currentSeasonData.name} ({currentSeasonData.period})
            </strong>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {t('agri.criticalFactors', 'Critical Factors')}: {currentSeasonData.criticalWeatherFactors}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)' }}>
          {t('agri.majorCrops', 'Major Crops')}: {currentSeasonData.majorCrops}
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
                {crop.status === 'Warning'
                  ? t('common.warning', 'Warning')
                  : crop.status === 'Caution'
                  ? t('common.caution', 'Caution')
                  : t('common.optimal', 'Optimal')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                <Sun size={13} style={{ color: '#f59e0b' }} />
                <span>{t('agri.stage', 'Stage')}: <strong>{crop.stage}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                <Droplets size={13} style={{ color: '#38bdf8' }} />
                <span>{t('agri.water', 'Water')}: {crop.waterRequirement}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--color-text-secondary)' }}>
                <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                <span>{t('agri.pestWatch', 'Pest Watch')}: {crop.pestAlert}</span>
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
              <strong>{t('agri.advisory', 'Advisory')}:</strong> {crop.advisory}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
