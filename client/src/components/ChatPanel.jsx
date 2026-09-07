import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';
import ChatBubble from './ChatBubble';
import RoleDock from './RoleDock';
import MoESWelcomeHub from './MoESWelcomeHub';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/chat.css';

const ROLE_LABELS = {
  farmer: 'Farmer / Crop Advisory',
  citizen: 'Citizen',
  researcher: 'Researcher',
  aviation: 'Aviation',
  marine: 'Marine',
  flood_disaster: 'Flood & Disaster',
  climate_analyst: 'Climate Analyst',
  urban_planner: 'Urban Planner',
};

export default function ChatPanel({
  messages,
  loading,
  error,
  selectedRole,
  onRoleChange,
  onFeatureSelect,
  suggestedRole,
  onRoleSwitch,
  onDismissSuggestion,
}) {
  const threadRef = useRef(null);
  const { t } = useLanguage();

  // Auto-scroll to bottom only when there are active chat messages
  useEffect(() => {
    if (threadRef.current && messages.length > 0) {
      threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  const isDev = import.meta.env.DEV;

  const POPUP_PILLS = [
    { label: '🌾 Crop Spraying', query: 'Is it safe to spray crops today?' },
    { label: '⛈️ 24h Rain', query: 'What is the 24-hour rain forecast?' },
    { label: '🚗 Visibility & Fog', query: 'How is visibility for driving today?' },
    { label: '🌊 Marine Wind', query: 'What is the sea state and coastal wind speed?' },
  ];

  return (
    <div className="chat-container">
      {/* Clean Compact Role Dock Bar */}
      <RoleDock
        selectedRole={selectedRole}
        onRoleChange={onRoleChange}
        onFeatureSelect={onFeatureSelect}
      />

      <div className="chat-thread" ref={threadRef} role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && !loading ? (
          <MoESWelcomeHub
            selectedRole={selectedRole}
            onRoleChange={onRoleChange}
            onSelectQuery={onFeatureSelect}
          />
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} showDebug={isDev} />
          ))
        )}

        {/* Contextual Progress Typing Indicator */}
        {loading && (
          <motion.div
            className="bubble-row bubble-row--ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bubble-avatar bubble-avatar--ai" aria-hidden="true">
              <Bot size={18} />
            </div>
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: '10px 14px',
              fontSize: '0.82rem',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontWeight: 600 }}>
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                <span>WeatherGPT AI Reasoning Pipeline...</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, display: 'flex', gap: 12 }}>
                <span style={{ color: '#4ade80' }}>✓ Location identified</span>
                <span style={{ color: '#4ade80' }}>✓ Weather data retrieved</span>
                <span style={{ color: '#facc15' }}>⟳ Analyzing risk...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-danger animate-fadeIn" role="alert" style={{ margin: '0 var(--space-4)' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Quick Suggestion Pills (Shown when chatting) */}
      {messages.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '6px 14px',
          overflowX: 'auto',
          background: 'rgba(15, 23, 42, 0.4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          {POPUP_PILLS.map((pill, idx) => (
            <button
              key={idx}
              onClick={() => onFeatureSelect && onFeatureSelect(pill.query)}
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 9999,
                padding: '4px 10px',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {/* Role suggestion banner */}
      {suggestedRole && (
        <div className="role-suggestion" role="alert" aria-live="polite">
          <span>💡</span>
          <span>
            {t('switchRoleHint')} <strong>{ROLE_LABELS[suggestedRole] || suggestedRole}</strong> role.
          </span>
          <button
            className="role-suggestion-btn"
            onClick={() => { onRoleSwitch(suggestedRole); onDismissSuggestion(); }}
            id="switch-role-btn"
          >
            {t('switchBtn')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={onDismissSuggestion}
            style={{ height: 28, padding: '0 var(--space-2)', fontSize: 'var(--font-size-xs)', minHeight: 28 }}
            id="dismiss-suggestion-btn"
          >
            {t('dismiss')}
          </button>
        </div>
      )}
    </div>
  );
}

