"use client";

import { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import { sendMessage } from '../utility/botservice';
import ChatbotDS from '../(dsLayer)/ChatbotDS';
import './chatsty.css';

export default function ChatManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [conversationState, setConversationState] = useState('welcome');
  const [storedZipcode, setStoredZipcode] = useState(null);
  const [userPhone, setUserPhone] = useState(null);
  const [userName, setUserName] = useState(null);
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        type: 'bot',
        content: 'Welcome to Shark Unlock. Are you an existing customer or new customer?',
        template: {
          type: 'QuickReply',
          elements: [
            { title: 'Yes' }, 
            { title: 'No' }
          ]
        }
      }]);
      setConversationState('welcome');
    }
  }, [isOpen, messages.length]);

  const handleInitiateCall = async () => {
    if (isCalling) return;
    setIsCalling(true);
    setMessages((prev) => [...prev, { type: 'bot', content: 'Initiating call...' }]);
  
    try {
      const response = await fetch('/api/start-webrtc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            userPhone: userPhone || 'Unknown',
            userName: userName || 'Customer',
          },
        }),
      });
  
      const data = await response.json();
      console.log('API Response Data:', data); // Debug: Check structure in console
  
      if (!data.success) {
        throw new Error(data.error);
      }
  
      const { connectionData } = data;
      if (!connectionData || !connectionData.Meeting || !connectionData.Attendee) {
        throw new Error('Invalid connection data from API. Check AWS configuration.');
      }
  
      const { ConsoleLogger, DefaultDeviceController, DefaultMeetingSession, LogLevel, MeetingSessionConfiguration } = await import('amazon-chime-sdk-js');
  
      const logger = new ConsoleLogger('ChimeSDK', LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger);
      const configuration = new MeetingSessionConfiguration(connectionData.Meeting, connectionData.Attendee);
      const session = new DefaultMeetingSession(configuration, logger, deviceController);
      const audioVideo = session.audioVideo;
  
      await audioVideo.start();
      audioVideo.bindAudioElement(document.getElementById('audio-element'));
  
      setMessages((prev) => [...prev, { type: 'bot', content: 'Please wait while we connect you to our agent.' }]);
  
      audioVideo.realtimeSubscribeToReceiveDataMessage('callEnd', (data) => {
        if (data.text() === 'end') {
          audioVideo.stop();
          setMessages((prev) => [...prev, { type: 'bot', content: 'Call ended.' }]);
          setIsCalling(false);
        }
      });
    } catch (error) {
      console.error('Voice call error:', error);
      setMessages((prev) => [...prev, { type: 'bot', content: error.message || 'Error connecting to agent.' }]);
      setIsCalling(false);
    }
  };

  const handleSendMessage = async (text, isQuickReply = false) => {
    const normalizedText = text.trim();
    setMessages(prev => [...prev, { type: 'user', content: normalizedText }]);

    if (normalizedText === 'Yes, I want to call') {
      await handleInitiateCall();
      return;
    }
    if (normalizedText === 'No, I don\'t want to') {
      setMessages(prev => [...prev, { type: 'bot', content: 'Chat ended. Goodbye!' }]);
      setTimeout(() => setIsOpen(false), 2000);
      return;
    }

    if (conversationState === 'welcome') {
      if (normalizedText.toLowerCase() === 'yes') {
        setConversationState('existing_phone');
        setMessages(prev => [...prev, { type: 'bot', content: 'Please enter your 10-digit phone number.' }]);
      } else if (normalizedText.toLowerCase() === 'no') {
        setConversationState('new_name');
        setMessages(prev => [...prev, { type: 'bot', content: 'Please enter your name.' }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'bot',
          content: 'Dear customer, to continue forward we want to know whether you are new customer or existing customer so answer yes if you are exsiting customer or no if you are new customer.',
          template: { type: 'QuickReply', elements: [{ title: 'Yes' }, { title: 'No' }] }
        }]);
      }
      return;
    }

    if (conversationState === 'existing_phone') {
      const phoneRegex = /^\d{10}$/;
      if (phoneRegex.test(normalizedText)) {
        setUserPhone(normalizedText);
        const ds = new ChatbotDS();
        try {
          const response = await ds.UsersGet({
            "Details": {
              "Parameters": {
                "userPhoneNumber": `+1${normalizedText}`,
                "language": "en-US"
              }
            },
            "Name": "ContactFlowEvent"
          });
          const setUserPhone = response.data.contactPhone; 
          const zip = response.data.contactMailingZip;
          if (zip) {
            setStoredZipcode(zip);
            setConversationState('existing_zip');
            setMessages(prev => [...prev, { type: 'bot', content: 'Please enter your zipcode.' }]);
          } else {
            setMessages(prev => [...prev, { type: 'bot', content: 'Please try again by giving your correct phone number that you registered with us.' }]);
          }
        } catch (error) {
          setMessages(prev => [...prev, { type: 'bot', content: 'Error fetching data. Please try again.' }]);
        }
      } else {
        setMessages(prev => [...prev, { type: 'bot', content: 'you entered Invalid phone number. Please enter a 10-digit number.' }]);
      }
      return;
    }

    if (conversationState === 'existing_zip') {
      if (normalizedText === storedZipcode) {
        setConversationState('connected_lex');
        await sendMessage(`lrzmsinu ${userPhone}`, sessionId, setMessages);
      } else {
        setMessages(prev => [...prev, { type: 'bot', content: 'Zipcode does not match. Please try again with your zipcode.' }]);
      }
      return;
    }

    if (conversationState === 'new_name') {
      setUserName(normalizedText);
      setConversationState('new_phone');
      setMessages(prev => [...prev, { type: 'bot', content: 'Please enter your 10-digit phone number.' }]);
      return;
    }

    if (conversationState === 'new_phone') {
      const phoneRegex = /^\d{10}$/;
      if (phoneRegex.test(normalizedText)) {
        setUserPhone(normalizedText);
        await handleInitiateCall();
      } else {
        setMessages(prev => [...prev, { type: 'bot', content: 'Invalid phone number. Please enter a 10-digit number.' }]);
      }
      return;
    }

    if (conversationState === 'connected_lex') {
      await sendMessage(normalizedText, sessionId, setMessages);
    }
  };

  console.log('Current messages:', messages);

  return (
    <div className="position-relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="primary-button"
      >
        chat
      </button>
      <ChatInterface
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onInitiateCall={handleInitiateCall}
      />
    </div>
  );
}