import React, { useState } from 'react';
import type { ChatMessage } from '../shared/types';
import { isRTL } from '../shared/textDirection';
import { ListenButton } from './ListenButton';
import type { RenderMarkdownFn } from './markdown';

interface ChatBubbleProps {
  message: ChatMessage;
  fontStack: string;
  ttsEnabled: boolean;
  renderMarkdown: RenderMarkdownFn;
}

export function ChatBubble({ message, fontStack, ttsEnabled, renderMarkdown }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const rtl = isRTL(message.content);

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
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textAlign: rtl ? 'right' : 'left',
          }}
        >
          {/* Completed assistant messages render markdown; user + streaming stay plain */}
          {isUser ? message.content : renderMarkdown(message.content)}
        </div>
        {!isUser && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {ttsEnabled && <ListenButton text={message.content} fontStack={fontStack} />}
            <button
              onClick={() => navigator.clipboard.writeText(message.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                color: copied ? '#43A047' : '#9CA3AF',
                padding: '0',
                fontFamily: fontStack,
              }}
            >
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
