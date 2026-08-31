# Contributing to LinguaAssist

Thanks for your interest in improving LinguaAssist! This document covers the development workflow and conventions.

## Getting started

```bash
git clone https://github.com/rezacloner1372/LinguaAssist.git
cd LinguaAssist
npm install
npm run dev    # watch build → dist/
```

Load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked). After every rebuild, refresh the extension card **and** reload any tabs where you test content scripts.

## Development commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Webpack watch mode; rebuilds on save |
| `npm run build` | Production build (minified) → `dist/` |
| `npm run type-check` | TypeScript check without emitting |

Run `npm run type-check` before opening a PR — CI and review will expect it clean.

## Code conventions

- **TypeScript everywhere**, strict mode; keep shared types in `src/shared/types.ts`.
- **One message shape per feature**: content scripts talk to the service worker only through the typed helpers in `src/shared/messages.ts` — never call `chrome.runtime.sendMessage` ad hoc from UI code.
- **Streaming first**: new text actions must go through `streamLLMRequest` (the `lingua-stream` port), not one-shot requests. Always disconnect in-flight streams on unmount.
- **Markdown only after DONE**: mid-stream content renders as `pre-wrap` text; call `renderMarkdown` only on the final result.
- **RTL is automatic**: direction comes from `isRTL()` in `src/shared/textDirection.ts` — never branch on action names or hardcode `dir` attributes.
- **Prompts return only the transform**: system prompts must instruct "Return ONLY the … no explanation" so results render cleanly.

## Adding a new text action

1. Extend the `Action` union in `src/shared/types.ts`.
2. Add a case to `getSystemPrompt` in `src/background/service-worker.ts`.
3. Add the button to `FloatingPanel.tsx` (keep labels short — grid buttons are ~160px wide).

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes: `feat:`, `fix:`, `docs:`, `refactor:`. Update `CHANGELOG.md` under an *Added / Changed / Fixed* structure for user-facing changes.

## Pull requests

1. Fork or branch off `main`.
2. Keep PRs focused — one feature or fix per PR.
3. Verify: `npm run type-check` clean, `npm run build` succeeds, and you exercised the change in Chrome with a configured LLM endpoint.
4. Describe what changed, why, and how you tested it.

## Reporting issues

Include: Chrome version, provider + base URL (redact the API key), the page/text involved, expected vs. actual behavior, and service-worker console output (extension card → *service worker* link) if applicable.
