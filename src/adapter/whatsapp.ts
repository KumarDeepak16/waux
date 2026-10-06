// WhatsApp DOM adapter. Watches only what it needs:
//  - a 1s identity check on #main / #pane-side (getElementById, O(1)),
//  - one childList observer on #main's parent (chat switches),
//  - one observer on the open chat's header (title changes),
//  - one observer on the chat list, attached only while chats are hidden.
// All DOM writes are batched into a single animation frame.

import { getComposer } from './composer.ts';
import { activeChatName, chatRows, normalizeName, rowHeight, rowIndex, rowName, SEL } from './selectors.ts';
import { planSidebar, type HiddenCache, type RowInfo } from './sidebar-plan.ts';

const HIDDEN_ATTR = 'data-waux-hidden';
const CUT_ATTR = 'data-waux-cut';

export class WhatsAppAdapter {
  onChatChange: (name: string | null) => void = () => {};
  onLayoutChange: (hasChat: boolean) => void = () => {};

  private main: HTMLElement | null = null;
  private pane: HTMLElement | null = null;
  private chat: string | null = null;
  private timer = 0;
  private mainObs = new MutationObserver(() => this.tick());
  private headerObs = new MutationObserver(() => this.checkChat());
  private paneObs = new MutationObserver(() => this.queueLayout());
  private hidden = new Set<string>();
  private exempt = new Set<string>();
  private cache: HiddenCache = new Map();
  private layoutQueued = false;
  private touched = new Set<HTMLElement>();

  start() {
    if (this.timer) return;
    const go = () => {
      this.tick();
      this.timer = window.setInterval(() => this.tick(), 1000);
    };
    if (document.body) go();
    else document.addEventListener('DOMContentLoaded', go, { once: true });
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.mainObs.disconnect();
    this.headerObs.disconnect();
    this.paneObs.disconnect();
    this.clearLayout();
    this.main = this.pane = null;
    this.chat = null;
  }

  get activeChat() {
    return this.chat;
  }

  get hasChat() {
    return !!this.main;
  }

  setHidden(names: string[]) {
    this.hidden = new Set(names.map(normalizeName));
    this.watchPane();
    this.queueLayout();
  }

  private tick() {
    const main = document.getElementById('main');
    if (main !== this.main) {
      this.main = main;
      this.mainObs.disconnect();
      this.headerObs.disconnect();
      if (main?.parentElement) this.mainObs.observe(main.parentElement, { childList: true });
      const header = main?.querySelector('header');
      if (header) this.headerObs.observe(header, { childList: true, subtree: true, characterData: true });
      this.onLayoutChange(!!main);
    }
    this.checkChat();
    const pane = document.getElementById('pane-side');
    if (pane !== this.pane) {
      this.pane = pane;
      this.cache.clear();
      this.watchPane();
      this.queueLayout();
    }
  }

  private checkChat() {
    const name = activeChatName(this.main);
    if (name === this.chat) return;
    this.chat = name;
    // A hidden chat opened from the Hidden Chats area stays visible only
    // while it is the open chat.
    let changed = false;
    const key = name ? normalizeName(name) : '';
    for (const n of this.exempt) if (n !== key) changed = this.exempt.delete(n) || changed;
    if (changed) this.queueLayout();
    this.onChatChange(name);
  }

  // --- Hide from sidebar ---------------------------------------------------

  private watchPane() {
    this.paneObs.disconnect();
    if (!this.pane) return;
    if (this.hidden.size || this.touched.size) {
      this.paneObs.observe(this.pane, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'data-testid'],
      });
    }
  }

  private queueLayout() {
    if (this.layoutQueued) return;
    this.layoutQueued = true;
    requestAnimationFrame(() => {
      this.layoutQueued = false;
      this.layout();
    });
  }

  private layout() {
    if (!this.hidden.size) {
      this.clearLayout();
      this.watchPane();
      return;
    }
    const rows = chatRows();
    if (!rows.length) return;
    const infos: RowInfo[] = rows.map((r, i) => {
      const name = rowName(r);
      return { index: rowIndex(r, i), name: name ? normalizeName(name) : null, height: rowHeight(r) };
    });
    const plan = planSidebar(infos, this.hidden, this.cache, this.exempt);
    rows.forEach((row, i) => {
      const idx = infos[i].index;
      const hide = plan.hide.has(idx);
      if (hide !== row.hasAttribute(HIDDEN_ATTR)) row.toggleAttribute(HIDDEN_ATTR, hide);
      const px = plan.shift.get(idx);
      const want = px ? `0px ${-px}px` : '';
      if (row.style.translate !== want) row.style.translate = want;
      if (hide || px) this.touched.add(row);
    });
    const grid = rows[0].parentElement;
    if (grid) {
      if (plan.removed) {
        grid.setAttribute(CUT_ATTR, '');
        grid.style.setProperty('--waux-list-h', grid.style.height || `${grid.scrollHeight}px`);
        grid.style.setProperty('--waux-list-cut', `${plan.removed}px`);
        this.touched.add(grid);
      } else if (grid.hasAttribute(CUT_ATTR)) {
        grid.removeAttribute(CUT_ATTR);
      }
    }
    for (const el of this.touched) if (!el.isConnected) this.touched.delete(el);
  }

  private clearLayout() {
    for (const el of this.touched) {
      el.removeAttribute(HIDDEN_ATTR);
      el.removeAttribute(CUT_ATTR);
      el.style.translate = '';
    }
    this.touched.clear();
    this.cache.clear();
  }

  // --- Opening a chat ------------------------------------------------------

  private findRow(name: string) {
    const key = normalizeName(name);
    return chatRows().find((r) => normalizeName(rowName(r) ?? '') === key) ?? null;
  }

  /** Opens a chat by display name, via the list or WhatsApp's own search. */
  /** Names of chats currently rendered in the list (for the hide picker). */
  visibleChats(): string[] {
    return [...new Set(chatRows().map(rowName).filter((n): n is string => !!n))];
  }

  async openChat(name: string): Promise<boolean> {
    this.exempt.add(normalizeName(name));
    this.layout();
    let row = this.findRow(name);
    let searched = false;
    if (!row) {
      const box = document.querySelector<HTMLElement>(SEL.sideSearch);
      if (!box) return this.abortOpen(name);
      box.focus();
      document.execCommand('selectAll');
      document.execCommand('insertText', false, name);
      searched = true;
      row = await waitFor(() => this.findRow(name), 3000);
    }
    if (!row) return this.abortOpen(name);
    clickRow(row);
    if (searched) {
      await waitFor(() => (normalizeName(activeChatName(document.getElementById('main')) ?? '') === normalizeName(name) ? true : null), 2000);
      const box = document.querySelector<HTMLElement>(SEL.sideSearch);
      if (box) {
        box.focus();
        document.execCommand('selectAll');
        document.execCommand('delete');
      }
    }
    getComposer()?.focus();
    return true;
  }

  private abortOpen(name: string) {
    this.exempt.delete(normalizeName(name));
    this.queueLayout();
    return false;
  }
}

function clickRow(row: HTMLElement) {
  const target = row.querySelector<HTMLElement>(SEL.rowCell) ?? row;
  const init = { bubbles: true, cancelable: true, composed: true, button: 0 };
  target.dispatchEvent(new PointerEvent('pointerdown', init));
  target.dispatchEvent(new MouseEvent('mousedown', init));
  target.dispatchEvent(new PointerEvent('pointerup', init));
  target.dispatchEvent(new MouseEvent('mouseup', init));
  target.dispatchEvent(new MouseEvent('click', init));
}

function waitFor<T>(probe: () => T | null, timeout: number): Promise<T | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const v = probe();
      if (v) return resolve(v);
      if (performance.now() - start > timeout) return resolve(null);
      setTimeout(step, 100);
    };
    step();
  });
}
