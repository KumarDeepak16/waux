// Color math for the theme engine. All mixing happens in OKLab so derived
// surfaces stay perceptually even across hues and light/dark schemes.

export interface RGBA {
  r: number; // 0..1 sRGB
  g: number;
  b: number;
  a: number; // 0..1
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab({ r, g, b }: RGBA): [number, number, number] {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgbRaw(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = (c: number[]) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to sRGB, reducing chroma until the color fits the sRGB gamut. */
export function oklchToRgb(L: number, C: number, H: number, a = 1): RGBA {
  const h = (H * Math.PI) / 180;
  let rgb = oklabToRgbRaw(L, C * Math.cos(h), C * Math.sin(h));
  if (!inGamut(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const t = oklabToRgbRaw(L, mid * Math.cos(h), mid * Math.sin(h));
      if (inGamut(t)) { lo = mid; rgb = t; } else hi = mid;
    }
    if (!inGamut(rgb)) rgb = oklabToRgbRaw(L, 0, 0);
  }
  return { r: clamp01(rgb[0]), g: clamp01(rgb[1]), b: clamp01(rgb[2]), a };
}

export function rgbToOklch(c: RGBA): [number, number, number] {
  const [L, A, B] = rgbToOklab(c);
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function hslToRgb(h: number, s: number, l: number, a = 1): RGBA {
  h = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4), a };
}

const num = (s: string, pctScale = 1) =>
  s.endsWith('%') ? (parseFloat(s) / 100) * pctScale : parseFloat(s);

function parseAlpha(s: string | undefined) {
  if (s === undefined) return 1;
  return clamp01(num(s));
}

/**
 * Parses hex, rgb(), hsl(), oklch(), and bare shadcn-style HSL triplets
 * ("240 10% 3.9%"). Returns null for anything else.
 */
export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === 'white') return { r: 1, g: 1, b: 1, a: 1 };
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };

  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) : 1 };
  }

  const fn = /^([a-z]+)\((.*)\)$/.exec(s);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const [p0, p1, p2, p3] = parts;
    switch (fn[1]) {
      case 'rgb':
      case 'rgba':
        return {
          r: clamp01(num(p0, 255) / 255),
          g: clamp01(num(p1, 255) / 255),
          b: clamp01(num(p2, 255) / 255),
          a: parseAlpha(p3),
        };
      case 'hsl':
      case 'hsla':
        return hslToRgb(parseFloat(p0), num(p1), num(p2), parseAlpha(p3));
      case 'oklch': {
        const L = p0.endsWith('%') ? parseFloat(p0) / 100 : parseFloat(p0);
        const C = p1.endsWith('%') ? (parseFloat(p1) / 100) * 0.4 : parseFloat(p1);
        const H = p2 === 'none' ? 0 : parseFloat(p2);
        if ([L, C, H].some(Number.isNaN)) return null;
        return oklchToRgb(L, C, H, parseAlpha(p3));
      }
      default:
        return null;
    }
  }

  const bare = /^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/.exec(s);
  if (bare) return hslToRgb(parseFloat(bare[1]), +bare[2] / 100, +bare[3] / 100);
  return null;
}

const byte = (n: number) => Math.round(clamp01(n) * 255);
const hex2 = (n: number) => byte(n).toString(16).padStart(2, '0');

export function toHex(c: RGBA): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(c.a) : ''}`;
}

/** Normalizes any parseable color to #rrggbb; returns null if unparseable. */
export function normalizeHex(input: string): string | null {
  const c = parseColor(input);
  return c ? toHex({ ...c, a: 1 }) : null;
}

const must = (hex: string): RGBA => parseColor(hex) ?? { r: 0, g: 0, b: 0, a: 1 };

/** Mix `a` toward `b` by `t` (0..1) in OKLab. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbToOklab(must(a));
  const y = rgbToOklab(must(b));
  const [r, g, bl] = oklabToRgbRaw(
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  );
  return toHex({ r: clamp01(r), g: clamp01(g), b: clamp01(bl), a: 1 });
}

/** Shift OKLCH lightness by `dL` (e.g. 0.05). */
export function shiftL(hex: string, dL: number): string {
  const [L, C, H] = rgbToOklch(must(hex));
  return toHex(oklchToRgb(clamp01(L + dL), C, H));
}

export function luminance(hex: string): number {
  const { r, g, b } = must(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const INK = '#111214';
const PAPER = '#fafaf9';

/** Off-black or off-white, whichever reads better on `bg`. */
export function onColor(bg: string): string {
  return contrast(INK, bg) >= contrast(PAPER, bg) ? INK : PAPER;
}

/** `preferred` if it meets WCAG AA on `bg`, otherwise the best neutral. */
export function readableOn(bg: string, preferred: string): string {
  return contrast(preferred, bg) >= 4.5 ? preferred : onColor(bg);
}

export function rgbTriplet(hex: string): string {
  const { r, g, b } = must(hex);
  return `${byte(r)}, ${byte(g)}, ${byte(b)}`;
}

export function alpha(hex: string, a: number): string {
  return `rgba(${rgbTriplet(hex)}, ${+a.toFixed(3)})`;
}
