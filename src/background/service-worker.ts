import { getSettings } from '../shared/storage';
import type {
  MessageToBackground,
  MessageToBackgroundHealthCheck,
  MessageToBackgroundPageSummarize,
  MessageResponse,
  LLMSettings,
  PageChatRequest,
  ChatMessage,
} from '../shared/types';
import { truncateToTokens } from '../content/tokenUtils';

type IncomingMessage =
  | MessageToBackground
  | MessageToBackgroundHealthCheck
  | MessageToBackgroundPageSummarize;

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;
const SUMMARY_MAX_TOKENS = 1500;
const CHAT_REPLY_MAX_TOKENS = 1000;
// Token budget reserved for system prompt metadata (title, URL, instruction overhead)
const SYSTEM_PROMPT_OVERHEAD_TOKENS = 200;

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

function getSummarizeSystemPrompt(): string {
  return `You are an expert content analyst. Analyze the provided webpage content and produce a structured response in markdown with these three sections:

**Summary**
A concise 2–4 sentence overview of the main content.

**Key Points**
3–7 bullet points covering the most important information.

**Action Items** *(include only if the content contains specific steps or recommendations)*
Bullet points of actionable steps mentioned in the content.

Be concise but comprehensive. Respond in markdown only.`;
}

function buildChatSystemPrompt(
  title: string,
  url: string,
  content: string,
  maxContextTokens: number,
): string {
  const contentBudget = maxContextTokens - SYSTEM_PROMPT_OVERHEAD_TOKENS;
  const truncatedContent = truncateToTokens(content, contentBudget);

  return `You are an intelligent assistant analyzing a webpage for the user.

PAGE TITLE: ${title}
PAGE URL: ${url}

PAGE CONTENT:
${truncatedContent}

Answer questions about this content accurately and helpfully. If the user asks to translate, summarize, or explain something specific from the page, do so. If information is not in the provided content, clearly say so. Respond in markdown when it improves readability.`;
}

async function callLLM(
  settings: LLMSettings,
  systemPrompt: string,
  userText: string,
  maxTokens = 1000,
): Promise<string> {
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
      temperature: settings.temperature ?? 0,
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

async function callLLMWithHistory(
  settings: LLMSettings,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  maxTokens = 1000,
): Promise<string> {
  const url = settings.baseUrl.replace(/\/$/, '') + '/chat/completions';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: settings.temperature ?? 0.3,
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

async function streamLLMWithHistory(
  settings: LLMSettings,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  maxTokens: number,
  port: chrome.runtime.Port,
): Promise<void> {
  const url = settings.baseUrl.replace(/\/$/, '') + '/chat/completions';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: settings.temperature ?? 0.3,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  if (!response.body) throw new Error('No response body for streaming');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const chunk = parsed?.choices?.[0]?.delta?.content;
        if (chunk) port.postMessage({ type: 'CHUNK', content: chunk });
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  port.postMessage({ type: 'DONE' });
}

// Standard request/response messages
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

    if (message.type === 'PAGE_SUMMARIZE') {
      const { pageContent } = message.payload;
      getSettings().then((settings) => {
        if (!settings.baseUrl || !settings.model) {
          sendResponse({ success: false, error: 'LLM not configured. Please open Settings.' });
          return;
        }
        const maxContext = settings.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
        const truncated = truncateToTokens(pageContent.content, maxContext - 500);
        const systemPrompt = getSummarizeSystemPrompt();
        callLLM(settings, systemPrompt, `Title: ${pageContent.title}\n\n${truncated}`, SUMMARY_MAX_TOKENS)
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
      });
      return true;
    }
  },
);

// Streaming port for chat
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'lingua-stream') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'PAGE_CHAT') return;

    const payload = msg.payload as PageChatRequest;
    const { pageContent, conversationHistory, userMessage } = payload;

    const settings = await getSettings();
    if (!settings.baseUrl || !settings.model) {
      port.postMessage({ type: 'ERROR', error: 'LLM not configured. Please open Settings.' });
      return;
    }

    const maxContext = settings.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    // Reserve tokens for conversation history and the reply
    const historyTokens = conversationHistory.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
    const contentBudget = Math.max(1000, maxContext - historyTokens - CHAT_REPLY_MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD_TOKENS);

    const systemPrompt = buildChatSystemPrompt(
      pageContent.title,
      pageContent.url,
      pageContent.content,
      contentBudget,
    );

    try {
      await streamLLMWithHistory(
        settings,
        systemPrompt,
        conversationHistory,
        userMessage,
        CHAT_REPLY_MAX_TOKENS,
        port,
      );
    } catch (err) {
      // Fallback to non-streaming if streaming fails
      try {
        const result = await callLLMWithHistory(
          settings,
          systemPrompt,
          conversationHistory,
          userMessage,
          CHAT_REPLY_MAX_TOKENS,
        );
        port.postMessage({ type: 'CHUNK', content: result });
        port.postMessage({ type: 'DONE' });
      } catch (fallbackErr: unknown) {
        const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        port.postMessage({ type: 'ERROR', error: message });
      }
    }
  });
});
