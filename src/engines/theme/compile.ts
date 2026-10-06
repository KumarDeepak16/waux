// Theme engine: a handful of user tokens in, a complete UI palette out.
// Every derived value is computed from the base tokens, so changing one
// token (say `card`) re-derives hover, pressed, elevated, divider and
// text-on-surface colors consistently across WhatsApp and WAUX surfaces.

import { alpha, mix, onColor, readableOn, rgbTriplet, shiftL } from '../../shared/color.ts';
import type { ColorTokens, Density, Mode, Scheme, Theme } from '../../shared/types.ts';

export interface Palette {
  bg: string;
  fg: string;
  card: string;
  muted: string;
  accent: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryFg: string;
  primaryHi: string;
  fgMuted: string;
  fgSubtle: string;
  s2: string;
  s3: string;
  pressed: string;
  incoming: string;
  inFg: string;
  inMeta: string;
  outgoing: string;
  outFg: string;
  outMeta: string;
  wallFg: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  bubbleShadow: string;
}

export function derive(c: ColorTokens, scheme: Scheme, depth: number): Palette {
  const dark = scheme === 'dark';
  const pick = (d: number, l: number) => (dark ? d : l);
  const fg = c.foreground;
  const card = c.card;
  const inFg = readableOn(c.incoming, fg);
  const outFg = readableOn(c.outgoing, fg);

  // Shadows are tinted toward the background hue instead of pure black.
  const ink = rgbTriplet(mix(c.background, '#000000', pick(0.7, 0.55)));
  const d = Math.min(1, Math.max(0, depth));
  const a = (n: number) => +(n * d).toFixed(3);
  const hl = dark ? `rgba(255, 255, 255, ${a(0.055)})` : `rgba(255, 255, 255, ${a(0.85)})`;
  const shadowSm = `inset 0 1px 0 ${hl}, 0 1px 2px rgba(${ink}, ${a(pick(0.5, 0.1))})`;
  const shadowMd =
    `inset 0 1px 0 ${hl}, 0 2px 4px -1px rgba(${ink}, ${a(pick(0.45, 0.08))}), ` +
    `0 10px 24px -8px rgba(${ink}, ${a(pick(0.6, 0.14))})`;
  const shadowLg =
    `inset 0 1px 0 ${hl}, 0 4px 10px -2px rgba(${ink}, ${a(pick(0.5, 0.1))}), ` +
    `0 28px 64px -16px rgba(${ink}, ${a(pick(0.75, 0.24))})`;

  return {
    bg: c.background,
    fg,
    card,
    muted: c.muted,
    accent: c.accent,
    border: c.border,
    borderStrong: mix(c.border, fg, 0.22),
    primary: c.primary,
    primaryFg: onColor(c.primary),
    primaryHi: shiftL(c.primary, pick(0.06, -0.06)),
    fgMuted: mix(fg, card, 0.38),
    fgSubtle: mix(fg, card, 0.58),
    s2: mix(card, fg, pick(0.035, 0.025)),
    s3: mix(card, fg, pick(0.07, 0.05)),
    pressed: mix(card, fg, pick(0.11, 0.08)),
    incoming: c.incoming,
    inFg,
    inMeta: mix(inFg, c.incoming, 0.42),
    outgoing: c.outgoing,
    outFg,
    outMeta: mix(outFg, c.outgoing, 0.42),
    wallFg: mix(c.background, fg, pick(0.03, 0.045)),
    shadowSm,
    shadowMd,
    shadowLg,
    bubbleShadow: `0 0 0 1px ${alpha(c.border, pick(0.6, 0.9))}, ${shadowSm}`,
  };
}

const DENSITY: Record<Density, { pad: number; gap: number; ctl: number }> = {
  compact: { pad: 6, gap: 0, ctl: 30 },
  comfortable: { pad: 8, gap: 2, ctl: 34 },
  spacious: { pad: 10, gap: 5, ctl: 38 },
};

export const FONT_STACK = {
  geist: `"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  system: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
  mono: `"Geist Mono", ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace`,
};

/** `--waux-*` variables consumed by the WhatsApp skin and all WAUX UI. */
export function wauxVars(theme: Theme, scheme: Scheme): Record<string, string> {
  const p = derive(theme[scheme], scheme, theme.depth);
  const dn = DENSITY[theme.density] ?? DENSITY.comfortable;
  const r = Math.max(0, Math.round(theme.radius));
  return {
    'color-scheme': scheme,
    '--waux-bg': p.bg,
    '--waux-fg': p.fg,
    '--waux-card': p.card,
    '--waux-muted': p.muted,
    '--waux-accent': p.accent,
    '--waux-border': p.border,
    '--waux-border-strong': p.borderStrong,
    '--waux-primary': p.primary,
    '--waux-primary-fg': p.primaryFg,
    '--waux-primary-hi': p.primaryHi,
    '--waux-primary-soft': alpha(p.primary, scheme === 'dark' ? 0.16 : 0.12),
    '--waux-ring': alpha(p.primary, 0.5),
    // Hard offset shadow for the brutalist press/lift language.
    '--waux-hard': scheme === 'dark' ? mix(p.borderStrong, p.bg, 0.15) : alpha(p.fg, 0.85),
    '--waux-hard-soft': scheme === 'dark' ? alpha('#000000', 0.45) : alpha(p.fg, 0.12),
    '--waux-fg-muted': p.fgMuted,
    '--waux-fg-subtle': p.fgSubtle,
    '--waux-s2': p.s2,
    '--waux-s3': p.s3,
    '--waux-pressed': p.pressed,
    '--waux-in': p.incoming,
    '--waux-in-fg': p.inFg,
    '--waux-in-meta': p.inMeta,
    '--waux-out': p.outgoing,
    '--waux-out-fg': p.outFg,
    '--waux-out-meta': p.outMeta,
    '--waux-glass': alpha(p.card, theme.blur > 0 ? 0.82 : 1),
    '--waux-scrim': alpha(mix(p.bg, '#000000', 0.5), scheme === 'dark' ? 0.55 : 0.28),
    '--waux-shadow-sm': p.shadowSm,
    '--waux-shadow-md': p.shadowMd,
    '--waux-shadow-lg': p.shadowLg,
    '--waux-bubble-shadow': p.bubbleShadow,
    '--waux-radius': `${r}px`,
    '--waux-radius-sm': `${Math.max(0, r - 3)}px`,
    '--waux-radius-lg': `${r + 4}px`,
    '--waux-blur': `${Math.max(0, theme.blur)}px`,
    '--waux-pad': `${dn.pad}px`,
    '--waux-msg-gap': `${dn.gap}px`,
    '--waux-ctl': `${dn.ctl}px`,
    '--waux-font': theme.font === 'system' ? FONT_STACK.system : FONT_STACK.geist,
    '--waux-mono': FONT_STACK.mono,
  };
}

/**
 * WhatsApp's own design tokens (WDS). Overriding these themes every native
 * surface without depending on hashed class names. Each token also has
 * `-RGB` / `-rgb` triplet variants that WhatsApp uses for alpha blends.
 */
export function whatsappVars(p: Palette): Record<string, string> {
  const wds: Record<string, string> = {
    accent: p.primary,
    'accent-deemphasized': alpha(p.primary, 0.3),
    'accent-emphasized': p.primaryHi,
    'content-default': p.fg,
    'content-deemphasized': p.fgMuted,
    'content-disabled': alpha(p.fg, 0.45),
    'content-on-accent': p.primaryFg,
    'content-action-default': p.primary,
    'content-action-emphasized': p.primaryHi,
    'content-inverse': p.bg,
    'content-read': p.primary,
    'background-wash-inset': p.bg,
    'background-wash-plain': p.bg,
    'background-elevated-wash-plain': p.bg,
    'background-elevated-wash-inset': p.bg,
    'modal-backdrop-solid': p.bg,
    'surface-default': p.card,
    'surface-emphasized': p.s2,
    'surface-elevated-default': p.s2,
    'surface-elevated-emphasized': p.s3,
    'surface-highlight': p.accent,
    'surface-inverse': p.fg,
    'surface-pressed': p.pressed,
    'lines-divider': p.border,
    'lines-outline-default': p.borderStrong,
    'lines-outline-deemphasized': p.border,
    'persistent-activity-indicator': p.primary,
    'persistent-always-branded': p.primary,
    'systems-bubble-surface-incoming': p.incoming,
    'systems-bubble-surface-outgoing': p.outgoing,
    'systems-bubble-content-deemphasized': p.inMeta,
    'systems-bubble-surface-overlay': p.card,
    'systems-bubble-surface-system': p.muted,
    'systems-bubble-surface-e2e': p.muted,
    'systems-bubble-content-e2e': p.fgMuted,
    'systems-bubble-surface-business': p.muted,
    'systems-chat-surface-composer': p.s2,
    'systems-chat-background-wallpaper': p.bg,
    'systems-chat-foreground-wallpaper': p.wallFg,
    'systems-chat-surface-tray': p.s2,
    'systems-status-seen': p.fgSubtle,
    'components-surface-nav-bar': p.card,
    'app-wash': p.bg,
    white: p.bg,
  };
  const legacy: Record<string, string> = {
    'background-default': p.card,
    'search-container-background': p.card,
    'app-background': p.bg,
    'toast-background': p.s3,
    'toast-text': p.fg,
    'picker-background': p.s2,
    'gray-500': p.fgMuted,
    'focus-animation': mix(p.primary, p.card, 0.6),
    'focus-animation-deeper': mix(p.primary, p.card, 0.7),
    'splashscreen-startup-background': p.bg,
    'splashscreen-startup-icon': p.s3,
    'splashscreen-primary-title': p.fg,
    'splashscreen-progress-primary': p.primary,
    'splashscreen-progress-background': p.s3,
    'splashscreen-secondary-lighter': p.fgMuted,
    'startup-icon': p.s3,
    'startup-background': p.bg,
    'progress-background': p.s3,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(wds)) {
    out[`--WDS-${k}`] = v;
    if (v.startsWith('#')) out[`--WDS-${k}-RGB`] = out[`--WDS-${k}-rgb`] = rgbTriplet(v);
  }
  for (const [k, v] of Object.entries(legacy)) {
    out[`--${k}`] = v;
    out[`--${k}-rgb`] = rgbTriplet(v);
  }
  return out;
}

const decl = (vars: Record<string, string>, important = false) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}${important ? ' !important' : ''};`)
    .join('');

/** Every element WhatsApp declares WDS tokens on; ours must win on each. */
const WA_SCOPE = [
  'html.waux',
  'html.waux body',
  'html.waux .color-refresh',
  'html.waux .app-wrapper-web',
  'html.waux .dark',
  'html.waux [style*="--splashscreen-startup-background"]',
].join(',');

function forMode(mode: Mode, block: (s: Scheme) => string): string {
  if (mode !== 'system') return block(mode);
  return `${block('dark')}@media (prefers-color-scheme: light){${block('light')}}`;
}

/** Full stylesheet for web.whatsapp.com. */
export function whatsappCss(theme: Theme, mode: Mode): string {
  return forMode(mode, (s) => {
    const p = derive(theme[s], s, theme.depth);
    return `html.waux{${decl(wauxVars(theme, s))}}${WA_SCOPE}{${decl(whatsappVars(p), true)}}`;
  });
}

/** Per-chat accent: recolors outgoing bubbles and actions inside the open chat only. */
export function chatAccentCss(theme: Theme, mode: Mode, accent: string): string {
  return forMode(mode, (s) => {
    const c = theme[s];
    const tokens = { ...c, primary: accent, outgoing: mix(c.card, accent, s === 'dark' ? 0.2 : 0.16) };
    const p = derive(tokens, s, theme.depth);
    const all = whatsappVars(p);
    const keep = Object.keys(all).filter((k) => /accent|action|bubble-surface-outgoing|content-read/.test(k));
    const vars = Object.fromEntries(keep.map((k) => [k, all[k]]));
    vars['--waux-out'] = p.outgoing;
    vars['--waux-out-fg'] = p.outFg;
    vars['--waux-primary'] = p.primary;
    return `html.waux #main{${decl(vars, true)}}`;
  });
}

/** Stylesheet for extension pages (popup, studio). */
export function pageCss(theme: Theme, mode: Mode, selector = ':root'): string {
  return forMode(mode, (s) => `${selector}{${decl(wauxVars(theme, s))}}`);
}

export function resolveScheme(mode: Mode): Scheme {
  if (mode !== 'system') return mode;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}
