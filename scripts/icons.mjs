// Renders assets/icon.svg to extension icons and Chrome Web Store tiles
// using the locally installed Playwright Chromium.
//   static/icons/{16,32,48,128}.png   extension icons
//   store/promo-440x280.png           small promo tile
//   store/marquee-1400x560.png        marquee tile
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const svg = await readFile(path.join(root, 'assets/icon.svg'), 'utf8');
// Toolbar sizes use a heavier, shadowless cut so the W survives at 16px.
const small = await readFile(path.join(root, 'assets/icon-small.svg'), 'utf8');
const font = (await readFile(path.join(root, 'node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2'))).toString('base64');

await mkdir(path.join(root, 'static/icons'), { recursive: true });
await mkdir(path.join(root, 'store'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

// "off-*" variants: the same mark in graphite, shown while WAUX is switched off.
for (const off of [false, true]) {
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px;${off ? 'filter:grayscale(1) brightness(1.05) contrast(.85);opacity:.75' : ''}}</style>${size <= 32 ? small : svg}`,
    );
    await page.screenshot({ path: path.join(root, `static/icons/${off ? 'off-' : ''}${size}.png`), omitBackground: true });
  }
}

const tile = (w, h, scale) => `
<style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    display: flex; align-items: center; gap: ${36 * scale}px; padding: 0 ${64 * scale}px; box-sizing: border-box;
    font-family: Geist, sans-serif; color: #e9e7e2;
    background:
      radial-gradient(60% 90% at 100% 0%, rgba(242,106,61,.20), transparent 60%),
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / ${32 * scale}px ${32 * scale}px,
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / ${32 * scale}px ${32 * scale}px,
      #0b0c0e;
  }
  svg { width: ${132 * scale}px; height: ${132 * scale}px; flex: none; filter: drop-shadow(0 ${18 * scale}px ${30 * scale}px rgba(0,0,0,.55)); }
  h1 { margin: 0; font-size: ${64 * scale}px; font-weight: 680; letter-spacing: .04em; line-height: 1; }
  p { margin: ${14 * scale}px 0 0; font-size: ${22 * scale}px; font-weight: 450; color: #a9a7a2; letter-spacing: -.01em; }
  b { color: #f26a3d; font-weight: 560; }
</style>
${svg}
<div><h1>WAUX</h1><p>WhatsApp Web, <b>redesigned</b>.<br>Private by default.</p></div>`;

for (const [w, h, scale, name] of [
  [440, 280, 0.62, 'promo-440x280.png'],
  [1400, 560, 1.6, 'marquee-1400x560.png'],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(tile(w, h, scale));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'store', name) });
}

await browser.close();
console.log('Icons written to static/icons, store tiles to store/');
