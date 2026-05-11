export type Action = 'translate_to_persian' | 'translate_to_english' | 'fix_grammar';

export interface LLMSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxContextTokens?: number;
  temperature?: number;
}

export interface PageContent {
  title: string;
  content: string;
  wordCount: number;
  estimatedTokens: number;
  url: string;
  extractedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface LLMRequest {
  text: string;
  action: Action;
}

export interface PageSummarizeRequest {
  pageContent: PageContent;
}

export interface PageChatRequest {
  pageContent: PageContent;
  conversationHistory: ChatMessage[];
  userMessage: string;
}

export interface LLMResponse {
  result: string;
  error?: string;
}

export type HealthStatus = 'idle' | 'checking' | 'healthy' | 'unhealthy';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTimeMs?: number;
  error?: string;
}

export interface MessageToBackground {
  type: 'LLM_REQUEST';
  payload: LLMRequest;
}

export interface MessageToBackgroundHealthCheck {
  type: 'HEALTH_CHECK';
  payload: LLMSettings;
}

export interface MessageToBackgroundPageSummarize {
  type: 'PAGE_SUMMARIZE';
  payload: PageSummarizeRequest;
}

export interface MessageToBackgroundPageChat {
  type: 'PAGE_CHAT';
  payload: PageChatRequest;
}

export interface MessageResponse {
  success: boolean;
  data?: string;
  error?: string;
  responseTimeMs?: number;
}

// Port-based streaming message shapes
export interface StreamChunk {
  type: 'CHUNK';
  content: string;
}

export interface StreamDone {
  type: 'DONE';
}

export interface StreamError {
  type: 'ERROR';
  error: string;
}

export type StreamMessage = StreamChunk | StreamDone | StreamError;
