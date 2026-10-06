// Marks WhatsApp elements that have no stable hook of their own, by
// structure and geometry rather than class names. CSS then targets the
// data-waux-* attributes. Runs once a second; every step is a handful of
// queries and writes only when something changed.

const NAV_KEYS: [RegExp, string][] = [
  [/communit/i, 'communities'],
  [/channel|newsletter/i, 'channels'],
  [/status/i, 'status'],
  [/call/i, 'calls'],
  [/meta-ai|metaai/i, 'meta-ai'],
];
const META_AI_IMG = /static\.whatsapp\.net\/rsrc\.php/i;

function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** The outermost wrapper that holds only this nav button, so hiding it collapses the gap. */
function navHost(button: Element): Element {
  let host = button;
  while (
    host.parentElement &&
    !host.parentElement.matches('[data-testid^="navbar-"]') &&
    host.parentElement.querySelectorAll('button').length === 1
  ) {
    host = host.parentElement;
  }
  return host;
}

/** Tags WhatsApp's rail items (and Meta AI entry points) by their icon's svg <title>. */
export function tagNav(metaAi: boolean) {
  for (const button of document.querySelectorAll('button[data-navbar-item="true"]')) {
    const title = button.querySelector('svg title')?.textContent ?? '';
    const img = button.querySelector('img');
    let key = NAV_KEYS.find(([re]) => re.test(title))?.[1] ?? '';
    if (!key && img && META_AI_IMG.test(img.currentSrc || img.src)) key = 'meta-ai';
    if (key) setAttr(navHost(button), 'data-waux-nav', key);
  }
  if (!metaAi) return;
  // Meta AI also appears outside the rail (start panel, chat list button).
  for (const t of document.querySelectorAll('svg title')) {
    if (!/meta-ai/i.test(t.textContent ?? '')) continue;
    const btn = t.closest('button, [role="button"]');
    if (btn && !btn.closest('[data-waux-nav]')) setAttr(btn, 'data-waux-nav', 'meta-ai');
  }
}

/** Nearest ancestor (up to `limit` levels) that paints its own background. */
function paintedAncestor(el: Element, stop: Element, limit = 8): HTMLElement | null {
  let node: Element | null = el;
  for (let i = 0; node && node !== stop && i < limit; i++, node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return node as HTMLElement;
  }
  return null;
}

let composerEl: HTMLElement | null = null;
let searchEl: HTMLElement | null = null;

/** Composer and chat-search boxes become WAUX panels. */
export function markInputs() {
  const editor = document.querySelector('#main footer [contenteditable="true"]');
  const footer = editor?.closest('footer');
  const composer = editor && footer ? paintedAncestor(editor, footer) : null;
  if (composer !== composerEl) {
    composerEl?.removeAttribute('data-waux-composer');
    composer?.setAttribute('data-waux-composer', '');
    composerEl = composer;
  }
  const side = document.getElementById('side');
  const field = side?.querySelector('input[type="text"], [contenteditable="true"]');
  const search = field && side ? paintedAncestor(field, side) : null;
  if (search !== searchEl) {
    searchEl?.removeAttribute('data-waux-search');
    search?.setAttribute('data-waux-search', '');
    searchEl = search;
  }
}

/**
 * The chat-list column and the content column beside it. Found by walking
 * up from #side to the level where a much wider sibling exists.
 */
let columns: { side: HTMLElement | null; content: HTMLElement | null } = { side: null, content: null };

export function markColumns(): { side: HTMLElement | null; content: HTMLElement | null } {
  const sideEl = document.getElementById('side');
  if (!sideEl) return { side: null, content: null };
  // A chat is open: the list column is the highest ancestor of #side that does
  // not contain #main, and its sibling holding #main is the content column.
  // Exact, and needs no measuring (works while Focus Mode hides the list).
  const main = document.getElementById('main');
  if (main) {
    let col: HTMLElement = sideEl;
    while (col.parentElement && !col.parentElement.contains(main)) col = col.parentElement;
    const content = col.parentElement ? ([...col.parentElement.children].find((c) => c.contains(main)) as HTMLElement | undefined) : undefined;
    if (content && content !== col) return commit(col, content);
  }
  // No chat open. While Focus Mode hides the list it has no width to measure; keep the last answer.
  if (columns.side?.isConnected && columns.content?.isConnected && columns.side.contains(sideEl) && !columns.side.getBoundingClientRect().width) {
    return columns;
  }
  let col: HTMLElement = sideEl;
  let content: HTMLElement | null = null;
  while (col.parentElement && col.parentElement !== document.body) {
    const sw = col.getBoundingClientRect().width;
    if (!sw) return { side: null, content: null };
    let widest: HTMLElement | null = null;
    for (const c of col.parentElement.children) {
      if (c === col || !(c instanceof HTMLElement)) continue;
      const w = c.getBoundingClientRect().width;
      if (w > sw * 1.2 && w > (widest?.getBoundingClientRect().width ?? 0)) widest = c;
    }
    if (widest) {
      content = widest;
      break;
    }
    col = col.parentElement;
  }
  if (!content) return { side: null, content: null };
  return commit(col, content);
}

function commit(side: HTMLElement, content: HTMLElement) {
  for (const el of document.querySelectorAll('[data-waux-col]')) {
    if (el !== side && el !== content) el.removeAttribute('data-waux-col');
  }
  setAttr(side, 'data-waux-col', 'side');
  setAttr(content, 'data-waux-col', 'content');
  columns = { side, content };
  return columns;
}

/**
 * Focus Mode leaves WhatsApp's column divider / resize handle (a thin, tall
 * element, often pointer-events:none) where the chat list used to end.
 * Search near the columns structurally and by hit-test, mark what's found.
 */
export function hideDividers(x: number) {
  const { side, content } = columns;
  const tall = innerHeight * 0.5;
  const isLine = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.width <= 16 && r.height > tall;
  };
  const scope = side?.parentElement?.parentElement ?? side?.parentElement;
  if (scope) {
    const queue: [Element, number][] = [[scope, 0]];
    while (queue.length) {
      const [el, depth] = queue.shift()!;
      for (const child of el.children) {
        if (child === side || child === content || child.id === 'main' || child.tagName === 'WAUX-OVERLAY') continue;
        if (isLine(child)) setAttr(child, 'data-waux-divider', '');
        else if (depth < 4) queue.push([child, depth + 1]);
      }
    }
  }
  if (!x) return;
  for (const dx of [-2, -1, 0, 1, 2]) {
    for (const el of document.elementsFromPoint(x + dx, innerHeight / 2)) {
      const r = el.getBoundingClientRect();
      if (isLine(el)) setAttr(el, 'data-waux-divider', '');
      else if (Math.abs(r.left - x) <= 2 && parseFloat(getComputedStyle(el).borderLeftWidth) > 0) setAttr(el, 'data-waux-divider', 'border');
    }
  }
}

/**
 * Avatars with no photo (initials or the default silhouette) have no <img> to
 * swap. Mark their painted circle so CSS can draw a 3D character on it.
 */
export function markInitials(rows: Element[]) {
  for (const row of rows) {
    const col = row.querySelector('[data-testid="cell-frame-container"]')?.firstElementChild;
    if (!col) continue;
    const marked = col.querySelector('[data-waux-initials]') ?? (col.hasAttribute('data-waux-initials') ? col : null);
    if (col.querySelector('img')) {
      marked?.removeAttribute('data-waux-initials');
      continue;
    }
    if (marked) continue;
    const circle = [col, ...col.querySelectorAll('div, span')].find((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return r.width >= 24 && r.width <= 80 && Math.abs(r.width - r.height) < 4 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    });
    circle?.setAttribute('data-waux-initials', '');
  }
}

/** WhatsApp's doodle wallpaper layer inside the open chat. */
export function markWallpaper() {
  const main = document.getElementById('main');
  if (!main) return;
  const mr = main.getBoundingClientRect();
  for (const el of main.querySelectorAll(':scope > div, :scope > div > div, :scope > div > div > div')) {
    if (el.hasAttribute('data-waux-wallpaper')) continue;
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg.includes('url(')) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > mr.width * mr.height * 0.4) el.setAttribute('data-waux-wallpaper', '');
  }
}

/** The "Get WhatsApp for Windows" banner at the foot of the chat list. */
export function tagPromo() {
  const side = document.getElementById('side');
  if (!side) return;
  for (const a of side.querySelectorAll('a[href*="download" i]')) {
    let host: Element = a;
    while (host.parentElement && host.parentElement !== side) host = host.parentElement;
    if (host !== document.getElementById('pane-side')) setAttr(host, 'data-waux-nav', 'promo');
  }
}

/** True when the chat list is really on screen (not covered by a drawer). */
export function chatListVisible(): boolean {
  const pane = document.getElementById('pane-side');
  const r = pane?.getBoundingClientRect();
  if (!pane || !r || r.width < 100 || r.height < 100) return false;
  const hits = document.elementsFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 200));
  const top = hits.find((el) => el.tagName !== 'WAUX-OVERLAY');
  return !!top && pane.contains(top);
}

/**
 * WhatsApp's own start screen ("Download WhatsApp for Windows") is showing
 * in the content column. Detected by its download link; anything else
 * (Settings, Profile, Media, Status) is left alone.
 */
export function introShowing(content: Element | null): boolean {
  if (!content || document.getElementById('main')) return false;
  return !!content.querySelector('a[href*="download" i], a[href*="apps.microsoft.com" i], a[href*="apps.apple.com" i]');
}