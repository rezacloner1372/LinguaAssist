import React, { useState, useRef, useCallback } from 'react';
import type { Action } from '../shared/types';
import { sendLLMRequest } from '../shared/messages';

interface Props {
  selectedText: string;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
}

type PanelState = 'idle' | 'loading' | 'success' | 'error';

const ACTIONS: { key: Action; label: string; icon: string }[] = [
  { key: 'translate_to_persian', label: 'Translate → Persian', icon: '🔄' },
  { key: 'translate_to_english', label: 'Translate → English', icon: '🔄' },
  { key: 'fix_grammar', label: 'Fix Grammar', icon: '✏️' },
];

export function FloatingPanel({ selectedText, anchorX, anchorY, onClose }: Props) {
  const [state, setState] = useState<PanelState>('idle');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const panelWidth = 340;
  const panelHeight = 420;
  const padding = 12;

  let left = anchorX + 8;
  let top = anchorY + 8;

  if (left + panelWidth > window.innerWidth - padding) {
    left = window.innerWidth - panelWidth - padding;
  }
  if (left < padding) left = padding;
  if (top + panelHeight > window.innerHeight - padding) {
    top = anchorY - panelHeight - 8;
  }
  if (top < padding) top = padding;

  const handleAction = useCallback(async (action: Action) => {
    setActiveAction(action);
    setState('loading');
    setResult('');
    setError('');
    setCopied(false);

    try {
      const response = await sendLLMRequest({ text: selectedText, action });
      if (response.success && response.data) {
        setResult(response.data);
        setState('success');
      } else {
        setError(response.error ?? 'Unknown error occurred.');
        setState('error');
      }
    } catch (err) {
      setError('Failed to contact extension background. Please reload.');
      setState('error');
    }
  }, [selectedText]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const truncated = selectedText.length > 120
    ? selectedText.slice(0, 120) + '…'
    : selectedText;

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
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
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #F0F2FF',
        background: 'linear-gradient(135deg, #5C6BC0 0%, #7986CB 100%)',
        borderRadius: '16px 16px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', letterSpacing: '0.02em' }}>
            LinguaAssist
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            width: '28px',
            height: '28px',
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

      {/* Selected text preview */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0F2FF' }}>
        <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
          Selected Text
        </div>
        <div style={{
          fontSize: '13px',
          color: '#374151',
          lineHeight: '1.5',
          maxHeight: '60px',
          overflow: 'hidden',
          background: '#F8F9FE',
          borderRadius: '8px',
          padding: '8px 10px',
          border: '1px solid #E8EAF6',
          fontStyle: 'italic',
        }}>
          "{truncated}"
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0F2FF' }}>
        <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ACTIONS.map(({ key, label, icon }) => {
            const isActive = activeAction === key && state === 'loading';
            return (
              <button
                key={key}
                onClick={() => handleAction(key)}
                disabled={state === 'loading'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: activeAction === key ? '#EEF0FF' : '#F8F9FE',
                  border: `1px solid ${activeAction === key ? '#C5CAE9' : '#E8EAF6'}`,
                  borderRadius: '10px',
                  cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  color: activeAction === key ? '#3F51B5' : '#374151',
                  fontWeight: activeAction === key ? 600 : 400,
                  fontFamily: fontStack,
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  opacity: state === 'loading' && activeAction !== key ? 0.5 : 1,
                  width: '100%',
                }}
                onMouseEnter={e => {
                  if (state !== 'loading') {
                    e.currentTarget.style.background = '#EEF0FF';
                    e.currentTarget.style.borderColor = '#C5CAE9';
                    e.currentTarget.style.color = '#3F51B5';
                  }
                }}
                onMouseLeave={e => {
                  if (activeAction !== key) {
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

      {/* Result area */}
      <div style={{ padding: '10px 16px', flex: 1 }}>
        {state === 'idle' && (
          <div style={{
            textAlign: 'center',
            color: '#9CA3AF',
            fontSize: '13px',
            paddingTop: '12px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>✦</div>
            <div>Select an action to get started</div>
          </div>
        )}

        {state === 'loading' && (
          <div style={{
            textAlign: 'center',
            color: '#5C6BC0',
            fontSize: '13px',
            paddingTop: '12px',
          }}>
            <div style={{
              display: 'inline-block',
              width: '24px',
              height: '24px',
              border: '2px solid #C5CAE9',
              borderTopColor: '#5C6BC0',
              borderRadius: '50%',
              animation: 'linguaSpin 0.7s linear infinite',
              marginBottom: '8px',
            }} />
            <div>Thinking…</div>
          </div>
        )}

        {state === 'error' && (
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
        )}

        {state === 'success' && (
          <div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
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
              direction: activeAction === 'translate_to_persian' ? 'rtl' : 'ltr',
              textAlign: activeAction === 'translate_to_persian' ? 'right' : 'left',
            }}>
              {result}
            </div>
            <button
              onClick={handleCopy}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '8px',
                background: copied ? '#43A047' : '#5C6BC0',
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
                gap: '6px',
              }}
              onMouseEnter={e => { if (!copied) e.currentTarget.style.background = '#3F51B5'; }}
              onMouseLeave={e => { if (!copied) e.currentTarget.style.background = '#5C6BC0'; }}
            >
              {copied ? '✓ Copied!' : '⎘ Copy Result'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 16px',
        borderTop: '1px solid #F0F2FF',
        fontSize: '11px',
        color: '#C4C9E8',
        textAlign: 'center',
      }}>
        Your text is never stored · Press Esc to close
      </div>
    </div>
  );
}
