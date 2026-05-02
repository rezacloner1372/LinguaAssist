import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../shared/storage';
import { sendHealthCheck } from '../shared/messages';
import type { LLMSettings, HealthStatus } from '../shared/types';

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif";

export function Settings() {
  const [settings, setSettings] = useState<LLMSettings>({ baseUrl: '', model: '', apiKey: '' });
  const [savedApiKey, setSavedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle');
  const [healthInfo, setHealthInfo] = useState<{ time?: number; error?: string }>({});

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setSavedApiKey(s.apiKey);
    });
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

  const displayApiKey = () => {
    if (showApiKey) return settings.apiKey;
    if (!apiKeyDirty && savedApiKey) {
      return '•'.repeat(Math.min(savedApiKey.length, 24));
    }
    return settings.apiKey;
  };

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
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #E8EAF6',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
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
              onFocus={e => {
                e.currentTarget.style.borderColor = '#5C6BC0';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(92,107,192,0.1)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#E8EAF6';
                e.currentTarget.style.boxShadow = 'none';
              }}
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
              onFocus={e => {
                e.currentTarget.style.borderColor = '#5C6BC0';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(92,107,192,0.1)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#E8EAF6';
                e.currentTarget.style.boxShadow = 'none';
              }}
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
            <p style={hintStyle}>Your API key is stored locally in Chrome extension storage and never shared.</p>
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

        {/* Health Check Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #E8EAF6',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
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
            <li>No text is stored by the extension after the response is received.</li>
            <li>Your API key is stored in Chrome's local extension storage only.</li>
            <li>No data is collected or transmitted to LinguaAssist servers.</li>
            <li>All requests go directly from your browser to your configured LLM endpoint.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#C4C9E8' }}>
          LinguaAssist v1.0.0 · Open source · Your AI, your data
        </div>
      </div>
    </div>
  );
}
