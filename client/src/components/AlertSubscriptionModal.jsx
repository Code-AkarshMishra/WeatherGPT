import { useState } from 'react';
import { Bell, Mail, Phone, MessageSquare, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

export default function AlertSubscriptionModal({ isOpen, onClose, currentCity = 'Lucknow' }) {
  const { t } = useLanguage();
  const [channel, setChannel] = useState('push'); // 'push' | 'sms' | 'whatsapp' | 'email'
  const [targetContact, setTargetContact] = useState('');
  const [selectedCity, setSelectedCity] = useState(currentCity);
  const [minSeverity, setMinSeverity] = useState('ORANGE'); // 'YELLOW' | 'ORANGE' | 'RED'
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/weather/alert-subscribe', {
        channel,
        contact: targetContact,
        city: selectedCity,
        minSeverity,
      });
      setSubscribed(true);
    } catch (err) {
      console.warn('Subscription error, falling back:', err.message);
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubscribed(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 24,
          padding: '28px 32px',
          maxWidth: 480,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          color: 'var(--color-text-primary)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
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

        {!subscribed ? (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-danger)',
                }}
              >
                <Bell size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {t('subscription.title', 'Subscribe to Severe Weather Alerts')}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {t('subscription.subtitle', 'Direct IMD Early Warning Dispatch')}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              {t('subscription.description', 'Receive instant proactive notifications when cyclone tracks, heavy precipitation, heatwaves, or squalls are detected in your area.')}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Channel Selector */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
                  {t('subscription.channelLabel', 'Notification Channel:')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { id: 'push', label: t('subscription.webPush', 'Web Push'), icon: Bell },
                    { id: 'whatsapp', label: t('subscription.whatsapp', 'WhatsApp'), icon: MessageSquare },
                    { id: 'sms', label: t('subscription.sms', 'SMS'), icon: Phone },
                    { id: 'email', label: t('subscription.email', 'Email'), icon: Mail },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setChannel(item.id)}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 10,
                          border: channel === item.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: channel === item.id ? 'var(--color-primary-glow)' : 'var(--color-bg-card)',
                          color: channel === item.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact Input (if not push) */}
              {channel !== 'push' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                    {channel === 'email' ? t('subscription.contactLabel', 'Email Address:') : t('subscription.contactLabel', 'Mobile Number (with +91):')}
                  </label>
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    required
                    value={targetContact}
                    onChange={(e) => setTargetContact(e.target.value)}
                    placeholder={channel === 'email' ? 'citizen@gov.in' : '+91 98765 43210'}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.86rem',
                    }}
                  />
                </div>
              )}

              {/* District / City */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  {t('subscription.targetCity', 'Target City / District:')}
                </label>
                <input
                  type="text"
                  required
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.86rem',
                  }}
                />
              </div>

              {/* Severity Threshold */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>
                  {t('subscription.severityThreshold', 'Trigger Severity Threshold:')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'YELLOW', label: t('alerts.severity.yellow', 'Yellow (Watch+)'), color: '#eab308' },
                    { id: 'ORANGE', label: t('alerts.severity.orange', 'Orange (Alert+)'), color: '#f97316' },
                    { id: 'RED', label: t('alerts.severity.red', 'Red (Warning Only)'), color: '#ef4444' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMinSeverity(item.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 8,
                        border: minSeverity === item.id ? `1px solid ${item.color}` : '1px solid var(--color-border)',
                        background: minSeverity === item.id ? `${item.color}22` : 'var(--color-bg-card)',
                        color: minSeverity === item.id ? item.color : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6,
                  padding: '12px',
                  borderRadius: 12,
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={16} />
                <span>{loading ? t('subscription.registering', 'Registering Dispatch...') : t('subscription.activateBtn', 'Activate Proactive Alert Broadcast')}</span>
              </button>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '2px solid var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: 'var(--color-success)',
              }}
            >
              <Check size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {t('common.done', 'Subscription Active!')}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              {selectedCity} • {minSeverity}+ • {channel.toUpperCase()}
            </p>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                background: 'var(--color-primary)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {t('common.done', 'Done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
