import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { Bot, User, Copy, Check, Volume2, VolumeX, ShieldAlert, Cpu, Sprout, Anchor } from 'lucide-react';
import RiskGauge from './RiskGauge';
import { calculateDynamicRiskScore } from './WeatherIntelligencePanel';
import '../styles/chat.css';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, showDebug }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Hindi + English Voice Accessibility (TTS)
  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = message.content.replace(/[*#_`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Auto-detect Hindi characters or Hinglish context
    const hasHindi = /[\u0900-\u097F]/.test(cleanText) || message.nlp?.language === 'hi' || message.nlp?.language === 'hinglish';
    const voices = window.speechSynthesis.getVoices();
    
    if (hasHindi) {
      utterance.lang = 'hi-IN';
      const hiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hiVoice) utterance.voice = hiVoice;
    } else {
      utterance.lang = 'en-IN';
      const enVoice = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('en-US'));
      if (enVoice) utterance.voice = enVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => {
    return () => {
      if (isSpeaking && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const imdRisk = message.weather?.disasterRisk || message.disaster_risk;
  const imdColor = imdRisk?.imdColorCode || imdRisk?.imd_color_code || null;
  const riskScore = calculateDynamicRiskScore(message.weather || {});

  // Determine if Speedometer / Risk Gauge should be rendered for this message
  const msgText = (message.content || '').toLowerCase();
  const intent = message.nlp?.intent || '';
  const isRiskIntent =
    intent.includes('disaster') ||
    intent.includes('flood') ||
    intent.includes('warning') ||
    intent.includes('alert') ||
    ['RED', 'ORANGE'].includes(imdColor) ||
    msgText.includes('risk') ||
    msgText.includes('hazard') ||
    msgText.includes('gauge') ||
    msgText.includes('warning') ||
    msgText.includes('danger') ||
    msgText.includes('speedometer') ||
    msgText.includes('alert');

  return (
    <motion.div
      className={`bubble-row bubble-row--${isUser ? 'user' : 'ai'}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
    >
      {/* Avatar */}
      <div className={`bubble-avatar bubble-avatar--${isUser ? 'user' : 'ai'}`} aria-hidden="true">
        {isUser ? <User size={16} /> : <Bot size={17} />}
      </div>

      <div className="bubble-content-wrapper">
        {/* Clean Message bubble */}
        <div
          className={`bubble bubble--${isUser ? 'user' : 'ai'}`}
          role="article"
          aria-label={`${isUser ? 'Your message' : 'AI response'}`}
        >
          {isUser ? (
            message.content.split('\n').map((line, i) => (
              line ? <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0 }}>{line}</p> : <br key={i} />
            ))
          ) : (
            <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>


        {/* Meta row */}
        <div className="bubble-meta">
          <span className="bubble-time">{formatTime(message.timestamp)}</span>

          {!isUser && (
            <>
              {/* Voice Read Aloud Button (TTS) */}
              <button
                className={`bubble-action-btn ${isSpeaking ? 'active-speaking' : ''}`}
                onClick={handleSpeak}
                title={isSpeaking ? 'बोलना बंद करें / Stop Voice' : 'आवाज़ में सुनें / Listen in Hindi'}
                aria-label="Listen to response"
                style={{ color: isSpeaking ? '#22c55e' : undefined }}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                <span>{isSpeaking ? 'रोकें' : 'सुनें'}</span>
              </button>

              {/* Copy Button */}
              <button
                className="bubble-action-btn"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
                aria-label="Copy response"
              >
                {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Provider Tag */}
              {message.provider && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: 9999,
                    background: message.provider.includes('python') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    border: message.provider.includes('python') ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
                    color: message.provider.includes('python') ? '#4ade80' : '#38bdf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`Processed via ${message.provider}`}
                >
                  <Cpu size={10} />
                  {message.provider === 'render-ml1-toolcalling' ? 'ML-1 Tool Calling' : 'Grounded Agent'}
                </span>
              )}
            </>
          )}
        </div>

        {/* NLP debug tags — dev mode only */}
        {showDebug && !isUser && message.nlp && (
          <div className="bubble-debug" aria-label="NLP analysis">
            {message.nlp.intent && (
              <span className="debug-tag" title="Detected intent">
                intent: {message.nlp.intent}
              </span>
            )}
            {message.nlp.location && (
              <span className="debug-tag" title="Detected location">
                loc: {message.nlp.location}
              </span>
            )}
            {message.nlp.timeEntity && (
              <span className="debug-tag" title="Time entity">
                time: {message.nlp.timeEntity}
              </span>
            )}
            {message.nlp.language && (
              <span className="debug-tag" title="Detected language">
                lang: {message.nlp.language}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
