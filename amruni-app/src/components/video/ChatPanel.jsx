import { useState, useEffect, useRef } from 'react';
import { useVideoCall } from '../../hooks/useVideoCall';

export default function ChatPanel({ onClose }) {
  const { chatMessages, sendChatMessage } = useVideoCall();
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChatMessage(text);
    setText('');
  };

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="chat-panel">
      {/* Panel Header */}
      <div className="chat-panel__header">
        <h3>Consultation Chat</h3>
        <button className="chat-close-btn" onClick={onClose} aria-label="Close Chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Message List */}
      <div className="chat-panel__messages">
        {chatMessages.map((msg) => {
          const isPatient = msg.sender === 'patient';
          return (
            <div
              key={msg.id}
              className={`chat-bubble-wrapper ${isPatient ? 'chat-bubble-wrapper--patient' : 'chat-bubble-wrapper--doctor'}`}
            >
              <div className="chat-bubble-meta">
                {isPatient ? 'You' : 'Doctor'} · {msg.timestamp}
              </div>
              <div className="chat-bubble">
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form className="chat-panel__form" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message..."
          className="chat-input"
          maxLength={500}
        />
        <button type="submit" className="chat-send-btn" disabled={!text.trim()} aria-label="Send Message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
