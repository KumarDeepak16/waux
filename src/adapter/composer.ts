// Writing into WhatsApp's composer (a Lexical editor). We only ever insert
// text. Nothing here presses Enter or clicks Send.

import { SEL } from './selectors.ts';

export function getComposer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SEL.composer);
}

function caretToEnd(el: HTMLElement) {
  const sel = getSelection();
  if (!sel || (sel.anchorNode && el.contains(sel.anchorNode))) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Lexical syncs its selection on `selectionchange`; give it a frame. */
const settle = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function paste(el: HTMLElement, text: string) {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  // Editor did not take the paste: fall back to a plain text insertion.
  if (!ev.defaultPrevented) document.execCommand('insertText', false, text);
}

/** Inserts at the caret (or the end). Returns false when no chat is open. */
export async function insertText(text: string): Promise<boolean> {
  const el = getComposer();
  if (!el) return false;
  el.focus();
  caretToEnd(el);
  document.dispatchEvent(new Event('selectionchange'));
  await settle();
  paste(el, text);
  return true;
}

/** Replaces the `n` characters before the caret (a `;shortcut`) with `text`. */
export async function replaceBeforeCaret(n: number, text: string): Promise<boolean> {
  const el = getComposer();
  const sel = getSelection();
  if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return false;
  for (let i = 0; i < n; i++) sel.modify('extend', 'backward', 'character');
  document.dispatchEvent(new Event('selectionchange'));
  await settle();
  paste(el, text);
  return true;
}

/** Text in the caret's text node, up to the caret. */
export function textBeforeCaret(): string | null {
  const el = getComposer();
  const sel = getSelection();
  if (!el || !sel || !sel.isCollapsed || !sel.anchorNode || !el.contains(sel.anchorNode)) return null;
  const node = sel.anchorNode;
  if (node.nodeType !== Node.TEXT_NODE) return '';
  return (node.textContent ?? '').slice(0, sel.anchorOffset);
}
