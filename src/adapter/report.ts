// Privacy-safe layout report of WhatsApp Web's DOM, for fixing selectors
// after a WhatsApp update. Structure only: tag, id, role, data-testid,
// data-icon and a few state attributes, plus box geometry. Never text,
// titles, aria-labels, image sources or class names. Long digit runs (phone
// numbers, message ids) are redacted.

const ATTRS = ['id', 'data-testid', 'role', 'data-icon', 'data-navbar-item', 'aria-selected', 'aria-pressed', 'contenteditable', 'data-tab', 'data-waux-col'];
const MAX_LINES = 4000;

const redact = (v: string) => v.replace(/\d{5,}/g, '#').replace(/[\w.+-]+@[cgs]\.us/g, '#@id').slice(0, 60);

function signature(el: Element) {
  return el.tagName + (el.getAttribute('role') ?? '') + (el.getAttribute('data-testid')?.replace(/\d+/g, '') ?? '');
}

export function layoutReport(): string {
  const lines: string[] = [
    `WAUX layout report ${new Date().toISOString()}`,
    `viewport ${innerWidth}x${innerHeight}`,
    '',
  ];

  const walk = (el: Element, depth: number) => {
    if (lines.length > MAX_LINES) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'waux-overlay') return;
    const attrs = ATTRS.filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${redact(el.getAttribute(a) ?? '')}`)
      .join(' ');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const box = r.width || r.height ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : '0';
    const layout = [cs.display !== 'block' ? cs.display : '', cs.position !== 'static' ? cs.position : ''].filter(Boolean).join('/');
    lines.push(`${'  '.repeat(depth)}${tag}${attrs ? ` [${attrs}]` : ''} ${box}${layout ? ` ${layout}` : ''}`);
    if (tag === 'svg') return;

    // Collapse long runs of look-alike siblings (message lists, chat rows).
    const kids = [...el.children];
    let i = 0;
    while (i < kids.length) {
      const sig = signature(kids[i]);
      let j = i;
      while (j + 1 < kids.length && signature(kids[j + 1]) === sig) j++;
      const run = j - i + 1;
      const shown = run > 4 ? 2 : run;
      for (let k = 0; k < shown; k++) walk(kids[i + k], depth + 1);
      if (run > shown) lines.push(`${'  '.repeat(depth + 1)}... ${run - shown} more like the above`);
      i = j + 1;
    }
  };

  walk(document.getElementById('app') ?? document.body, 0);
  if (lines.length > MAX_LINES) lines.push('(truncated)');
  return lines.join('\n');
}

export function downloadText(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Rect of WhatsApp's bottom nav section, where the WAUX dock attaches. */
export function navAnchor(): DOMRect | null {
  const footer = document.querySelector('[data-testid="navbar-footer-section"]');
  const r = footer?.getBoundingClientRect();
  return r && r.width > 0 ? r : null;
}
