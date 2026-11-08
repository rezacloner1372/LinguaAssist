import React from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingPanel } from './FloatingPanel';
import type { PageContent, PanelState, SelectionContext } from '../shared/types';

let shadowHost: HTMLElement | null = null;
let panelRoot: ReturnType<typeof createRoot> | null = null;
let triggerBtn: HTMLElement | null = null;
let triggerTimeout: ReturnType<typeof setTimeout> | null = null;
let pageFab: HTMLElement | null = null;

// Module-level caches — persist for the lifetime of the page
let cachedPageContent: PageContent | null = null;
let panelState: PanelState | null = null;

const CONTEXT_LINES = 10;
const CONTEXT_MAX_CHARS = 1500;

function lastLines(text: string, n: number): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(-n).join('\n').slice(-CONTEXT_MAX_CHARS);
}

function firstLines(text: string, n: number): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, n).join('\n').slice(0, CONTEXT_MAX_CHARS);
}

/**
 * Collect ~10 lines of text before and after the selection so "Explain" can
 * use the surrounding context. Climbs from the selection to an ancestor that
 * holds enough text, then slices the text around the selected range.
 */
function getSelectionContext(selection: Selection | null): SelectionContext | undefined {
  if (!selection || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);

  let container: Node | null = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
  let el = container as Element | null;
  const MIN_CHARS = CONTEXT_MAX_CHARS * 2;
  while (el && el !== document.body && (el.textContent?.length ?? 0) < MIN_CHARS) {
    el = el.parentElement;
  }
  if (!el) el = document.body;

  try {
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const afterRange = document.createRange();
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);

    const before = lastLines(beforeRange.toString(), CONTEXT_LINES);
    const after = firstLines(afterRange.toString(), CONTEXT_LINES);
    return before || after ? { before, after } : undefined;
  } catch {
    return undefined;
  }
}

/** Same idea for <input>/<textarea>, where Range doesn't reach the text. */
function getFieldContext(field: HTMLInputElement | HTMLTextAreaElement, start: number, end: number): SelectionContext | undefined {
  const before = lastLines(field.value.slice(0, start), CONTEXT_LINES);
  const after = firstLines(field.value.slice(end), CONTEXT_LINES);
  return before || after ? { before, after } : undefined;
}

function updatePersistedState(partial: Partial<PanelState>) {
  panelState = { ...(panelState ?? { selectedText: '', activeView: 'page', textResult: '', activeTextAction: null, summary: '', chatMessages: [] }), ...partial };
}

function removeTrigger() {
  if (triggerBtn && triggerBtn.parentNode) {
    triggerBtn.parentNode.removeChild(triggerBtn);
  }
  triggerBtn = null;
}

function removePanel() {
  if (shadowHost && shadowHost.parentNode) {
    shadowHost.parentNode.removeChild(shadowHost);
  }
  shadowHost = null;
  panelRoot = null;
  showPageFab();
}

function hidePageFab() {
  if (pageFab) pageFab.style.display = 'none';
}

function showPageFab() {
  if (pageFab) pageFab.style.display = 'flex';
}

function openPanel(text: string, x: number, y: number, selectionContext?: SelectionContext) {
  removeTrigger();
  removePanel();
  hidePageFab();

  // A new selection invalidates the persisted text result — a stale result
  // for different input is confusing. Page summary/chat persist regardless.
  let initialState = panelState;
  if (initialState && initialState.selectedText && text && initialState.selectedText !== text) {
    initialState = { ...initialState, textResult: '', activeTextAction: null };
  }
  if (text && (!initialState || !initialState.selectedText)) {
    initialState = { ...(initialState ?? { selectedText: '', activeView: 'page', textResult: '', activeTextAction: null, summary: '', chatMessages: [] }), selectedText: text, activeView: 'text' };
  }

  shadowHost = document.createElement('div');
  shadowHost.id = 'lingua-assist-root';
  shadowHost.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;
  document.body.appendChild(shadowHost);

  // Keep typing inside the panel from reaching page hotkey handlers (GitHub,
  // Gmail, YouTube…). Events are retargeted to the host at the document level,
  // so stopping them here at the host keeps them away from page listeners.
  // Escape is left alone so the global "Esc to close" still works.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    shadowHost.addEventListener(type, (e) => {
      if ((e as KeyboardEvent).key !== 'Escape') e.stopPropagation();
    });
  }

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  mountPoint.style.pointerEvents = 'all';
  shadowRoot.appendChild(mountPoint);

  panelRoot = createRoot(mountPoint);
  panelRoot.render(
    <FloatingPanel
      selectedText={text}
      anchorX={x}
      anchorY={y}
      onClose={removePanel}
      cachedPageContent={cachedPageContent}
      onPageContentExtracted={(content) => { cachedPageContent = content; }}
      selectionContext={selectionContext}
      initialState={initialState}
      onPersistState={updatePersistedState}
    />
  );
}

function showTrigger(text: string, rect: DOMRect, selectionContext?: SelectionContext) {
  removeTrigger();

  triggerBtn = document.createElement('button');
  triggerBtn.id = 'lingua-assist-trigger';

  const x = rect.right + window.scrollX;
  const y = rect.top + window.scrollY - 8;

  triggerBtn.style.cssText = `
    position: absolute;
    left: ${Math.min(x, window.innerWidth + window.scrollX - 140)}px;
    top: ${y}px;
    z-index: 2147483646;
    background: #5C6BC0;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(92,107,192,0.4);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    pointer-events: all;
    transition: all 0.15s ease;
    letter-spacing: 0.01em;
  `;
  triggerBtn.innerHTML = '✦ LinguaAssist';
  triggerBtn.title = 'Open LinguaAssist panel';

  triggerBtn.addEventListener('mouseenter', () => {
    if (triggerBtn) {
      triggerBtn.style.background = '#3F51B5';
      triggerBtn.style.transform = 'scale(1.04)';
    }
  });
  triggerBtn.addEventListener('mouseleave', () => {
    if (triggerBtn) {
      triggerBtn.style.background = '#5C6BC0';
      triggerBtn.style.transform = 'scale(1)';
    }
  });

  triggerBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const viewportX = rect.right;
    const viewportY = rect.bottom;
    openPanel(text, viewportX, viewportY, selectionContext);
  });

  document.body.appendChild(triggerBtn);
}

function createPageFab() {
  if (pageFab) return;

  pageFab = document.createElement('button');
  pageFab.id = 'lingua-assist-page-fab';
  pageFab.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483645;
    background: #5C6BC0;
    color: white;
    border: none;
    border-radius: 24px;
    padding: 8px 14px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(92,107,192,0.45);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    pointer-events: all;
    transition: all 0.18s ease;
    letter-spacing: 0.02em;
    opacity: 0.88;
  `;
  pageFab.innerHTML = '✦ Page';
  pageFab.title = 'Open LinguaAssist page intelligence';

  pageFab.addEventListener('mouseenter', () => {
    if (pageFab) {
      pageFab.style.background = '#3F51B5';
      pageFab.style.opacity = '1';
      pageFab.style.transform = 'scale(1.05)';
    }
  });
  pageFab.addEventListener('mouseleave', () => {
    if (pageFab) {
      pageFab.style.background = '#5C6BC0';
      pageFab.style.opacity = '0.88';
      pageFab.style.transform = 'scale(1)';
    }
  });

  pageFab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Position the panel near the top-right area of the viewport (below toolbar)
    const PANEL_WIDTH_ESTIMATE = 360;
    const MIN_EDGE_MARGIN = 24;
    const PREFERRED_TOP_OFFSET = 80;
    const cx = Math.max(MIN_EDGE_MARGIN, window.innerWidth - PANEL_WIDTH_ESTIMATE - MIN_EDGE_MARGIN);
    const cy = PREFERRED_TOP_OFFSET;
    openPanel('', cx, cy);
  });

  document.body.appendChild(pageFab);
}

document.addEventListener('mouseup', (e) => {
  const target = e.target as HTMLElement;
  if (
    target?.id === 'lingua-assist-trigger' ||
    target?.id === 'lingua-assist-page-fab' ||
    target?.closest?.('#lingua-assist-root') ||
    target?.closest?.('#lingua-assist-trigger')
  ) {
    return;
  }

  if (triggerTimeout) clearTimeout(triggerTimeout);
  triggerTimeout = setTimeout(() => {
    const selection = window.getSelection();
    let text = selection?.toString().trim() ?? '';
    let rect: DOMRect | null = null;
    let context: SelectionContext | undefined;

    // Selections inside <input>/<textarea> have no usable Range rect and may
    // not appear in getSelection() — fall back to the field itself.
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && /^(text|search|url|email|tel)?$/.test(active.type))) {
      const { selectionStart, selectionEnd, value } = active;
      if (selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart) {
        text = value.slice(selectionStart, selectionEnd).trim();
        rect = active.getBoundingClientRect();
        context = getFieldContext(active, selectionStart, selectionEnd);
      }
    }

    if (text.length > 0 && text.length <= 5000) {
      if (!rect && selection && selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
        context = getSelectionContext(selection);
      }
      if (rect) showTrigger(text, rect, context);
      else removeTrigger();
    } else {
      removeTrigger();
    }
  }, 200);
});

document.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement;
  if (
    target?.id === 'lingua-assist-trigger' ||
    target?.id === 'lingua-assist-page-fab' ||
    target?.closest?.('#lingua-assist-root')
  ) {
    return;
  }
  removeTrigger();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removeTrigger();
    removePanel();
  }
});

// Initialize the persistent FAB — http/https pages only (manifest narrows
// matches, this guards the runtime edge cases like file://)
if (location.protocol === 'http:' || location.protocol === 'https:') {
  createPageFab();
}
