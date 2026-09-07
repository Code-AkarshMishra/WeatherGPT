import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  Sprout,
  Anchor,
  Volume2,
  Sliders,
  CheckCircle,
  X,
  Wind,
  CloudRain,
  Thermometer,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function DisasterAdvisoryCard({ disasterRisk, currentCity, onSimulate }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('farmer'); // 'farmer' | 'marine' | 'action'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Simulation inputs
  const [simRain, setSimRain] = useState(disasterRisk?.rainMm || 0);
  const [simWind, setSimWind] = useState(disasterRisk?.windKmph || 15);
  const [simTemp, setSimTemp] = useState(disasterRisk?.tempC || 26);
  const [simulatedData, setSimulatedData] = useState(null);

  const activeRisk = simulatedData || disasterRisk;
  const imdColor = activeRisk?.imdColorCode || 'GREEN';

  const colorStyles = {
    GREEN: {
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.35)',
      text: '#16a34a',
      badgeBg: '#16a34a',
      badgeColor: '#ffffff',
      label: 'GREEN (All Clear)',
    },
    YELLOW: {
      bg: 'rgba(234, 179, 8, 0.14)',
      border: 'rgba(234, 179, 8, 0.4)',
      text: '#d97706',
      badgeBg: '#eab308',
      badgeColor: '#000000',
      label: 'YELLOW (Watch & Update)',
    },
    ORANGE: {
      bg: 'rgba(249, 115, 22, 0.15)',
      border: 'rgba(249, 115, 22, 0.45)',
      text: '#ea580c',
      badgeBg: '#f97316',
      badgeColor: '#ffffff',
      label: 'ORANGE (Alert & Prepare)',
    },
    RED: {
      bg: 'rgba(239, 68, 68, 0.16)',
      border: 'rgba(239, 68, 68, 0.5)',
      text: '#dc2626',
      badgeBg: '#ef4444',
      badgeColor: '#ffffff',
      label: 'RED (Warning & Action)',
    },
  }[imdColor] || {
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.35)',
    text: '#16a34a',
    badgeBg: '#16a34a',
    badgeColor: '#ffffff',
    label: 'GREEN',
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = activeRisk?.spokenTextHi || `IMD ${imdColor} Alert. ${activeRisk?.farmerAdvisory?.hi}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'hi-IN';

    const voices = window.speechSynthesis.getVoices();
    const hiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('IN'));
    if (hiVoice) utterance.voice = hiVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const runSimulation = async (r, w, t) => {
    try {
      const res = await fetch(`/api/weather/disaster-risk?rain_mm=${r}&wind_kmph=${w}&temp_c=${t}&city=${encodeURIComponent(currentCity || 'Area')}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSimulatedData(json.data);
          if (onSimulate) onSimulate(json.data);
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  return (
    <div
      style={{
        background: colorStyles.bg,
        border: `1.5px solid ${colorStyles.border}`,
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)',
        backdropFilter: 'blur(16px)',
        color: 'var(--color-text-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              background: colorStyles.badgeBg,
              color: colorStyles.badgeColor,
              fontWeight: 800,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.04em',
            }}
          >
            <ShieldAlert size={15} />
            IMD {colorStyles.label}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {t('riskAssessment', 'MoES Severe-Weather Risk')}: <strong style={{ color: colorStyles.text }}>{activeRisk?.riskAssessment || 'Low'}</strong>
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* TTS Audio button */}
          <button
            onClick={handleSpeak}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isSpeaking ? 'var(--color-success)' : 'var(--color-bg-card)',
              color: isSpeaking ? '#ffffff' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 9999,
              padding: '6px 14px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
            }}
            title={isSpeaking ? t('stopSpeaking') : t('playAudioAlert')}
          >
            <Volume2 size={14} style={{ color: isSpeaking ? '#ffffff' : 'var(--color-primary)' }} />
            <span>{isSpeaking ? t('stopSpeaking') : t('playAudioAlert')}</span>
          </button>

          {/* Simulator Toggle */}
          <button
            onClick={() => setIsSimulatorOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isSimulatorOpen ? 'var(--color-primary)' : 'var(--color-bg-card)',
              color: isSimulatorOpen ? '#ffffff' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 9999,
              padding: '6px 14px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
            title="Simulate ML-2 Severe Weather Scenarios"
          >
            <Sliders size={13} style={{ color: isSimulatorOpen ? '#ffffff' : 'var(--color-primary)' }} />
            <span>MoES Simulator</span>
          </button>
        </div>
      </div>

      {/* Role-Based Tabs (Farmer, Marine, Action Checklist) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('farmer')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'farmer' ? 'rgba(22, 163, 74, 0.15)' : 'transparent',
            color: activeTab === 'farmer' ? '#16a34a' : 'var(--color-text-secondary)',
            border: activeTab === 'farmer' ? '1px solid rgba(22, 163, 74, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Sprout size={15} />
          <span>{t('farmerAdvisoryTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('marine')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'marine' ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
            color: activeTab === 'marine' ? '#0284c7' : 'var(--color-text-secondary)',
            border: activeTab === 'marine' ? '1px solid rgba(2, 132, 199, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Anchor size={15} />
          <span>{t('marineAdvisoryTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('action')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'action' ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
            color: activeTab === 'action' ? '#d97706' : 'var(--color-text-secondary)',
            border: activeTab === 'action' ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <AlertTriangle size={15} />
          <span>{t('actionPointsTitle')}</span>
        </button>
      </div>

      {/* Tab Content Display */}
      <div style={{ fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--color-text-primary)' }}>
        {activeTab === 'farmer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
              🇮🇳 <strong>{activeRisk?.farmerAdvisory?.hi}</strong>
            </p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              🌐 <em>{activeRisk?.farmerAdvisory?.en}</em>
            </p>
          </div>
        )}

        {activeTab === 'marine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
              🌊 <strong>{activeRisk?.marineAdvisory?.hi}</strong>
            </p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              🌐 <em>{activeRisk?.marineAdvisory?.en}</em>
            </p>
          </div>
        )}

        {activeTab === 'action' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeRisk?.actionPoints?.map((pt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-primary)' }}>
                <CheckCircle size={14} style={{ color: colorStyles.text, flexShrink: 0 }} />
                <span>{pt}</span>
              </div>
            )) || <span style={{ color: 'var(--color-text-secondary)' }}>Standard safety protocol in effect.</span>}
          </div>
        )}
      </div>

      {/* Interactive MoES ML-2 Simulator Panel */}
      <AnimatePresence>
        {isSimulatorOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '14px 16px',
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sliders size={14} />
                MoES Disaster Random Forest Model Simulator (Test Different Weather Scenarios)
              </span>
              <button
                onClick={() => {
                  setSimulatedData(null);
                  setIsSimulatorOpen(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              {/* Rain Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CloudRain size={12} /> Rainfall</span>
                  <strong style={{ color: '#38bdf8' }}>{simRain} mm</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="5"
                  value={simRain}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimRain(val);
                    runSimulation(val, simWind, simTemp);
                  }}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#38bdf8' }}
                />
              </div>

              {/* Wind Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Wind size={12} /> Wind Speed</span>
                  <strong style={{ color: '#facc15' }}>{simWind} km/h</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={simWind}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimWind(val);
                    runSimulation(simRain, val, simTemp);
                  }}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#facc15' }}
                />
              </div>

              {/* Temperature Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Thermometer size={12} /> Temperature</span>
                  <strong style={{ color: '#f87171' }}>{simTemp} °C</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="48"
                  step="1"
                  value={simTemp}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimTemp(val);
                    runSimulation(simRain, simWind, val);
                  }}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#f87171' }}
                />
              </div>
            </div>

            {simulatedData && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, fontSize: '0.75rem' }}>
                <span style={{ color: colorStyles.text, fontWeight: 700 }}>
                  Active Scenario: {simulatedData.imdColorCode} Alert ({simulatedData.riskAssessment} Risk)
                </span>
                <button
                  onClick={() => setSimulatedData(null)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#ffffff',
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Live Data
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
