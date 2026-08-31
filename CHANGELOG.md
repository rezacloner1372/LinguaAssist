# Changelog

All notable changes to LinguaAssist are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

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
