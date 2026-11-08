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

  // `settled` guards against double callbacks and against reporting a
  // disconnect we caused ourselves (cancel) or one that follows DONE/ERROR.
  let settled = false;

  port.onMessage.addListener((msg: StreamMessage) => {
    if (settled) return;
    if (msg.type === 'CHUNK') {
      onChunk(msg.content);
    } else if (msg.type === 'DONE') {
      settled = true;
      onDone();
    } else if (msg.type === 'ERROR') {
      settled = true;
      onError(msg.error);
    }
  });

  // The worker can be killed or the extension reloaded mid-stream; without
  // this the UI would stay in "loading" forever.
  port.onDisconnect.addListener(() => {
    if (settled) return;
    settled = true;
    onError(chrome.runtime.lastError?.message ?? 'Connection to the extension was lost. Please try again.');
  });

  try {
    port.postMessage(request);
  } catch (err: unknown) {
    settled = true;
    onError(err instanceof Error ? err.message : String(err));
  }

  return () => {
    settled = true;
    port.disconnect();
  };
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
