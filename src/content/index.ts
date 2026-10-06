// WAUX content script: wires storage, engines, the WhatsApp adapter and the
// overlay together. Runs at document_start so the theme lands before
// WhatsApp paints.

import { h, render } from 'preact';
import { insertText, replaceBeforeCaret, textBeforeCaret } from '../adapter/composer.ts';
import { WhatsAppAdapter } from '../adapter/whatsapp.ts';
import { chatRows, normalizeName, probeHooks } from '../adapter/selectors.ts';
import { downloadText, layoutReport, navAnchor } from '../adapter/report.ts';
import { declutterFlags, installReveal, privacyFlags } from '../engines/privacy/privacy.ts';
import { chatListVisible, hideDividers, introShowing, markColumns, markInitials, markInputs, markWallpaper, tagNav, tagPromo } from '../adapter/markers.ts';
import { shortcutToken, templatesForShortcut } from '../engines/quick/search.ts';
import { chatAccentCss, whatsappCss } from '../engines/theme/compile.ts';
import { Overlay, type Actions, type UiState, type View } from '../overlay/Overlay.tsx';
import overlayCss from '../overlay/overlay.css';
import { createStore } from '../overlay/store.ts';
import { loadState, normalize, onState, save } from '../shared/storage.ts';
import type { Density, Mode, State, Template } from '../shared/types.ts';
import componentsCss from '../ui/components.css';

const root = document.documentElement;

// One live instance per tab. After an extension update the service worker
// injects a fresh copy; the stale one hears this event and retires.
document.dispatchEvent(new CustomEvent('waux:replace'));
const life = new AbortController();
const signal = life.signal;

let state: State = normalize({});
const adapter = new WhatsAppAdapter();
const ui = createStore<UiState>({ view: null, query: '', suggest: null, toast: null, dock: null, stage: null, unlocked: false, version: 0 });

function styleEl(id: string) {
  const el = document.createElement('style');
  el.id = id;
  (document.head ?? root).appendChild(el);
  return el;
}
const themeStyle = styleEl('waux-theme');
const chatStyle = styleEl('waux-chat');

// ---- Apply state -------------------------------------------------------------

let flagKeys: string[] = [];
function setFlags(flags: Record<string, boolean>) {
  for (const k of flagKeys) if (!(k in flags)) root.classList.remove(k);
  for (const [k, v] of Object.entries(flags)) root.classList.toggle(k, v);
  flagKeys = Object.keys(flags);
}

let disposeReveal: (() => void) | null = null;

function apply() {
  const s = state.settings;
  root.classList.toggle('waux', s.enabled);
  if (!s.enabled) {
    themeStyle.textContent = '';
    chatStyle.textContent = '';
    setFlags({});
    root.classList.remove('waux-font', 'waux-reduce-motion', 'waux-focus-on', 'waux-nochat', 'waux-wall-ambient', 'waux-wall-plain');
    root.dataset.wauxNotif = '0';
    adapter.stop();
    disposeReveal?.();
    disposeReveal = null;
    ui.set({ view: null, suggest: null, dock: null, stage: null });
    return;
  }
  themeStyle.textContent = whatsappCss(state.theme, s.mode);
  root.classList.toggle('waux-font', state.theme.font === 'geist');
  root.classList.toggle('waux-reduce-motion', s.reduceMotion);
  root.classList.toggle('waux-wall-ambient', state.theme.wallpaper === 'ambient');
  root.classList.toggle('waux-wall-plain', state.theme.wallpaper === 'plain');
  host?.classList.toggle('reduce-motion', s.reduceMotion);
  root.style.setProperty('--waux-blur-px', `${s.privacy.strength}px`);
  // Read by the main-world script when WhatsApp raises a notification.
  root.dataset.wauxNotif = s.privacy.notifications || s.shield ? '1' : '0';
  applyChat();
  adapter.setHidden(state.vault.hidden);
  adapter.start();
  disposeReveal ??= installReveal(root);
  if (document.body) scan();
  ui.set({ version: ui.get().version + 1 });
}

let dividerX = 0;

function applyChat() {
  if (!state.settings.enabled) return;
  const chat = adapter.activeChat;
  const prefs = chat ? state.settings.chats[chat] : undefined;
  setFlags({ ...privacyFlags(state.settings, !!prefs?.blur), ...declutterFlags(state.settings) });
  chatStyle.textContent = prefs?.accent ? chatAccentCss(state.theme, state.settings.mode, prefs.accent) : '';
  root.classList.toggle('waux-nochat', !adapter.hasChat);
  const focusOn = state.settings.focus && adapter.hasChat;
  if (focusOn && !root.classList.contains('waux-focus-on')) {
    // Remember where the chat list ended so its divider can be hidden too.
    dividerX = markColumns().side?.getBoundingClientRect().right ?? 0;
    requestAnimationFrame(() => hideDividers(dividerX));
  }
  root.classList.toggle('waux-focus-on', focusOn);
  stage();
}

adapter.onChatChange = () => {
  applyChat();
  ui.set({ version: ui.get().version + 1 });
};
adapter.onLayoutChange = () => {
  applyChat();
  // A chat just opened or closed: refresh its markers right away.
  requestAnimationFrame(() => {
    markInputs();
    scan();
  });
};

apply();
loadState().then((s) => {
  state = s;
  apply();
});

const stopState = onState((next) => {
  const prev = state.settings;
  state = { ...state, ...next };
  if (next.settings && prev.enabled && next.settings.enabled) {
    if (prev.shield !== next.settings.shield) toast(`Privacy Shield ${next.settings.shield ? 'on' : 'off'}`);
    else if (prev.focus !== next.settings.focus) toast(`Focus Mode ${next.settings.focus ? 'on' : 'off'}`);
  }
  apply();
});

// ---- Writes ------------------------------------------------------------------

async function persist<K extends keyof State>(key: K, value: State[K]) {
  state = { ...state, [key]: value };
  apply();
  try {
    await save(key, value);
  } catch {
    toast('WAUX was updated. Reload this tab to keep changes.');
  }
}

const patchSettings = (fn: (s: State['settings']) => void) => {
  const s = structuredClone(state.settings);
  fn(s);
  return persist('settings', s);
};

function bumpUses(t: Template) {
  persist(
    'templates',
    state.templates.map((x) => (x.id === t.id ? { ...x, uses: x.uses + 1 } : x)),
  );
}

let toastTimer = 0;
function toast(text: string, undo?: () => void) {
  ensureOverlay();
  const wrapped = undo && (() => {
    ui.set({ toast: null });
    undo();
  });
  ui.set({ toast: { text, undo: wrapped } });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.set({ toast: null }), undo ? 5000 : 2200);
}

const MODES: Mode[] = ['system', 'dark', 'light'];
const DENSITIES: Density[] = ['compact', 'comfortable', 'spacious'];
const next = <T,>(list: T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

const actions: Actions = {
  state: () => state,
  activeChat: () => adapter.activeChat,
  visibleChats: () => adapter.visibleChats(),
  hasChat: () => adapter.hasChat,
  close,
  show,
  toast,
  toggleShield: () => patchSettings((s) => void (s.shield = !s.shield)),
  toggleFocus: () => patchSettings((s) => void (s.focus = !s.focus)),
  cycleMode: () => patchSettings((s) => void (s.mode = next(MODES, s.mode))),
  cycleDensity: () => persist('theme', { ...state.theme, density: next(DENSITIES, state.theme.density) }),
  async insertTemplate(t) {
    close();
    if (await insertText(t.body)) bumpUses(t);
    else toast('Open a chat to insert a quick message');
  },
  async acceptSuggest(t) {
    const sg = ui.get().suggest;
    ui.set({ suggest: null });
    if (sg && (await replaceBeforeCaret(sg.token.length + 1, t.body))) bumpUses(t);
  },
  setChatPrefs(name, patch) {
    patchSettings((s) => {
      const merged = { ...s.chats[name], ...patch };
      for (const k of Object.keys(merged) as (keyof typeof merged)[]) if (merged[k] === undefined || merged[k] === false) delete merged[k];
      if (Object.keys(merged).length) s.chats[name] = merged;
      else delete s.chats[name];
    });
  },
  setHidden(name, hidden) {
    const key = normalizeName(name);
    const list = state.vault.hidden.filter((n) => normalizeName(n) !== key);
    if (hidden) list.push(name);
    persist('vault', { ...state.vault, hidden: list });
    toast(hidden ? 'Hidden. Find it under the lock key on the left.' : 'Back in the chat list', () => actions.setHidden(name, !hidden));
  },
  saveLayoutReport() {
    close();
    downloadText('waux-layout-report.txt', layoutReport());
    toast('Layout report saved. It contains page structure only, no messages or names.');
  },
  async openChat(name) {
    close();
    if (!(await adapter.openChat(name))) toast('Could not find that chat. Try WhatsApp search.');
  },
  openStudio(section) {
    close();
    try {
      chrome.runtime.sendMessage({ type: 'open-studio', section });
    } catch {
      toast('WAUX was updated. Reload this tab.');
    }
  },
  unlock: () => ui.set({ unlocked: true }),
  lockNow: () => ui.set({ unlocked: false }),
};

function show(view: View, query = '') {
  ensureOverlay();
  ui.set({ view, query, suggest: null });
}

function close() {
  if (!ui.get().view) return;
  ui.set({ view: null });
}

// ---- Overlay (lazy, closed shadow root) ---------------------------------------

let host: HTMLElement | null = null;
function ensureOverlay() {
  if (host || !document.body) return;
  host = document.createElement('waux-overlay');
  host.classList.toggle('reduce-motion', state.settings.reduceMotion);
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = componentsCss + overlayCss;
  const mount = document.createElement('div');
  shadow.append(style, mount);
  // Keep keystrokes inside WAUX from reaching WhatsApp's document listeners.
  for (const type of ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'copy', 'cut']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  document.body.append(host);
  render(h(Overlay, { store: ui, actions }), mount);
}

// ---- Keyboard -------------------------------------------------------------------

const consume = (e: Event) => {
  e.preventDefault();
  e.stopImmediatePropagation();
};

let dismissedToken: string | null = null;

window.addEventListener(
  'keydown',
  (e) => {
    if (!state.settings.enabled) return;
    const sg = ui.get().suggest;
    if (sg && !e.isComposing) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        consume(e);
        const n = sg.items.length;
        ui.set({ suggest: { ...sg, index: (sg.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n } });
        return;
      }
      // Enter would send in WhatsApp; while suggestions are open it inserts instead.
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        consume(e);
        actions.acceptSuggest(sg.items[sg.index]);
        return;
      }
      if (e.key === 'Escape') {
        consume(e);
        dismissedToken = sg.token;
        ui.set({ suggest: null });
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      consume(e);
      if (ui.get().view === 'palette') close();
      else show('palette');
      return;
    }
    if (e.key === 'Escape' && ui.get().view) {
      consume(e);
      close();
    }
  },
  { capture: true, signal },
);

// ---- ;shortcut suggestions ---------------------------------------------------------

let suggestQueued = false;
function queueSuggest(e: Event) {
  if (!state.settings.enabled || suggestQueued) return;
  if (!(e.target as Element | null)?.closest?.('#main footer')) return;
  suggestQueued = true;
  requestAnimationFrame(() => {
    suggestQueued = false;
    const before = textBeforeCaret();
    const token = before ? shortcutToken(before) : null;
    if (!token) dismissedToken = null;
    const items = token && token !== dismissedToken ? templatesForShortcut(state.templates, token).slice(0, 5) : [];
    if (!items.length) {
      if (ui.get().suggest) ui.set({ suggest: null });
      return;
    }
    ensureOverlay();
    const prev = ui.get().suggest;
    ui.set({ suggest: { items, token: token!, index: prev?.token === token ? Math.min(prev.index, items.length - 1) : 0 } });
  });
}
window.addEventListener('input', queueSuggest, { capture: true, signal });
window.addEventListener('keyup', queueSuggest, { capture: true, signal });
window.addEventListener(
  'focusout',
  (e) => {
    if ((e.target as Element | null)?.closest?.('#main footer') && ui.get().suggest) ui.set({ suggest: null });
  },
  { capture: true, signal },
);

// ---- Lifecycle and diagnostics ---------------------------------------------------

document.addEventListener(
  'waux:replace',
  () => {
    life.abort();
    clearInterval(diagTimer);
    initialsObs.disconnect();
    adapter.stop();
    disposeReveal?.();
    host?.remove();
    themeStyle.remove();
    chatStyle.remove();
    try {
      stopState();
    } catch {
      // Extension context already gone.
    }
  },
  { once: true },
);

// Which WhatsApp hooks this page exposes. Booleans only, no content. Shown
// in Studio so a WhatsApp DOM change is visible instead of silent.
let lastDiag = '';
let pulses = 0;
const diagTimer = window.setInterval(() => {
  if (!state.settings.enabled || document.visibilityState !== 'visible') return;
  // Cheap geometry every second; DOM scans only for enabled features, less often.
  const n = pulses++;
  placeDock();
  stage();
  if (n % 2 === 0) markInputs();
  if (n % 5 === 0) scan();
  if (n % 6) return;
  const probe = probeHooks();
  const key = JSON.stringify(probe);
  if (key === lastDiag) return;
  lastDiag = key;
  chrome.storage.local.set({ diag: { ...probe, at: Date.now() } }).catch(() => {});
}, 1000);

// Initials avatars: watch the chat list only while photos are hidden.
let initialsQueued = false;
const initialsObs = new MutationObserver(() => {
  if (initialsQueued) return;
  initialsQueued = true;
  requestAnimationFrame(() => {
    initialsQueued = false;
    markAvatars();
  });
});
const markAvatars = () => markInitials([...chatRows(), ...document.querySelectorAll('#main [role="row"]')]);
let initialsWatched: (Element | null)[] = [];
function watchInitials() {
  const on = root.classList.contains('waux-p-avatar');
  const targets = on ? [document.getElementById('pane-side'), document.getElementById('main')] : [];
  if (targets.length === initialsWatched.length && targets.every((t, i) => t === initialsWatched[i])) return;
  initialsObs.disconnect();
  initialsWatched = targets;
  for (const t of targets) if (t) initialsObs.observe(t, { childList: true, subtree: true });
  if (on) markAvatars();
}

/** Marker passes that only matter when their feature is on. */
function scan() {
  watchInitials();
  const d = state.settings.declutter;
  if (d.communities || d.channels || d.status || d.calls || d.metaAi) tagNav(d.metaAi);
  if (d.promo) tagPromo();
  if (state.theme.wallpaper !== 'doodles') markWallpaper();
  if (root.classList.contains('waux-focus-on')) hideDividers(dividerX);
}

// The dock sits just above WhatsApp's bottom nav section (media, profile).
function placeDock() {
  const r = navAnchor();
  if (!r) {
    if (ui.get().dock) ui.set({ dock: null });
    return;
  }
  ensureOverlay();
  // Room between the last top rail item and the bottom section decides full vs compact.
  let lastTop = 0;
  for (const b of document.querySelectorAll('button[data-navbar-item="true"]')) {
    if (b.closest('[data-testid="navbar-footer-section"]')) continue;
    const br = b.getBoundingClientRect();
    if (br.height) lastTop = Math.max(lastTop, br.bottom);
  }
  const room = r.top - lastTop;
  const dock = { left: Math.round(r.left + (r.width - 40) / 2), bottom: Math.round(innerHeight - r.top + 8), compact: room < 310 };
  const cur = ui.get().dock;
  if (!cur || cur.left !== dock.left || cur.bottom !== dock.bottom || cur.compact !== dock.compact) ui.set({ dock });
}
window.addEventListener('resize', () => {
  placeDock();
  stage();
}, { signal });

/**
 * Geometry for WAUX surfaces that sit on WhatsApp's layout: the welcome
 * panel (no chat open) and the Chats edge tab (Focus Mode).
 */
function stage() {
  if (!state.settings.enabled) return;
  const { side, content } = markColumns();
  const r = content?.getBoundingClientRect();
  const s = side?.getBoundingClientRect();
  // The start panel only replaces WhatsApp's own intro screen, never Settings,
  // Profile, Media or Status, and never sits over a visible chat list.
  const welcome =
    !!r &&
    r.width > 200 &&
    !adapter.hasChat &&
    state.settings.declutter.intro &&
    chatListVisible() &&
    (!s || !s.width || r.left >= s.right - 2) &&
    introShowing(content);
  const edge = root.classList.contains('waux-focus-on');
  const nav = document.querySelector('[data-testid="navbar-footer-section"]')?.getBoundingClientRect();
  const next = {
    rect: r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null,
    welcome,
    edge,
    edgeLeft: Math.round(nav?.right ?? r?.left ?? 0),
  };
  const cur = ui.get().stage;
  if (JSON.stringify(cur) !== JSON.stringify(next)) {
    if (next.welcome || next.edge) ensureOverlay();
    ui.set({ stage: next });
  }
}