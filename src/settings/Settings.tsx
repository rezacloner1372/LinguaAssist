import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getVocab, deleteVocabEntry } from '../shared/storage';
import { sendHealthCheck } from '../shared/messages';
import { isRTL } from '../shared/textDirection';
import type { LLMSettings, HealthStatus, VocabEntry } from '../shared/types';

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

export function Settings() {
  const [settings, setSettings] = useState<LLMSettings>({ baseUrl: '', model: '', apiKey: '', targetLangA: 'fa', targetLangB: 'en', ttsEnabled: true });
  const [savedApiKey, setSavedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [healthInfo, setHealthInfo] = useState<{ time?: number; error?: string }>({});

  // Vocabulary
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [vocabSearch, setVocabSearch] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setSavedApiKey(s.apiKey);
    });
    getVocab().then(setVocab);
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    setSavedApiKey(settings.apiKey);
    setApiKeyDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCheckConnection = async () => {
    setHealthStatus('checking');
    setHealthInfo({});
    try {
      const response = await sendHealthCheck(settings);
      if (response.success) {
        setHealthStatus('healthy');
        setHealthInfo({ time: response.responseTimeMs });
      } else {
        setHealthStatus('unhealthy');
        setHealthInfo({ error: response.error, time: response.responseTimeMs });
      }
    } catch (err) {
      setHealthStatus('unhealthy');
      setHealthInfo({ error: 'Could not reach extension background service.' });
    }
  };

  const handleDeleteVocab = async (id: string) => {
    await deleteVocabEntry(id);
    setVocab((prev) => prev.filter((e) => e.id !== id));
  };

  const handleExportCsv = () => {
    // BOM prefix or Excel renders Persian as mojibake
    const header = 'Source,Translation,Pair,Page,Date';
    const escape = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const rows = vocab.map((e) =>
      [escape(e.source), escape(e.translation), escape(e.langPair), escape(e.pageUrl), new Date(e.savedAt).toISOString()].join(','),
    );
    const csv = '﻿' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linguaassist-vocabulary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayApiKey = () => {
    if (showApiKey) return settings.apiKey;
    if (!apiKeyDirty && savedApiKey) {
      return '•'.repeat(Math.min(savedApiKey.length, 24));
    }
    return settings.apiKey;
  };

  const filteredVocab = vocabSearch.trim()
    ? vocab.filter((e) => {
        const q = vocabSearch.trim().toLowerCase();
        return e.source.toLowerCase().includes(q) || e.translation.toLowerCase().includes(q);
      })
    : vocab;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #E8EAF6',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: fontStack,
    color: '#1A1A2E',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    background: '#FAFBFF',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9CA3AF',
    marginTop: '4px',
  };

  const focusBlur = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = '#5C6BC0';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(92,107,192,0.1)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = '#E8EAF6';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    border: '1px solid #E8EAF6',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F9FE',
      fontFamily: fontStack,
      color: '#1A1A2E',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #5C6BC0 0%, #7986CB 100%)',
        padding: '20px 24px',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>✦</span>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '18px' }}>LinguaAssist</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px' }}>Settings & Configuration</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px' }}>

        {/* LLM Configuration Card */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>
            LLM Configuration
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280' }}>
            Connect to any OpenAI-compatible endpoint. Works with OpenAI, Ollama, Together.ai, Groq, and others.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Base URL</label>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              style={inputStyle}
              {...focusBlur}
            />
            <p style={hintStyle}>The base URL of the OpenAI-compatible API endpoint</p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Model</label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              placeholder="gpt-4o-mini"
              style={inputStyle}
              {...focusBlur}
            />
            <p style={hintStyle}>e.g. gpt-4o-mini, llama3.2, mistral-7b</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>API Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={displayApiKey()}
                onChange={(e) => {
                  setApiKeyDirty(true);
                  setSettings({ ...settings, apiKey: e.target.value });
                }}
                onFocus={() => {
                  if (!apiKeyDirty && savedApiKey && !showApiKey) {
                    setApiKeyDirty(true);
                    setSettings(prev => ({ ...prev, apiKey: '' }));
                  }
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#E8EAF6';
                  e.currentTarget.style.boxShadow = 'none';
                  if (apiKeyDirty && !settings.apiKey) {
                    setApiKeyDirty(false);
                    setSettings(prev => ({ ...prev, apiKey: savedApiKey }));
                  }
                }}
                placeholder="sk-..."
                style={{ ...inputStyle, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#9CA3AF',
                  padding: '2px 4px',
                }}
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? '🙈' : '👁'}
              </button>
            </div>
            <p style={hintStyle}>Stored locally in Chrome extension storage (not synced to your Google account).</p>
          </div>

          {/* Advanced generation params */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max Context Tokens</label>
              <input
                type="number"
                min={1000}
                step={500}
                value={settings.maxContextTokens ?? ''}
                onChange={(e) => setSettings({ ...settings, maxContextTokens: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="8000"
                style={inputStyle}
                {...focusBlur}
              />
              <p style={hintStyle}>Page content budget for summarize/chat</p>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature ?? ''}
                onChange={(e) => setSettings({ ...settings, temperature: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0.1"
                style={inputStyle}
                {...focusBlur}
              />
              <p style={hintStyle}>0 = deterministic, 2 = creative</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '12px',
              background: saved ? '#43A047' : '#5C6BC0',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: fontStack,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { if (!saved) e.currentTarget.style.background = '#3F51B5'; }}
            onMouseLeave={e => { if (!saved) e.currentTarget.style.background = '#5C6BC0'; }}
          >
            {saved ? '✓ Settings Saved!' : 'Save Settings'}
          </button>
        </div>

        {/* Language & Voice Card */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>
            Language Pair & Voice
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280' }}>
            Translate ⇄ auto-detects direction: text in Language A is translated to B and vice versa.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Language A</label>
              <input
                type="text"
                value={settings.targetLangA ?? 'fa'}
                onChange={(e) => setSettings({ ...settings, targetLangA: e.target.value })}
                placeholder="fa"
                style={inputStyle}
                {...focusBlur}
              />
            </div>
            <div style={{ padding: '0 2px 10px', color: '#9CA3AF', fontSize: '16px' }}>⇄</div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Language B</label>
              <input
                type="text"
                value={settings.targetLangB ?? 'en'}
                onChange={(e) => setSettings({ ...settings, targetLangB: e.target.value })}
                placeholder="en"
                style={inputStyle}
                {...focusBlur}
              />
            </div>
          </div>
          <p style={{ ...hintStyle, marginBottom: '16px' }}>
            ISO codes (fa, en, de, fr, es, ar, tr…) or full names. Defaults: fa ⇄ en.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
            <input
              type="checkbox"
              checked={settings.ttsEnabled !== false}
              onChange={(e) => setSettings({ ...settings, ttsEnabled: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#5C6BC0' }}
            />
            Show 🔊 Listen buttons on results (text-to-speech)
          </label>
        </div>

        {/* Health Check Card */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>
            Connection Health
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280' }}>
            Verify your endpoint is reachable and the API key is valid.
          </p>

          {healthStatus !== 'idle' && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '10px',
              marginBottom: '16px',
              background:
                healthStatus === 'checking' ? '#F8F9FE' :
                healthStatus === 'healthy' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${
                healthStatus === 'checking' ? '#E8EAF6' :
                healthStatus === 'healthy' ? '#BBF7D0' : '#FECACA'
              }`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: healthInfo.error ? '8px' : '0' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background:
                    healthStatus === 'checking' ? '#9CA3AF' :
                    healthStatus === 'healthy' ? '#22C55E' : '#EF4444',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color:
                    healthStatus === 'checking' ? '#374151' :
                    healthStatus === 'healthy' ? '#15803D' : '#B91C1C',
                }}>
                  {healthStatus === 'checking' ? 'Checking…' :
                   healthStatus === 'healthy' ? `Healthy${healthInfo.time ? ` · ${healthInfo.time}ms` : ''}` :
                   `Unhealthy${healthInfo.time ? ` · ${healthInfo.time}ms` : ''}`}
                </span>
              </div>
              {healthInfo.error && (
                <div style={{ fontSize: '13px', color: '#B91C1C', paddingLeft: '18px' }}>
                  {healthInfo.error}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleCheckConnection}
            disabled={healthStatus === 'checking' || !settings.baseUrl || !settings.model}
            style={{
              width: '100%',
              padding: '12px',
              background: healthStatus === 'checking' ? '#9CA3AF' : '#5C6BC0',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (healthStatus === 'checking' || !settings.baseUrl || !settings.model) ? 'not-allowed' : 'pointer',
              fontFamily: fontStack,
              transition: 'background 0.15s',
              opacity: (!settings.baseUrl || !settings.model) ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (healthStatus !== 'checking' && settings.baseUrl && settings.model) e.currentTarget.style.background = '#3F51B5'; }}
            onMouseLeave={e => { if (healthStatus !== 'checking') e.currentTarget.style.background = '#5C6BC0'; }}
          >
            {healthStatus === 'checking' ? '⟳ Checking…' : '⚡ Check Connection'}
          </button>
          {(!settings.baseUrl || !settings.model) && (
            <p style={{ ...hintStyle, textAlign: 'center', marginTop: '8px' }}>
              Enter Base URL and Model to enable health check
            </p>
          )}
        </div>

        {/* Vocabulary Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>
              📚 Vocabulary
            </h2>
            {vocab.length > 0 && (
              <button
                onClick={handleExportCsv}
                style={{
                  background: '#5C6BC0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: fontStack,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3F51B5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#5C6BC0')}
              >
                ⤓ Export CSV
              </button>
            )}
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6B7280' }}>
            Translations you save with 📚 in the panel appear here. {vocab.length} {vocab.length === 1 ? 'entry' : 'entries'}.
          </p>

          {vocab.length > 0 && (
            <input
              type="text"
              value={vocabSearch}
              onChange={(e) => setVocabSearch(e.target.value)}
              placeholder="Search vocabulary…"
              style={{ ...inputStyle, marginBottom: '12px' }}
              {...focusBlur}
            />
          )}

          {vocab.length === 0 ? (
            <div style={{
              textAlign: 'center', color: '#9CA3AF', fontSize: '13px', padding: '20px 0',
              background: '#F8F9FE', borderRadius: '10px', border: '1px solid #E8EAF6',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>📚</div>
              <div>No saved words yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Translate text and click 📚 Save in the panel</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
              {filteredVocab.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: '1px solid #E8EAF6',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    background: '#FAFBFF',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        dir={isRTL(entry.source) ? 'rtl' : 'ltr'}
                        style={{ fontSize: '13px', color: '#374151', fontWeight: 600, textAlign: isRTL(entry.source) ? 'right' : 'left', wordBreak: 'break-word' }}
                      >
                        {entry.source.length > 80 ? entry.source.slice(0, 80) + '…' : entry.source}
                      </div>
                      <div
                        dir={isRTL(entry.translation) ? 'rtl' : 'ltr'}
                        style={{ fontSize: '13px', color: '#1A1A2E', marginTop: '3px', textAlign: isRTL(entry.translation) ? 'right' : 'left', wordBreak: 'break-word' }}
                      >
                        {entry.translation.length > 80 ? entry.translation.slice(0, 80) + '…' : entry.translation}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '5px' }}>
                        {entry.langPair} · {new URL(entry.pageUrl).hostname} · {new Date(entry.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteVocab(entry.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: '#9CA3AF', padding: '2px 4px', flexShrink: 0,
                      }}
                      title="Delete entry"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
              {filteredVocab.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', padding: '12px 0' }}>
                  No matches for "{vocabSearch}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Privacy card */}
        <div style={{
          background: '#F0F4FF',
          borderRadius: '16px',
          border: '1px solid #C5CAE9',
          padding: '20px 24px',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: '#3F51B5' }}>
            🔒 Privacy & Data Handling
          </h3>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '13px', color: '#374151', lineHeight: '1.7' }}>
            <li>Text is only sent when you explicitly trigger an action.</li>
            <li>Nothing is stored after a response, except vocabulary entries you save explicitly — those stay in local storage only.</li>
            <li>Your API key is stored in Chrome's local extension storage only (never synced).</li>
            <li>No data is collected or transmitted to LinguaAssist servers.</li>
            <li>All requests go directly from your browser to your configured LLM endpoint.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#C4C9E8' }}>
          LinguaAssist v1.1.0 · Open source · Your AI, your data
        </div>
      </div>
    </div>
  );
}
