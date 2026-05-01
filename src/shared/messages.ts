import type { MessageToBackground, MessageToBackgroundHealthCheck, MessageResponse, LLMRequest, LLMSettings } from './types';

export function sendLLMRequest(payload: LLMRequest): Promise<MessageResponse> {
  const message: MessageToBackground = { type: 'LLM_REQUEST', payload };
  return chrome.runtime.sendMessage(message);
}

export function sendHealthCheck(payload: LLMSettings): Promise<MessageResponse> {
  const message: MessageToBackgroundHealthCheck = { type: 'HEALTH_CHECK', payload };
  return chrome.runtime.sendMessage(message);
}
