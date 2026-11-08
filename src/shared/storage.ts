import type { ActionGroup, LLMProfile, LLMSettings, VocabEntry } from './types';

export const SETTINGS_KEY = 'lingua_settings';
const VOCAB_KEY = 'lingua_vocab';
const VOCAB_MAX_ENTRIES = 1000;

const DEFAULT_SETTINGS: LLMSettings = {
  baseUrl: '',
  model: '',
  apiKey: '',
  targetLangA: 'fa',
  targetLangB: 'en',
  ttsEnabled: true,
  showPageButton: true,
  disabledSites: [],
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
        resolve(ensureProfiles({ ...DEFAULT_SETTINGS, ...local }));
        return;
      }
      chrome.storage.sync.get(SETTINGS_KEY, (syncResult) => {
        const legacy = syncResult[SETTINGS_KEY] as LLMSettings | undefined;
        if (legacy) {
          chrome.storage.local.set({ [SETTINGS_KEY]: legacy }, () => {
            chrome.storage.sync.remove(SETTINGS_KEY);
            resolve(ensureProfiles({ ...DEFAULT_SETTINGS, ...legacy }));
          });
        } else {
          resolve(ensureProfiles({ ...DEFAULT_SETTINGS }));
        }
      });
    });
  });
}

export async function saveSettings(settings: LLMSettings): Promise<void> {
  const toSave = mirrorActiveProfile(settings);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: toSave }, resolve);
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

// ─── Per-site disable ────────────────────────────────────────────────────────

/** Normalize user input ("https://www.Example.com/path") to a bare hostname. */
export function normalizeSite(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
}

/** True if `hostname` equals a disabled site or is a subdomain of one. */
export function isSiteDisabled(settings: LLMSettings, hostname: string): boolean {
  const host = normalizeSite(hostname);
  return (settings.disabledSites ?? []).some((entry) => {
    const site = normalizeSite(entry);
    return site !== '' && (host === site || host.endsWith('.' + site));
  });
}

// ─── Connection profiles ─────────────────────────────────────────────────────

/** New profile id; unique enough for a handful of local entries. */
export function newProfileId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Guarantee at least one profile. Installs from before profiles existed get a
 * "Default" profile built from their top-level baseUrl/model/apiKey.
 */
export function ensureProfiles(settings: LLMSettings): LLMSettings {
  if (settings.profiles && settings.profiles.length > 0) {
    const active = settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0];
    return mirrorActiveProfile({ ...settings, activeProfileId: active.id });
  }
  const profile: LLMProfile = {
    id: 'default',
    name: 'Default',
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
  };
  return { ...settings, profiles: [profile], activeProfileId: profile.id };
}

/** Copy the active profile's connection fields onto the top level. */
export function mirrorActiveProfile(settings: LLMSettings): LLMSettings {
  const active = settings.profiles?.find((p) => p.id === settings.activeProfileId);
  return active
    ? { ...settings, baseUrl: active.baseUrl, model: active.model, apiKey: active.apiKey }
    : settings;
}

export function groupForAction(action: string): ActionGroup {
  switch (action) {
    case 'translate':
    case 'translate_to_persian':
    case 'translate_to_english':
      return 'translate';
    case 'explain':
      return 'explain';
    default:
      return 'rewrite'; // fix_grammar, rewrite_*, reply_draft, summarize_selection
  }
}

/**
 * Settings with baseUrl/model/apiKey swapped for the profile routed to
 * `group` (falls back to the active profile when none is set or it was deleted).
 */
export function resolveForGroup(settings: LLMSettings, group: ActionGroup): LLMSettings {
  const id = settings.actionProfiles?.[group];
  const profile = id ? settings.profiles?.find((p) => p.id === id) : undefined;
  return profile
    ? { ...settings, baseUrl: profile.baseUrl, model: profile.model, apiKey: profile.apiKey }
    : settings;
}
