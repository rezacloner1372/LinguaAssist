import type {
  MessageToBackground,
  MessageToBackgroundHealthCheck,
  MessageToBackgroundPageSummarize,
  MessageResponse,
  LLMRequest,
  LLMSettings,
  PageSummarizeRequest,
  StreamMessage,
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

/**
 * Stream a chat response via a long-lived port.
 * Calls `onChunk` for each delta, `onDone` when finished, `onError` on failure.
 * Returns a disconnect function to cancel early.
 */
export function streamPageChat(
  payload: PageChatRequest,
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

  port.postMessage({ type: 'PAGE_CHAT', payload });

  return () => port.disconnect();
}
