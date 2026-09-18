import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Loader2, Sparkles, AlertCircle, Send } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Strips markdown, emojis, parenthetical English duplicates, and converts units
 * into smooth, slow, and crystal clear conversational speech.
 */
function sanitizeForSpeech(rawText) {
  if (!rawText) return '';
  let text = String(rawText)
    // Remove markdown code blocks and tables
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\|[^\n]+\|/g, '')
    // Remove markdown headers and formatting
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove emojis
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    // Clean parenthetical translations like "(broken clouds)" or "(Green alert)"
    .replace(/\(([^)]+)\)/g, '$1')
    // Convert units to clean spoken words
    .replace(/(\d+)\s*°C/gi, '$1 degrees Celsius')
    .replace(/(\d+)\s*km\/h/gi, '$1 kilometers per hour')
    .replace(/(\d+)%/g, '$1 percent')
    .replace(/\s+/g, ' ')
    .trim();

  // Take the first 2-3 clean conversational sentences (up to ~260 characters)
  const sentences = text.match(/[^.!?।\n]+[.!?।\n]+/g) || [text];
  const shortResponse = sentences.slice(0, 3).join(' ').trim();
  return shortResponse || text.slice(0, 240);
}

/**
 * Detects whether the text is Hindi or Hinglish (Hindi written in Latin script)
 */
function isHindiOrHinglish(text) {
  if (!text) return false;
  // Devanagari script check
  if (/[\u0900-\u097F]/.test(text)) return true;
  // Common Hinglish words check
  const hinglishPattern = /\b(aapka|aapki|mera|meri|mein|hun|hoon|mausam|hai|hain|kya|batao|baadal|aaj|kal|barish|garmi|sardi|yahan|vahan|dekhna|chahta|chahiye)\b/i;
  return hinglishPattern.test(text);
}

/**
 * Finds the highest quality, most natural neural/human voice available in the browser.
 */
function selectBestVoice(voices, targetLang, cleanText) {
  if (!voices || voices.length === 0) return null;

  const isHindiContent = isHindiOrHinglish(cleanText);

  // 1. High-priority Premium / Natural Neural Voices (Google & Microsoft Online)
  const naturalVoices = voices.filter(
    (v) =>
      v.name.includes('Natural') ||
      v.name.includes('Online') ||
      v.name.includes('Google') ||
      v.name.includes('Neural') ||
      v.name.includes('Siri') ||
      v.name.includes('Premium')
  );

  // If Hindi/Hinglish content, prioritize Hindi or Indian Natural voices
  if (isHindiContent) {
    const hindiNatural = naturalVoices.find(
      (v) => v.lang.startsWith('hi') || v.name.includes('Hindi') || v.name.includes('Swara') || v.name.includes('Madhur')
    );
    if (hindiNatural) return { voice: hindiNatural, lang: 'hi-IN' };

    const indianNatural = naturalVoices.find(
      (v) => v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Heera') || v.name.includes('Ravi')
    );
    if (indianNatural) return { voice: indianNatural, lang: 'en-IN' };

    const anyHindi = voices.find((v) => v.lang.startsWith('hi') || v.name.includes('Hindi'));
    if (anyHindi) return { voice: anyHindi, lang: 'hi-IN' };
  }

  // Language-specific natural matches for regional tongues
  const langPrefix = targetLang ? targetLang.slice(0, 2).toLowerCase() : 'en';
  const matchedNatural = naturalVoices.find(
    (v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()) || v.lang.toLowerCase().startsWith(langPrefix)
  );
  if (matchedNatural) return { voice: matchedNatural, lang: matchedNatural.lang };

  // Indian English Natural
  const indianNatural = naturalVoices.find(
    (v) => v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Heera')
  );
  if (indianNatural) return { voice: indianNatural, lang: 'en-IN' };

  // Standard English Natural
  const englishNatural = naturalVoices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'))
  );
  if (englishNatural) return { voice: englishNatural, lang: 'en-US' };

  // Fallback match
  const standardMatch = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (standardMatch) return { voice: standardMatch, lang: standardMatch.lang };

  const anyEnglish = voices.find((v) => v.lang.startsWith('en'));
  return anyEnglish ? { voice: anyEnglish, lang: 'en-US' } : { voice: voices[0], lang: targetLang };
}

export default function VoiceModal({
  isOpen,
  onClose,
  onSendMessage,
  selectedRole = 'citizen',
  lastAiResponse = null,
  loading = false,
}) {
  const { t, lang, speechLocale } = useLanguage();
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState([]);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const transcriptRef = useRef('');
  const lastSpokenTextRef = useRef('');
  const processingTimeoutRef = useRef(null);

  // Sync transcript ref
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Load and cache browser speech synthesis voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const available = window.speechSynthesis.getVoices() || [];
        setVoices(available);
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLocale || 'en-IN';

      recognition.onstart = () => {
        setVoiceState('listening');
        setErrorMessage('');
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        // Only show message for genuine permission issues
        if (event.error === 'not-allowed') {
          setErrorMessage(t('voice.micDenied', 'Microphone access denied. Please allow microphone permissions in browser.'));
          setVoiceState('error');
        } else {
          // Non-fatal recognition end
          setVoiceState((curr) => (curr === 'listening' ? 'idle' : curr));
        }
      };

      recognition.onend = () => {
        const text = transcriptRef.current.trim();
        if (text) {
          setVoiceState('processing');
          if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = setTimeout(() => {
            setVoiceState((curr) => (curr === 'processing' ? 'idle' : curr));
          }, 10000);

          if (onSendMessage) {
            onSendMessage(text);
          }
        } else {
          setVoiceState((current) => (current === 'error' ? 'error' : 'idle'));
        }
      };

      recognitionRef.current = recognition;
    } else {
      recognitionRef.current = null;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [speechLocale, t, onSendMessage]);

  // Start listening on open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setManualInput('');
      setErrorMessage('');
      setVoiceState('idle');
      lastSpokenTextRef.current = '';

      const timer = setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      }, 350);

      return () => clearTimeout(timer);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Audio Waveform Animation
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.lineWidth = 3;
      const numWaves = voiceState === 'listening' ? 3 : voiceState === 'speaking' ? 2 : 1;
      const amplitude = voiceState === 'listening' ? 24 : voiceState === 'speaking' ? 16 : 4;

      for (let w = 0; w < numWaves; w++) {
        ctx.strokeStyle =
          w === 0
            ? 'rgba(56, 189, 248, 0.9)'
            : w === 1
            ? 'rgba(20, 184, 166, 0.6)'
            : 'rgba(251, 191, 36, 0.4)';

        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const freq = 0.02 + w * 0.01;
          const y =
            centerY +
            Math.sin(x * freq + phase + w) *
              amplitude *
              Math.sin((x / width) * Math.PI);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += voiceState === 'listening' ? 0.08 : 0.03;
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, voiceState]);

  // Speak AI response automatically with slow, clear, crystal audio
  useEffect(() => {
    if (lastAiResponse && isOpen && !loading && lastAiResponse !== lastSpokenTextRef.current) {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      lastSpokenTextRef.current = lastAiResponse;

      const cleanSpokenText = sanitizeForSpeech(lastAiResponse);

      if (cleanSpokenText && !isMuted && typeof window !== 'undefined' && window.speechSynthesis) {
        setTranscript(cleanSpokenText);
        setVoiceState('speaking');

        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanSpokenText);

        const targetLang = speechLocale || 'en-IN';
        const bestVoiceInfo = selectBestVoice(voices, targetLang, cleanSpokenText);
        if (bestVoiceInfo?.voice) {
          utterance.voice = bestVoiceInfo.voice;
          utterance.lang = bestVoiceInfo.lang || bestVoiceInfo.voice.lang;
        } else {
          utterance.lang = targetLang;
        }

        // Slow, clear, calm conversational pacing (rate: 0.85 = relaxed and intelligible)
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          setVoiceState('idle');
        };
        utterance.onerror = () => {
          setVoiceState('idle');
        };

        synthRef.current.speak(utterance);
      } else {
        setVoiceState('idle');
      }
    } else if (!loading && voiceState === 'processing') {
      setVoiceState('idle');
    }
  }, [lastAiResponse, isOpen, loading, isMuted, voices, speechLocale, lang, voiceState]);

  const handleStartListening = () => {
    if (!recognitionRef.current) {
      setErrorMessage(t('voice.notSupported', 'Speech recognition unavailable in this browser. Please type below.'));
      setVoiceState('error');
      return;
    }
    try {
      if (synthRef.current) synthRef.current.cancel();
      setTranscript('');
      setErrorMessage('');
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Recognition restart:', err);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setVoiceState('processing');
    if (onSendMessage) {
      onSendMessage(manualInput.trim());
    }
    setManualInput('');
  };

  const handleClose = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    setVoiceState('idle');
    setTranscript('');
    setManualInput('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 17, 32, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'var(--font-family)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--color-bg-card, #131d31)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '24px 20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 9999,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Sparkles size={12} />
              {speechLocale}
            </span>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
            {t('chat.title', 'Meteorological Assistant')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            {voiceState === 'listening'
              ? 'Listening to your voice...'
              : voiceState === 'processing' || loading
              ? 'Analyzing atmospheric telemetry...'
              : voiceState === 'speaking'
              ? 'Speaking response slowly & clearly...'
              : 'Tap microphone to speak'}
          </p>
        </div>

        {/* Dynamic Waveform Visualizer Canvas */}
        <div style={{ width: '100%', height: 48, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={440}
            height={48}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {/* Live Speech Transcript Box */}
        <div
          style={{
            width: '100%',
            minHeight: 80,
            maxHeight: 140,
            overflowY: 'auto',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: transcript ? '#38bdf8' : '#64748b',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            fontWeight: transcript ? 600 : 400,
          }}
        >
          {transcript ? (
            `“${transcript}”`
          ) : (
            <span style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>
              {voiceState === 'listening'
                ? 'Speak now in your language...'
                : 'Your spoken words will appear here...'}
            </span>
          )}
        </div>

        {/* Error Alert only for genuine permission denials */}
        {errorMessage && (
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Primary Animated Mic Action Button */}
        <div style={{ position: 'relative', margin: '6px 0' }}>
          {voiceState === 'processing' || loading ? (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 24px rgba(245, 158, 11, 0.5)',
              }}
            >
              <Loader2 size={32} className="spin-slow" />
            </div>
          ) : voiceState === 'listening' ? (
            <button
              onClick={handleStopListening}
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 0 28px rgba(239, 68, 68, 0.6)',
                animation: 'pulse 1.5s infinite',
              }}
            >
              <MicOff size={30} />
            </button>
          ) : (
            <button
              onClick={handleStartListening}
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(2, 132, 199, 0.45)',
                transition: 'transform 0.15s ease',
              }}
            >
              <Mic size={30} />
            </button>
          )}
        </div>

        {/* Fallback Text Input Bar */}
        <form onSubmit={handleManualSubmit} style={{ width: '100%', display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={t('chat.placeholder', 'Type query in your language...')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--color-border)',
              color: '#f8fafc',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || voiceState === 'processing'}
            style={{
              padding: '0 16px',
              borderRadius: 12,
              background: manualInput.trim() ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Send size={13} />
            <span>{t('chat.send', 'Send')}</span>
          </button>
        </form>

        {/* Controls Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: 4 }}>
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isMuted ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
              color: isMuted ? '#f87171' : '#94a3b8',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span>{isMuted ? 'Audio Off' : 'Audio On'}</span>
          </button>

          <button
            onClick={handleClose}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
