import { PAGE_TITLE, EXPLAIN_SENTENCE, TRANSLATE_SENTENCE } from './fixtures.mjs';

/** The article the demo runs on — original text, styled like a normal blog post. */
export function renderSite() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${PAGE_TITLE}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 19px/1.7 Georgia, 'Times New Roman', serif; color: #1f2430; background: #fbfaf7; }
  header { background: #1f2a44; color: #fff; padding: 14px 0; font: 600 15px -apple-system, 'Segoe UI', sans-serif; letter-spacing: .03em; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 28px; }
  h1 { font: 800 40px/1.15 -apple-system, 'Segoe UI', sans-serif; margin: 40px 0 8px; }
  .meta { color: #7a8091; font: 14px -apple-system, 'Segoe UI', sans-serif; margin-bottom: 28px; }
  h2 { font: 700 24px -apple-system, 'Segoe UI', sans-serif; margin: 38px 0 6px; }
  p { margin: 0 0 18px; }
  label { display: block; font: 600 14px -apple-system, 'Segoe UI', sans-serif; margin: 6px 0; color: #4a5163; }
  textarea { width: 100%; box-sizing: border-box; font: 17px/1.5 -apple-system, 'Segoe UI', sans-serif; padding: 12px 14px;
             border: 1.5px solid #c9cdd8; border-radius: 10px; background: #fff; resize: none; }
  .gap { height: 420px; }
</style></head>
<body>
<header><div class="wrap">PLATFORM WEEKLY</div></header>
<div class="wrap">
  <h1>${PAGE_TITLE}</h1>
  <div class="meta">November 15, 2026 · 4-minute read · Infrastructure</div>

  <p>A decade ago, running servers was a craft. Engineers gave each machine a name, logged in by hand, and nursed it back to health whenever it misbehaved. When one of them finally died, it felt like losing a colleague, and the replacement could take days to rebuild from memory.</p>
  <p>That approach worked while there were ten servers. It collapsed at a few hundred. Every machine had quietly become different, and nobody could say exactly how. <span id="s-explain">${EXPLAIN_SENTENCE}</span> It is created from code, checked, and thrown away the moment something looks wrong.</p>
  <p>The shift also changed how teams plan their work. Repairs became rebuilds, and rebuilds became routine, so the fear of touching production slowly faded away.</p>

  <h2>What changed in practice</h2>
  <p>Configuration now lives in version control. A change is a pull request, a review, and an automated rollout, rather than a late-night login. <span id="s-translate">${TRANSLATE_SENTENCE}</span></p>
  <p>None of this removes the need for judgement. It simply moves the judgement from repairing machines to designing the system that replaces them.</p>

  <h2>Send your feedback</h2>
  <label for="compose">Write a quick note to the editors</label>
  <textarea id="compose" rows="3" placeholder="Type here…"></textarea>
  <div class="gap"></div>
</div>
</body></html>`;
}
