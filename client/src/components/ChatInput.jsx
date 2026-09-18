import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Paperclip, SendHorizontal, Sparkles, Volume2 } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLanguage } from '../contexts/LanguageContext';
import RoleChip from './RoleChip';
import VoiceModal from './VoiceModal';
import '../styles/chat.css';

export default function ChatInput({ onSend, loading, selectedRole, initialText, lastAiResponse }) {
  const [text, setText] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { t, speechLocale } = useLanguage();

  // Handle prefill from feature chips
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
    lang: speechLocale,
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
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setText((prev) => `${prev} [${file.name}]`);
    }
    e.target.value = '';
  };

  return (
    <div className="chat-input-area">
      {/* Role chip */}
      <div className="chat-input-meta">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
          {t('personas.selectorTitle')}
        </span>
        <RoleChip role={selectedRole} label={t(`personas.${selectedRole}.name`, selectedRole)} />
      </div>

      {/* Input form */}
      <form
        className="chat-input-form"
        onSubmit={handleSubmit}
        aria-label={t('chat.placeholder')}
        id="chat-form"
      >
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          rows={1}
          aria-label={t('chat.placeholder')}
          aria-multiline="true"
          disabled={loading}
          id="chat-textarea"
        />

        <div className="chat-input-actions">
          {/* Voice-to-Voice AI Modal Trigger Button */}
          <motion.button
            type="button"
            className="input-action-btn"
            onClick={() => setVoiceModalOpen(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={t('voice.voiceAssist')}
            title={t('voice.voiceAssist')}
            style={{ color: 'var(--color-primary)' }}
            id="voice-ai-modal-btn"
          >
            <Mic size={16} />
          </motion.button>

          {/* File upload */}
          <motion.button
            type="button"
            className="input-action-btn"
            onClick={handleFileClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={t('common.download')}
            title={t('common.download')}
            id="attach-btn"
          >
            <Paperclip size={16} />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          {/* Send button */}
          <motion.button
            type="submit"
            className="input-send-btn"
            disabled={!text.trim() || loading}
            whileHover={{ scale: text.trim() && !loading ? 1.05 : 1 }}
            whileTap={{ scale: text.trim() && !loading ? 0.95 : 1 }}
            aria-label={t('chat.send')}
            title={t('chat.send')}
            id="send-btn"
          >
            {loading ? (
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <SendHorizontal size={17} />
            )}
          </motion.button>
        </div>
      </form>

      {/* Voice-to-Voice Interaction Modal */}
      <VoiceModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSendMessage={(spokenText) => {
          onSend(spokenText);
        }}
        selectedRole={selectedRole}
        lastAiResponse={lastAiResponse}
        loading={loading}
      />
    </div>
  );
}
