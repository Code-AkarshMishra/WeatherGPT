import { useState, useRef, useCallback, useEffect } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLanguage } from '../contexts/LanguageContext';
import RoleChip from './RoleChip';
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

export default function ChatInput({ onSend, loading, selectedRole, initialText }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { t } = useLanguage();

  // Handle prefill from sidebar feature chips
  useEffect(() => {
    if (initialText) {
      setText(initialText);
      textareaRef.current?.focus();
    }
  }, [initialText]);

  const handleSpeechResult = useCallback((transcript) => {
    setText((prev) => prev + (prev ? ' ' : '') + transcript);
    textareaRef.current?.focus();
  }, []);

  const { isListening, start, stop, isSupported } = useSpeechRecognition({
    onResult: handleSpeechResult,
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    // Auto-resize textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    }
  };

  const handleMicClick = () => {
    if (isListening) stop();
    else start();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Future: upload file and include in message context
      setText((prev) => `${prev} [Attached: ${file.name}]`);
    }
    e.target.value = '';
  };

  return (
    <div className="chat-input-area">
      {/* Role chip */}
      <div className="chat-input-meta">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {t('youAreChattingAs')}
        </span>
        <RoleChip role={selectedRole} label={ROLE_LABELS[selectedRole] || selectedRole} />
      </div>

      {/* Input form */}
      <form
        className="chat-input-form"
        onSubmit={handleSubmit}
        aria-label="Chat input"
        id="chat-form"
      >
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={t('typeMessage')}
          rows={1}
          aria-label="Message input"
          aria-multiline="true"
          disabled={loading}
          id="chat-textarea"
        />

        <div className="chat-input-actions">
          {/* Mic button */}
          {isSupported && (
            <button
              type="button"
              className={`input-action-btn${isListening ? ' recording' : ''}`}
              onClick={handleMicClick}
              aria-label={isListening ? 'Stop recording' : 'Start voice input'}
              title={isListening ? 'Stop recording' : 'Voice input'}
              id="mic-btn"
            >
              {isListening ? '⏹️' : '🎙️'}
            </button>
          )}

          {/* File upload */}
          <button
            type="button"
            className="input-action-btn"
            onClick={handleFileClick}
            aria-label="Attach file"
            title="Attach file"
            id="attach-btn"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          {/* Send */}
          <button
            type="submit"
            className="input-send-btn"
            disabled={!text.trim() || loading}
            aria-label={t('send')}
            title={t('send')}
            id="send-btn"
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : '➤'}
          </button>
        </div>
      </form>
    </div>
  );
}
