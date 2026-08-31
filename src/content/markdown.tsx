import React from 'react';

/**
 * Minimal inline markdown renderer shared by summaries, results, and chat
 * bubbles. Handles # headers, -/* bullets, **bold**, `code`.
 * NEVER call this on a partial stream — markdown only after DONE.
 */
export type RenderMarkdownFn = (text: string) => React.ReactNode;

export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let lineIdx = 0;

  function flushList() {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${lineIdx}`} style={{ margin: '4px 0 8px 0', paddingLeft: '18px' }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  }

  function processInline(str: string, lineKey: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const pattern = /(\*\*(.*?)\*\*|`(.*?)`)/g;
    let last = 0;
    let matchIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(str)) !== null) {
      if (m.index > last) parts.push(<span key={`${lineKey}-t${matchIdx++}`}>{str.slice(last, m.index)}</span>);
      if (m[2] !== undefined) {
        parts.push(<strong key={`${lineKey}-b${matchIdx++}`}>{m[2]}</strong>);
      } else if (m[3] !== undefined) {
        parts.push(
          <code key={`${lineKey}-c${matchIdx++}`} style={{ background: '#EEF0FF', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
            {m[3]}
          </code>
        );
      }
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(<span key={`${lineKey}-t${matchIdx}`}>{str.slice(last)}</span>);
    return parts;
  }

  for (const line of lines) {
    const lineKey = `l${lineIdx}`;
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const content = line.replace(/^#+\s/, '');
      nodes.push(
        <div key={lineKey} style={{ fontWeight: 700, fontSize: '13px', color: '#3F51B5', margin: '10px 0 4px' }}>
          {processInline(content, lineKey)}
        </div>
      );
    } else if (/^[-*•]\s/.test(line)) {
      const content = line.replace(/^[-*•]\s/, '');
      listItems.push(<li key={lineKey} style={{ marginBottom: '2px', lineHeight: '1.5' }}>{processInline(content, lineKey)}</li>);
    } else if (line.trim() === '') {
      flushList();
      nodes.push(<div key={lineKey} style={{ height: '4px' }} />);
    } else {
      flushList();
      nodes.push(
        <p key={lineKey} style={{ margin: '0 0 6px', lineHeight: '1.6' }}>
          {processInline(line, lineKey)}
        </p>
      );
    }
    lineIdx++;
  }
  flushList();
  return <>{nodes}</>;
}
