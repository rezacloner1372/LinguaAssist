import React from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingPanel } from './FloatingPanel';
import type { PageContent } from '../shared/types';

let shadowHost: HTMLElement | null = null;
let panelRoot: ReturnType<typeof createRoot> | null = null;
let triggerBtn: HTMLElement | null = null;
let triggerTimeout: ReturnType<typeof setTimeout> | null = null;
let pageFab: HTMLElement | null = null;

// Module-level cache — persists for the lifetime of the page
let cachedPageContent: PageContent | null = null;

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

function openPanel(text: string, x: number, y: number) {
  removeTrigger();
  removePanel();
  hidePageFab();

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
    />
  );
}

function showTrigger(text: string, rect: DOMRect) {
  removeTrigger();

  triggerBtn = document.createElement('button');
  triggerBtn.id = 'lingua-assist-trigger';

  const x = rect.right + window.scrollX;
  const y = rect.top + window.scrollY - 8;

  triggerBtn.style.cssText = `
    position: absolute;
    left: ${Math.min(x, window.innerWidth - 140)}px;
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
    openPanel(text, viewportX, viewportY);
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
    // Open panel in page-only mode: no selected text, centered
    const cx = Math.min(window.innerWidth - 200, Math.max(200, window.innerWidth * 0.72));
    const cy = Math.min(window.innerHeight - 300, 120);
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
    const text = selection?.toString().trim() ?? '';

    if (text.length > 0 && text.length <= 5000) {
      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTrigger(text, rect);
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

// Initialize the persistent FAB
createPageFab();
