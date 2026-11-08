<div align="center">

# ✦ LinguaAssist

**A bilingual Persian ⇄ English AI companion for the browser.**

Translate, explain, and rewrite selected text; summarize and chat with entire pages —
powered by your own OpenAI-compatible LLM endpoint.

[![Version](https://img.shields.io/badge/version-1.2.0-5C6BC0.svg)](https://github.com/rezacloner1372/LinguaAssist)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/develop)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Screenshots

| | |
|:---:|:---:|
| ![Text Actions — Translate](public/screenshots/text-actions.png) | ![Manual Translate tab](public/screenshots/translate-tab.png) |
| **Text Actions — Translate ⇄** | **Manual Translate tab** |
| ![Page Intelligence](public/screenshots/page-intel.png) | ![Casual rewrite](public/screenshots/casual.png) |
| **Page Intelligence — Read, Summarize, Chat** | **Casual rewrite** |
| ![Draft Reply](public/screenshots/draft-reply.png) | |
| **Draft Reply** | |

---

## Features

### Text tools (on any selection)

- 🔄 **Translate ⇄** — auto-detects direction between Persian and English, tuned for natural, native-quality output
- 📖 **Dictionary mode** — translate a single word and get pronunciation, translations, meaning, examples, and synonyms
- 💡 **Explain** — explains your selection *in context*, using about 10 lines of surrounding text
- 📋 **Summarize** — condenses the selection into 2–4 bullet points
- ✏️ **Fix Grammar / Formal / Casual / Draft Reply** — editing and tone tools that keep the original language
- ⤺ **Replace in place** — in inputs, textareas, and rich-text editors, write the result straight over your selection
- ■ **Stop / ↻ Regenerate** — cancel any response mid-stream, or run it again

### Manual translate

- ⌨️ Type or paste any word, sentence, or paragraph in the **Translate** tab — no selection needed — with automatic RTL/LTR detection and ⌘/Ctrl+Enter to submit

### Page intelligence

- 📄 **Read Page** — extracts the main readable content, skipping navbars, sidebars, footers, ads, and popups
- 🧾 **Summarize Page** — structured markdown summary with key points and action items
- 💬 **Chat with Page** — streaming Q&A grounded in the extracted content

### Everywhere

- 🖱 **Right-click menu and shortcut** — run an action from the context menu, or open the panel with **Alt+Shift+L**
- 🔌 **Profiles and per-task models** — save several endpoints, fetch their model lists, and route Translate, Explain, rewriting, and page tasks to different models
- 🚫 **Per-site control** — hide LinguaAssist on any site with one click; manage the list in Settings
- 🖐 **Draggable panel** — grab the header and move it anywhere; it stays put until closed
- 🔊 **Listen (TTS)** — results read aloud with automatic Persian/English voice selection
- 📚 **Vocabulary** — save translations; review, search, and export as CSV from Settings
- ↕️ **RTL-aware rendering** — Persian text displays correctly throughout
- 🧠 **Context-aware** — token estimation (including Persian/Arabic), chunking, and truncation respect your model's context window
- ⚡ **Provider-agnostic** — works with any OpenAI-compatible endpoint: OpenAI, Ollama, Together.ai, Groq, and more (including reasoning models)
- 🔒 **Private by design** — content leaves your browser only when you trigger an action, always going directly to your endpoint

---

## Installation

### From source (development)

**Prerequisites:** Node.js 18+, npm 9+, Google Chrome 114+.

```bash
git clone https://github.com/rezacloner1372/LinguaAssist.git
cd LinguaAssist
npm install
npm run build          # or: npm run dev  (watch mode)
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/` folder.

> After each rebuild during development, click the 🔄 refresh icon on the extension card, and reload any open tabs so content scripts update.

---

## Configuration

Click the **✦ LinguaAssist** toolbar icon → **⚙ Configure Settings** (or right-click → *Options*).

| Field | Example | Notes |
|-------|---------|-------|
| **Profile** | `Default`, `Local Ollama` | Each profile is one saved connection; **＋ New** adds another |
| **Base URL** | `https://api.openai.com/v1` | Must be the OpenAI-compatible root, including `/v1` |
| **Model** | `gpt-4o-mini` | Type any model your endpoint serves, or click **↻ Fetch models** to pick from the list |
| **API Key** | `sk-...` | Stored only in `chrome.storage.local` |

Click **⚡ Check Connection** to verify the endpoint before use. Existing single-endpoint settings are migrated to a **Default** profile automatically.

### Optional settings

| Setting | Default | Purpose |
|---------|---------|---------|
| Model per task | Active profile | Route Translate, Explain, Grammar/rewrite, and Page summarize/chat to different profiles |
| `maxContextTokens` | 8000 | Caps page content sent in summarize/chat requests |
| `temperature` | 0.1 (text) / 0.3 (chat) | Generation randomness (ignored for reasoning models such as o-series / GPT-5) |
| Language A / B | `fa` / `en` | Translation pair; direction auto-detected |
| TTS toggle | on | Show/hide 🔊 Listen buttons |
| Page button | on | Show/hide the floating ✦ Page button |
| Disabled sites | none | Sites where the on-page buttons are hidden |

### Provider examples

**OpenAI**

```text
Base URL : https://api.openai.com/v1
Model    : gpt-4o-mini
API Key  : <your OpenAI API key>
```

**Ollama (local)**

```text
Base URL : http://localhost:11434/v1
Model    : llama3.2        (or any pulled model)
API Key  : ollama          (any non-empty string)
```

Start Ollama first: `ollama serve`

---

## Usage

### Text actions

1. Select text on any webpage — click the **✦ LinguaAssist** button that appears, right-click and choose **LinguaAssist →** an action, or press **Alt+Shift+L**.
2. Pick an action: **Translate ⇄**, **Explain**, **Summarize**, **Fix Grammar**, **Formal**, **Casual**, or **Draft Reply**. Translating a single word returns a dictionary-style entry; **Explain** also reads the lines around your selection.
3. The result streams in progressively. Use **■ Stop** to cancel, **↻** to regenerate, **⎘ Copy Result** to copy, 🔊 to listen, or **📚 Save** to keep a translation.
4. Close with **Esc** or **×**.

The shortcut can be rebound at `chrome://extensions/shortcuts`.

### Replace in place

When the selection is inside an input, textarea, or rich-text editor (Gmail, Notion, …), results from Fix Grammar, Formal, Casual, Draft Reply, and Translate show a **⤺ Replace** button that writes the result over your selection. If the text was edited after you selected it, Replace refuses and you can use Copy instead. Explain, Summarize, and single-word dictionary results can't be replaced, and read-only or password fields never offer it.

### Manual translate

1. Open the panel (text selection or the persistent **✦ Page** button) and switch to the **⌨️ Translate** tab.
2. Type or paste text, then click **🔄 Translate ⇄** or press **⌘/Ctrl + Enter**.

### Page intelligence

1. Click the **✦ Page** button (bottom-right) or switch to the **Page Intel** tab.
2. Click **Read Page** to extract content.
3. **Summarize** for a structured summary, or **Chat with Page** to ask questions ("What are the key takeaways?", "Summarize section 2.").

### Profiles, models and per-task routing

In **Settings → LLM Configuration**, use **＋ New** to add more connections and the **Profile** dropdown to switch the default. **↻ Fetch models** lists the models available at the endpoint. Under **Model per task** you can send Translate, Explain, Grammar/rewrite, and Page summarize/chat to different profiles — for example a fast, cheap model for translation and a stronger one for Explain. Everything else uses the selected profile. Press **Save Settings** to apply.

### Hiding LinguaAssist on a site

Click **⊘ Hide here** in the panel header to turn LinguaAssist off on the current site; an **Undo** toast appears. Hidden sites are listed under **Settings → On-page UI → Disabled sites**, where you can remove them (✕) or add new ones — changes apply instantly. You can also tick **Hide buttons on this site** in the toolbar popup, or turn off the floating ✦ Page button entirely. The right-click menu and shortcut keep working on disabled sites.

### Moving the panel

Drag the panel header to reposition it anywhere on screen. It stays where you drop it until closed; the next open anchors near your selection again.

---

## Project Structure

```text
LinguaAssist/
├── public/
│   └── icons/                   # Icons and demo assets
├── src/
│   ├── background/
│   │   └── service-worker.ts    # LLM requests, streaming, model listing, TTS, context menu
│   ├── content/
│   │   ├── content.tsx          # Content script: selection capture, trigger, page FAB, per-site gating
│   │   ├── FloatingPanel.tsx    # Panel UI: tabs, drag handling, streaming results
│   │   ├── ChatView.tsx         # Chat bubble component (TTS support)
│   │   ├── ListenButton.tsx     # 🔊 TTS listen button
│   │   ├── markdown.tsx         # Lightweight markdown renderer
│   │   ├── pageExtractor.ts     # Main-content extraction
│   │   ├── replaceTarget.ts     # Write results back over editable selections
│   │   └── tokenUtils.ts        # Token estimation, chunking, truncation
│   ├── popup/                   # Toolbar popup
│   ├── settings/                # Options page (profiles, routing, sites, vocabulary)
│   └── shared/
│       ├── messages.ts          # Runtime message + streaming port helpers
│       ├── storage.ts           # chrome.storage.local (settings, profiles, sites, vocabulary)
│       ├── textDirection.ts     # RTL detection, language-pair labels
│       ├── theme.ts             # Shared theme tokens
│       └── types.ts             # Shared TypeScript types
├── manifest.json                # Chrome Extension Manifest V3
└── webpack.config.js            # Build configuration
```

## Architecture

LinguaAssist follows the standard Manifest V3 layout:

- **Content script** (`src/content/`) — selection detection, floating panel UI (React inside a shadow DOM root), page extraction.
- **Service worker** (`src/background/`) — all LLM traffic. Resolves the connection profile for each task, builds system prompts per action, calls `{baseUrl}/chat/completions`, parses SSE streams, and posts `CHUNK`/`DONE`/`ERROR` back over a long-lived port (`lingua-stream`). Cancelling the port aborts the request. It also owns the context menu, shortcut, TTS, and `/models` lookup.
- **Shared** (`src/shared/`) — typed message contracts, storage helpers (profiles, per-site settings), RTL utilities.

Streaming flows: `FloatingPanel` → `streamLLMRequest` (port) → service worker → provider; results render with a typewriter effect, and markdown is only applied to the final text.

---

## Development

```bash
npm run dev          # Webpack watch mode → dist/
npm run build        # Production build (minified)
npm run type-check   # TypeScript, no emit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, conventions, and PR process. Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

---

## Troubleshooting

| Symptom | Cause & Fix |
|---------|-------------|
| `404 Not Found` on requests | Base URL is wrong. It must be the OpenAI-compatible root **including `/v1`** — e.g. `https://api.example.com/v1`, not `https://api.example.com` or a `/anthropic` path (that's a different API). Compare with a working `curl` to `{baseUrl}/chat/completions`. |
| Buttons do nothing after code changes | Stale build — rerun `npm run build`, refresh the extension in `chrome://extensions`, and reload the tab. |
| Streaming errors mid-response | If streaming fails before any text arrives, the worker retries once without streaming; after partial output the error is shown instead, so text is never duplicated. Check the worker console (extension card → *service worker* link). |
| `max_tokens` / `temperature` rejected | Reasoning models (o-series, GPT-5) are detected by name and sent `max_completion_tokens` with no temperature. For other models with unusual rules, open an issue with the error. |
| ↻ Fetch models fails | The endpoint must serve `GET {baseUrl}/models`. Some gateways don't — type the model name by hand instead. |
| No ✦ buttons on a site | The site may be in **Settings → Disabled sites**, or the page button is turned off. The right-click menu and Alt+Shift+L still work there. |
| Alt+Shift+L does nothing | Another extension may own that shortcut — rebind it at `chrome://extensions/shortcuts`. |
| Gateway rejects health check | Some gateways reject extra params — the health check already sends a minimal body; verify your key and model name. |
| Persian text renders left-aligned | This is handled automatically via RTL detection; if you see it wrong, report an issue with the page and text. |

---

## Privacy

- Text, manual input, and page content are sent to your LLM **only** when you explicitly trigger an action — always directly from your browser to your endpoint. **Explain** also sends about 10 lines of text around your selection for context.
- Nothing is stored after a response, except vocabulary entries you save explicitly (local storage only).
- Your API keys stay in `chrome.storage.local` and are only sent to the endpoint of the profile they belong to; no data ever reaches LinguaAssist servers.
- See [PRIVACY.md](PRIVACY.md) for the full policy and the list of permissions.
- Review your provider's privacy policy for how they handle processed content.

---

## License

Released under the [MIT License](LICENSE).
