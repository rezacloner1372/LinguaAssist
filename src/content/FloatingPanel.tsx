import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Action, PageContent, ChatMessage } from '../shared/types';
import { sendLLMRequest, sendPageSummarizeRequest, streamPageChat } from '../shared/messages';
import { extractPageContent } from './pageExtractor';

interface Props {
  selectedText: string;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  cachedPageContent: PageContent | null;
  onPageContentExtracted: (content: PageContent) => void;
}

type TextState = 'idle' | 'loading' | 'success' | 'error';
type PageIntelState = 'idle' | 'extracting' | 'extracted' | 'summarizing' | 'summarized' | 'error';
type PanelView = 'text' | 'page';

const TEXT_ACTIONS: { key: Action; label: string; icon: string }[] = [
  { key: 'translate_to_persian', label: 'Translate → Persian', icon: '🔄' },
  { key: 'translate_to_english', label: 'Translate → English', icon: '🔄' },
  { key: 'fix_grammar', label: 'Fix Grammar', icon: '✏️' },
];

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

// ─── Simple inline markdown renderer ────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={key++} style={{ margin: '4px 0 8px 0', paddingLeft: '18px' }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  }

  function processInline(str: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const pattern = /(\*\*(.*?)\*\*|`(.*?)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = pattern.exec(str)) !== null) {
      if (m.index > last) parts.push(<span key={idx++}>{str.slice(last, m.index)}</span>);
      if (m[2] !== undefined) {
        parts.push(<strong key={idx++}>{m[2]}</strong>);
      } else if (m[3] !== undefined) {
        parts.push(
          <code key={idx++} style={{ background: '#EEF0FF', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
            {m[3]}
          </code>
        );
      }
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(<span key={idx++}>{str.slice(last)}</span>);
    return parts;
  }

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const content = line.replace(/^#+\s/, '');
      nodes.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: '13px', color: '#3F51B5', margin: '10px 0 4px' }}>
          {processInline(content)}
        </div>
      );
    } else if (/^[-*•]\s/.test(line)) {
      const content = line.replace(/^[-*•]\s/, '');
      listItems.push(<li key={key++} style={{ marginBottom: '2px', lineHeight: '1.5' }}>{processInline(content)}</li>);
    } else if (line.trim() === '') {
      flushList();
      nodes.push(<div key={key++} style={{ height: '4px' }} />);
    } else {
      flushList();
      nodes.push(
        <p key={key++} style={{ margin: '0 0 6px', lineHeight: '1.6' }}>
          {processInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <>{nodes}</>;
}

// ─── Main component ──────────────────────────────────────────────────────────
export function FloatingPanel({
  selectedText,
  anchorX,
  anchorY,
  onClose,
  cachedPageContent,
  onPageContentExtracted,
}: Props) {
  const hasText = selectedText.length > 0;

  // ── View ──
  const [activeView, setActiveView] = useState<PanelView>(hasText ? 'text' : 'page');
  const [chatOpen, setChatOpen] = useState(false);

  // ── Text action state ──
  const [textState, setTextState] = useState<TextState>('idle');
  const [textResult, setTextResult] = useState('');
  const [textError, setTextError] = useState('');
  const [activeTextAction, setActiveTextAction] = useState<Action | null>(null);
  const [textCopied, setTextCopied] = useState(false);

  // ── Page intelligence state ──
  const [pageIntelState, setPageIntelState] = useState<PageIntelState>(
    cachedPageContent ? 'extracted' : 'idle'
  );
  const [pageContent, setPageContent] = useState<PageContent | null>(cachedPageContent);
  const [summary, setSummary] = useState('');
  const [pageError, setPageError] = useState('');
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatError, setChatError] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

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
  const panelWidth = chatOpen ? 400 : 360;
  const padding = 12;

  let left = anchorX + 8;
  let top = anchorY + 8;
  if (left + panelWidth > window.innerWidth - padding) left = window.innerWidth - panelWidth - padding;
  if (left < padding) left = padding;
  const estimatedHeight = chatOpen ? 580 : activeView === 'page' ? 500 : 460;
  if (top + estimatedHeight > window.innerHeight - padding) top = Math.max(padding, anchorY - estimatedHeight - 8);
  if (top < padding) top = padding;

  // ── Text action handler ──
  const handleTextAction = useCallback(async (action: Action) => {
    setActiveTextAction(action);
    setTextState('loading');
    setTextResult('');
    setTextError('');
    setTextCopied(false);
    try {
      const response = await sendLLMRequest({ text: selectedText, action });
      if (response.success && response.data) {
        setTextResult(response.data);
        setTextState('success');
      } else {
        setTextError(response.error ?? 'Unknown error occurred.');
        setTextState('error');
      }
    } catch {
      setTextError('Failed to contact extension background. Please reload.');
      setTextState('error');
    }
  }, [selectedText]);

  const handleTextCopy = useCallback(() => {
    navigator.clipboard.writeText(textResult).then(() => {
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    });
  }, [textResult]);

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

  // ── Summarize ──
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
    setSummary('');
    setSummaryCopied(false);
    setSummaryExpanded(true);
    setPageError('');
    setPageIntelState('summarizing');
    try {
      const response = await sendPageSummarizeRequest({ pageContent: content });
      if (response.success && response.data) {
        setSummary(response.data);
        setPageIntelState('summarized');
      } else {
        setPageError(response.error ?? 'Unknown error occurred.');
        setPageIntelState(content ? 'extracted' : 'error');
      }
    } catch {
      setPageError('Failed to contact extension background. Please reload.');
      setPageIntelState(content ? 'extracted' : 'error');
    }
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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
        maxHeight: `${chatOpen ? 600 : 560}px`,
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

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 14px',
        background: 'linear-gradient(135deg, #5C6BC0 0%, #7986CB 100%)',
        borderRadius: '16px 16px 0 0',
        flexShrink: 0,
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

      {/* ── Tab Bar (only when text is selected and not in chat) ── */}
      {hasText && !chatOpen && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E8EAF6',
          flexShrink: 0,
        }}>
          {(['text', 'page'] as PanelView[]).map((tab) => (
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
              {tab === 'text' ? '✏️ Text Actions' : '📄 Page Intel'}
            </button>
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

            {chatMessages.map((msg, i) => (
              <ChatBubble key={i} message={msg} fontStack={fontStack} />
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
                      <span style={{
                        display: 'inline-block',
                        width: '2px',
                        height: '14px',
                        background: '#5C6BC0',
                        marginLeft: '2px',
                        verticalAlign: 'text-bottom',
                        animation: 'linguaPulse 0.8s ease-in-out infinite',
                      }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: '#5C6BC0',
                          animation: `linguaPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
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
            <div style={{
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
            }}>
              "{truncatedText}"
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F2FF', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
              Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {TEXT_ACTIONS.map(({ key, label, icon }) => {
                const isActive = activeTextAction === key && textState === 'loading';
                return (
                  <button
                    key={key}
                    onClick={() => handleTextAction(key)}
                    disabled={textState === 'loading'}
                    style={actionBtnStyle(activeTextAction === key, textState === 'loading' && activeTextAction !== key)}
                    onMouseEnter={e => {
                      if (textState !== 'loading') {
                        e.currentTarget.style.background = '#EEF0FF';
                        e.currentTarget.style.borderColor = '#C5CAE9';
                        e.currentTarget.style.color = '#3F51B5';
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeTextAction !== key) {
                        e.currentTarget.style.background = '#F8F9FE';
                        e.currentTarget.style.borderColor = '#E8EAF6';
                        e.currentTarget.style.color = '#374151';
                      }
                    }}
                  >
                    <span style={{
                      display: 'inline-block',
                      ...(isActive ? { animation: 'linguaSpin 0.8s linear infinite' } : {}),
                    }}>{isActive ? '⟳' : icon}</span>
                    {isActive ? 'Processing…' : label}
                  </button>
                );
              })}
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
            {textState === 'loading' && (
              <div style={{ textAlign: 'center', color: '#5C6BC0', fontSize: '13px', paddingTop: '12px' }}>
                <div style={{
                  display: 'inline-block', width: '22px', height: '22px',
                  border: '2px solid #C5CAE9', borderTopColor: '#5C6BC0',
                  borderRadius: '50%', animation: 'linguaSpin 0.7s linear infinite', marginBottom: '7px',
                }} />
                <div>Thinking…</div>
              </div>
            )}
            {textState === 'error' && (
              <ErrorCard error={textError} fontStack={fontStack} />
            )}
            {textState === 'success' && (
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                  Result
                </div>
                <div style={{
                  background: '#F0F4FF',
                  border: '1px solid #C5CAE9',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#1A1A2E',
                  lineHeight: '1.7',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  direction: activeTextAction === 'translate_to_persian' ? 'rtl' : 'ltr',
                  textAlign: activeTextAction === 'translate_to_persian' ? 'right' : 'left',
                }}>
                  {textResult}
                </div>
                <button
                  onClick={handleTextCopy}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '8px',
                    background: textCopied ? '#43A047' : '#5C6BC0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: fontStack,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                  onMouseEnter={e => { if (!textCopied) e.currentTarget.style.background = '#3F51B5'; }}
                  onMouseLeave={e => { if (!textCopied) e.currentTarget.style.background = '#5C6BC0'; }}
                >
                  {textCopied ? '✓ Copied!' : '⎘ Copy Result'}
                </button>
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
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') {
                      e.currentTarget.style.background = '#EEF0FF';
                      e.currentTarget.style.borderColor = '#C5CAE9';
                      e.currentTarget.style.color = '#3F51B5';
                    }
                  }}
                  onMouseLeave={e => {
                    if (pageIntelState !== 'extracting') {
                      e.currentTarget.style.background = '#F8F9FE';
                      e.currentTarget.style.borderColor = '#E8EAF6';
                      e.currentTarget.style.color = '#374151';
                    }
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
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') {
                      e.currentTarget.style.background = '#EEF0FF';
                      e.currentTarget.style.borderColor = '#C5CAE9';
                      e.currentTarget.style.color = '#3F51B5';
                    }
                  }}
                  onMouseLeave={e => {
                    if (pageIntelState !== 'summarizing') {
                      e.currentTarget.style.background = '#F8F9FE';
                      e.currentTarget.style.borderColor = '#E8EAF6';
                      e.currentTarget.style.color = '#374151';
                    }
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
                    if (pageIntelState !== 'extracting' && pageIntelState !== 'summarizing') {
                      e.currentTarget.style.background = '#EEF0FF';
                      e.currentTarget.style.borderColor = '#C5CAE9';
                      e.currentTarget.style.color = '#3F51B5';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F8F9FE';
                    e.currentTarget.style.borderColor = '#E8EAF6';
                    e.currentTarget.style.color = '#374151';
                  }}
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
            {(pageIntelState === 'summarized' || pageIntelState === 'summarizing') && (
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
                  <div style={{ display: 'flex', gap: '6px' }}>
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
                  <div style={{
                    background: '#F0F4FF',
                    border: '1px solid #C5CAE9',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#1A1A2E',
                    lineHeight: '1.65',
                  }}>
                    {renderMarkdown(summary)}
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
          Your text is never stored · Press Esc to close
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChatBubble({ message, fontStack }: { message: ChatMessage; fontStack: string }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? '#5C6BC0' : '#F0F4FF',
        border: `1px solid ${isUser ? '#5C6BC0' : '#C5CAE9'}`,
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '8px 12px',
        fontSize: '13px',
        color: isUser ? 'white' : '#1A1A2E',
        lineHeight: '1.6',
        position: 'relative',
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>
        {!isUser && (
          <button
            onClick={() => navigator.clipboard.writeText(message.content).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })}
            style={{
              display: 'block',
              marginTop: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: copied ? '#43A047' : '#9CA3AF',
              padding: '0',
              fontFamily: fontStack,
              textAlign: 'right' as const,
              width: '100%',
            }}
          >
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

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
