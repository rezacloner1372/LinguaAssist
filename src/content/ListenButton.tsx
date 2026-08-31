import React, { useState, useEffect, useRef } from 'react';
import { sendTtsSpeak, sendTtsStop } from '../shared/messages';
import { detectLangTag } from '../shared/textDirection';

interface Props {
  text: string;
  fontStack: string;
}

/**
 * 🔊/⏹ toggle — speaks via chrome.tts in the service worker (detected lang),
 * falls back to in-page speechSynthesis when chrome.tts is unavailable or
 * errors (e.g. no Persian voice installed on the platform).
 */
export function ListenButton({ text, fontStack }: Props) {
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const usingFallbackRef = useRef(false);

  const stop = () => {
    if (usingFallbackRef.current) {
      window.speechSynthesis.cancel();
      usingFallbackRef.current = false;
    } else {
      sendTtsStop().catch(() => { /* ignore */ });
    }
    playingRef.current = false;
    setPlaying(false);
  };

  const speakFallback = () => {
    usingFallbackRef.current = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = detectLangTag(text);
    utterance.onend = () => { playingRef.current = false; setPlaying(false); };
    utterance.onerror = () => { playingRef.current = false; setPlaying(false); };
    window.speechSynthesis.speak(utterance);
  };

  const handleClick = () => {
    if (playingRef.current) {
      stop();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    sendTtsSpeak({ text, lang: detectLangTag(text) })
      .then((res) => {
        if (!res?.success) speakFallback();
      })
      .catch(() => speakFallback());
    // chrome.tts has no completion callback into the content script — the
    // button stays a manual ⏹ toggle until clicked or unmounted.
  };

  // Stop speaking when the component unmounts (panel close)
  useEffect(() => {
    return () => {
      if (playingRef.current) {
        if (usingFallbackRef.current) {
          window.speechSynthesis.cancel();
        } else {
          sendTtsStop().catch(() => { /* ignore */ });
        }
      }
    };
  }, []);

  return (
    <button
      onClick={handleClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '11px',
        color: playing ? '#3F51B5' : '#9CA3AF',
        padding: '0',
        fontFamily: fontStack,
      }}
      title={playing ? 'Stop' : 'Listen'}
    >
      {playing ? '⏹ Stop' : '🔊 Listen'}
    </button>
  );
}
