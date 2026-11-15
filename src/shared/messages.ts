import type {
  MessageToBackground,
  MessageToBackgroundHealthCheck,
  MessageToBackgroundPageSummarize,
  MessageToBackgroundTtsSpeak,
  MessageToBackgroundTtsStop,
  MessageToBackgroundListModels,
  MessageToBackgroundOpenOptions,
  MessageResponse,
  LLMRequest,
  LLMSettings,
  PageSummarizeRequest,
  StreamMessage,
  StreamRequest,
  PageChatRequest,
} from './types';

/** Shown when the extension was reloaded or updated while this page stayed open. */
export const STALE_CONTEXT_MESSAGE = 'LinguaAssist was updated or reloaded. Refresh this page (F5) to keep using it.';

/**
 * False once the extension has been reloaded/updated underneath this page: the old content
 * script keeps running, but chrome.runtime.id is gone and every chrome.* call throws
 * "Extension context invalidated".
 */
export function isExtensionAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** sendMessage that always reports failure as a rejected promise (a stale page throws synchronously). */
function send(message: unknown): Promise<MessageResponse> {
  try {
    return chrome.runtime.sendMessage(message);
  } catch (err) {
    return Promise.reject(err);
  }
}

export function sendLLMRequest(payload: LLMRequest): Promise<MessageResponse> {
  const message: MessageToBackground = { type: 'LLM_REQUEST', payload };
  return send(message);
}

export function sendHealthCheck(payload: LLMSettings): Promise<MessageResponse> {
  const message: MessageToBackgroundHealthCheck = { type: 'HEALTH_CHECK', payload };
  return send(message);
}

export function sendPageSummarizeRequest(payload: PageSummarizeRequest): Promise<MessageResponse> {
  const message: MessageToBackgroundPageSummarize = { type: 'PAGE_SUMMARIZE', payload };
  return send(message);
}

/** Ask the worker to fetch the model list for an endpoint (resolves with ids in `data` as JSON). */
export async function sendListModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const message: MessageToBackgroundListModels = { type: 'LIST_MODELS', payload: { baseUrl, apiKey } };
  const response: MessageResponse = await send(message);
  if (!response.success) throw new Error(response.error ?? 'Could not load models.');
  return JSON.parse(response.data ?? '[]') as string[];
}

/** Open the settings page. Works from content scripts, where chrome.runtime.openOptionsPage is unavailable. */
export function sendOpenOptions(): Promise<MessageResponse> {
  const message: MessageToBackgroundOpenOptions = { type: 'OPEN_OPTIONS' };
  return send(message);
}

export function sendTtsSpeak(payload: { text: string; lang?: string }): Promise<MessageResponse> {
  const message: MessageToBackgroundTtsSpeak = { type: 'TTS_SPEAK', payload };
  return send(message);
}

export function sendTtsStop(): Promise<MessageResponse> {
  const message: MessageToBackgroundTtsStop = { type: 'TTS_STOP' };
  return send(message);
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
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: 'lingua-stream' });
  } catch (err) {
    onError(isExtensionAlive() ? (err instanceof Error ? err.message : String(err)) : STALE_CONTEXT_MESSAGE);
    return () => undefined;
  }

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
    onError(
      isExtensionAlive()
        ? (chrome.runtime.lastError?.message ?? 'Connection to the extension was lost. Please try again.')
        : STALE_CONTEXT_MESSAGE,
    );
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
