export type Action = 'translate_to_persian' | 'translate_to_english' | 'fix_grammar';

export interface LLMSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LLMRequest {
  text: string;
  action: Action;
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

export interface MessageResponse {
  success: boolean;
  data?: string;
  error?: string;
  responseTimeMs?: number;
}
