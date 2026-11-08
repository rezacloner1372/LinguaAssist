# Changelog

All notable changes to LinguaAssist are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **LLM profiles** — save several connections (endpoint, key, model) and switch between them in Settings. Existing settings migrate to a "Default" profile automatically.
- **Model dropdown** — "Fetch models" loads the model list from the endpoint's `/models` (OpenAI, Ollama, Groq, Together, …); you can still type any name.
- **Model per task** — route Translate, Explain, Grammar/rewrite, and Page summarize/chat to different profiles (e.g. a cheap model for translation, a stronger one for Explain).
- **Replace in place** — for selections inside inputs, textareas and rich-text editors, a **⤺ Replace** button writes the result over the selection (Fix Grammar, Formal, Casual, Draft Reply, Translate). It refuses to overwrite if the text changed in the meantime.
- **Stop / Regenerate** controls for text actions, manual translate, page summary and chat.
- **Dictionary mode** — translating a single word returns a dictionary-style entry (pronunciation, translations, meaning, examples, synonyms).
- **Right-click menu** (Translate, Explain, Summarize, Fix grammar, Formal, Casual, Draft reply) and an **Alt+Shift+L** shortcut (rebind at `chrome://extensions/shortcuts`).
- **Explain uses page context** — about 10 lines before and after the selection are sent to the model.
- **On-page UI controls** — hide the ✦ Page button, or disable the buttons per site (Settings, or the toolbar popup).

### Fixed

- Streaming no longer duplicates text after a mid-stream failure, cancelled requests are aborted, and a dropped connection shows an error instead of loading forever.
- Typing in the panel no longer triggers page keyboard shortcuts.
- Selections inside inputs/textareas are supported; the page extractor no longer drops "privacy"/"consent" classes or large forms.
- Reasoning models (o-series, GPT-5) now get `max_completion_tokens` and no custom temperature; Persian/Arabic token estimates are more accurate.

## [1.1.0] — 2026-08-31

### Added

- **Manual Translate tab** — type or paste a word, sentence, or paragraph and translate it without selecting page text; supports ⌘/Ctrl+Enter and automatic RTL/LTR input direction.
- **Draggable panel** — grab the panel header to move it anywhere on screen; position persists until the panel is closed and is clamped to the viewport.
- **Vocabulary manager** in Settings — review, search, and export saved translations as CSV.
- **TTS Listen buttons** on results, with automatic Persian/English voice selection and a settings toggle.
- Additional text actions: **Explain**, **Summarize**, **Formal**, **Casual**, **Draft Reply**.
- Streaming responses for all text actions (previously limited to page chat), with markdown rendering applied to the final text.
- Configurable translation pair (Language A/B), `maxContextTokens`, and `temperature`.

### Changed

- Rewrote the translation system prompt for natural, fluent output: native-expert phrasing, technical identifiers and product names kept in Latin script, and no transliteration of people's names.
- Settings and vocabulary moved to `chrome.storage.local` (with one-time migration from `sync`).

### Fixed

- Removed an accidentally duplicated Text Actions tab block that broke action buttons and rendered the section twice.
- 404s caused by base URLs missing the OpenAI-compatible `/v1` path are now documented in the README's Troubleshooting section.

## [1.0.x] — Page Intelligence

Introduced in [#3](https://github.com/rezacloner1372/LinguaAssist/pull/3):

- **Page Intel** tab with **Read Page**, **Summarize**, and **Chat with Page** (streaming with non-streaming fallback).
- Persistent **✦ Page** floating action button for opening page tools without a selection.
- Smart webpage extraction that skips navbars, sidebars, footers, ads, and popups.
- Shared token utilities for estimating size, chunking, and context-window truncation.
- Toolbar popup and options page.

## [1.0.0] — Initial release

- Floating panel with text selection actions: Translate → Persian, Translate → English, Fix Grammar.
- Works with any OpenAI-compatible endpoint (OpenAI, Ollama, Together.ai, Groq, …).
- Privacy-first design: requests only on explicit user action, key stored in extension storage.
