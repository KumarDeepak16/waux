// Captures product screenshots for the landing page (docs/assets) from the
// built extension, at 2x. Run `npm run build` first.
import { chromium } from 'playwright';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { avatarSvg } from './avatars.mjs';
import { buildCipherFont } from './cipher-font.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'docs/assets');
await mkdir(path.join(out, 'avatars'), { recursive: true });
await mkdir(path.join(root, 'docs/fonts'), { recursive: true });

// Static assets the page needs.
await copyFile(path.join(root, 'assets/icon.svg'), path.join(out, 'icon.svg'));
await copyFile(path.join(root, 'static/icons/32.png'), path.join(out, 'favicon.png'));
await copyFile(path.join(root, 'store/marquee-1400x560.png'), path.join(out, 'og.png'));
for (let i = 0; i < 10; i++) await writeFile(path.join(out, `avatars/${i}.svg`), avatarSvg(i));
await writeFile(path.join(root, 'docs/fonts/WauxCipher.ttf'), buildCipherFont());
const fonts = path.join(root, 'node_modules/geist/dist/fonts');
await copyFile(path.join(fonts, 'geist-sans/Geist-Variable.woff2'), path.join(root, 'docs/fonts/Geist-Variable.woff2'));
await copyFile(path.join(fonts, 'geist-mono/GeistMono-Variable.woff2'), path.join(root, 'docs/fonts/GeistMono-Variable.woff2'));
await copyFile(path.join(root, 'node_modules/geist/LICENSE.txt'), path.join(root, 'docs/fonts/OFL.txt'));

const profile = await mkdtemp(path.join(os.tmpdir(), 'waux-site-'));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const base = `chrome-extension://${new URL(sw.url()).host}`;
const settings = (patch) =>
  sw.evaluate(async (patch) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...settings, ...patch, privacy: { ...(settings.privacy ?? {}), ...(patch.privacy ?? {}) } },
    });
  }, patch);

// Mock WhatsApp with real rail icons.
const mockHtml = await readFile(path.join(root, 'scripts/mock-whatsapp.html'), 'utf8');
await ctx.route('**/*waux-mock*', (route) => route.fulfill({ contentType: 'text/html', body: mockHtml }));
const ph = (n) => readFile(path.join(root, `node_modules/@phosphor-icons/core/assets/regular/${n}.svg`), 'utf8');
const railIcons = await Promise.all(['chat-circle-text', 'phone', 'circle-dashed', 'megaphone-simple', 'users-three', 'sparkle', 'images', 'gear-six'].map(ph));

const page = await ctx.newPage();
const openMock = async (query) => {
  await page.goto(`https://web.whatsapp.com/?waux-mock=${query}`);
  await page.waitForTimeout(1500);
  await page.evaluate((icons) => {
    document.querySelectorAll('button[data-navbar-item="true"]').forEach((b, i) => {
      const title = b.querySelector('title')?.outerHTML ?? '';
      b.innerHTML = icons[i].replace('<svg ', '<svg width="22" height="22" ').replace('>', `>${title}`);
    });
  }, railIcons);
  await page.waitForTimeout(3200); // let toasts clear
};

await settings({ enabled: true, shield: true, focus: false, privacy: { messages: true, names: true, avatars: true, media: true, style: 'cipher', reveal: 'hover' } });
await openMock('chat');
await page.hover('[data-testid="conv-msg-true_3"] [data-testid="msg-container"]');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, 'shot-shield.png') });

await settings({ shield: false });
await page.mouse.move(900, 600);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, 'shot-chat.png') });
await page.keyboard.press('Control+k');
await page.waitForTimeout(300);
await page.keyboard.type('th');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, 'shot-palette.png') });
await page.keyboard.press('Escape');

for (const sec of ['theme', 'settings']) {
  await page.goto(`${base}/studio.html#${sec}`);
  await page.waitForSelector('.studio.is-ready');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `shot-${sec}.png`) });
}

await page.setViewportSize({ width: 300, height: 320 });
await page.goto(`${base}/popup.html`);
await page.waitForSelector('.pop.is-ready');
await page.waitForTimeout(400);
await page.locator('.pop').screenshot({ path: path.join(out, 'shot-popup.png') });

await ctx.close();
await rm(profile, { recursive: true, force: true });
console.log('Landing assets written to docs/');
