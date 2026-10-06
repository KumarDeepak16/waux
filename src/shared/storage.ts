// Single source of truth: chrome.storage.local. Nothing is synced or
// uploaded. Popup, studio and the WhatsApp tab all read and write here and
// react to storage.onChanged, so no cross-context messaging is needed.

import { OBSIDIAN } from '../engines/theme/presets.ts';
import { newTemplate } from '../engines/quick/search.ts';
import type { Settings, State, Template, Theme, Vault } from './types.ts';

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: 'system',
  shield: false,
  focus: false,
  reduceMotion: false,
  privacy: {
    // What Privacy Shield hides. Shield itself is the on/off switch.
    messages: true,
    names: true,
    avatars: true,
    media: true,
    notifications: false,
    style: 'cipher',
    strength: 8,
    reveal: 'hover',
  },
  declutter: {
    communities: false,
    channels: false,
    status: false,
    calls: false,
    metaAi: false,
    promo: true,
    intro: true,
  },
  chats: {},
};

export const DEFAULT_VAULT: Vault = { hidden: [], lock: null };

export function starterTemplates(): Template[] {
  return [
    newTemplate({ title: 'Received, thanks', body: 'Thanks, received. I will get back to you shortly.', category: 'Work', shortcut: 'thanks', favorite: true }),
    newTemplate({ title: 'On my way', body: 'On my way, about 10 minutes out.', category: 'Personal', shortcut: 'omw' }),
    newTemplate({ title: 'Call later', body: 'In a meeting right now. Can I call you back in an hour?', category: 'Work', shortcut: 'later' }),
  ];
}

type Keys = keyof State;
const KEYS: Keys[] = ['settings', 'theme', 'templates', 'vault'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj((base as Record<string, unknown>)[k]) && k !== 'chats' ? deepMerge((base as any)[k], v) : v;
  }
  return out as T;
}

export function normalize(raw: Partial<Record<Keys, unknown>>): State {
  const settings = deepMerge(DEFAULT_SETTINGS, raw.settings);
  const p = settings.privacy;
  // Older versions had independent 'always blur' toggles defaulting off; a
  // Shield that hides nothing is never what anyone wants.
  if (!p.messages && !p.names && !p.avatars && !p.media) p.messages = p.names = p.avatars = p.media = true;
  return {
    settings,
    theme: deepMerge<Theme>(OBSIDIAN, raw.theme),
    templates: Array.isArray(raw.templates) ? (raw.templates as Template[]) : [],
    vault: deepMerge(DEFAULT_VAULT, raw.vault),
  };
}

export async function loadState(): Promise<State> {
  return normalize(await chrome.storage.local.get(KEYS));
}

export function save<K extends Keys>(key: K, value: State[K]): Promise<void> {
  return chrome.storage.local.set({ [key]: value });
}

/** Read-modify-write of settings against the latest stored value. */
export async function patchSettings(fn: (s: Settings) => void): Promise<Settings> {
  const s = (await loadState()).settings;
  fn(s);
  await save('settings', s);
  return s;
}

export function onState(cb: (next: Partial<State>) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    const raw: Partial<Record<Keys, unknown>> = {};
    for (const k of KEYS) if (k in changes) raw[k] = changes[k].newValue;
    if (!Object.keys(raw).length) return;
    const full = normalize(raw);
    const next: Partial<State> = {};
    for (const k of Object.keys(raw) as Keys[]) (next as any)[k] = full[k];
    cb(next);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// PIN for the Hidden Chats area. A salted SHA-256 hash kept locally. This is
// a visual privacy gate, not encryption: anyone with access to the browser
// profile can read extension storage.
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeLock(pin: string): Promise<Vault['lock']> {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt, hash: await hashPin(pin, salt) };
}
