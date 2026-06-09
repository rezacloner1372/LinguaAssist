import { getSettings } from '../shared/storage';
import type { MessageToBackground, MessageToBackgroundHealthCheck, MessageResponse, LLMSettings } from '../shared/types';

type IncomingMessage = MessageToBackground | MessageToBackgroundHealthCheck;

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

interface CallLLMOptions {
    systemPrompt: string;
    userText: string;
    /** Set to false for health checks to send the absolute minimal payload */
    includeOptionalParams?: boolean;
}

async function callLLM(settings: LLMSettings, options: CallLLMOptions): Promise<string> {
    const { systemPrompt, userText, includeOptionalParams = true } = options;

    const url = settings.baseUrl.replace(/\/$/, '') + '/chat/completions';

    // Build minimal body — only add optional params for real LLM calls, not health checks
    // This matches the exact curl that your gateway accepts
    const body: Record<string, unknown> = {
        model: settings.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
        ],
    };

    if (includeOptionalParams) {
        body.temperature = 0.1;  // Use float, not integer 0 — some gateways reject integer 0
        body.max_tokens = 2048;
    }

    // Only send Authorization header when API key is non-empty
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (settings.apiKey && settings.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
    }
);
