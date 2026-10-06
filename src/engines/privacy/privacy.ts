// Privacy engine. Blur is pure CSS (skin.css) driven by classes on <html>,
// so it costs nothing per message and survives WhatsApp re-renders. This
// module owns the class flags and the reveal interactions.

import type { Settings } from '../../shared/types.ts';

/** Classes for the WhatsApp surfaces the user switched off. */
export function declutterFlags(s: Settings): Record<string, boolean> {
  const d = s.declutter;
  return {
    'waux-hide-communities': d.communities,
    'waux-hide-channels': d.channels,
    'waux-hide-status': d.status,
    'waux-hide-calls': d.calls,
    'waux-hide-meta-ai': d.metaAi,
    'waux-hide-promo': d.promo,
    'waux-intro': d.intro,
  };
}

export function privacyFlags(s: Settings, chatBlur: boolean): Record<string, boolean> {
  const p = s.privacy;
  return {
    // Shield is the single switch; the privacy toggles choose what it covers.
    'waux-p-msg': s.shield && p.messages,
    'waux-p-name': s.shield && p.names,
    'waux-p-avatar': s.shield && p.avatars,
    'waux-p-media': s.shield && p.media,
    'waux-chat-blur': chatBlur,
    'waux-style-cipher': p.style !== 'blur',
    'waux-style-blur': p.style === 'blur',
    'waux-reveal-hover': p.reveal === 'hover',
    'waux-reveal-click': p.reveal === 'click',
  };
}

const PEEK = 'waux-peek';
const REVEALED = 'waux-revealed';
const HIDING = '.waux-p-msg, .waux-p-name, .waux-p-avatar, .waux-p-media, .waux-chat-blur';

/** The unit one reveal unlocks: a message, a chat card, or the chat header. */
function unitOf(el: Element | null): Element | null {
  if (!el?.closest) return null;
  return (
    el.closest('#main [role="row"]') ??
    el.closest('[data-testid^="conv-msg-"]') ??
    el.closest('[data-testid="cell-frame-container"]') ??
    el.closest('#main header')
  );
}

/**
 * Reveal interactions. Returns a disposer.
 *  - hover: the unit under the pointer shows real text and photos.
 *  - click: the first click on a hidden unit reveals it and is swallowed,
 *    so it never opens media or a chat by accident. Moving away hides it.
 *  - hold Alt: everything is revealed until release.
 * Driven from JS (a class on the unit) rather than CSS :hover, so it works
 * whatever WhatsApp layers on top of its rows.
 */
export function installReveal(root: HTMLElement): () => void {
  let current: Element | null = null;
  const set = (unit: Element | null) => {
    if (unit === current) return;
    current?.classList.remove(REVEALED);
    unit?.classList.add(REVEALED);
    current = unit;
  };
  const hiding = () => root.matches(HIDING) && !root.classList.contains(PEEK);

  const onOver = (e: PointerEvent) => {
    if (!hiding()) return set(null);
    const unit = unitOf(e.target as Element);
    if (root.classList.contains('waux-reveal-hover')) set(unit);
    else if (current && unit !== current) set(null);
  };

  const onClick = (e: MouseEvent) => {
    if (!root.classList.contains('waux-reveal-click') || !hiding()) return;
    const unit = unitOf(e.target as Element);
    if (!unit || unit === current) return;
    set(unit);
    e.preventDefault();
    e.stopPropagation();
  };

  const onLeave = () => set(null);

  let peekCandidate = false;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Alt' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      peekCandidate = true;
      root.classList.add(PEEK);
    } else if (peekCandidate) {
      // Alt is part of a chord (Alt+Shift+S...), not a peek.
      peekCandidate = false;
      root.classList.remove(PEEK);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== 'Alt') return;
    if (peekCandidate) e.preventDefault(); // keep focus off the browser menu
    peekCandidate = false;
    root.classList.remove(PEEK);
  };
  const onBlur = () => {
    peekCandidate = false;
    root.classList.remove(PEEK);
  };

  window.addEventListener('click', onClick, true);
  window.addEventListener('pointerover', onOver, true);
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('pointerover', onOver, true);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    set(null);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    root.classList.remove(PEEK);
  };
}
