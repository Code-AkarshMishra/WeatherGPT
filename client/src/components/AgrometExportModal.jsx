import { useState } from 'react';
import { Download, Share2, FileText, Check, X, Printer, Sprout, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function AgrometExportModal({
  isOpen,
  onClose,
  weatherData,
  currentCity = 'Lucknow',
}) {
  const { t, lang, formatDate, currentLanguage } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const temp = weatherData?.temperature || 28;
  const rainProb = weatherData?.rainProbability || 40;
  const humidity = weatherData?.humidity || 65;
  const windSpeed = weatherData?.windSpeed || 12;
  const imdAlert = weatherData?.disasterRisk?.imdColorCode || 'GREEN';

  const todayStr = formatDate(new Date(), { dateStyle: 'long' });

  // Generate localized WhatsApp share text
  const shareText = `${t('pdf.advisoryHeader')}\n\n📍 ${t('pdf.station', { station: currentCity })}\n📅 ${t('pdf.generatedOn', { date: todayStr })}\n\n🌡️ ${t('weather.temperature')}: ${temp}°C\n💧 ${t('weather.humidity')}: ${humidity}%\n🌧️ ${t('weather.rainProbability')}: ${rainProb}%\n💨 ${t('weather.windSpeed')}: ${windSpeed} km/h\n🚨 IMD Alert: ${imdAlert}\n\n🌾 ${t('agri.sprayWindow')}: ${rainProb > 50 ? t('agri.unsuitable') : t('agri.suitable')}\n\n👉 WeatherGPT MoES Portal: https://weather-gpt-srmu.vercel.app/`;

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handlePrintPdf = () => {
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 400);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(11, 17, 32, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card, #131d31)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '28px 32px',
          maxWidth: 580,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          color: 'var(--color-text-primary)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success)',
            }}
          >
            <Sprout size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              {t('agri.downloadAgrometPdf')}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Gramin Krishi Mausam Sewa (GKMS) • {currentLanguage.native}
            </span>
          </div>
        </div>

        {/* Advisory Preview Document Card */}
        <div
          id="printable-agromet-advisory"
          style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: 20,
            fontSize: '0.84rem',
            lineHeight: 1.5,
          }}
        >
          <div style={{ textAlign: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 10, marginBottom: 12 }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--color-primary)', display: 'block' }}>
              {t('pdf.advisoryHeader')}
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('pdf.generatedOn', { date: todayStr })} &bull; {t('pdf.station', { station: currentCity })}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('weather.temperature')}</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{temp}°C</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('weather.rainProbability')}</span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{rainProb}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem' }}>
            <div>
              <strong>{t('agri.sprayWindow')}:</strong>{' '}
              <span style={{ color: rainProb > 50 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                {rainProb > 50 ? t('agri.unsuitable') : t('agri.suitable')}
              </span>
            </div>
            <div>
              <strong>{t('agri.soilMoisture')}:</strong> {humidity > 70 ? 'Adequate / High' : 'Moderate'}
            </div>
            <div>
              <strong>IMD Warning Tier:</strong> {imdAlert} (All nominal)
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handlePrintPdf}
            disabled={downloading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              background: 'var(--color-primary)',
              border: 'none',
              color: '#fff',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Printer size={16} />
            <span>{downloading ? 'Preparing Print...' : 'Print / Save PDF'}</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              background: '#25D366',
              border: 'none',
              color: '#fff',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Share2 size={16} />
            <span>{t('agri.shareOnWhatsApp')}</span>
          </button>

          <button
            onClick={handleCopyText}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {copied ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <FileText size={16} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
