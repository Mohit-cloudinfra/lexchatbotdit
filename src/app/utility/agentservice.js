"use client"; // Explicitly mark as client-side

// Only import if in browser environment
export const initiateAgentChat = async (userName, setMessages, chatSessionRef) => {
  // Guard against server-side execution
  if (typeof window === 'undefined') {
    console.warn('initiateAgentChat called on server-side; skipping.');
    setMessages(prev => [...prev, { type: 'bot', content: 'Error: Agent chat unavailable on server.' }]);
    return;
  }

  try {
    // Dynamic import with explicit destructuring for ChatSession
    const module = await import('amazon-connect-chatjs');
    const { ChatSession } = module;

    // Debug: Log if ChatSession is undefined
    if (!ChatSession) {
      console.error('ChatSession is undefined. Module exports:', module);
      setMessages(prev => [...prev, { type: 'bot', content: 'Error: Failed to load chat module.' }]);
      return;
    }

    const session = ChatSession.create({
      chatDetails: {
        contactFlowId: process.env.CONNECT_CONTACT_FLOW_ID,
        instanceId: process.env.CONNECT_INSTANCE_ID,
        participantDetails: {
          displayName: userName || 'Customer'
        }
      },
      region: process.env.NEXT_PUBLIC_AWS_REGION,
      type: "CUSTOMER" // String literal as per previous fix
    });
    chatSessionRef.current = session;
    await session.connect();
    setMessages(prev => [...prev, { type: 'bot', content: 'Connected to agent.' }]);

    session.onMessage((event) => {
      if (event.data.Type === 'MESSAGE' && event.data.ContentType === 'text/plain') {
        setMessages(prev => [...prev, { type: 'bot', content: event.data.Content }]);
      }
    });
  } catch (error) {
    console.error('Error initiating agent chat:', error);
    setMessages(prev => [...prev, { type: 'bot', content: 'Error connecting to agent.' }]);
  }
};

export const sendMessageToAgent = async (text, chatSessionRef) => {
  // Guard against server-side execution
  if (typeof window === 'undefined') {
    console.warn('sendMessageToAgent called on server-side; skipping.');
    return;
  }

  if (chatSessionRef.current) {
    try {
      await chatSessionRef.current.sendMessage({
        contentType: 'text/plain',
        content: text
      });
    } catch (e) {
      console.error(e);
    }
  }
};