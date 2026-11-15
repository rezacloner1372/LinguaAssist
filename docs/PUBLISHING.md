# Publishing LinguaAssist

How to build, package, and submit LinguaAssist to the **Chrome Web Store** and **Firefox Add-ons (AMO)**, plus ready-to-paste listing text.

> Store dashboards change. Items marked **(verify)** are from memory or secondary sources — check them against the live dashboard. Everything else was checked against the official docs linked at the bottom.

## 1. What you ship

One command builds everything:

```bash
npm run package
```

| File (in `release/`) | Upload to |
|----------------------|-----------|
| `linguaassist-chrome-vX.Y.Z.zip` | Chrome Web Store — also accepted by Microsoft Edge Add-ons (verify) |
| `linguaassist-firefox-vX.Y.Z.zip` | addons.mozilla.org — the extension package |
| `linguaassist-source-vX.Y.Z.zip` | addons.mozilla.org — the **Source code** upload (required: the bundle is minified) |

`npm run package` builds both browsers, lints the Firefox build with `web-ext lint`, and refuses to run if `package.json` and `manifest.json` versions differ. The source zip comes from `git archive HEAD`, so **commit (and tag) before packaging** — it warns if there are uncommitted changes.

Operating systems do not matter: an extension package is the same file on Windows, macOS, Linux, and ChromeOS. Only the browser matters.

## 2. How the Chrome and Firefox builds differ

`manifest.json` is written for Chrome; `scripts/manifest.js` derives the Firefox manifest at build time.

| Area | Chrome | Firefox | How it is handled |
|------|--------|---------|-------------------|
| Background | `background.service_worker` | Not supported — uses `background.scripts` (event page) | Firefox manifest swaps the key |
| Text-to-speech | `chrome.tts` API + `tts` permission | No such API | `tts` permission dropped; code compiled out via `__BROWSER__`; Listen button uses the Web Speech API in the page |
| Add-on ID | Not needed | `browser_specific_settings.gecko.id` required and permanent | `linguaassist@rezacloner1372` — **never change it** |
| Data disclosure | Dashboard form | `data_collection_permissions` required for new AMO add-ons | `websiteContent` + `authenticationInfo` declared as required |
| Minimum version | Chrome 114+ | Firefox 140+ (first with the built-in data-consent prompt) | `strict_min_version` |
| Optional APIs | — | Some platforms lack `contextMenus`/`commands` | Feature-detected in the worker |

**Not supported yet:** Firefox for Android (selection UI relies on mouse events), Chrome on Android/iOS (no extensions), Safari (needs Xcode and an Apple Developer account).

Voices for Listen depend on the operating system; Persian voices are not installed everywhere.

## Developer identity for the stores

Use the same details everywhere so the listings match the repository:

- **Developer / author name:** Mohammadreza Saberi
- **Contact email** (typed into each dashboard; Chrome may show the developer contact on the listing **(verify)**): the one in the PRIVACY.md contact line
- **Website / homepage:** `https://github.com/rezacloner1372/LinguaAssist`
- **Support URL:** `https://github.com/rezacloner1372/LinguaAssist/issues`

The email deliberately does not appear in the manifests, the extension UI, or this file; only the name and GitHub link do.

## 3. Chrome Web Store

**Account:** register at the Chrome Web Store Developer Dashboard (a one-time fee, about $5 — confirm the amount during registration). A dedicated Google account for publishing is recommended.

**Steps:** *Add new item* → upload `linguaassist-chrome-vX.Y.Z.zip` → fill **Store listing**, **Privacy**, **Distribution** (and **Test instructions**) → *Submit for review*. After approval you must publish within 30 days.

### Store listing

- **Name:** LinguaAssist
- **Summary (≤132 chars):** Translate, explain, rewrite and summarize text on any page — Persian ⇄ English — with your own AI model. No account.
- **Category:** Productivity **(verify)**
- **Language:** English
- **Description:**

  > LinguaAssist is a bilingual Persian ⇄ English assistant that works on any web page, powered by the AI model **you** choose.
  >
  > Select text and get a natural translation, a context-aware explanation, a grammar fix, a formal or casual rewrite, a summary, or a drafted reply. Translate a single word and get a dictionary entry. In text boxes and editors, replace your selection with the result in one click. Summarize or chat with a whole page. Listen to results read aloud.
  >
  > Bring your own model: any OpenAI-compatible endpoint works (OpenAI, Ollama, Groq, Together.ai and more). Save several connections, fetch their model lists, and send different tasks to different models.
  >
  > Private by design: no account, no analytics, no LinguaAssist servers. Your text is sent only when you trigger an action, and only to the endpoint you configured. Your API key stays on your device.
  >
  > Features: Translate ⇄ • Explain with surrounding context • Fix grammar • Formal / casual rewrite • Draft reply • Dictionary mode • Replace in place • Page summary and chat • Right-click menu and Alt+Shift+L shortcut • Stop / Regenerate • Vocabulary list with CSV export • Per-site "Hide here" • Full right-to-left (Persian) support

- **Icon:** 128×128 PNG — `public/icons/icon128.png` (the store wants 96×96 artwork with 16 px transparent padding **(verify)**).
- **Screenshots (1280×800, at least 1, up to 5):** use the generated stills in `docs/media/`: `explain.png`, `fix-grammar-replace.png`, `translate-fa.png`, `manual-translate.png`, `page-intel.png`. Regenerate them any time with `npm run demo`. (The older `public/screenshots/*.png` predate Replace, Hide here, and profiles.)
- **Promo video (optional):** the store only takes static screenshots, but there is a separate field for a YouTube link **(verify)**. Upload `demo/out/demo.mp4` (~50 s, made by `npm run demo`) to YouTube and paste the link there. Put the same link in the README.
- **Small promo tile (440×280, optional) and marquee (1400×560, optional):** not created yet.

### Privacy tab

- **Single purpose:** Help users translate, explain, rewrite, and summarize web page text with an AI model of their choice.
- **Permission justifications:**
  - `storage` — saves the user's settings, connection profiles, API key, disabled-sites list and saved vocabulary on their device.
  - `tts` — reads results aloud with the browser's text-to-speech.
  - `contextMenus` — adds the right-click menu (Translate, Explain, …) for selected text.
  - Host permissions (`<all_urls>`) and the content script — the assistant must work on whatever page the user is reading, and requests go to an LLM endpoint at a host the user types in, which cannot be known in advance. The content script only shows a button; nothing is sent until the user triggers an action.
- **Remote code:** No. All code is bundled in the package.
- **Data usage (check these):** *Website content* (selected text and page content sent on user action) and *Authentication information* (the API key the user enters, sent only to their endpoint) **(verify names)**. Certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness.
- **Privacy policy URL:** `https://github.com/rezacloner1372/LinguaAssist/blob/main/PRIVACY.md`

### Test instructions for reviewers

> The extension needs an OpenAI-compatible endpoint. In Settings (toolbar icon → Configure Settings) enter a Base URL, Model, and API key, then click Check Connection. Then select any text on a web page and click the ✦ LinguaAssist button. **Provide a working temporary key or a free endpoint here.**

Expect extra review attention for the broad host permission; the justification above is what to point to.

## 4. Firefox Add-ons (AMO)

**Account:** free Firefox Account at addons.mozilla.org → Developer Hub.

**Steps:** *Submit a New Add-on* → *On this site* (listed) → upload `linguaassist-firefox-vX.Y.Z.zip` → when asked whether the code is minified/bundled, answer **Yes** and upload `linguaassist-source-vX.Y.Z.zip` → paste the reviewer notes below → fill the listing → submit. Firefox shows the declared data-collection types (website content, authentication information) in the install prompt.

### Listing

- **Name:** LinguaAssist
- **Summary (≤250 chars):** Bilingual Persian ⇄ English assistant. Translate, explain, rewrite and summarize selected text or whole pages using your own OpenAI-compatible AI model. No account, no tracking — your text goes only to the endpoint you configure.
- **Description:** same as the Chrome description above.
- **Categories:** Language Support, Productivity **(verify)**
- **License:** MIT · **Privacy policy:** the PRIVACY.md URL above · **Support:** `https://github.com/rezacloner1372/LinguaAssist/issues`
- **Screenshots:** the same five PNGs from `docs/media/`. Add the YouTube link to the description if links are allowed **(verify)** — the listing itself takes images only.

### Notes to reviewers (paste into the version page)

> **Build:** the source package reproduces the submitted extension byte for byte.
> Environment: any OS; Node.js 24 and npm 11 (the AMO default); no other tools.
> ```
> npm ci
> npm run build-for-amo      # webpack production build → dist/firefox/
> ```
> The built `dist/firefox/` matches the uploaded package (verified by hashing all files).
>
> **Lint notes:** the `UNSAFE_VAR_ASSIGNMENT` (innerHTML) warnings come from React DOM's own code in the bundle, not from this extension. The Android min-version warning is intentional: Android is not claimed as supported.
>
> **Network:** the extension makes requests only to the OpenAI-compatible endpoint the user configures (`/chat/completions` and `/models`), triggered by user action. No telemetry.
>
> **Testing:** configure any OpenAI-compatible endpoint under the add-on's options page, then select text on a page and click the ✦ LinguaAssist button. **Provide a working temporary key or free endpoint here.**

The add-on ID is already in the manifest — AMO checks that it is unique on first upload.

## 5. Releasing a new version

1. Bump the version in `manifest.json`, `package.json`, and `package-lock.json`; move the CHANGELOG "Unreleased" notes under the new version; update README/PRIVACY if behaviour or permissions changed.
2. Commit, then tag: `git tag -a vX.Y.Z -m "LinguaAssist vX.Y.Z"` and push both.
3. `npm run package`.
4. GitHub release: `gh release create vX.Y.Z release/linguaassist-chrome-vX.Y.Z.zip release/linguaassist-firefox-vX.Y.Z.zip --notes-file <notes>`.
5. Chrome Web Store: Package → *Upload new package* → submit.
6. AMO: the add-on's *Upload New Version* → firefox zip + source zip + reviewer notes.

Permissions are the main cause of slow reviews: any new permission re-triggers review and a user-facing "permissions changed" warning, so avoid adding them in routine releases.

## 6. Test before submitting

```bash
npm run start:firefox      # opens Firefox with the extension loaded
npm run lint:firefox       # Mozilla's linter (0 errors expected)
```

Smoke test in **both** browsers: configure an endpoint → select text → Translate, Explain, Fix Grammar → Replace inside a textarea → Page Intel summarize → right-click menu → Alt+Shift+L → Listen → "Hide here" and Undo. In Firefox also confirm Listen speaks (Web Speech) and that the options page opens from the popup.

## Sources

- [MDN — `background` manifest key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) (Firefox: no `service_worker`, use `scripts`)
- [MDN — `browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) (gecko ID, `data_collection_permissions`)
- [Extension Workshop — data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Extension Workshop — source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Chrome — publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Chrome — listing image sizes](https://developer.chrome.com/docs/webstore/images)
