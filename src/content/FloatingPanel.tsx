import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Action, PageContent, ChatMessage, PanelState, VocabEntry, LLMSettings } from '../shared/types';
import { streamLLMRequest, streamPageChat } from '../shared/messages';
import { getSettings, saveVocabEntry } from '../shared/storage';
import { isRTL, langPairLabel } from '../shared/textDirection';
import { extractPageContent } from './pageExtractor';
import { renderMarkdown } from './markdown';
import { ChatBubble } from './ChatView';
import { ListenButton } from './ListenButton';

interface Props {
  selectedText: string;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  cachedPageContent: PageContent | null;
  onPageContentExtracted: (content: PageContent) => void;
  initialState: PanelState | null;
  onPersistState: (partial: Partial<PanelState>) => void;
}

type TextState = 'idle' | 'loading' | 'success' | 'error';
type PageIntelState = 'idle' | 'extracting' | 'extracted' | 'summarizing' | 'summarized' | 'error';
type PanelView = 'text' | 'page' | 'manual';

// Primary translate action renders full-width; the rest fill a 2-col grid.
// Keep labels short — grid buttons are ~160px wide.
const PRIMARY_ACTION = { key: 'translate' as Action, label: 'Translate ⇄', icon: '🔄' };
const GRID_ACTIONS: { key: Action; label: string; icon: string }[] = [
  { key: 'explain', label: 'Explain', icon: '💡' },
  { key: 'summarize_selection', label: 'Summarize', icon: '📋' },
  { key: 'fix_grammar', label: 'Fix Grammar', icon: '✏️' },
  { key: 'rewrite_formal', label: 'Formal', icon: '🎩' },
  { key: 'rewrite_casual', label: 'Casual', icon: '😊' },
  { key: 'reply_draft', label: 'Draft Reply', icon: '↩️' },
];

const TRANSLATE_ACTIONS = new Set<Action>(['translate', 'translate_to_persian', 'translate_to_english']);

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

// Panel sizing constants
const PANEL_WIDTH_NORMAL = 360;
const PANEL_WIDTH_CHAT = 400;
const PANEL_MAX_HEIGHT_NORMAL = 560;
const PANEL_MAX_HEIGHT_CHAT = 600;

export function FloatingPanel({
  selectedText,
  anchorX,
  anchorY,
  onClose,
  cachedPageContent,
  onPageContentExtracted,
  initialState,
  onPersistState,
}: Props) {
  const hasText = selectedText.length > 0;

  // ── Settings (TTS toggle) ──
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);
  const ttsEnabled = settings?.ttsEnabled !== false;

  // ── View ──
  const [activeView, setActiveView] = useState<PanelView>(
    initialState?.activeView ?? (hasText ? 'text' : 'page')
  );
  const [chatOpen, setChatOpen] = useState(false);

  // ── Text action state (persisted across panel open/close) ──
  const [textState, setTextState] = useState<TextState>(initialState?.textResult ? 'success' : 'idle');
  const [textResult, setTextResult] = useState(initialState?.textResult ?? '');
  const [textError, setTextError] = useState('');
  const [activeTextAction, setActiveTextAction] = useState<Action | null>(initialState?.activeTextAction ?? null);
  const [textCopied, setTextCopied] = useState(false);
  const [vocabSaved, setVocabSaved] = useState(false);

  // ── Page intelligence state ──
  const [pageIntelState, setPageIntelState] = useState<PageIntelState>(
    cachedPageContent ? 'extracted' : 'idle'
  );
  const [pageContent, setPageContent] = useState<PageContent | null>(cachedPageContent);
  const [summary, setSummary] = useState(initialState?.summary ?? '');
  const [pageError, setPageError] = useState('');
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // ── Chat state (persisted) ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialState?.chatMessages ?? []);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatError, setChatError] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  const textDisconnectRef = useRef<(() => void) | null>(null);
  const summaryDisconnectRef = useRef<(() => void) | null>(null);

  // Persist key state on change
  useEffect(() => {
    onPersistState({ textResult, activeTextAction });
  }, [textResult, activeTextAction, onPersistState]);
  useEffect(() => {
    onPersistState({ summary });
  }, [summary, onPersistState]);
  useEffect(() => {
    onPersistState({ chatMessages });
  }, [chatMessages, onPersistState]);

  // Disconnect any in-flight streams on unmount
  useEffect(() => {
    return () => {
      textDisconnectRef.current?.();
      summaryDisconnectRef.current?.();
      disconnectRef.current?.();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  // Focus chat input when chat opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 80);
    }
  }, [chatOpen]);

  // ── Panel dimensions ──
  const panelWidth = chatOpen ? PANEL_WIDTH_CHAT : PANEL_WIDTH_NORMAL;
  const padding = 12;

  let left = anchorX + 8;
  let top = anchorY + 8;
  if (left + panelWidth > window.innerWidth - padding) left = window.innerWidth - panelWidth - padding;
  if (left < padding) left = padding;
  const estimatedHeight = chatOpen ? PANEL_MAX_HEIGHT_CHAT : activeView === 'page' ? 500 : 460;
  if (top + estimatedHeight > window.innerHeight - padding) top = Math.max(padding, anchorY - estimatedHeight - 8);
  if (top < padding) top = padding;

  // ── Dragging (click + hold header to move; position resets when panel closes) ──
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start a drag from the header's buttons (close / back-to-page)
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = panel.getBoundingClientRect().left;
    const origTop = panel.getBoundingClientRect().top;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const pad = 8;
      const maxX = Math.max(pad, window.innerWidth - panel.offsetWidth - pad);
      const maxY = Math.max(pad, window.innerHeight - panel.offsetHeight - pad);
      setDragPos({
        x: Math.min(Math.max(origLeft + (ev.clientX - startX), pad), maxX),
        y: Math.min(Math.max(origTop + (ev.clientY - startY), pad), maxY),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const panelLeft = dragPos ? dragPos.x : left;
  const panelTop = dragPos ? dragPos.y : top;

  // ── Text action handler (streaming with typewriter effect) ──
  const handleTextAction = useCallback((action: Action) => {
    textDisconnectRef.current?.();
    setActiveTextAction(action);
    setTextState('loading');
    setTextResult('');
    setTextError('');
    setTextCopied(false);
    setVocabSaved(false);

    let accumulated = '';
    const disconnect = streamLLMRequest(
      { type: 'TEXT_ACTION_STREAM', payload: { text: selectedText, action } },
      (chunk) => {
        accumulated += chunk;
        setTextResult(accumulated);
      },
      () => {
        setTextState('success');
        textDisconnectRef.current = null;
      },
      (err) => {
        setTextError(err);
        setTextState('error');
        textDisconnectRef.current = null;
      },
    );
    textDisconnectRef.current = disconnect;
  }, [selectedText]);

  // ── Manual translate (typed/pasted text, same stream as text actions) ──
  const [manualInput, setManualInput] = useState('');
  const [manualState, setManualState] = useState<TextState>('idle');
  const [manualResult, setManualResult] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualCopied, setManualCopied] = useState(false);
  const manualDisconnectRef = useRef<(() => void) | null>(null);
  const manualInputRtl = isRTL(manualInput);
  const manualResultRtl = isRTL(manualResult);

  // Disconnect in-flight manual stream on unmount
  useEffect(() => {
    return () => {
      manualDisconnectRef.current?.();
    };
  }, []);

  const handleManualTranslate = useCallback(() => {
    const text = manualInput.trim();
    if (!text) return;
    manualDisconnectRef.current?.();
    setManualState('loading');
    setManualResult('');
    setManualError('');
    setManualCopied(false);

    let accumulated = '';
    const disconnect = streamLLMRequest(
      { type: 'TEXT_ACTION_STREAM', payload: { text, action: 'translate' } },
      (chunk) => {
        accumulated += chunk;
        setManualResult(accumulated);
      },
      () => {
        setManualState('success');
        manualDisconnectRef.current = null;
      },
      (err) => {
        setManualError(err);
        setManualState('error');
        manualDisconnectRef.current = null;
      },
    );
    manualDisconnectRef.current = disconnect;
  }, [manualInput]);

  const handleManualCopy = useCallback(() => {
    navigator.clipboard.writeText(manualResult).then(() => {
      setManualCopied(true);
      setTimeout(() => setManualCopied(false), 2000);
    });
  }, [manualResult]);

  const handleTextCopy = useCallback(() => {
    navigator.clipboard.writeText(textResult).then(() => {
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    });
  }, [textResult]);

  const handleSaveVocab = useCallback(() => {
    const entry: VocabEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: selectedText,
      translation: textResult,
      pageUrl: location.href,
      savedAt: Date.now(),
      langPair: langPairLabel(selectedText, textResult),
    };
    saveVocabEntry(entry).then(() => {
      setVocabSaved(true);
      setTimeout(() => setVocabSaved(false), 2000);
    });
  }, [selectedText, textResult]);

  // ── Page extraction ──
  const handleReadPage = useCallback(async () => {
    setPageIntelState('extracting');
    setPageError('');
    try {
      // extractPageContent is synchronous DOM reading — run in micro-task to not freeze UI
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      const content = extractPageContent();
      setPageContent(content);
      onPageContentExtracted(content);
      setPageIntelState('extracted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPageError(`Extraction failed: ${msg}`);
      setPageIntelState('error');
    }
  }, [onPageContentExtracted]);

  // ── Summarize (streaming) ──
  const handleSummarize = useCallback(async () => {
    let content = pageContent;
    if (!content) {
      // Auto-extract first
      setPageIntelState('extracting');
      setPageError('');
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      try {
        content = extractPageContent();
        setPageContent(content);
        onPageContentExtracted(content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setPageError(`Extraction failed: ${msg}`);
        setPageIntelState('error');
        return;
      }
    }
    summaryDisconnectRef.current?.();
    setSummary('');
    setSummaryCopied(false);
    setSummaryExpanded(true);
    setPageError('');
    setPageIntelState('summarizing');

    let accumulated = '';
    const disconnect = streamLLMRequest(
      { type: 'PAGE_SUMMARIZE_STREAM', payload: { pageContent: content } },
      (chunk) => {
        accumulated += chunk;
        setSummary(accumulated);
      },
      () => {
        setPageIntelState('summarized');
        summaryDisconnectRef.current = null;
      },
      (err) => {
        setPageError(err);
        setPageIntelState(content ? 'extracted' : 'error');
        summaryDisconnectRef.current = null;
      },
    );
    summaryDisconnectRef.current = disconnect;
  }, [pageContent, onPageContentExtracted]);

  // ── Chat ──
  const handleSendChat = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    if (!pageContent) return;

    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatSending(true);
    setChatError('');
    setStreamingContent('');

    let accumulated = '';

    const disconnect = streamPageChat(
      {
        pageContent,
        conversationHistory: chatMessages,
        userMessage: msg,
      },
      (chunk) => {
        accumulated += chunk;
        setStreamingContent(accumulated);
      },
      () => {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: accumulated,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent('');
        setChatSending(false);
        disconnectRef.current = null;
      },
      (err) => {
        setChatError(err);
        setChatSending(false);
        setStreamingContent('');
        disconnectRef.current = null;
      },
    );

    disconnectRef.current = disconnect;
  }, [chatInput, chatSending, pageContent, chatMessages]);

  const handleChatInputKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    },
    [handleSendChat],
  );

  const handleClearChat = useCallback(() => {
    if (disconnectRef.current) {
      disconnectRef.current();
      disconnectRef.current = null;
    }
    setChatMessages([]);
    setStreamingContent('');
    setChatSending(false);
    setChatError('');
  }, []);

  const handleOpenChat = useCallback(async () => {
    // Ensure page content is extracted before opening chat
    if (!pageContent) {
      await handleReadPage();
    }
    setChatOpen(true);
  }, [pageContent, handleReadPage]);

  const handleCloseChat = useCallback(() => {
    if (disconnectRef.current) {
      disconnectRef.current();
      disconnectRef.current = null;
    }
    setChatOpen(false);
    setChatSending(false);
    setStreamingContent('');
  }, []);

  const truncatedText = selectedText.length > 120
    ? selectedText.slice(0, 120) + '…'
    : selectedText;

  const selectedTextRtl = isRTL(selectedText);
  const textResultRtl = isRTL(textResult);
  const summaryRtl = isRTL(summary);

  // ── Shared button style helpers ──
  const actionBtnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 11px',
    background: active ? '#EEF0FF' : '#F8F9FE',
    border: `1px solid ${active ? '#C5CAE9' : '#E8EAF6'}`,
    borderRadius: '10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    color: active ? '#3F51B5' : '#374151',
    fontWeight: active ? 600 : 400,
    fontFamily: fontStack,
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    opacity: disabled && !active ? 0.5 : 1,
    width: '100%',
  });

  const actionHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = '#EEF0FF';
      e.currentTarget.style.borderColor = '#C5CAE9';
      e.currentTarget.style.color = '#3F51B5';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = '#F8F9FE';
      e.currentTarget.style.borderColor = '#E8EAF6';
      e.currentTarget.style.color = '#374151';
    },
  };

  const renderActionButton = ({ key, label, icon }: { key: Action; label: string; icon: string }) => {
    const isActive = activeTextAction === key && textState === 'loading';
    return (
      <button
        key={key}
        onClick={() => handleTextAction(key)}
        disabled={textState === 'loading'}
        style={actionBtnStyle(activeTextAction === key, textState === 'loading' && activeTextAction !== key)}
        onMouseEnter={e => { if (textState !== 'loading') actionHover.onMouseEnter(e); }}
        onMouseLeave={e => { if (activeTextAction !== key) actionHover.onMouseLeave(e); }}
      >
        <span style={{
          display: 'inline-block',
          ...(isActive ? { animation: 'linguaSpin 0.8s linear infinite' } : {}),
        }}>{isActive ? '⟳' : icon}</span>
        {isActive ? 'Processing…' : label}
      </button>
    );
  };

  // Streaming cursor element (reused by text result and summary)
  const streamCursor = (
    <span style={{
      display: 'inline-block',
      width: '2px',
      height: '14px',
      background: '#5C6BC0',
      marginLeft: '2px',
      verticalAlign: 'text-bottom',
      animation: 'linguaPulse 0.8s ease-in-out infinite',
    }} />
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${panelLeft}px`,
        top: `${panelTop}px`,
        width: `${panelWidth}px`,
        maxHeight: `${chatOpen ? PANEL_MAX_HEIGHT_CHAT : PANEL_MAX_HEIGHT_NORMAL}px`,
        background: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #E8EAF6',
        fontFamily: fontStack,
        fontSize: '14px',
        color: '#1A1A2E',
        zIndex: 2147483647,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'linguaFadeIn 0.18s ease',
        userSelect: 'none',
        ...(isDragging ? { transition: 'none', boxShadow: '0 14px 40px rgba(0,0,0,0.22)' } : {}),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes linguaFadeIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes linguaSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes linguaPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ── Header (drag handle) ── */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 14px',
        background: 'linear-gradient(135deg, #5C6BC0 0%, #7986CB 100%)',
        borderRadius: '16px 16px 0 0',
        flexShrink: 0,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {chatOpen && (
            <button
              onClick={handleCloseChat}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '13px',
                fontFamily: fontStack,
              }}
              title="Back to Page Intelligence"
            >
              ←
            </button>
          )}
          <span style={{ fontSize: '15px' }}>✦</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em' }}>
            {chatOpen ? 'Chat with Page' : 'LinguaAssist'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            width: '26px',
            height: '26px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 300,
            padding: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.32)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          title="Close (Esc)"
        >
          ×
        </button>
      </div>

      {/* ── Tab Bar (only when not in chat) ── */}
      {!chatOpen && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E8EAF6',
          flexShrink: 0,
        }}>
          {(['text', 'page', 'manual'] as PanelView[]).map((tab) => (
            (!hasText && tab === 'text') ? null : (
              <button
                key={tab}
                onClick={() => setActiveView(tab)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  background: activeView === tab ? '#FFFFFF' : '#F8F9FE',
                  border: 'none',
                  borderBottom: `2px solid ${activeView === tab ? '#5C6BC0' : 'transparent'}`,
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeView === tab ? 600 : 400,
                  color: activeView === tab ? '#5C6BC0' : '#6B7280',
                  fontFamily: fontStack,
                  transition: 'all 0.15s',
                  letterSpacing: '0.03em',
                }}
              >
                {tab === 'text' ? '✏️ Text Actions' : tab === 'page' ? '📄 Page Intel' : '⌨️ Translate'}
              </button>
            )
          ))}
        </div>
      )}

      {/* ─────────────────── CHAT VIEW ─────────────────── */}
      {chatOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Page context badge */}
          {pageContent && (
            <div style={{
              padding: '6px 14px',
              background: '#F0F4FF',
              borderBottom: '1px solid #E8EAF6',
              fontSize: '11px',
              color: '#5C6BC0',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              📄 {pageContent.title || pageContent.url}
            </div>
          )}

          {/* Privacy notice */}
          <div style={{
            padding: '5px 14px',
            background: '#FFFBEB',
            borderBottom: '1px solid #FEF3C7',
            fontSize: '11px',
            color: '#92400E',
            flexShrink: 0,
          }}>
            ⚠ Content will be sent to your configured AI provider.
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minHeight: 0,
          }}>
            {chatMessages.length === 0 && !chatSending && (
              <div style={{
                textAlign: 'center',
                color: '#9CA3AF',
                fontSize: '13px',
                paddingTop: '20px',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>💬</div>
                <div>Ask anything about this page</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#C4C9E8' }}>
                  e.g. "Summarize section 2", "What are the key points?"
                </div>
              </div>
            )}

            {chatMessages.map((msg) => (
              <ChatBubble key={`${msg.role}-${msg.timestamp}`} message={msg} fontStack={fontStack} ttsEnabled={ttsEnabled} renderMarkdown={renderMarkdown} />
            ))}

            {/* Streaming assistant bubble */}
            {chatSending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: '#F0F4FF',
                  border: '1px solid #C5CAE9',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#1A1A2E',
                  lineHeight: '1.6',
                }}>
                  {streamingContent ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{streamingContent}
                      {streamCursor}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                      {[0, 1, 2].map((dotIdx) => (
                        <span key={`dot-${dotIdx}`} style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: '#5C6BC0',
                          animation: `linguaPulse 1.2s ease-in-out ${dotIdx * 0.2}s infinite`,
                          display: 'inline-block',
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {chatError && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#B91C1C',
              }}>
                ⚠ {chatError}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Clear + Input */}
          <div style={{ borderTop: '1px solid #E8EAF6', padding: '8px 12px', flexShrink: 0 }}>
            {chatMessages.length > 0 && (
              <button
                onClick={handleClearChat}
                style={{
                  fontSize: '11px',
                  color: '#9CA3AF',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 0 6px',
                  fontFamily: fontStack,
                }}
              >
                🗑 Clear conversation
              </button>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatInputKey}
                placeholder="Ask about this page…"
                disabled={chatSending}
                style={{
                  flex: 1,
                  padding: '8px 11px',
                  border: '1px solid #E8EAF6',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontFamily: fontStack,
                  outline: 'none',
                  color: '#1A1A2E',
                  background: chatSending ? '#F8F9FE' : '#FAFBFF',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#5C6BC0')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8EAF6')}
              />
              <button
                onClick={handleSendChat}
                disabled={chatSending || !chatInput.trim()}
                style={{
                  padding: '8px 12px',
                  background: chatSending || !chatInput.trim() ? '#C5CAE9' : '#5C6BC0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: chatSending || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontFamily: fontStack,
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!chatSending && chatInput.trim()) e.currentTarget.style.background = '#3F51B5'; }}
                onMouseLeave={e => { if (!chatSending && chatInput.trim()) e.currentTarget.style.background = '#5C6BC0'; }}
                title="Send (Enter)"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── TEXT ACTIONS TAB ─────────────────── */}
      {!chatOpen && activeView === 'text' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Selected text preview */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Selected Text
            </div>
            <div
              dir={selectedTextRtl ? 'rtl' : 'ltr'}
              style={{
                fontSize: '13px',
                color: '#374151',
                lineHeight: '1.5',
                maxHeight: '56px',
                overflow: 'hidden',
                background: '#F8F9FE',
                borderRadius: '8px',
                padding: '7px 10px',
                border: '1px solid #E8EAF6',
                fontStyle: 'italic',
                textAlign: selectedTextRtl ? 'right' : 'left',
              }}
            >
              "{truncatedText}"
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
              Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {renderActionButton(PRIMARY_ACTION)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {GRID_ACTIONS.map(renderActionButton)}
              </div>
            </div>
          </div>

          {/* Result */}
          <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {textState === 'idle' && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', paddingTop: '10px' }}>
                <div style={{ fontSize: '22px', marginBottom: '5px' }}>✦</div>
                <div>Select an action to get started</div>
              </div>
            )}
            {textState === 'error' && (
              <ErrorCard error={textError} fontStack={fontStack} />
            )}
            {(textState === 'loading' || textState === 'success') && textResult !== '' && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                  Result
                </div>
                <div
                  dir={textResultRtl ? 'rtl' : 'ltr'}
                  style={{
                    background: '#F0F4FF',
                    border: '1px solid #C5CAE9',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#1A1A2E',
                    lineHeight: '1.7',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    textAlign: textResultRtl ? 'right' : 'left',
                  }}
                >
                  {textState === 'loading' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{textResult}{streamCursor}</span>
                  ) : (
                    renderMarkdown(textResult)
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={handleTextCopy}
                    disabled={textState === 'loading'}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: textCopied ? '#43A047' : '#5C6BC0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: textState === 'loading' ? 'not-allowed' : 'pointer',
                      fontFamily: fontStack,
                      transition: 'all 0.2s ease',
                      opacity: textState === 'loading' ? 0.6 : 1,
                    }}
                  >
                    {textCopied ? '✓ Copied!' : '⎘ Copy Result'}
                  </button>
                  {activeTextAction && TRANSLATE_ACTIONS.has(activeTextAction) && textState === 'success' && (
                    <button
                      onClick={handleSaveVocab}
                      style={{
                        padding: '8px 12px',
                        background: vocabSaved ? '#43A047' : '#FFFFFF',
                        color: vocabSaved ? 'white' : '#5C6BC0',
                        border: `1px solid ${vocabSaved ? '#43A047' : '#C5CAE9'}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: fontStack,
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                      title="Save to vocabulary"
                    >
                      {vocabSaved ? '✓ Saved' : '📚 Save'}
                    </button>
                  )}
                  {ttsEnabled && textState === 'success' && textResult && (
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '0 10px',
                      border: '1px solid #C5CAE9', borderRadius: '10px', flexShrink: 0,
                    }}>
                      <ListenButton text={textResult} fontStack={fontStack} />
                    </div>
                  )}
                </div>
              </div>
            )}
            {textState === 'loading' && textResult === '' && (
              <div style={{ textAlign: 'center', color: '#5C6BC0', fontSize: '13px', paddingTop: '12px' }}>
                <div style={{
                  display: 'inline-block', width: '22px', height: '22px',
                  border: '2px solid #C5CAE9', borderTopColor: '#5C6BC0',
                  borderRadius: '50%', animation: 'linguaSpin 0.7s linear infinite', marginBottom: '7px',
                }} />
                <div>Thinking…</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── MANUAL TRANSLATE TAB ─────────────────── */}
      {!chatOpen && activeView === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Input */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
              Translate Text
            </div>
            <textarea
              dir={manualInputRtl ? 'rtl' : 'ltr'}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleManualTranslate();
                }
              }}
              placeholder="Type or paste a word, sentence, or paragraph…"
              disabled={manualState === 'loading'}
              style={{
                width: '100%',
                minHeight: '84px',
                maxHeight: '160px',
                resize: 'vertical',
                padding: '8px 11px',
                border: '1px solid #E8EAF6',
                borderRadius: '10px',
                fontSize: '13px',
                fontFamily: fontStack,
                outline: 'none',
                color: '#1A1A2E',
                background: manualState === 'loading' ? '#F8F9FE' : '#FAFBFF',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
                lineHeight: '1.6',
                textAlign: manualInputRtl ? 'right' : 'left',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#5C6BC0')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E8EAF6')}
            />
            <button
              onClick={handleManualTranslate}
              disabled={manualState === 'loading' || !manualInput.trim()}
              style={{
                width: '100%',
                marginTop: '7px',
                padding: '9px',
                background: manualState === 'loading' || !manualInput.trim() ? '#C5CAE9' : '#5C6BC0',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: manualState === 'loading' || !manualInput.trim() ? 'not-allowed' : 'pointer',
                fontFamily: fontStack,
                transition: 'all 0.15s',
              }}
            >
              {manualState === 'loading' ? 'Translating…' : '🔄 Translate ⇄'}
            </button>
          </div>

          {/* Result — same format as Text Actions tab */}
          <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {manualState === 'idle' && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', paddingTop: '10px' }}>
                <div style={{ fontSize: '22px', marginBottom: '5px' }}>⌨️</div>
                <div>Enter text and press Translate</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#C4C9E8' }}>⌘/Ctrl + Enter also works</div>
              </div>
            )}
            {manualState === 'error' && (
              <ErrorCard error={manualError} fontStack={fontStack} />
            )}
            {(manualState === 'loading' || manualState === 'success') && manualResult !== '' && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                  Result
                </div>
                <div
                  dir={manualResultRtl ? 'rtl' : 'ltr'}
                  style={{
                    background: '#F0F4FF',
                    border: '1px solid #C5CAE9',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#1A1A2E',
                    lineHeight: '1.7',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    textAlign: manualResultRtl ? 'right' : 'left',
                  }}
                >
                  {manualState === 'loading' ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{manualResult}{streamCursor}</span>
                  ) : (
                    renderMarkdown(manualResult)
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={handleManualCopy}
                    disabled={manualState === 'loading'}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: manualCopied ? '#43A047' : '#5C6BC0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: manualState === 'loading' ? 'not-allowed' : 'pointer',
                      fontFamily: fontStack,
                      transition: 'all 0.2s ease',
                      opacity: manualState === 'loading' ? 0.6 : 1,
                    }}
                  >
                    {manualCopied ? '✓ Copied!' : '⎘ Copy Result'}
                  </button>
                  {ttsEnabled && manualState === 'success' && manualResult && (
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '0 10px',
                      border: '1px solid #C5CAE9', borderRadius: '10px', flexShrink: 0,
                    }}>
                      <ListenButton text={manualResult} fontStack={fontStack} />
                    </div>
                  )}
                </div>
              </div>
            )}
            {manualState === 'loading' && manualResult === '' && (
              <div style={{ textAlign: 'center', color: '#5C6BC0', fontSize: '13px', paddingTop: '12px' }}>
                <div style={{
                  display: 'inline-block', width: '22px', height: '22px',
                  border: '2px solid #C5CAE9', borderTopColor: '#5C6BC0',
                  borderRadius: '50%', animation: 'linguaSpin 0.7s linear infinite', marginBottom: '7px',
                }} />
                <div>Thinking…</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── PAGE INTELLIGENCE TAB ─────────────────── */}
      {!chatOpen && activeView === 'page' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {/* Page status card */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Page Content
              </div>
              {pageIntelState === 'idle' && (
                <div style={{
                  fontSize: '13px', color: '#6B7280', background: '#F8F9FE',
                  border: '1px solid #E8EAF6', borderRadius: '10px',
                  padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>📄</div>
                  <div>No content extracted yet</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>Click "Read Page" to extract</div>
                </div>
              )}
              {pageIntelState === 'extracting' && (
                <div style={{ textAlign: 'center', color: '#5C6BC0', fontSize: '13px', padding: '10px 0' }}>
                  <div style={{
                    display: 'inline-block', width: '20px', height: '20px',
                    border: '2px solid #C5CAE9', borderTopColor: '#5C6BC0',
                    borderRadius: '50%', animation: 'linguaSpin 0.7s linear infinite', marginBottom: '6px',
                  }} />
                  <div>Reading page content…</div>
                </div>
              )}
              {(pageIntelState === 'extracted' || pageIntelState === 'summarizing' || pageIntelState === 'summarized') && pageContent && (
                <div style={{
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#15803D',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ✓ {pageContent.title || 'Page extracted'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', display: 'flex', gap: '12px' }}>
                    <span>📝 {pageContent.wordCount.toLocaleString()} words</span>
                    <span>🔢 ~{pageContent.estimatedTokens.toLocaleString()} tokens</span>
                  </div>
                </div>
              )}
              {pageIntelState === 'error' && (
                <ErrorCard error={pageError} fontStack={fontStack} />
              )}
            </div>

            {/* Page action buttons */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
                Page Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {/* Read Page */}
                <button
                  onClick={handleReadPage}
                  disabled={pageIntelState === 'extracting' || pageIntelState === 'summarizing'}
                  style={actionBtnStyle(
                    pageIntelState === 'extracting',
                    pageIntelState === 'extracting' || pageIntelState === 'summarizing',
                  )}
                  onMouseEnter={e => {
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') actionHover.onMouseEnter(e);
                  }}
                  onMouseLeave={e => {
                    if (pageIntelState !== 'extracting') actionHover.onMouseLeave(e);
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    ...(pageIntelState === 'extracting' ? { animation: 'linguaSpin 0.8s linear infinite' } : {}),
                  }}>
                    {pageIntelState === 'extracting' ? '⟳' : '📄'}
                  </span>
                  {pageIntelState === 'extracting' ? 'Reading…' : pageContent ? 'Re-read Page' : 'Read Page'}
                </button>

                {/* Summarize */}
                <button
                  onClick={handleSummarize}
                  disabled={pageIntelState === 'extracting' || pageIntelState === 'summarizing'}
                  style={actionBtnStyle(
                    pageIntelState === 'summarizing',
                    pageIntelState === 'extracting' || pageIntelState === 'summarizing',
                  )}
                  onMouseEnter={e => {
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') actionHover.onMouseEnter(e);
                  }}
                  onMouseLeave={e => {
                    if (pageIntelState !== 'summarizing') actionHover.onMouseLeave(e);
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    ...(pageIntelState === 'summarizing' ? { animation: 'linguaSpin 0.8s linear infinite' } : {}),
                  }}>
                    {pageIntelState === 'summarizing' ? '⟳' : '📋'}
                  </span>
                  {pageIntelState === 'summarizing' ? 'Summarizing…' : 'Summarize'}
                </button>

                {/* Chat with Page */}
                <button
                  onClick={handleOpenChat}
                  disabled={pageIntelState === 'extracting' || pageIntelState === 'summarizing'}
                  style={actionBtnStyle(
                    false,
                    pageIntelState === 'extracting' || pageIntelState === 'summarizing',
                  )}
                  onMouseEnter={e => {
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') actionHover.onMouseEnter(e);
                  }}
                  onMouseLeave={actionHover.onMouseLeave}
                >
                  <span>💬</span>
                  Chat with Page
                </button>
              </div>

              {/* Privacy notice */}
              {(pageIntelState !== 'idle') && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#92400E',
                  background: '#FFFBEB',
                  border: '1px solid #FEF3C7',
                  borderRadius: '8px',
                  padding: '6px 10px',
                }}>
                  ⚠ Content will be sent to your configured AI provider when you Summarize or Chat.
                </div>
              )}
            </div>

            {/* Summary result */}
            {(pageIntelState === 'summarized' || pageIntelState === 'summarizing' || (summary !== '' && pageIntelState === 'extracted')) && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Summary
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {ttsEnabled && summary && pageIntelState !== 'summarizing' && (
                      <ListenButton text={summary} fontStack={fontStack} />
                    )}
                    <button
                      onClick={() => setSummaryExpanded((v) => !v)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9CA3AF', padding: '0 2px', fontFamily: fontStack }}
                      title={summaryExpanded ? 'Collapse' : 'Expand'}
                    >
                      {summaryExpanded ? '▲' : '▼'}
                    </button>
                    {summary && (
                      <button
                        onClick={() => navigator.clipboard.writeText(summary).then(() => {
                          setSummaryCopied(true);
                          setTimeout(() => setSummaryCopied(false), 2000);
                        })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: summaryCopied ? '#43A047' : '#9CA3AF', padding: '0 2px', fontFamily: fontStack }}
                        title="Copy summary"
                      >
                        {summaryCopied ? '✓' : '⎘'}
                      </button>
                    )}
                    {summary && (
                      <button
                        onClick={handleSummarize}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9CA3AF', padding: '0 2px', fontFamily: fontStack }}
                        title="Regenerate summary"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
                {pageIntelState === 'summarizing' && !summary && (
                  <div style={{ textAlign: 'center', color: '#5C6BC0', fontSize: '13px', padding: '10px 0' }}>
                    <div style={{
                      display: 'inline-block', width: '20px', height: '20px',
                      border: '2px solid #C5CAE9', borderTopColor: '#5C6BC0',
                      borderRadius: '50%', animation: 'linguaSpin 0.7s linear infinite', marginBottom: '6px',
                    }} />
                    <div>Summarizing…</div>
                  </div>
                )}
                {summaryExpanded && summary && (
                  <div
                    dir={summaryRtl ? 'rtl' : 'ltr'}
                    style={{
                      background: '#F0F4FF',
                      border: '1px solid #C5CAE9',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: '#1A1A2E',
                      lineHeight: '1.65',
                      textAlign: summaryRtl ? 'right' : 'left',
                    }}
                  >
                    {pageIntelState === 'summarizing' ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{summary}{streamCursor}</span>
                    ) : (
                      renderMarkdown(summary)
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {!chatOpen && (
        <div style={{
          padding: '5px 14px',
          borderTop: '1px solid #F0F2FF',
          fontSize: '11px',
          color: '#C4C9E8',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          Stored locally only when you save vocabulary · Esc to close
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorCard({ error, fontStack }: { error: string; fontStack: string }) {
  return (
    <div style={{
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: '10px',
      padding: '10px 12px',
      fontSize: '13px',
      color: '#B91C1C',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠ Error</div>
      <div style={{ lineHeight: '1.5' }}>{error}</div>
      {error.includes('Settings') && (
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={{
            marginTop: '8px',
            background: '#5C6BC0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: fontStack,
          }}
        >
          Open Settings →
        </button>
      )}
    </div>
  );
}
