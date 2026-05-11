import type { PageContent } from '../shared/types';
import { estimateTokens } from './tokenUtils';

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
  'header', 'footer', 'nav', 'aside', 'form',
]);

const SKIP_ROLES = new Set([
  'navigation', 'banner', 'contentinfo', 'complementary', 'search',
  'dialog', 'alertdialog',
]);

const SKIP_PATTERNS = [
  /\bnav(igation|bar|menu)?\b/i,
  /\b(side|tool)bar\b/i,
  /\bfooter\b/i,
  /\bheader\b/i,
  /\b(ad|ads|advert(isement)?|sponsored)\b/i,
  /\b(cookie|gdpr|consent|privacy)-?(banner|bar|notice|popup|modal)?\b/i,
  /\bpopup\b/i,
  /\boverlay\b/i,
  /\bmodal\b/i,
  /\btoast\b/i,
  /\bshare(-buttons?)?\b/i,
  /\bsocial(-links?)?\b/i,
  /\bbreadcrumb\b/i,
  /\bpagination\b/i,
  /\brelated(-posts?)?\b/i,
  /\bcomments?\b/i,
];

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'blockquote', 'pre', 'td', 'th',
  'article', 'section', 'main', 'div',
]);

function shouldSkipElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return true;

  const role = el.getAttribute('role') ?? '';
  if (SKIP_ROLES.has(role)) return true;

  const ariaHidden = el.getAttribute('aria-hidden');
  if (ariaHidden === 'true') return true;

  const combined = `${el.className ?? ''} ${el.id ?? ''}`.toLowerCase();
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(combined)) return true;
  }

  return false;
}

function walkNode(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? '';
    if (text.length > 0) parts.push(text);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  if (shouldSkipElement(el)) return;

  const tag = el.tagName.toLowerCase();

  // Heading separator for readability
  if (/^h[1-6]$/.test(tag)) parts.push('\n');

  Array.from(el.childNodes).forEach((child) => walkNode(child, parts));

  // Line break after block elements
  if (BLOCK_TAGS.has(tag)) parts.push('\n');
}

function findMainContent(): Element {
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.article-body',
    '.post-body',
    '#content',
    '.content',
    '#main',
    '.main',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.body;
}

export function extractPageContent(): PageContent {
  const title = document.title.trim();
  const url = location.href;

  const root = findMainContent();
  const parts: string[] = [];
  walkNode(root, parts);

  const rawText = parts
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(\n\s*){3,}/g, '\n\n')
    .trim();

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const estimatedTokens = estimateTokens(rawText);

  return {
    title,
    content: rawText,
    wordCount,
    estimatedTokens,
    url,
    extractedAt: Date.now(),
  };
}
