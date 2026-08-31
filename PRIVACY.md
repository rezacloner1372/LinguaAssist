# LinguaAssist Privacy Policy

_Last updated: 2026-09-01_

## Summary

LinguaAssist is a browser extension that translates, explains, rewrites, and summarizes text using a large language model (LLM) that **you configure yourself**. The extension has no servers, collects no analytics, and sends nothing anywhere unless you explicitly trigger an action.

## What we collect

**Nothing.** LinguaAssist does not collect, track, or transmit any personal data to the developer. There are no analytics, no telemetry, no advertising, and no third-party trackers.

## What data the extension processes, and where it goes

LinguaAssist sends data **only when you explicitly trigger an action**, and only to the LLM endpoint **you configured** in the extension settings:

| Data | When it is sent | Where it goes |
|------|-----------------|---------------|
| Text you select on a page | When you click an action (Translate, Explain, Summarize, etc.) | Your configured LLM endpoint |
| Text you type or paste into the Translate tab | When you click Translate or press ⌘/Ctrl+Enter | Your configured LLM endpoint |
| Webpage content | When you use Read Page, Summarize, or Chat with Page | Your configured LLM endpoint |
| LLM API key | Stored in `chrome.storage.local` on your device | Sent only to your configured endpoint for authentication |

The extension never sends data to LinguaAssist developers or any LinguaAssist-operated service.

## What is stored locally

All storage is in your browser's local extension storage (`chrome.storage.local`) on your device:

- **Settings** — your endpoint URL, model, API key, and preferences
- **Vocabulary** — translations you explicitly save; removable and exportable at any time
- **Per-tab session state** — panel content and cached page extraction, kept in memory and cleared when the tab closes

The API key is never synced to your Google account and never leaves your device except as an authentication header to your own LLM endpoint.

## Your LLM provider

Requests go directly from your browser to your chosen LLM provider. Once content is sent to that provider, it is processed under **that provider's** privacy policy. Please review the policy of your chosen provider (e.g. OpenAI, Ollama, Together.ai, Groq) to understand how they handle request data. If you run a local LLM (e.g. Ollama), content never leaves your machine.

## Permissions and why they are needed

| Permission | Reason |
|------------|--------|
| `storage` | Save your settings, API key, and saved vocabulary locally |
| `activeTab` / `scripting` | Show the assistant panel on the page you are viewing |
| `host_permissions` | The assistant works on any website, and your LLM endpoint can be any host you configure |
| `tts` | Read results aloud (Listen feature) |

## Changes to this policy

Material changes will be posted in this repository and reflected in the "Last updated" date.

## Contact

Open an issue at [github.com/rezacloner1372/LinguaAssist/issues](https://github.com/rezacloner1372/LinguaAssist/issues) for any privacy-related questions.
