import type { LLMSettings, VocabEntry } from './types';

const SETTINGS_KEY = 'lingua_settings';
const VOCAB_KEY = 'lingua_vocab';
const VOCAB_MAX_ENTRIES = 1000;

const DEFAULT_SETTINGS: LLMSettings = {
  baseUrl: '',
  model: '',
  apiKey: '',
  targetLangA: 'fa',
  targetLangB: 'en',
  ttsEnabled: true,
};

/**
 * Read settings from chrome.storage.local.
 * Self-healing one-time migration: if local is empty but sync has settings
 * (legacy installs stored them there), copy to local and remove from sync —
 * API keys should not sync plaintext to the user's Google account.
 */
export async function getSettings(): Promise<LLMSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (localResult) => {
      const local = localResult[SETTINGS_KEY] as LLMSettings | undefined;
      if (local) {
        resolve({ ...DEFAULT_SETTINGS, ...local });
        return;
      }
      chrome.storage.sync.get(SETTINGS_KEY, (syncResult) => {
        const legacy = syncResult[SETTINGS_KEY] as LLMSettings | undefined;
        if (legacy) {
          chrome.storage.local.set({ [SETTINGS_KEY]: legacy }, () => {
            chrome.storage.sync.remove(SETTINGS_KEY);
            resolve({ ...DEFAULT_SETTINGS, ...legacy });
          });
        } else {
          resolve({ ...DEFAULT_SETTINGS });
        }
      });
    });
  });
}

export async function saveSettings(settings: LLMSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, resolve);
  });
}

// ─── Vocabulary store ────────────────────────────────────────────────────────

export async function getVocab(): Promise<VocabEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(VOCAB_KEY, (result) => {
      resolve((result[VOCAB_KEY] as VocabEntry[] | undefined) ?? []);
    });
  });
}

export async function saveVocabEntry(entry: VocabEntry): Promise<void> {
  const vocab = await getVocab();
  // Newest first; cap the list by dropping the oldest entries
  const next = [entry, ...vocab.filter((e) => e.id !== entry.id)].slice(0, VOCAB_MAX_ENTRIES);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [VOCAB_KEY]: next }, resolve);
  });
}

export async function deleteVocabEntry(id: string): Promise<void> {
  const vocab = await getVocab();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [VOCAB_KEY]: vocab.filter((e) => e.id !== id) }, resolve);
  });
}
