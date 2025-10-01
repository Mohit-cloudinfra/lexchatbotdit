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
  const [isConnecting, setIsConnecting] = useState(false);

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
    if (isCalling || isConnecting) return;
    setIsConnecting(true);
    setMessages((prev) => [...prev, { type: 'bot', content: 'Connecting...' }]);
  
    let timeoutId;
    let session;
    let audioVideo;
  
    try {
      // Check microphone availability and permissions
      try {
        // Attempt to get microphone stream to trigger browser permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted, stream:', stream);
        // Release the stream to avoid conflicts with Chime SDK
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('Microphone access error:', permError);
        let errorMessage = 'Error accessing microphone. Please try again.';
        if (permError.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings (e.g., Chrome: Settings > Privacy > Microphone > Allow localhost:3000) and refresh.';
        } else if (permError.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone (e.g., headset or built-in mic) and refresh. Check Windows Sound settings to ensure a microphone is enabled.';
        }
        setMessages((prev) => [...prev, { type: 'bot', content: errorMessage }]);
        setIsConnecting(false);
        setTimeout(() => setIsOpen(false), 5000); // Longer delay for user to read
        return;
      }
  
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
      console.log('API Response Data:', data);
  
      if (!data.success) {
        throw new Error(data.error);
      }
  
      const { connectionData } = data;
      if (!connectionData || !connectionData.Meeting || !connectionData.Attendee) {
        throw new Error('Invalid connection data from API. Check AWS configuration.');
      }
  
      const { ConsoleLogger, DefaultDeviceController, DefaultMeetingSession, LogLevel, MeetingSessionConfiguration } = await import('amazon-chime-sdk-js');
  
      const logger = new ConsoleLogger('ChimeSDK', LogLevel.DEBUG);
      const deviceController = new DefaultDeviceController(logger);
  
      // List audio input devices after permission
      const audioInputDevices = await deviceController.listAudioInputDevices();
      console.log('Available audio input devices after permission:', audioInputDevices);
  
      if (!audioInputDevices || audioInputDevices.length === 0) {
        setMessages((prev) => [...prev, { type: 'bot', content: 'No microphone detected after permission. Please connect a microphone and refresh.' }]);
        setIsConnecting(false);
        setTimeout(() => setIsOpen(false), 5000);
        return;
      }
  
      // Select the first available microphone
      await deviceController.chooseAudioInputDevice(audioInputDevices[0]);
      console.log('Selected audio input device:', audioInputDevices[0]);
  
      const configuration = new MeetingSessionConfiguration(connectionData.Meeting, connectionData.Attendee);
      session = new DefaultMeetingSession(configuration, logger, deviceController);
      audioVideo = session.audioVideo;
  
      const observer = {
        audioVideoDidStart: () => {
          console.log('WebRTC session started');
          clearTimeout(timeoutId);
          setMessages((prev) => [...prev, { type: 'bot', content: 'Connected to agent! Speak now.' }]);
          setIsConnecting(false);
          setIsCalling(true);
        },
        audioVideoDidFail: (error) => {
          console.error('WebRTC session failed:', error);
          setMessages((prev) => [...prev, { type: 'bot', content: 'Call failed: ' + error.message }]);
          setIsConnecting(false);
          setIsCalling(false);
        },
        audioInputFailed: (error) => {
          console.error('Audio input failed:', error);
          setMessages((prev) => [...prev, { type: 'bot', content: 'Microphone error. Please check permissions or connect a microphone.' }]);
          setIsConnecting(false);
          setIsCalling(false);
        },
      };
      audioVideo.addObserver(observer);
  
      await audioVideo.start();
      audioVideo.bindAudioElement(document.getElementById('audio-element'));
  
      timeoutId = setTimeout(() => {
        audioVideo.stop();
        audioVideo.removeObserver(observer);
        setMessages((prev) => [...prev, { type: 'bot', content: 'Our agents are busy, we will call back.' }]);
        setIsConnecting(false);
        setTimeout(() => setIsOpen(false), 2000);
      }, 10000);
  
      audioVideo.realtimeSubscribeToReceiveDataMessage('callEnd', (data) => {
        if (data.text() === 'end') {
          audioVideo.stop();
          audioVideo.removeObserver(observer);
          setMessages((prev) => [...prev, { type: 'bot', content: 'Call ended.' }]);
          setIsCalling(false);
          setIsConnecting(false);
        }
      });
    } catch (error) {
      console.error('Voice call error:', error);
      if (session && audioVideo) {
        audioVideo.stop();
      }
      clearTimeout(timeoutId);
      setMessages((prev) => [...prev, { type: 'bot', content: error.message || 'Error connecting to agent.' }]);
      setIsConnecting(false);
      setTimeout(() => setIsOpen(false), 5000);
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
            setMessages(prev => [...prev, { type: 'bot', content: 'No zipcode found for this phone. Please try again by giving your correct phone number.' }]);
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