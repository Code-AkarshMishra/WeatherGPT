import '../styles/chat.css';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, showDebug }) {
  const isUser = message.role === 'user';

  return (
    <div className={`bubble-row bubble-row--${isUser ? 'user' : 'ai'}`}>
      {/* Avatar */}
      <div className={`bubble-avatar bubble-avatar--${isUser ? 'user' : 'ai'}`} aria-hidden="true">
        {isUser ? '👤' : '🤖'}
      </div>

      <div className="bubble-content-wrapper">
        {/* Message bubble */}
        <div
          className={`bubble bubble--${isUser ? 'user' : 'ai'}`}
          role="article"
          aria-label={`${isUser ? 'Your message' : 'AI response'}`}
        >
          {/* Render newlines as paragraphs */}
          {message.content.split('\n').map((line, i) => (
            line ? <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0 }}>{line}</p> : <br key={i} />
          ))}
        </div>

        {/* Meta row */}
        <div className="bubble-meta">
          <span className="bubble-time">{formatTime(message.timestamp)}</span>
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
    </div>
  );
}
