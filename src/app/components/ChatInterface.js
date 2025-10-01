import React, { useRef, useEffect } from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

const ChatInterface = ({ isOpen, onClose, messages, onSendMessage, onInitiateCall }) => {
  const [input, setInput] = React.useState('');
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
    console.log('Messages updated in ChatInterface:', messages);
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const renderMessage = (msg, index) => {
    const isBot = msg.type === 'bot';
    return (
      <div key={index} className={`d-flex ${isBot ? 'justify-content-start' : 'justify-content-end'} mb-3`}>
        <div className={`p-2 rounded ${isBot ? 'bg-light' : 'bg-info'} text-dark`} style={{ maxWidth: '75%' }}>
          <p className="flex items-center">
            {msg.content}
            {msg.content === 'Connecting...' && (<AiOutlineLoading3Quarters className="animate-spin ml-2" size={20} />)}
          </p>
          {msg.template?.type === 'QuickReply' && msg.template.elements.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {msg.template.elements.map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(btn.title, true)}
                  className="btn custom-button btn-sm"
                >
                  {btn.title}
                </button>
              ))}
            </div>
          )}
          {msg.template?.type === 'Agent' && (
            <button
              onClick={onInitiateCall}
              className="btn custom-button btn-sm mt-2"
            >
              Call Agent
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="open-chat-container">
      <div className="chat-header">
        <h5 className="mb-0">shark unlock chat</h5>
        <button onClick={onClose} className="btn-close btn-close-white" aria-label="Close"></button>
      </div>
      <div ref={chatMessagesRef} className="chat-body">
        {messages.length > 0 ? messages.map(renderMessage) : <p>No messages yet.</p>}
      </div>
      <form onSubmit={handleSubmit} className="chat-footer">
        <input
          type="text"
          className="form-control me-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit" className="btn custom-button">Send</button>
      </form>
      <audio id="audio-element" autoPlay style={{ display: 'none' }} />
    </div>
  );
};

export default ChatInterface;