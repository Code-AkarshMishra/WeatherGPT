import { useState, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function SpeakButton({ text, lang: propLang, size = 'sm' }) {
  const { t, lang: ctxLang } = useLanguage();
  const lang = propLang || ctxLang || 'en';
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const utteranceRef = useRef(null);

  const getVoice = useCallback((targetLang) => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();

    // Prefer Indian voices
    const langMap = {
      hi: ['hi-IN', 'hi'],
      hinglish: ['hi-IN', 'hi', 'en-IN'],
      en: ['en-IN', 'en-US', 'en-GB', 'en'],
      bn: ['bn-IN', 'bn'],
      te: ['te-IN', 'te'],
      mr: ['mr-IN', 'mr'],
      ta: ['ta-IN', 'ta'],
      gu: ['gu-IN', 'gu'],
      kn: ['kn-IN', 'kn'],
      pa: ['pa-IN', 'pa'],
      ml: ['ml-IN', 'ml'],
      or: ['or-IN', 'or'],
    };

    const preferred = langMap[targetLang] || langMap.en;
    for (const pref of preferred) {
      const match = voices.find((v) => v.lang.startsWith(pref));
      if (match) return match;
    }

    // Fallback: any Hindi voice for Hindi text, else default
    if (targetLang === 'hi' || targetLang === 'hinglish') {
      const hindiVoice = voices.find((v) => v.lang.includes('hi'));
      if (hindiVoice) return hindiVoice;
    }

    return null;
  }, []);

  const stripMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/#{1,6}\s*/g, '')          // headers
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
      .replace(/\*([^*]+)\*/g, '$1')      // italic
      .replace(/`([^`]+)`/g, '$1')        // code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/[📌🌡️💧💨🌧️🛡️🌤️⚓🌾✅❄️⚠️🔴📊📅🏙️]/g, '') // emojis
      .replace(/[-*]\s+/g, '. ')          // bullets
      .replace(/\n+/g, '. ')             // newlines
      .replace(/\.\s*\./g, '.')           // double dots
      .trim();
  };

  const handleSpeak = useCallback(() => {
    if (!window.speechSynthesis) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    // Truncate to ~500 chars for reasonable TTS duration
    const truncated = cleanText.length > 500 ? cleanText.substring(0, 500) + '...' : cleanText;

    setLoading(true);

    const utterance = new SpeechSynthesisUtterance(truncated);
    utteranceRef.current = utterance;

    // Detect language from content if not specified
    const hasHindi = /[\u0900-\u097F]/.test(text);
    const effectiveLang = hasHindi ? 'hi' : (lang || 'en');

    const voice = getVoice(effectiveLang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = effectiveLang === 'hi' ? 'hi-IN' : 'en-IN';
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setLoading(false);
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
      setLoading(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setLoading(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [text, lang, speaking, getVoice]);

  if (!window.speechSynthesis) return null;

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleSpeak}
      title={speaking ? 'Stop speaking' : 'Listen to this response'}
      aria-label={speaking ? 'Stop speaking' : 'Listen to this response'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: isSmall ? '3px 8px' : '5px 12px',
        borderRadius: 8,
        border: '1px solid',
        borderColor: speaking
          ? 'rgba(239, 68, 68, 0.4)'
          : 'var(--color-border, rgba(255,255,255,0.1))',
        background: speaking
          ? 'rgba(239, 68, 68, 0.1)'
          : 'var(--color-bg-alt, rgba(255,255,255,0.05))',
        color: speaking
          ? 'var(--color-danger, #ef4444)'
          : 'var(--color-text-muted, rgba(255,255,255,0.5))',
        cursor: 'pointer',
        fontSize: isSmall ? '0.68rem' : '0.76rem',
        fontWeight: 600,
        transition: 'all 0.15s ease',
        lineHeight: 1,
      }}
    >
      {loading ? (
        <Loader2 size={isSmall ? 12 : 14} style={{ animation: 'spin 1s linear infinite' }} />
      ) : speaking ? (
        <VolumeX size={isSmall ? 12 : 14} />
      ) : (
        <Volume2 size={isSmall ? 12 : 14} />
      )}
      <span>{speaking ? t('chat.stopSpeaking', 'Stop') : (`🔊 ${t('chat.listen', 'Listen')}`)}</span>
    </button>
  );
}
