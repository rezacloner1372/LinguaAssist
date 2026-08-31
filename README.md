# LinguaAssist

> A bilingual Persian/English Chrome extension that translates selected text, reads webpages, summarizes them, and lets you chat with page content using your own LLM.

<img src="public/icons/demo-LinguaAssist.png" alt="LinguaAssist demo" width="420" />

<img src="public/icons/LinguaAssist.png" alt="LinguaAssist icon" width="310" />

<img src="public/icons/chat.png" alt="LinguaAssist icon" width="310" />

<img src="public/icons/summary.png" alt="LinguaAssist icon" width="310" />

---

## Table of Contents

- [Features](#features)
- [What’s New in Page Intelligence](#whats-new-in-page-intelligence)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Getting Started (Development)](#getting-started-development)
- [Building for Production](#building-for-production)
- [Loading the Extension in Chrome](#loading-the-extension-in-chrome)
- [Configuring Your LLM](#configuring-your-llm)
- [Using the Extension](#using-the-extension)
- [Project Structure](#project-structure)
- [Privacy](#privacy)

---

## Features

- 🔄 **Translate ⇄** — Auto-detects direction: Persian → English or English → Persian, with a prompt tuned for natural, native-quality output
- ⌨️ **Manual Translate** — Type or paste any word, sentence, or paragraph into the panel and translate it — no page selection needed
- 💡 **Explain** — Clear, concise explanations of selected text with key-term glosses
- 📋 **Summarize** — Condense selected text into 2–4 bullet points
- ✏️ **Fix Grammar / Formal / Casual / Draft Reply** — Editing and tone tools that keep the original language
- 📄 **Read Page** — Extract the main readable content from the current webpage
- 🧾 **Summarize Page** — Structured markdown summary with key points and action items when relevant
- 💬 **Chat with Page** — Ask follow-up questions about the current webpage with streaming responses
- 🖐 **Draggable panel** — Click and hold the header to move the panel anywhere; it stays where you drop it until you close it
- 🔊 **Listen (TTS)** — Hear any result read aloud, with automatic Persian/English voice selection
- 📚 **Vocabulary** — Save translations from the panel and review, search, or export them as CSV
- ↕️ **RTL-aware rendering** — Persian results automatically display right-to-left
- 🧠 **Page-aware context handling** — Estimates tokens, truncates oversized content, and reserves budget for chat history and replies
- 🚀 **Persistent page FAB** — Open page intelligence from any tab even when no text is selected
- ⚡ Works with any **OpenAI-compatible** API endpoint (OpenAI, Ollama, Together.ai, Groq, and more)
- 🔒 **Private by design** — content is sent only when you trigger an action; your API key stays in Chrome extension storage

---

## What’s New in Page Intelligence

PR [#3](https://github.com/rezacloner1372/LinguaAssist/pull/3) added a new **Page Intelligence** workflow to LinguaAssist.

It introduces:

- A new **Page Intel** tab in the floating panel
- A persistent **✦ Page** floating action button for opening page tools without selecting text
- Smart webpage extraction that skips common non-content areas like navbars, sidebars, footers, ads, popups, and similar noise
- **Structured page summaries** generated through your configured LLM
- **Chat with Page** with streaming responses and automatic fallback to non-streaming mode if needed
- Shared token utilities for estimating size, chunking large content, and truncating to fit context windows
- Configurable `maxContextTokens` and `temperature` support in the extension settings/backend request flow

---

## How It Works

### Text actions

1. You select text on any webpage.
2. A floating **✦ LinguaAssist** panel appears near your selection.
3. In the **Text Actions** tab, pick one of the actions:
   - **Translate ⇄** (auto-detects direction)
   - **Explain**
   - **Summarize**
   - **Fix Grammar**
   - **Formal** / **Casual** rewrites
   - **Draft Reply**
4. The extension streams the request to your configured LLM endpoint and the result appears progressively in the panel.
5. Copy the result, listen to it with 🔊, or save translations to your vocabulary with 📚.

### Manual translate

1. Open the panel (select text or click the **✦ Page** button) and switch to the **⌨️ Translate** tab.
2. Type or paste any word, sentence, or paragraph — the input box detects direction (RTL/LTR) automatically.
3. Click **🔄 Translate ⇄** (or press **⌘/Ctrl + Enter**). The result uses the same translation system and streaming format as the Text Actions tab.

### Page Intelligence

1. Click the persistent **✦ Page** button or open the panel and switch to **Page Intel**.
2. Click **Read Page** to extract the main content of the current webpage.
3. Choose one of the page actions:
   - **Summarize** to get a structured markdown summary
   - **Chat with Page** to ask questions about the page content
4. LinguaAssist sends the extracted page content to your configured LLM only when you explicitly use these actions.
5. Chat responses stream into the panel in real time when supported by your provider.

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| [Node.js](https://nodejs.org/) | 18+ |
| [npm](https://www.npmjs.com/) | 9+ |
| Google Chrome | 114+ (Manifest V3 support) |

An OpenAI-compatible LLM endpoint is also required (see [Configuring Your LLM](#configuring-your-llm)).

---

## Getting Started (Development)

```bash
# 1. Clone the repository
git clone https://github.com/rezacloner1372/LinguaAssist.git
cd LinguaAssist

# 2. Install dependencies
npm install

# 3. Start the development build (watch mode — rebuilds on every file save)
npm run dev
```

The compiled extension is written to the **`dist/`** folder.  
Leave the `npm run dev` terminal running while you develop — any saved change will automatically trigger a rebuild.

> **TypeScript type checking** (without emitting files):
> ```bash
> npm run type-check
> ```

---

## Building for Production

```bash
npm run build
```

This runs Webpack in production mode (minified output) and writes the final extension to **`dist/`**.

---

## Loading the Extension in Chrome

After building (`npm run dev` or `npm run build`), load the extension as an unpacked extension:

1. Open Chrome and navigate to **`chrome://extensions`**.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Select the **`dist/`** folder inside this repository.
5. The **✦ LinguaAssist** icon will appear in your Chrome toolbar.

> **After every rebuild in development**, click the 🔄 refresh icon on the extension card in `chrome://extensions` to pick up the latest changes. Content scripts on already-open tabs also need to be refreshed.

---

## Configuring Your LLM

Before using the extension you must point it at an LLM endpoint:

1. Click the **✦ LinguaAssist** toolbar icon.
2. Click **"⚙ Configure Settings"** (or right-click the icon → *Options*).
3. Fill in the required fields:

   | Field | Example |
   |-------|---------|
   | **Base URL** | `https://api.openai.com/v1` |
   | **Model** | `gpt-4o-mini` |
   | **API Key** | `sk-...` |

4. Save your settings.
5. Click **"⚡ Check Connection"** to verify the endpoint is reachable.

### Optional advanced behavior

- **`maxContextTokens`** — limits how much page content is included in summarize/chat requests
- **`temperature`** — controls generation randomness for supported providers
- **Language A / Language B** — the translation pair (defaults to Persian ⇄ English); translation auto-detects direction between them
- **TTS toggle** — show or hide 🔊 Listen buttons on results

If these values are not configured, LinguaAssist falls back to built-in defaults.

### Local LLM with Ollama

```
Base URL : http://localhost:11434/v1
Model    : llama3.2        (or any model you have pulled)
API Key  : ollama          (any non-empty string)
```

Start Ollama before using the extension:
```bash
ollama serve
```

### OpenAI

```
Base URL : https://api.openai.com/v1
Model    : gpt-4o-mini
API Key  : <your OpenAI API key>
```

---

## Using the Extension

### Text Actions

1. Navigate to any webpage.
2. **Select** a piece of text with your mouse.
3. A floating **✦ LinguaAssist** panel appears automatically.
4. Use the **Text Actions** tab to choose:
   - **Translate ⇄** (auto-detects Persian ⇄ English)
   - **Explain**
   - **Summarize**
   - **Fix Grammar**
   - **Formal** / **Casual**
   - **Draft Reply**
5. Wait for the streaming result to finish in the panel.
6. Click **"⎘ Copy Result"** to copy it, 🔊 to listen, or **📚 Save** (translations) to add it to your vocabulary.
7. Press **Esc** or click **×** to dismiss the panel.

### Moving the panel

- Click and hold the panel header and drag to move it anywhere on screen.
- The panel stays where you drop it until you close it; the next time it opens, it appears near your selection again.

### Manual Translate

1. Open the panel from the persistent **✦ Page** button or a text selection.
2. Switch to the **⌨️ Translate** tab.
3. Type or paste text (a word, sentence, or paragraph) and click **🔄 Translate ⇄** — or press **⌘/Ctrl + Enter**.
4. The translation streams in with the same result format, copy, and listen controls as Text Actions.

### Page Intelligence

1. Open any webpage.
2. Click the persistent **✦ Page** button in the bottom-right corner, or switch to the **Page Intel** tab from the selection panel.
3. Click **Read Page** to extract the page’s readable content.
4. Choose one of the following:
   - **Summarize** — produces a structured summary in markdown
   - **Chat with Page** — starts a conversational interface grounded in the extracted page content
5. For chat, type a question such as:
   - “What are the key takeaways?”
   - “Summarize section 2.”
   - “What action items are mentioned on this page?”
6. Use the built-in copy controls to copy summaries or assistant replies.

---

## Project Structure

```text
LinguaAssist/
├── public/
│   └── icons/                   # Icons and demo assets
├── src/
│   ├── background/
│   │   └── service-worker.ts    # LLM requests, page summarize, and streaming page chat
│   ├── content/
│   │   ├── content.tsx          # Content script, selection trigger, page FAB, page content cache
│   │   ├── FloatingPanel.tsx    # Floating panel: Text Actions, Manual Translate, Page Intel, chat, drag handling
│   │   ├── ChatView.tsx         # Chat bubble component with TTS support
│   │   ├── ListenButton.tsx     # 🔊 TTS listen button
│   │   ├── markdown.tsx         # Lightweight markdown renderer for results
│   │   ├── pageExtractor.ts     # Main-content extraction from webpages
│   │   └── tokenUtils.ts        # Token estimation, chunking, and truncation helpers
│   ├── popup/
│   │   ├── index.tsx            # Popup entry point
│   │   ├── index.html
│   │   └── Popup.tsx            # Toolbar popup UI
│   ├── settings/
│   │   ├── index.tsx            # Settings page entry point
│   │   ├── index.html
│   │   └── Settings.tsx         # LLM configuration UI
│   └── shared/
│       ├── messages.ts          # Chrome runtime message and streaming helpers
│       ├── storage.ts           # chrome.storage.local helpers (settings, vocabulary)
│       ├── textDirection.ts     # RTL detection and language-pair labels
│       ├── theme.ts             # Shared theme tokens
│       └── types.ts             # Shared TypeScript types for text and page workflows
├── manifest.json                # Chrome Extension Manifest V3
├── webpack.config.js            # Webpack build configuration
├── tsconfig.json                # TypeScript configuration
└── package.json
```

---

## Privacy

- Selected text, manual input, or page content is sent to your LLM **only** when you explicitly trigger a text or page action.
- Nothing is stored after a response, except vocabulary entries you save explicitly — those stay in local storage only.
- Your API key is stored in **Chrome extension storage** (`chrome.storage.local`) only.
- No data is collected or transmitted to LinguaAssist servers.
- All requests go **directly** from your browser to your configured LLM endpoint.
- Data handling during LLM processing depends on your provider, so review your LLM provider's privacy policy if needed.
