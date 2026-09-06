import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * useChat — manages conversation state and API communication.
 */
export function useChat({ role, lat, lon }) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedRole, setSuggestedRole] = useState(null);
  const guestId = useRef(
    localStorage.getItem('guestId') || `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );

  // Persist guest ID
  if (!localStorage.getItem('guestId')) {
    localStorage.setItem('guestId', guestId.current);
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);
    setSuggestedRole(null);

    try {
      const payload = {
        message: text,
        role,
        guestId: guestId.current,
      };
      if (lat != null) payload.lat = lat;
      if (lon != null) payload.lon = lon;
      if (conversationId) payload.conversationId = conversationId;

      const res = await api.post('/api/chat', payload);

      const { response, conversationId: cid, nlp, suggestedRole: sr, provider, weather } = res.data.data;

      if (cid && !conversationId) setConversationId(cid);
      if (sr) setSuggestedRole(sr);

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        nlp,
        provider,
        weather,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a response. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, role, lat, lon, conversationId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setSuggestedRole(null);
    setError(null);
  }, []);

  return { messages, loading, error, suggestedRole, sendMessage, clearConversation, setSuggestedRole };
}
