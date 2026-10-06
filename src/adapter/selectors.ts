// The only place that knows WhatsApp Web's DOM. Hooks are chosen for
// stability, in this order: element ids (#main, #side, #pane-side),
// data-testid attributes, ARIA roles, then long-lived class names
// (.message-in / .message-out). No hashed class names. When WhatsApp ships a
// DOM change, this file and skin.css are the only things to update.

export const SEL = {
  side: '#side',
  paneSide: '#pane-side',
  main: '#main',
  chatRow: '[role="row"][data-testid^="list-item-"]',
  chatRowFallback: '#pane-side [role="row"], #pane-side [role="listitem"]',
  rowCell: '[data-testid="cell-frame-container"]',
  rowTitle: '[data-testid="cell-frame-title"]',
  headerTitle: '[data-testid="conversation-info-header-chat-title"]',
  headerTitleFallback: '#main header span[dir="auto"]',
  composer: '#main footer [contenteditable="true"]',
  sideSearch: '#side :is(input[type="text"], [contenteditable="true"])',
  loading: '[data-testid="wa-web-loading-screen"]',
} as const;

const ROW_INDEX = /^list-item-(\d+)$/;
const TRANSLATE_Y = /translateY\((-?[\d.]+)px\)/;

export function rowIndex(row: HTMLElement, fallback: number): number {
  const m = ROW_INDEX.exec(row.getAttribute('data-testid') ?? '');
  if (m) return Number(m[1]);
  const t = TRANSLATE_Y.exec(row.style.transform);
  const h = parseFloat(row.style.height);
  return t && h ? Math.round(parseFloat(t[1]) / h) : fallback;
}

export function rowHeight(row: HTMLElement): number {
  return parseFloat(row.style.height) || row.offsetHeight || 72;
}

/** Comparable form of a chat name: emoji presentation marks, zero-width chars, case and spacing removed. */
export function normalizeName(name: string): string {
  return name.normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufe0e\ufe0f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function rowName(row: Element): string | null {
  const title = row.querySelector(SEL.rowTitle);
  const fromAttr = (title?.querySelector('[title]') ?? title)?.getAttribute('title');
  const name = fromAttr || title?.textContent || row.querySelector('span[title]')?.getAttribute('title');
  return name?.trim() || null;
}

export function chatRows(): HTMLElement[] {
  const pane = document.getElementById('pane-side');
  if (!pane) return [];
  const rows = pane.querySelectorAll<HTMLElement>(SEL.chatRow);
  return [...(rows.length ? rows : pane.querySelectorAll<HTMLElement>(SEL.chatRowFallback))];
}

export interface HookProbe {
  app: boolean;
  chatList: boolean;
  chatRows: boolean;
  chatNames: boolean;
  openChat: boolean;
  chatTitle: boolean;
  messages: boolean;
  composer: boolean;
  tokens: boolean;
}

/** Which hooks WAUX depends on are present right now. */
export function probeHooks(): HookProbe {
  const main = document.getElementById('main');
  const rows = chatRows();
  const wrapper = document.querySelector('.app-wrapper-web') ?? document.body;
  const ours = getComputedStyle(document.documentElement).getPropertyValue('--WDS-surface-default').trim();
  return {
    app: !!document.getElementById('app'),
    chatList: !!document.getElementById('pane-side'),
    chatRows: rows.length > 0,
    chatNames: rows.some((r) => rowName(r) !== null),
    openChat: !!main,
    chatTitle: !!activeChatName(main),
    messages: !!main?.querySelector('[data-testid^="conv-msg-"]'),
    composer: !!document.querySelector(SEL.composer),
    tokens: !!ours && !!wrapper && getComputedStyle(wrapper).getPropertyValue('--WDS-surface-default').trim() === ours,
  };
}

export function activeChatName(main: HTMLElement | null): string | null {
  if (!main) return null;
  const el = main.querySelector(SEL.headerTitle) ?? main.querySelector(SEL.headerTitleFallback);
  return el?.textContent?.trim() || null;
}
