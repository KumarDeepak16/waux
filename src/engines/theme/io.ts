// Theme import/export. Accepts WAUX JSON, shadcn/tweakcn registry JSON, or
// pasted CSS variables (`:root { --primary: ... } .dark { ... }`).

import { luminance, mix, normalizeHex } from '../../shared/color.ts';
import { COLOR_KEYS, type ColorKey, type ColorTokens, type Density, type Scheme, type Theme } from '../../shared/types.ts';

export const THEME_FORMAT = 'waux-theme@1';

/** Source variable names accepted for each token, in priority order. */
const ALIASES: Record<ColorKey, string[]> = {
  primary: ['primary'],
  // shadcn's 'secondary' is a muted surface, so only chart colors map here.
  secondary: ['secondary-accent', 'chart-2'],
  background: ['background'],
  foreground: ['foreground'],
  card: ['card', 'popover'],
  muted: ['muted', 'secondary'],
  accent: ['accent'],
  border: ['border', 'input'],
  incoming: ['incoming', 'incoming-message', 'incomingmessage'],
  outgoing: ['outgoing', 'outgoing-message', 'outgoingmessage'],
};

export type ImportResult = { theme: Theme; applied: string[] } | { error: string };

export function exportTheme(theme: Theme): string {
  return JSON.stringify({ format: THEME_FORMAT, ...theme }, null, 2);
}

export function importTheme(text: string, base: Theme): ImportResult {
  const src = text.trim();
  if (!src) return { error: 'Paste a theme first.' };
  if (src.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(src);
    } catch {
      return { error: 'That looks like JSON but it does not parse.' };
    }
    return fromJson(json, base);
  }
  return fromCss(src, base);
}

type VarMap = Record<string, string>;

function fromJson(json: unknown, base: Theme): ImportResult {
  if (!json || typeof json !== 'object') return { error: 'Expected a JSON object.' };
  const o = json as Record<string, any>;
  // shadcn / tweakcn registry item: { cssVars: { theme, light, dark } }
  if (o.cssVars && typeof o.cssVars === 'object') {
    const shared: VarMap = lowerKeys(o.cssVars.theme ?? {});
    return merge(base, lowerKeys(o.cssVars.light ?? {}), lowerKeys(o.cssVars.dark ?? {}), shared);
  }
  if (o.dark || o.light) {
    const res = merge(base, lowerKeys(o.light ?? {}), lowerKeys(o.dark ?? {}), {});
    if ('error' in res) return res;
    const t = res.theme;
    if (typeof o.name === 'string' && o.name.trim()) t.name = o.name.trim().slice(0, 40);
    if (Number.isFinite(o.radius)) t.radius = clamp(o.radius, 0, 24);
    if (['compact', 'comfortable', 'spacious'].includes(o.density)) t.density = o.density as Density;
    if (Number.isFinite(o.depth)) t.depth = clamp(o.depth, 0, 1);
    if (Number.isFinite(o.blur)) t.blur = clamp(o.blur, 0, 32);
    if (o.font === 'geist' || o.font === 'system') t.font = o.font;
    if (o.style === 'brutal' || o.style === 'soft') t.style = o.style;
    if (['ambient', 'doodles', 'plain', 'custom'].includes(o.wallpaper)) t.wallpaper = o.wallpaper;
    if (Number.isFinite(o.wallBlur)) t.wallBlur = clamp(o.wallBlur, 0, 60);
    if (Number.isFinite(o.wallDim)) t.wallDim = clamp(o.wallDim, 0, 0.9);
    return res;
  }
  return { error: 'No theme colors found in that JSON.' };
}

function fromCss(css: string, base: Theme): ImportResult {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const light: VarMap = {};
  const dark: VarMap = {};
  const shared: VarMap = {};
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let found = false;
  for (let m; (m = blockRe.exec(clean)); ) {
    const selector = m[1].trim();
    const vars = parseDecls(m[2]);
    if (!Object.keys(vars).length) continue;
    found = true;
    if (/\.dark|\[data-theme=["']?dark/.test(selector)) Object.assign(dark, vars);
    else if (/@theme/.test(selector)) Object.assign(shared, vars);
    else Object.assign(light, vars);
  }
  if (!found) {
    // Bare declarations without a selector.
    const vars = parseDecls(clean);
    if (!Object.keys(vars).length) return { error: 'No CSS variables found.' };
    Object.assign(light, vars);
  }
  // A single block that is clearly dark belongs to the dark scheme.
  if (!Object.keys(dark).length && light.background) {
    const bg = normalizeHex(light.background);
    if (bg && luminance(bg) < 0.2) return merge(base, {}, light, shared);
  }
  return merge(base, light, dark, shared);
}

function parseDecls(body: string): VarMap {
  const out: VarMap = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) out[m[1].toLowerCase()] = m[2].trim();
  return out;
}

function lowerKeys(o: Record<string, unknown>): VarMap {
  const out: VarMap = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === 'string') out[k.replace(/^--/, '').toLowerCase()] = v;
  return out;
}

function merge(base: Theme, light: VarMap, dark: VarMap, shared: VarMap): ImportResult {
  const theme: Theme = structuredClone(base);
  const applied: string[] = [];
  const apply = (scheme: Scheme, vars: VarMap) => {
    if (!Object.keys(vars).length) return;
    const tokens: ColorTokens = { ...theme[scheme] };
    const got = new Set<ColorKey>();
    for (const key of COLOR_KEYS) {
      for (const alias of ALIASES[key]) {
        const hex = vars[alias] ? normalizeHex(vars[alias]) : null;
        if (hex) {
          tokens[key] = hex;
          got.add(key);
          break;
        }
      }
    }
    if (!got.size) return;
    // Sources without chat tokens: derive bubbles from the imported palette.
    if (!got.has('incoming')) tokens.incoming = scheme === 'dark' ? mix(tokens.card, tokens.foreground, 0.03) : tokens.card;
    if (!got.has('secondary')) tokens.secondary = tokens.primary;
    if (!got.has('outgoing')) tokens.outgoing = mix(tokens.card, tokens.primary, scheme === 'dark' ? 0.2 : 0.16);
    theme[scheme] = tokens;
    applied.push(`${scheme}: ${[...got].join(', ')}`);
  };
  apply('light', light);
  apply('dark', dark);
  const radius = shared.radius ?? light.radius ?? dark.radius;
  if (radius) {
    const px = toPx(radius);
    if (px !== null) {
      theme.radius = clamp(px, 0, 24);
      applied.push(`radius: ${theme.radius}px`);
    }
  }
  if (!applied.length) return { error: 'Found variables, but none WAUX can use (primary, background, card...).' };
  theme.name = 'Imported';
  return { theme, applied };
}

function toPx(v: string): number | null {
  const m = /^([\d.]+)(rem|px)?$/.exec(v.trim());
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
