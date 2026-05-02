import type { LLMSettings } from './types';

const STORAGE_KEY = 'lingua_settings';

const DEFAULT_SETTINGS: LLMSettings = {
  baseUrl: '',
  model: '',
  apiKey: '',
};

export async function getSettings(): Promise<LLMSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] ?? DEFAULT_SETTINGS);
    });
  });
}

export async function saveSettings(settings: LLMSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
  });
}
