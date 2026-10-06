import type { Template } from '../../shared/types.ts';

/**
 * Subsequence fuzzy score. -1 means no match. Rewards contiguous runs and
 * matches at word starts so "hc" finds "Hidden chats" before "which".
 */
export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const direct = t.indexOf(q);
  if (direct !== -1) return 100 - direct + (direct === 0 || /\W/.test(t[direct - 1]) ? 40 : 0);
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2 + (found === 0 || /\W/.test(t[found - 1]) ? 4 : 0);
    ti = found + 1;
  }
  return score;
}

export function normalizeShortcut(s: string): string {
  return s.toLowerCase().replace(/^;+/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

/** Ranked templates for the palette / studio list. */
export function searchTemplates(list: Template[], query: string, category?: string): Template[] {
  const q = query.trim().toLowerCase().replace(/^;/, '');
  const pool = category ? list.filter((t) => t.category === category) : list;
  const ranked = pool
    .map((t) => {
      if (!q) return { t, s: 0 };
      if (t.shortcut && t.shortcut === q) return { t, s: 1000 };
      const s = Math.max(
        fuzzyScore(t.title, q) * 2,
        t.shortcut ? fuzzyScore(t.shortcut, q) * 2 : -1,
        fuzzyScore(t.category, q),
        t.body.toLowerCase().includes(q) ? 20 : -1,
      );
      return { t, s };
    })
    .filter((x) => x.s >= 0);
  ranked.sort(
    (a, b) =>
      b.s - a.s ||
      Number(b.t.favorite) - Number(a.t.favorite) ||
      b.t.uses - a.t.uses ||
      a.t.title.localeCompare(b.t.title),
  );
  return ranked.map((x) => x.t);
}

/** `;tok` immediately before the caret, or null. */
export function shortcutToken(beforeCaret: string): string | null {
  const m = /(?:^|\s);([a-z0-9_-]{1,24})$/i.exec(beforeCaret);
  return m ? m[1].toLowerCase() : null;
}

export function templatesForShortcut(list: Template[], token: string): Template[] {
  return list
    .filter((t) => t.shortcut && t.shortcut.startsWith(token))
    .sort((a, b) => Number(b.shortcut === token) - Number(a.shortcut === token) || a.shortcut.localeCompare(b.shortcut));
}

export function categories(list: Template[]): string[] {
  return [...new Set(list.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function newTemplate(partial: Partial<Template> = {}): Template {
  return {
    id: crypto.randomUUID(),
    title: '',
    body: '',
    category: '',
    shortcut: '',
    favorite: false,
    uses: 0,
    updatedAt: Date.now(),
    ...partial,
  };
}

export const QUICK_FORMAT = 'waux-quick-messages@1';

export function exportTemplates(list: Template[]): string {
  const templates = list.map(({ title, body, category, shortcut, favorite }) => ({ title, body, category, shortcut, favorite }));
  return JSON.stringify({ format: QUICK_FORMAT, templates }, null, 2);
}

export type TemplateImport = { list: Template[]; added: number; skipped: number } | { error: string };

/**
 * Merges quick messages from JSON: a WAUX export, a bare array, or
 * { templates: [...] }. Items need a text body ("body", "text" or "message").
 * Exact duplicates are skipped; a shortcut already in use is dropped from the
 * imported item rather than overwriting the existing one.
 */
export function importTemplates(existing: Template[], text: string): TemplateImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const items = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.templates) ? (raw as any).templates : null;
  if (!items) return { error: 'Expected a list of quick messages.' };
  const list = [...existing];
  const seen = new Set(list.map((t) => `${t.title}\u0000${t.body}`));
  const shortcuts = new Set(list.map((t) => t.shortcut).filter(Boolean));
  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const o = (item ?? {}) as Record<string, unknown>;
    const body = [o.body, o.text, o.message].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (!body) {
      skipped++;
      continue;
    }
    const title = (typeof o.title === 'string' && o.title.trim()) || body.trim().split('\n')[0].slice(0, 40);
    const key = `${title}\u0000${body}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    let shortcut = typeof o.shortcut === 'string' ? normalizeShortcut(o.shortcut) : '';
    if (shortcut && shortcuts.has(shortcut)) shortcut = '';
    if (shortcut) shortcuts.add(shortcut);
    seen.add(key);
    list.push(
      newTemplate({
        title: title.slice(0, 80),
        body,
        category: typeof o.category === 'string' ? o.category.trim().slice(0, 40) : '',
        shortcut,
        favorite: o.favorite === true,
      }),
    );
    added++;
  }
  return { list, added, skipped };
}
