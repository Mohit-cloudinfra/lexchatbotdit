import { LexRuntimeV2Client, RecognizeTextCommand } from '@aws-sdk/client-lex-runtime-v2';

const lexClient = new LexRuntimeV2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const sendMessage = async (text, sessionId, setMessages) => {
  if (!text.trim()) return;

  const command = new RecognizeTextCommand({
    botId: process.env.NEXT_PUBLIC_BOT_ID,
    botAliasId: process.env.NEXT_PUBLIC_BOT_ALIAS_ID,
    localeId: process.env.NEXT_PUBLIC_BOT_LOCALE_ID,
    sessionId: sessionId,
    text: text,
  });

  try {
    const response = await lexClient.send(command);
    console.log('Lex response:', response);
    const botMessages = response.messages.map((msg) => {
      if (msg.contentType === 'CustomPayload') {
        try {
          const payload = JSON.parse(msg.content);
          console.log('Received payload:', payload);

          let content = 'No message content available.';
          let elements = [];
          let templateType = 'QuickReply';

          if (payload.templateType && payload.data) {
            templateType = payload.templateType;
            if (templateType === 'Agent') {
              return {
                type: 'bot',
                content: 'Will you talk to our agent?',
                template: {
                  type: 'QuickReply',
                  elements: [
                    { title: 'Yes, I want to call' },
                    { title: 'No, I don\'t want to' }
                  ],
                },
              };
            }
            content = payload.data.content || 'No content';
            elements = payload.data.elements || [];
          }

          if (typeof content !== 'string') {
            console.error('Invalid content type in payload:', payload);
            return { type: 'bot', content: 'Error: Invalid response format.' };
          }

          return {
            type: 'bot',
            content: content,
            template: {
              type: templateType,
              elements: Array.isArray(elements) ? elements : [],
            },
          };
        } catch (parseError) {
          console.error('Payload parse error:', parseError, msg.content);
          return { type: 'bot', content: 'Error processing response.' };
        }
      }
      return { type: 'bot', content: msg.content || 'No response.' };
    });
    setMessages((prev) => {
      const newMessages = [...prev, ...botMessages];
      console.log('Updated messages:', newMessages);
      return newMessages;
    });
  } catch (err) {
    console.error('Lex error:', err);
    setMessages((prev) => [...prev, { type: 'bot', content: 'Sorry, something went wrong.' }]);
  }
};