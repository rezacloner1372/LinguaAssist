import React, { useEffect, useState } from 'react';
import { getSettings } from '../shared/storage';

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

export function Popup() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setConfigured(Boolean(s.baseUrl && s.model));
    });
  }, []);

  return (
    <div style={{
      width: '280px',
      fontFamily: fontStack,
      background: '#FFFFFF',
      color: '#1A1A2E',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5C6BC0 0%, #7986CB 100%)',
        padding: '20px 20px 16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '28px', marginBottom: '6px' }}>✦</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: '18px', letterSpacing: '0.02em' }}>
          LinguaAssist
        </div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', marginTop: '2px' }}>
          Bilingual AI assistant
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          background: configured === true ? '#F0FDF4' : configured === false ? '#FEF2F2' : '#F8F9FE',
          border: `1px solid ${configured === true ? '#BBF7D0' : configured === false ? '#FECACA' : '#E8EAF6'}`,
          borderRadius: '10px',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: configured === true ? '#22C55E' : configured === false ? '#EF4444' : '#9CA3AF',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '13px', color: '#374151' }}>
            {configured === null
              ? 'Checking configuration…'
              : configured
              ? 'LLM configured and ready'
              : 'LLM not configured yet'}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6', marginBottom: '16px' }}>
          <strong style={{ color: '#374151' }}>How to use:</strong>
          <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
            <li>Select text on any webpage</li>
            <li>Click the <strong>✦ LinguaAssist</strong> button</li>
            <li>Choose your action</li>
            <li>Copy the result</li>
          </ol>
        </div>

        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={{
            width: '100%',
            padding: '10px',
            background: '#5C6BC0',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: fontStack,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3F51B5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#5C6BC0')}
        >
          ⚙ Configure Settings
        </button>
      </div>

      <div style={{
        padding: '8px 20px 12px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#C4C9E8',
      }}>
        Your text stays private · v1.0.0
      </div>
    </div>
  );
}
