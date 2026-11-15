/**
 * Records the README demo and the store screenshots by driving the REAL built
 * extension in Chromium against a fake local AI (no API key, same output each run).
 *
 *   npm run demo        (from the repo root)
 *
 * Output goes to demo/out/:
 *   hero.gif          short looping demo for the README
 *   demo.mp4 / .webm  full walkthrough (YouTube / GitHub upload)
 *   screenshots/*.png 1280×800 stills for the store listings
 *
 * The script also ASSERTS on what happened (context sent to Explain, text
 * replaced in the textarea, Persian rendered right-to-left), so it doubles as
 * an end-to-end smoke test of the extension.
 */
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startMockServer } from './mock-llm-server.mjs';
import * as F from './fixtures.mjs';

const here = import.meta.dirname;
const root = path.resolve(here, '..');
const extDir = path.join(root, 'dist', 'chrome');
const out = path.join(here, 'out');
const shots = path.join(out, 'screenshots');
// README hero GIF: speed-up and size knobs (override with HERO_* env vars)
const HERO = {
  fps: Number(process.env.HERO_FPS ?? 8),
  width: Number(process.env.HERO_WIDTH ?? 800),
  colors: Number(process.env.HERO_COLORS ?? 48),
  speed: Number(process.env.HERO_SPEED ?? 1.25),
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. Build the current code ────────────────────────────────────────────────
console.log('▶ Building the extension (Chrome)…');
const build = spawnSync('npm', ['run', 'build:chrome'], { cwd: root, stdio: 'ignore', shell: true });
if (build.status !== 0) throw new Error('Build failed — run `npm run build:chrome` to see why.');

rmSync(out, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });

// ── 2. Fake AI + browser ─────────────────────────────────────────────────────
const mock = await startMockServer();
console.log(`▶ Fake AI + demo page at ${mock.origin}`);

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'lingua-demo-')), {
  channel: 'chromium', // full Chromium (new headless) — supports extensions
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  recordVideo: { dir: path.join(out, 'raw'), size: { width: 1280, height: 800 } },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});

// Visible cursor + click ripple + caption bar (headless recordings show none of these)
await ctx.addInitScript(() => {
  if (window.top !== window) return;
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes demoRipple { from { transform: scale(.3); opacity: .7 } to { transform: scale(1.6); opacity: 0 } }
      #demo-caption { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 2147483647;
        pointer-events: none; background: rgba(20,24,40,.9); color: #fff; padding: 10px 20px; border-radius: 999px;
        font: 600 18px -apple-system, 'Segoe UI', sans-serif; transition: opacity .25s; opacity: 0; white-space: nowrap; }`;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))';
    cursor.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 2l17 8-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);

    const cap = document.createElement('div');
    cap.id = 'demo-caption';
    document.body.appendChild(cap);
    window.__caption = (text) => {
      cap.style.opacity = text ? '1' : '0';
      if (text) cap.textContent = text;
    };

    document.addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, true);
    document.addEventListener('mousedown', (e) => {
      const ring = document.createElement('div');
      ring.style.cssText = `position:fixed;left:${e.clientX - 16}px;top:${e.clientY - 16}px;width:32px;height:32px;border-radius:50%;
        border:3px solid #5C6BC0;z-index:2147483646;pointer-events:none;animation:demoRipple .5s ease-out forwards`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
    }, true);
  });
});

// ── 3. Point the extension at the fake AI (settings seeded via its worker) ───
let worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
const connection = { baseUrl: `${mock.origin}/v1`, model: 'demo-model', apiKey: 'demo' };
await worker.evaluate(
  (s) => chrome.storage.local.set({ lingua_settings: s }),
  {
    ...connection,
    targetLangA: 'fa', targetLangB: 'en', ttsEnabled: true, showPageButton: true, disabledSites: [],
    profiles: [{ id: 'default', name: 'Demo', ...connection }],
    activeProfileId: 'default',
  },
);

// First install opens the Settings tab by itself — close it so it can't steal the recording page
await sleep(1500);
for (const p of ctx.pages()) if (p.url().endsWith('/settings.html')) await p.close();
const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
const t0 = Date.now(); // the video starts with the page
const now = () => (Date.now() - t0) / 1000;
await page.goto(mock.origin);
await page.locator('#lingua-assist-page-fab').waitFor({ timeout: 10000 }); // content script is alive

// ── helpers ──────────────────────────────────────────────────────────────────
const panel = () => page.locator('#lingua-assist-root');
const button = (name) => panel().getByRole('button', { name });
const caption = (text) => page.evaluate((t) => window.__caption(t), text);
const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`) });

async function glide(x, y, steps = 24) {
  await page.mouse.move(x, y, { steps });
  await sleep(120);
}
async function clickLocator(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot click: element has no box');
  await glide(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(70);
  await page.mouse.up();
  await sleep(250);
}
/** Drag-select the text of an element with the real mouse, like a person would. */
async function dragSelect(selector) {
  await page.locator(selector).evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(800);
  const rects = await page.locator(selector).evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return [...r.getClientRects()].map((x) => ({ l: x.left, r: x.right, t: x.top, h: x.height }));
  });
  const first = rects[0];
  const last = rects[rects.length - 1];
  await glide(first.l + 1, first.t + first.h / 2);
  await page.mouse.down();
  await page.mouse.move(last.r - 1, last.t + last.h / 2, { steps: 28 });
  await sleep(150);
  await page.mouse.up();
}
async function openPanelFromTrigger() {
  const trigger = page.locator('#lingua-assist-trigger');
  await trigger.waitFor({ timeout: 5000 });
  await sleep(350);
  await clickLocator(trigger);
  await panel().getByRole('button', { name: /Text Actions/ }).waitFor();
}
async function runAction(name, doneSelector = 'button[title="Regenerate"]') {
  await clickLocator(button(name));
  await panel().locator(doneSelector).waitFor({ timeout: 30000 });
}
async function typeSlowly(text) {
  await page.keyboard.type(text, { delay: 22 });
}
const closePanel = async () => {
  await page.keyboard.press('Escape');
  await sleep(500);
};

const marks = [];
const checks = [];
const check = (label, ok) => {
  checks.push({ label, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
};
const scene = async (name, fn) => {
  console.log(`▶ Scene: ${name}`);
  const start = now();
  try {
    await fn();
  } catch (err) {
    // Leave evidence behind so a failing scene can be diagnosed
    await page.screenshot({ path: path.join(out, `failure-${name}.png`) }).catch(() => {});
    const buttons = await panel().getByRole('button').allInnerTexts().catch(() => []);
    console.error(`✗ Scene "${name}" failed. Panel buttons: ${JSON.stringify(buttons)}`);
    console.error(`  Textarea value: ${JSON.stringify(await page.locator('#compose').inputValue().catch(() => null))}`);
    await ctx.close().catch(() => {});
    mock.server.close();
    throw err;
  }
  marks.push({ name, start, end: now() });
};

// ── 4. Scenes ────────────────────────────────────────────────────────────────
const tStart = now();
await sleep(900);

await scene('explain', async () => {
  await caption('Select a line — Explain reads the lines around it');
  await dragSelect('#s-explain');
  await openPanelFromTrigger();
  await runAction(/Explain/);
  await sleep(1900);
  await shot('explain');
  const sent = mock.captured.find((r) => r.kind === 'explain');
  check('Explain sent the surrounding lines as context',
    !!sent && sent.user.includes('TEXT BEFORE') && sent.user.includes('TEXT AFTER') && sent.user.includes('SELECTED TEXT'));
  await closePanel();
});

await scene('fix-and-replace', async () => {
  await caption('Fix grammar and replace it in place');
  const box = page.locator('#compose');
  await box.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(800);
  await clickLocator(box);
  await typeSlowly(F.BROKEN_TEXT);
  await sleep(500);
  const b = await box.boundingBox();
  await glide(b.x + 80, b.y + 30);
  await page.mouse.click(b.x + 80, b.y + 30, { clickCount: 3 }); // triple-click selects the text
  await openPanelFromTrigger();
  await runAction(/Fix Grammar/);
  await sleep(1000);
  await clickLocator(button(/Replace/));
  await panel().getByRole('button', { name: /Replaced/ }).waitFor();
  await sleep(1500);
  await shot('fix-grammar-replace');
  check('Replace wrote the corrected text into the textarea', (await box.inputValue()) === F.FIXED_TEXT);
  await closePanel();
});

await scene('translate', async () => {
  await caption('Translate — natural Persian, right-to-left');
  await dragSelect('#s-translate');
  await openPanelFromTrigger();
  await runAction(/Translate ⇄/);
  await sleep(2600);
  await shot('translate-fa');
  check('Persian result is shown right-to-left', (await panel().locator('[dir="rtl"]').count()) > 0);
  await closePanel();
});
const heroEnd = now();

await scene('manual-translate', async () => {
  await caption('Type anything in the Translate tab');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(900);
  await clickLocator(page.locator('#lingua-assist-page-fab'));
  await clickLocator(button(/Translate$/));
  const input = panel().locator('textarea');
  await clickLocator(input);
  await typeSlowly(F.MANUAL_INPUT);
  await page.keyboard.press('Control+Enter');
  await panel().locator('button[title="Regenerate"]').waitFor({ timeout: 30000 });
  await sleep(1700);
  await shot('manual-translate');
});

await scene('page-intel', async () => {
  await caption('Summarize or chat with the whole page');
  await clickLocator(button(/Page Intel/));
  await runAction(/Summarize/, 'button[title="Regenerate summary"]');
  // The regenerate button shows while text is still streaming — wait for ■ Stop to go away
  await panel().getByRole('button', { name: /Stop/ }).waitFor({ state: 'hidden', timeout: 30000 });
  await sleep(2000);
  await shot('page-intel');
  await closePanel();
});

await caption('');
await sleep(600);
const tEnd = now();

// ── 5. Save the video and convert ────────────────────────────────────────────
const video = page.video();
const webm = path.join(out, 'demo.webm');
const saving = video.saveAs(webm); // must be started before the page closes; resolves once the file is written
await ctx.close();
await saving;
mock.server.close();
rmSync(path.join(out, 'raw'), { recursive: true, force: true });

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const trim = (from, to) => ['-ss', from.toFixed(2), '-t', (to - from).toFixed(2)];

console.log('▶ Converting…');
// Full walkthrough
ff([...trim(tStart, tEnd), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', '-an', path.join(out, 'demo.mp4')]);
// README hero: scenes 1–3 only. Built from the MP4 (it strips recording noise, so the GIF is ~40% smaller
// than one made from the raw WebM), sped up slightly, no dithering.
ff(['-t', (heroEnd - tStart).toFixed(2), '-i', path.join(out, 'demo.mp4'),
  '-vf', `setpts=PTS/${HERO.speed},fps=${HERO.fps},scale=${HERO.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${HERO.colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
  '-loop', '0', path.join(out, 'hero.gif')]);

const size = (f) => `${(statSync(path.join(out, f)).size / 1048576).toFixed(1)} MB`;
console.log(`\nhero.gif ${size('hero.gif')} (${((heroEnd - tStart) / HERO.speed).toFixed(0)}s) · demo.mp4 ${size('demo.mp4')} (${(tEnd - tStart).toFixed(0)}s)`);
console.log(`\n${checks.every((c) => c.ok) ? '✔' : '✗'} ${checks.filter((c) => c.ok).length}/${checks.length} checks passed. Output: ${out}`);
if (!checks.every((c) => c.ok)) process.exit(1);
