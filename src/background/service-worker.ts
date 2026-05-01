import { getSettings } from '../shared/storage';
import type { MessageToBackground, MessageToBackgroundHealthCheck, MessageResponse, LLMSettings } from '../shared/types';

type IncomingMessage = MessageToBackground | MessageToBackgroundHealthCheck;

function getSystemPrompt(action: string): string {
  switch (action) {
    case 'translate_to_persian':
      return 'You are a professional translator. Translate the following text to Persian (Farsi). Return ONLY the translated text with no explanation or commentary.';
    case 'translate_to_english':
      return 'You are a professional translator. Translate the following text to English. Return ONLY the translated text with no explanation or commentary.';
    case 'fix_grammar':
      return 'You are a professional editor. Fix the grammar, spelling, punctuation, and clarity of the following text. Return ONLY the corrected text with no explanation or commentary.';
    default:
      return 'Process the following text.';
  }
}

async function callLLM(settings: LLMSettings, systemPrompt: string, userText: string, maxTokens = 1000): Promise<string> {
  const url = settings.baseUrl.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from LLM');
  return content.trim();
}

chrome.runtime.onMessage.addListener(
  (message: IncomingMessage, _sender, sendResponse: (response: MessageResponse) => void) => {
    if (message.type === 'LLM_REQUEST') {
      const { text, action } = message.payload;
      getSettings().then((settings) => {
        if (!settings.baseUrl || !settings.model) {
          sendResponse({ success: false, error: 'LLM not configured. Please open Settings.' });
          return;
        }
        const systemPrompt = getSystemPrompt(action);
        callLLM(settings, systemPrompt, text)
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
      });
      return true;
    }

    if (message.type === 'HEALTH_CHECK') {
      const settings = message.payload;
      const start = Date.now();
      callLLM(settings, 'You are a helpful assistant.', 'Hello', 1)
        .then(() => {
          sendResponse({ success: true, responseTimeMs: Date.now() - start });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message, responseTimeMs: Date.now() - start });
        });
      return true;
    }
  }
);
