import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, BellRing, Volume2, VolumeX, X, PhoneCall, ExternalLink, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getSocket } from '../services/socket';

/**
 * Synthesizes an emergency chime using Web Audio API
 */
function playEmergencyChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.25); // D5
    osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.55);

    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.9);
    osc2.stop(ctx.currentTime + 0.9);
  } catch (err) {
    console.debug('Web Audio not allowed or unavailable:', err);
  }
}

export default function ProactiveAlertNotification({ activeWeatherData = null }) {
  const { t, lang, speechLocale } = useLanguage();
  const [activeAlert, setActiveAlert] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const notifiedIdsRef = useRef(new Set());

  // Function to speak alert via TTS
  const speakAlert = useCallback((text) => {
    if (!window.speechSynthesis || !soundEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocale || (lang === 'hi' ? 'hi-IN' : 'en-IN');
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, [soundEnabled, speechLocale, lang]);

  // Request & send native OS browser notification
  const sendBrowserNotification = useCallback((alertData) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(`WeatherGPT IMD Alert: ${alertData.city}`, {
          body: `${alertData.severity} Warning: ${alertData.message}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
        });
      } catch (err) {
        console.debug('Notification dispatch failed:', err);
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Trigger an alert dispatch
  const dispatchAlert = useCallback((alertObj) => {
    const alertKey = `${alertObj.city}-${alertObj.severity}-${alertObj.type}-${new Date().getHours()}`;
    if (notifiedIdsRef.current.has(alertKey)) return; // Prevent spamming within the same hour
    notifiedIdsRef.current.add(alertKey);

    setActiveAlert(alertObj);

    if (soundEnabled) {
      playEmergencyChime();
    }

    // Multilingual spoken announcement
    const voiceMsg = lang === 'hi'
      ? `सावधान: ${alertObj.city} में मौसम विभाग द्वारा ${alertObj.severity === 'RED' ? 'रेड' : alertObj.severity === 'ORANGE' ? 'ऑरेंज' : 'येलो'} अलर्ट जारी किया गया है। ${alertObj.message}`
      : `Weather alert for ${alertObj.city}: IMD ${alertObj.severity} warning. ${alertObj.message}`;
    
    setTimeout(() => {
      speakAlert(voiceMsg);
    }, 400);

    sendBrowserNotification(alertObj);
  }, [soundEnabled, lang, speakAlert, sendBrowserNotification]);

  // Listen to WebSocket events from server
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleAlertUpdate = (data) => {
      if (!data) return;
      if (data.type === 'ESCALATION' || data.currentColor === 'ORANGE' || data.currentColor === 'RED') {
        dispatchAlert({
          id: `ws-${Date.now()}`,
          city: data.city || 'Regional Center',
          severity: data.currentColor || 'ORANGE',
          title: data.statusText || 'Severe Weather Escalation Alert',
          message: data.riskAssessment || data.statusText || 'IMD severe weather conditions detected.',
          actionAdvice: data.actionPoints?.[0] || 'Stay indoors and monitor official IMD bulletins.',
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    };

    socket.on('alert_update', handleAlertUpdate);
    return () => {
      socket.off('alert_update', handleAlertUpdate);
    };
  }, [dispatchAlert]);

  // Check active weather data when loaded or updated
  useEffect(() => {
    if (!activeWeatherData) return;

    const city = activeWeatherData.city || activeWeatherData.location?.name || 'Local Area';
    const temp = activeWeatherData.current?.temperature ?? activeWeatherData.temperature ?? 25;
    const wind = activeWeatherData.current?.windSpeed ?? activeWeatherData.windSpeed ?? 0;
    const rain = activeWeatherData.current?.rainfallMm ?? activeWeatherData.recentPrecip1h ?? activeWeatherData.rainMm ?? 0;
    const colorCode = activeWeatherData.disasterRisk?.imdColorCode || 'GREEN';

    // Criteria for bad weather alert:
    // 1. IMD Color is RED or ORANGE
    // 2. Heavy Rain >= 40mm
    // 3. High Gale Wind >= 45 km/h
    // 4. Extreme Heat >= 42°C or Severe Cold <= 4°C
    let severeReason = null;
    let severityTier = colorCode !== 'GREEN' ? colorCode : 'YELLOW';

    if (colorCode === 'RED' || rain >= 65 || wind >= 60 || temp >= 45) {
      severityTier = 'RED';
      severeReason = rain >= 65
        ? (lang === 'hi' ? 'अत्यधिक भारी वर्षा (>65mm) का अलर्ट' : 'Extremely Heavy Rainfall (>65mm) Warning')
        : wind >= 60
        ? (lang === 'hi' ? 'विनाशकारी आंधी एवं चक्रवाती हवाएं (>60 km/h)' : 'High Velocity Gale Winds (>60 km/h)')
        : (lang === 'hi' ? 'अत्यधिक भीषण लू (हीटवेव) का प्रकोप' : 'Critical Heatwave Hazard');
    } else if (colorCode === 'ORANGE' || rain >= 35 || wind >= 40 || temp >= 40) {
      severityTier = 'ORANGE';
      severeReason = rain >= 35
        ? (lang === 'hi' ? 'भारी बारिश एवं जलभराव की चेतावनी' : 'Heavy Rainfall & Waterlogging Alert')
        : wind >= 40
        ? (lang === 'hi' ? 'तेज आंधी एवं गरज के साथ छींटे' : 'Severe Squall & Thunderstorm Alert')
        : (lang === 'hi' ? 'भीषण गर्मी / लू का अलर्ट' : 'Severe Heatwave Hazard');
    }

    if (severeReason) {
      dispatchAlert({
        id: `weather-${city}-${severityTier}`,
        city,
        severity: severityTier,
        title: severeReason,
        message: activeWeatherData.disasterRisk?.riskAssessment || severeReason,
        actionAdvice: activeWeatherData.disasterRisk?.actionPoints?.[0] || (lang === 'hi' ? 'सुरक्षित स्थानों पर रहें एवं मौसम विभाग के दिशा-निर्देशों का पालन करें।' : 'Remain indoors and monitor local advisories.'),
        timestamp: new Date().toISOString(),
      });
    }
  }, [activeWeatherData, lang, dispatchAlert]);

  if (!activeAlert) return null;

  const isRed = activeAlert.severity === 'RED';
  const isOrange = activeAlert.severity === 'ORANGE';
  const themeColor = isRed ? '#ef4444' : isOrange ? '#f97316' : '#eab308';
  const bgGlow = isRed ? 'rgba(239, 68, 68, 0.18)' : isOrange ? 'rgba(249, 115, 22, 0.18)' : 'rgba(234, 179, 8, 0.18)';
  const borderCol = isRed ? 'rgba(239, 68, 68, 0.5)' : isOrange ? 'rgba(249, 115, 22, 0.5)' : 'rgba(234, 179, 8, 0.5)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: 'calc(100% - 32px)',
          maxWidth: 720,
          background: 'var(--color-bg-card, #0f172a)',
          backgroundColor: 'var(--color-bg-card)',
          border: `2px solid ${borderCol}`,
          borderRadius: 20,
          padding: '14px 18px',
          boxShadow: `0 12px 36px -6px ${bgGlow}, 0 20px 25px -5px rgba(0, 0, 0, 0.4)`,
          color: 'var(--color-text-primary)',
          backdropFilter: 'blur(16px)',
        }}
        role="alert"
        aria-live="assertive"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          {/* Pulsing Icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: bgGlow,
              border: `1px solid ${borderCol}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: themeColor,
              flexShrink: 0,
            }}
          >
            {isRed ? <ShieldAlert size={24} className="animate-pulse" /> : <AlertTriangle size={24} className="animate-pulse" />}
          </div>

          {/* Alert Body */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: bgGlow,
                  border: `1px solid ${borderCol}`,
                  color: themeColor,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                IMD {activeAlert.severity} ALERT • {activeAlert.city}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                {new Date(activeAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {activeAlert.title}
            </h4>
            <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              {activeAlert.message}
            </p>

            {/* Action Advice Tag */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border)',
                fontSize: '0.76rem',
                color: 'var(--color-text-primary)',
              }}
            >
              <Sparkles size={14} style={{ color: themeColor, flexShrink: 0 }} />
              <span><strong>{lang === 'hi' ? 'सावधानी:' : 'Action Advisory:'}</strong> {activeAlert.actionAdvice}</span>
            </div>
          </div>

          {/* Top Actions: Sound Toggle & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => {
                if (soundEnabled) {
                  window.speechSynthesis?.cancel();
                  setSoundEnabled(false);
                } else {
                  setSoundEnabled(true);
                  playEmergencyChime();
                }
              }}
              title={soundEnabled ? 'Mute Alert Audio' : 'Unmute Alert Audio'}
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: soundEnabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={() => setActiveAlert(null)}
              aria-label="Dismiss Alert"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text-muted)',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Quick Links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
          <a
            href="tel:1078"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--color-danger)',
              textDecoration: 'none',
            }}
          >
            <PhoneCall size={12} />
            <span>NDRF (1078)</span>
          </a>
          <a
            href="/alerts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textDecoration: 'none',
            }}
          >
            <span>{lang === 'hi' ? 'MoES चेतावनी बुलेटिन देखें' : 'View Full MoES Bulletins'}</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
