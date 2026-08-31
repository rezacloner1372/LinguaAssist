import type {
  MessageToBackground,
  MessageToBackgroundHealthCheck,
  MessageToBackgroundPageSummarize,
  MessageToBackgroundTtsSpeak,
  MessageToBackgroundTtsStop,
  MessageResponse,
  LLMRequest,
  LLMSettings,
  PageSummarizeRequest,
  StreamMessage,
  StreamRequest,
  PageChatRequest,
} from './types';

export function sendLLMRequest(payload: LLMRequest): Promise<MessageResponse> {
  const message: MessageToBackground = { type: 'LLM_REQUEST', payload };
  return chrome.runtime.sendMessage(message);
}

export function sendHealthCheck(payload: LLMSettings): Promise<MessageResponse> {
  const message: MessageToBackgroundHealthCheck = { type: 'HEALTH_CHECK', payload };
  return chrome.runtime.sendMessage(message);
}

export function sendPageSummarizeRequest(payload: PageSummarizeRequest): Promise<MessageResponse> {
  const message: MessageToBackgroundPageSummarize = { type: 'PAGE_SUMMARIZE', payload };
  return chrome.runtime.sendMessage(message);
}

export function sendTtsSpeak(payload: { text: string; lang?: string }): Promise<MessageResponse> {
  const message: MessageToBackgroundTtsSpeak = { type: 'TTS_SPEAK', payload };
  return chrome.runtime.sendMessage(message);
}

export function sendTtsStop(): Promise<MessageResponse> {
  const message: MessageToBackgroundTtsStop = { type: 'TTS_STOP' };
  return chrome.runtime.sendMessage(message);
}

/**
 * Generic streaming request over the 'lingua-stream' port.
 * Calls `onChunk` for each delta, `onDone` when finished, `onError` on failure.
 * Returns a disconnect function to cancel early.
 */
export function streamLLMRequest(
  request: StreamRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const port = chrome.runtime.connect({ name: 'lingua-stream' });

  port.onMessage.addListener((msg: StreamMessage) => {
    if (msg.type === 'CHUNK') onChunk(msg.content);
    else if (msg.type === 'DONE') onDone();
    else if (msg.type === 'ERROR') onError(msg.error);
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      onError(chrome.runtime.lastError.message ?? 'Port disconnected unexpectedly.');
    }
  });

  port.postMessage(request);

  return () => port.disconnect();
}

/**
 * Stream a chat response via a long-lived port.
 * Thin wrapper over streamLLMRequest for the page-chat message shape.
 */
export function streamPageChat(
  payload: PageChatRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  return streamLLMRequest({ type: 'PAGE_CHAT', payload }, onChunk, onDone, onError);
}
