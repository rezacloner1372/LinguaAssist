# Demo recorder

Records the README demo GIF, a full MP4 walkthrough, and 1280×800 store screenshots by driving the **real built extension** in Chromium.

```bash
npm run demo        # from the repo root
```

First run downloads Playwright's Chromium (~190 MB, cached afterwards). Output lands in `demo/out/` (git-ignored):

| File | Use |
|------|-----|
| `hero.gif` | README hero (~1.5 MB, ~25 s) — copy to `docs/media/demo.gif` |
| `demo.mp4` / `demo.webm` | Full ~50 s walkthrough — upload to YouTube (Chrome Web Store promo video) |
| `screenshots/*.png` | 1280×800 stills for the store listings — copy to `docs/media/` |

## How it works

- `mock-llm-server.mjs` is a tiny OpenAI-compatible server: no API key, no network, identical answers every run (including Persian). It also serves the demo article (`site.mjs`) and records what the extension sends.
- `record.mjs` launches Chromium with the extension loaded, points its settings at the fake AI, then plays five scenes with the real mouse and keyboard (Explain, Fix Grammar → Replace, Translate, Translate tab, Page Intel). A visible cursor, click ripples and captions are injected because headless recordings show none.
- It **asserts** as it goes — Explain must send the surrounding lines, Replace must write the corrected text into the textarea, Persian must render right-to-left — so it doubles as an end-to-end smoke test.
- `ffmpeg` (on your PATH) converts the recording. The GIF is cut from the MP4, sped up 1.25×, and palette-reduced to keep it small.

## Tuning

`HERO_WIDTH`, `HERO_FPS`, `HERO_COLORS`, `HERO_SPEED` environment variables change the GIF (e.g. `HERO_WIDTH=640 npm run demo` for a smaller file). Edit the wording in `fixtures.mjs`, the page in `site.mjs`, and the scenes in `record.mjs`.

To record by hand against the same fake AI: `npm run demo:mock`, then set Base URL to the printed address + `/v1`.

The demo tooling has its own `package.json` so it never touches the extension's build or lockfile.
