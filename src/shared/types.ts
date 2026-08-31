export type Action =
  | 'translate'
  | 'explain'
  | 'summarize_selection'
  | 'rewrite_formal'
  | 'rewrite_casual'
  | 'reply_draft'
  // Legacy aliases — still accepted by the service worker
  | 'translate_to_persian'
  | 'translate_to_english'
  | 'fix_grammar';

export interface LLMSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxContextTokens?: number;
  temperature?: number;
  /** Primary language of the translate pair (default 'fa' — Persian) */
  targetLangA?: string;
  /** Secondary language of the translate pair (default 'en') */
  targetLangB?: string;
  /** Show 🔊 Listen buttons on results (default true) */
  ttsEnabled?: boolean;
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

export interface VocabEntry {
  id: string;
  source: string;
  translation: string;
  pageUrl: string;
  savedAt: number;
  /** e.g. 'en→fa' */
  langPair: string;
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

export interface TtsSpeakRequest {
  text: string;
  lang?: string;
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

export interface MessageToBackgroundTtsSpeak {
  type: 'TTS_SPEAK';
  payload: TtsSpeakRequest;
}

export interface MessageToBackgroundTtsStop {
  type: 'TTS_STOP';
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

// Requests sent over the 'lingua-stream' port
export interface StreamTextActionRequest {
  type: 'TEXT_ACTION_STREAM';
  payload: LLMRequest;
}

export interface StreamPageSummarizeRequest {
  type: 'PAGE_SUMMARIZE_STREAM';
  payload: PageSummarizeRequest;
}

export interface StreamPageChatRequest {
  type: 'PAGE_CHAT';
  payload: PageChatRequest;
}

export type StreamRequest =
  | StreamTextActionRequest
  | StreamPageSummarizeRequest
  | StreamPageChatRequest;

/** Per-tab persisted panel state (module-level in content.tsx, dies with the tab) */
export interface PanelState {
  selectedText: string;
  activeView: 'text' | 'page';
  textResult: string;
  activeTextAction: Action | null;
  summary: string;
  chatMessages: ChatMessage[];
}
