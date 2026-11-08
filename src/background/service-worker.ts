import { getSettings } from '../shared/storage';
import { detectLangTag } from '../shared/textDirection';
import type {
    MessageToBackground,
    MessageToBackgroundHealthCheck,
    MessageToBackgroundPageSummarize,
    MessageToBackgroundTtsSpeak,
    MessageToBackgroundTtsStop,
    MessageResponse,
    LLMSettings,
    PageChatRequest,
    ChatMessage,
    LLMRequest,
    PageSummarizeRequest,
    StreamRequest,
} from '../shared/types';
import { truncateToTokens, estimateTokens } from '../content/tokenUtils';

type IncomingMessage =
    | MessageToBackground
    | MessageToBackgroundHealthCheck
    | MessageToBackgroundPageSummarize
    | MessageToBackgroundTtsSpeak
    | MessageToBackgroundTtsStop;

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;
const SUMMARY_MAX_TOKENS = 1500;
const CHAT_REPLY_MAX_TOKENS = 1000;
// Token budget reserved for system prompt metadata (title, URL, instruction overhead)
const SYSTEM_PROMPT_OVERHEAD_TOKENS = 200;
// chrome.tts has a small per-utterance buffer; long Persian text must be chunked
const TTS_CHUNK_CHARS = 200;

function getSystemPrompt(action: string, settings?: LLMSettings): string {
    const langA = settings?.targetLangA ?? 'fa';
    const langB = settings?.targetLangB ?? 'en';
    const nameA = langA === 'fa' ? 'Persian (Farsi)' : langA;
    const nameB = langB === 'en' ? 'English' : langB;

    switch (action) {
        case 'translate':
        case 'translate_to_persian':
        case 'translate_to_english':
            return `You are an expert professional translator between ${nameA} and ${nameB}. If the input is primarily ${nameA}, translate it to ${nameB}; otherwise translate it to ${nameA}.

Rules:
- Produce a NATURAL, fluent translation as a native expert would write it — never word-for-word or literal. Restructure sentences freely when the target language demands it.
- Use the standard technical terminology of the field as native-speaking professionals actually use it. Keep code identifiers, API/field names (e.g. podResources, feature gate), and product names in their original Latin form when that is the prevailing convention.
- Keep proper names of people in their original script; do not transliterate them.
- Preserve meaning, tone, register, markdown formatting, and list structure.
- Keep numbers, versions, and code identifiers exactly as given.

Return ONLY the translated text with no explanation or commentary.`;
        case 'fix_grammar':
            return 'You are a professional editor. Fix the grammar, spelling, punctuation, and clarity of the following text. Keep the original language. Return ONLY the corrected text with no explanation or commentary.';
        case 'explain':
            return `You are a patient language tutor. Explain the following text clearly and concisely. If the text is in Persian, explain in Persian and gloss key terms in English; otherwise explain in English. Use short markdown (a brief paragraph plus a few bullets at most). Return ONLY the explanation.`;
        case 'summarize_selection':
            return 'You are an expert summarizer. Summarize the following text in 2–4 concise bullet points, in the same language as the input. Return ONLY the summary.';
        case 'rewrite_formal':
            return 'You are a professional editor. Rewrite the following text in a formal, polished register, keeping the original language and meaning. Return ONLY the rewritten text.';
        case 'rewrite_casual':
            return 'You are a professional editor. Rewrite the following text in a casual, friendly register, keeping the original language and meaning. Return ONLY the rewritten text.';
        case 'reply_draft':
            return 'You are an assistant drafting a reply. Write a short, natural reply to the following message, in the same language as the input. Return ONLY the reply text.';
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

/** Build authorization headers — only include the header when an API key is configured. */
function buildAuthHeaders(settings: LLMSettings): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.apiKey && settings.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }
    return headers;
}

/** Reasoning models (o-series, GPT-5) reject `max_tokens` and custom `temperature`. */
function isReasoningModel(model: string): boolean {
    return /^(o\d|gpt-5)/i.test(model.trim());
}

function chatUrl(settings: LLMSettings): string {
    return settings.baseUrl.replace(/\/$/, '') + '/chat/completions';
}

interface ChatBodyOptions {
    messages: { role: string; content: string }[];
    /** Omit to send the absolute minimal payload (health checks) */
    maxTokens?: number;
    defaultTemperature?: number;
    stream?: boolean;
}

function buildChatBody(settings: LLMSettings, opts: ChatBodyOptions): string {
    const body: Record<string, unknown> = { model: settings.model, messages: opts.messages };
    if (opts.maxTokens !== undefined) {
        if (isReasoningModel(settings.model)) {
            body.max_completion_tokens = opts.maxTokens;
        } else {
            // Float, not integer 0 — some gateways reject integer 0
            body.temperature = settings.temperature ?? opts.defaultTemperature ?? 0.3;
            body.max_tokens = opts.maxTokens;
        }
    }
    if (opts.stream) body.stream = true;
    return JSON.stringify(body);
}

async function throwIfNotOk(response: Response): Promise<void> {
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
}

interface CallLLMOptions {
    systemPrompt: string;
    userText: string;
    /** Set to false for health checks to send the absolute minimal payload */
    includeOptionalParams?: boolean;
    maxTokens?: number;
}

async function callLLM(settings: LLMSettings, options: CallLLMOptions): Promise<string> {
    const { systemPrompt, userText, includeOptionalParams = true, maxTokens } = options;
    return callLLMWithHistory(
        settings,
        systemPrompt,
        [],
        userText,
        includeOptionalParams ? (maxTokens ?? 2048) : null,
        0.1,
    );
}

async function callLLMWithHistory(
    settings: LLMSettings,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    maxTokens: number | null = 1000, // null = minimal payload (health check)
    defaultTemperature = 0.3,
): Promise<string> {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
    ];

    const response = await fetch(chatUrl(settings), {
        method: 'POST',
        headers: buildAuthHeaders(settings),
        body: buildChatBody(settings, { messages, maxTokens: maxTokens ?? undefined, defaultTemperature }),
    });
    await throwIfNotOk(response);

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from LLM');
    return content.trim();
}

/** Parse one SSE line; returns the content delta, or null if there is none. */
function parseSseLine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') return null;
    try {
        return JSON.parse(jsonStr)?.choices?.[0]?.delta?.content || null;
    } catch {
        return null; // malformed SSE line — skip
    }
}

/**
 * Stream an LLM completion over a port. Aborts the HTTP request when the
 * panel disconnects, and only falls back to a non-streaming call when no
 * chunk has been delivered yet (a fallback after partial output would
 * duplicate text in the UI).
 */
async function streamWithFallback(
    port: chrome.runtime.Port,
    settings: LLMSettings,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    maxTokens: number,
): Promise<void> {
    const controller = new AbortController();
    let connected = true;
    port.onDisconnect.addListener(() => {
        connected = false;
        controller.abort();
    });
    const send = (msg: unknown) => {
        if (!connected) return;
        try {
            port.postMessage(msg);
        } catch {
            connected = false;
        }
    };

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
    ];
    let chunksSent = 0;

    try {
        const response = await fetch(chatUrl(settings), {
            method: 'POST',
            headers: buildAuthHeaders(settings),
            body: buildChatBody(settings, { messages, maxTokens, stream: true }),
            signal: controller.signal,
        });
        await throwIfNotOk(response);
        if (!response.body) throw new Error('No response body for streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const emit = (line: string) => {
            const chunk = parseSseLine(line);
            if (chunk) {
                chunksSent++;
                send({ type: 'CHUNK', content: chunk });
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            lines.forEach(emit);
        }
        if (buffer) emit(buffer); // flush a final line with no trailing newline

        send({ type: 'DONE' });
    } catch (err: unknown) {
        if (!connected) return; // user cancelled — nothing to report or retry

        if (chunksSent > 0) {
            // Partial output already shown; surface the error rather than duplicating text
            send({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
            return;
        }
        try {
            const result = await callLLMWithHistory(settings, systemPrompt, history, userMessage, maxTokens);
            send({ type: 'CHUNK', content: result });
            send({ type: 'DONE' });
        } catch (fallbackErr: unknown) {
            send({ type: 'ERROR', error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) });
        }
    }
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

/** Split text into <=TTS_CHUNK_CHARS chunks on sentence boundaries (incl. Persian ؟). */
function chunkForTts(text: string): string[] {
    if (text.length <= TTS_CHUNK_CHARS) return [text];
    const sentences = text.split(/(?<=[.!?؟])\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length <= TTS_CHUNK_CHARS) {
            current = current ? `${current} ${sentence}` : sentence;
        } else {
            if (current) chunks.push(current);
            // Single sentence longer than the limit: hard-split
            if (sentence.length > TTS_CHUNK_CHARS) {
                for (let i = 0; i < sentence.length; i += TTS_CHUNK_CHARS) {
                    chunks.push(sentence.slice(i, i + TTS_CHUNK_CHARS));
                }
                current = '';
            } else {
                current = sentence;
            }
        }
    }
    if (current) chunks.push(current);
    return chunks.filter(Boolean);
}

function speakText(text: string, lang?: string): void {
    chrome.tts.stop();
    const chunks = chunkForTts(text);
    const langTag = lang ?? detectLangTag(text);
    chunks.forEach((chunk, i) => {
        chrome.tts.speak(chunk, {
            lang: langTag,
            enqueue: i > 0,
            onEvent: (event) => {
                if (event.type === 'error') {
                    console.warn('[LinguaAssist] TTS error:', event.errorMessage);
                }
            },
        });
    });
}

// ─── Standard request/response messages ──────────────────────────────────────

chrome.runtime.onMessage.addListener(
    (message: IncomingMessage, _sender, sendResponse: (response: MessageResponse) => void) => {

        if (message.type === 'LLM_REQUEST') {
            const { text, action } = message.payload;
            getSettings().then((settings) => {
                if (!settings.baseUrl || !settings.model) {
                    sendResponse({ success: false, error: 'LLM not configured. Please open Settings.' });
                    return;
                }
                const systemPrompt = getSystemPrompt(action, settings);
                callLLM(settings, { systemPrompt, userText: text, includeOptionalParams: true })
                    .then((result) => sendResponse({ success: true, data: result }))
                    .catch((err) => sendResponse({ success: false, error: err.message }));
            });
            return true;
        }

        if (message.type === 'HEALTH_CHECK') {
            const settings = message.payload;
            const start = Date.now();
            callLLM(settings, {
                systemPrompt: 'You are a helpful assistant.',
                userText: 'Hello!',
                includeOptionalParams: false,
            })
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
                callLLM(settings, {
                    systemPrompt: getSummarizeSystemPrompt(),
                    userText: `Title: ${pageContent.title}\n\n${truncated}`,
                    includeOptionalParams: true,
                    maxTokens: SUMMARY_MAX_TOKENS,
                })
                    .then((result) => sendResponse({ success: true, data: result }))
                    .catch((err) => sendResponse({ success: false, error: err.message }));
            });
            return true;
        }

        if (message.type === 'TTS_SPEAK') {
            try {
                speakText(message.payload.text, message.payload.lang);
                sendResponse({ success: true });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                sendResponse({ success: false, error: msg });
            }
            return false;
        }

        if (message.type === 'TTS_STOP') {
            chrome.tts.stop();
            sendResponse({ success: true });
            return false;
        }
    },
);

// ─── Streaming port ──────────────────────────────────────────────────────────

async function handleTextActionStream(payload: LLMRequest, port: chrome.runtime.Port): Promise<void> {
    const settings = await getSettings();
    if (!settings.baseUrl || !settings.model) {
        port.postMessage({ type: 'ERROR', error: 'LLM not configured. Please open Settings.' });
        return;
    }
    await streamWithFallback(port, settings, getSystemPrompt(payload.action, settings), [], payload.text, 2048);
}

async function handlePageSummarizeStream(payload: PageSummarizeRequest, port: chrome.runtime.Port): Promise<void> {
    const settings = await getSettings();
    if (!settings.baseUrl || !settings.model) {
        port.postMessage({ type: 'ERROR', error: 'LLM not configured. Please open Settings.' });
        return;
    }
    const maxContext = settings.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    const truncated = truncateToTokens(payload.pageContent.content, maxContext - 500);
    const userText = `Title: ${payload.pageContent.title}\n\n${truncated}`;
    await streamWithFallback(port, settings, getSummarizeSystemPrompt(), [], userText, SUMMARY_MAX_TOKENS);
}

async function handlePageChatStream(payload: PageChatRequest, port: chrome.runtime.Port): Promise<void> {
    const { pageContent, conversationHistory, userMessage } = payload;

    const settings = await getSettings();
    if (!settings.baseUrl || !settings.model) {
        port.postMessage({ type: 'ERROR', error: 'LLM not configured. Please open Settings.' });
        return;
    }

    const maxContext = settings.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    // Reserve tokens for conversation history and the reply
    const historyTokens = conversationHistory.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const contentBudget = Math.max(1000, maxContext - historyTokens - CHAT_REPLY_MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD_TOKENS);

    const systemPrompt = buildChatSystemPrompt(pageContent.title, pageContent.url, pageContent.content, contentBudget);
    await streamWithFallback(port, settings, systemPrompt, conversationHistory, userMessage, CHAT_REPLY_MAX_TOKENS);
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'lingua-stream') return;

    port.onMessage.addListener((msg: StreamRequest) => {
        if (msg.type === 'TEXT_ACTION_STREAM') {
            void handleTextActionStream(msg.payload, port);
        } else if (msg.type === 'PAGE_SUMMARIZE_STREAM') {
            void handlePageSummarizeStream(msg.payload, port);
        } else if (msg.type === 'PAGE_CHAT') {
            void handlePageChatStream(msg.payload, port);
        }
    });
});
