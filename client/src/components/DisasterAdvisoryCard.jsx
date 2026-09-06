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

export default function DisasterAdvisoryCard({ disasterRisk, currentCity, onSimulate }) {
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
      border: 'rgba(34, 197, 94, 0.4)',
      text: '#4ade80',
      badgeBg: '#22c55e',
      label: 'GREEN (All Clear)',
    },
    YELLOW: {
      bg: 'rgba(234, 179, 8, 0.14)',
      border: 'rgba(234, 179, 8, 0.45)',
      text: '#facc15',
      badgeBg: '#eab308',
      label: 'YELLOW (Watch & Update)',
    },
    ORANGE: {
      bg: 'rgba(249, 115, 22, 0.15)',
      border: 'rgba(249, 115, 22, 0.5)',
      text: '#fb923c',
      badgeBg: '#f97316',
      label: 'ORANGE (Alert & Prepare)',
    },
    RED: {
      bg: 'rgba(239, 68, 68, 0.2)',
      border: 'rgba(239, 68, 68, 0.6)',
      text: '#f87171',
      badgeBg: '#ef4444',
      label: 'RED (Warning & Action)',
    },
  }[imdColor] || {
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.4)',
    text: '#4ade80',
    badgeBg: '#22c55e',
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
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(16px)',
        color: '#ffffff',
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
              color: '#000000',
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
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            MoES Severe-Weather Risk: <strong style={{ color: colorStyles.text }}>{activeRisk?.riskAssessment || 'Low'}</strong>
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
              background: isSpeaking ? '#22c55e' : 'rgba(255,255,255,0.12)',
              color: isSpeaking ? '#000000' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 9999,
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Listen to official warning in Hindi"
          >
            <Volume2 size={14} />
            <span>{isSpeaking ? 'रोकें (Stop)' : 'चेतावनी सुनें (Audio)'}</span>
          </button>

          {/* Simulator Toggle */}
          <button
            onClick={() => setIsSimulatorOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isSimulatorOpen ? '#6366f1' : 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 9999,
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Simulate ML-2 Severe Weather Scenarios"
          >
            <Sliders size={13} />
            <span>MoES Simulator</span>
          </button>
        </div>
      </div>

      {/* Role-Based Tabs (Farmer, Marine, Action Checklist) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('farmer')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'farmer' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
            color: activeTab === 'farmer' ? '#4ade80' : 'rgba(255,255,255,0.65)',
            border: activeTab === 'farmer' ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Sprout size={15} />
          <span>किसान सलाह (Farmer Advisory)</span>
        </button>

        <button
          onClick={() => setActiveTab('marine')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'marine' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            color: activeTab === 'marine' ? '#38bdf8' : 'rgba(255,255,255,0.65)',
            border: activeTab === 'marine' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Anchor size={15} />
          <span>मछुआरा / तटीय (Marine Advisory)</span>
        </button>

        <button
          onClick={() => setActiveTab('action')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: activeTab === 'action' ? 'rgba(251, 191, 36, 0.2)' : 'transparent',
            color: activeTab === 'action' ? '#fbbf24' : 'rgba(255,255,255,0.65)',
            border: activeTab === 'action' ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid transparent',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <AlertTriangle size={15} />
          <span>सुरक्षा निर्देश (Action Points)</span>
        </button>
      </div>

      {/* Tab Content Display */}
      <div style={{ fontSize: '0.88rem', lineHeight: '1.55', color: 'rgba(255,255,255,0.92)' }}>
        {activeTab === 'farmer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.92rem' }}>
              🇮🇳 <strong>{activeRisk?.farmerAdvisory?.hi}</strong>
            </p>
            <p style={{ margin: 0, opacity: 0.78, fontSize: '0.82rem' }}>
              🌐 <em>{activeRisk?.farmerAdvisory?.en}</em>
            </p>
          </div>
        )}

        {activeTab === 'marine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.92rem' }}>
              🌊 <strong>{activeRisk?.marineAdvisory?.hi}</strong>
            </p>
            <p style={{ margin: 0, opacity: 0.78, fontSize: '0.82rem' }}>
              🌐 <em>{activeRisk?.marineAdvisory?.en}</em>
            </p>
          </div>
        )}

        {activeTab === 'action' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeRisk?.actionPoints?.map((pt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} style={{ color: colorStyles.text, flexShrink: 0 }} />
                <span>{pt}</span>
              </div>
            )) || <span>Standard safety protocol in effect.</span>}
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
