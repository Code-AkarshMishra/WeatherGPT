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

  return (
    <div className="chat-container">
      {/* Front-and-Center Role Dock with Hover Tooltips */}
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

        {/* Typing indicator */}
        {loading && (
          <motion.div
            className="bubble-row bubble-row--ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bubble-avatar bubble-avatar--ai" aria-hidden="true">
              <Bot size={18} />
            </div>
            <div className="typing-indicator" aria-label="AI is typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
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
