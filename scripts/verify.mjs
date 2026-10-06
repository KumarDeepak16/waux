// Loads dist/ as an unpacked extension in Chromium and checks it end to end:
// popup and Studio render without console errors, and on web.whatsapp.com
// the theme, fonts and command palette attach. Screenshots go to verify/.
//   node scripts/verify.mjs            (run `npm run build` first)
//   node scripts/verify.mjs --store    also writes 1280x800 store screenshots
import { chromium } from 'playwright';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const shots = path.join(root, 'verify');
const store = process.argv.includes('--store');
await mkdir(shots, { recursive: true });

const profile = await mkdtemp(path.join(os.tmpdir(), 'waux-'));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  // WhatsApp blocks the HeadlessChrome user agent; present as regular Chrome.
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});

const errors = [];
const watch = (page, label) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
};

let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const base = `chrome-extension://${id}`;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// Popup
const popup = await ctx.newPage();
watch(popup, 'popup');
await popup.setViewportSize({ width: 324, height: 420 });
await popup.goto(`${base}/popup.html`);
await popup.waitForSelector('.pop.is-ready');
await popup.screenshot({ path: path.join(shots, 'popup-on.png'), fullPage: true });
await popup.click('.power');
await popup.waitForTimeout(250);
await popup.screenshot({ path: path.join(shots, 'popup-off.png'), fullPage: true });
const enabled = await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => r.settings?.enabled));
check('popup power key switches WAUX off', enabled === false);
await popup.click('.power');
await popup.waitForTimeout(150);
await popup.emulateMedia({ colorScheme: 'light' });
await popup.waitForTimeout(150);
await popup.screenshot({ path: path.join(shots, 'popup-light.png'), fullPage: true });
await popup.close();

// Studio, every section, both schemes
const studio = await ctx.newPage();
watch(studio, 'studio');
for (const scheme of ['dark', 'light']) {
  await studio.emulateMedia({ colorScheme: scheme });
  for (const sec of ['settings', 'theme', 'messages', 'data', 'about']) {
    await studio.goto(`${base}/studio.html#${sec}`);
    await studio.waitForSelector('.studio.is-ready');
    await studio.waitForTimeout(260);
    if (sec === 'messages') await studio.click('.qm-item__main').catch(() => {});
    await studio.screenshot({ path: path.join(shots, `studio-${sec}-${scheme}.png`), fullPage: sec !== 'theme' });
  }
}
const fontOk = await studio.evaluate(() => document.fonts.check('13px Geist'));
check('Geist font loads in extension pages', fontOk);

// Theme engine live: change primary from Studio, read back in storage
await studio.emulateMedia({ colorScheme: 'dark' });
await studio.goto(`${base}/studio.html#theme`);
await studio.waitForSelector('.studio.is-ready');
const hex = studio.locator('.tok__hex').first();
await hex.fill('#5b8cff');
await hex.press('Enter');
await studio.waitForTimeout(200);
const primary = await sw.evaluate(() => chrome.storage.local.get('theme').then((r) => r.theme?.dark?.primary));
check('Theme Studio writes tokens', primary === '#5b8cff', primary);
const imported = await studio.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--waux-primary').trim());
check('Studio re-themes itself live', imported === '#5b8cff', imported);
await studio.click('.preset >> nth=0');
await studio.waitForTimeout(150);

// Live WhatsApp Web (logged out: QR screen) with the real content script
const wa = await ctx.newPage();
watch(wa, 'whatsapp');
await wa.emulateMedia({ colorScheme: 'dark' });
try {
  await wa.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wa.waitForTimeout(9000);
  const probe = await wa.evaluate(() => {
    const html = document.documentElement;
    const css = getComputedStyle(html);
    return {
      cls: html.className,
      accent: css.getPropertyValue('--WDS-accent').trim(),
      themeCss: document.getElementById('waux-theme')?.textContent?.length ?? 0,
      font: document.fonts.check('13px Geist'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      light: matchMedia('(prefers-color-scheme: light)').matches,
    };
  });
  check('WhatsApp: html.waux applied', probe.cls.includes('waux'), probe.cls);
  check('WhatsApp: WDS tokens overridden', probe.accent === (probe.light ? '#d9522a' : '#f26a3d'), probe.accent);
  check('WhatsApp: theme stylesheet injected', probe.themeCss > 1000, String(probe.themeCss));
  check('WhatsApp: Geist available', probe.font, probe.bodyFont);
  await wa.screenshot({ path: path.join(shots, 'whatsapp-themed.png') });
  await wa.keyboard.press('Control+k');
  await wa.waitForTimeout(400);
  const overlay = await wa.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.2)?.tagName);
  check('WhatsApp: Ctrl+K shows the palette on top', overlay === 'WAUX-OVERLAY', overlay);
  await wa.screenshot({ path: path.join(shots, 'whatsapp-palette.png') });
  await wa.keyboard.press('Escape');
} catch (e) {
  check('WhatsApp reachable', false, String(e.message).split('\n')[0]);
}

// Logged-in surfaces, against the structural mock served at a WhatsApp URL
// so the real content script runs on it.
const mockHtml = await readFile(path.join(root, 'scripts/mock-whatsapp.html'), 'utf8');
await ctx.route('**/*waux-mock*', (route) => route.fulfill({ contentType: 'text/html', body: mockHtml }));
const setSettings = (patch) =>
  sw.evaluate(async (patch) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const merged = { ...settings, ...patch, privacy: { ...(settings.privacy ?? {}), ...(patch.privacy ?? {}) }, declutter: { ...(settings.declutter ?? {}), ...(patch.declutter ?? {}) } };
    await chrome.storage.local.set({ settings: merged });
  }, patch);
const mock = await ctx.newPage();
watch(mock, 'mock');
await mock.emulateMedia({ colorScheme: 'dark' });

// Shield on, Cipher style (no blur on text)
await setSettings({ shield: true, focus: false, privacy: { messages: true, names: true, avatars: true, media: true, style: 'cipher', reveal: 'hover' } });
await mock.goto('https://web.whatsapp.com/?waux-mock=chat');
await mock.waitForTimeout(2500);
const cipher = await mock.evaluate(async () => {
  await document.fonts.ready;
  const span = document.querySelector('[data-testid^="conv-msg-"] span[dir="ltr"]');
  const cs = getComputedStyle(span);
  return { font: cs.fontFamily, filter: cs.filter, loaded: document.fonts.check('14px "WAUX Cipher"') };
});
check('Mock: cipher hides text without blur', cipher.font.includes('WAUX Cipher') && cipher.filter === 'none', `${cipher.font} / ${cipher.filter}`);
check('Mock: cipher font loads from the extension', cipher.loaded);
const avatar = await mock.evaluate(() => {
  const img = document.querySelector('[data-testid="cell-frame-container"] img');
  const cs = getComputedStyle(img);
  return { pos: cs.objectPosition, bg: cs.backgroundImage.startsWith('url("data:image/svg') };
});
check('Mock: photos become 3D avatars', avatar.pos.startsWith('-9999px') && avatar.bg, JSON.stringify(avatar));
await mock.waitForTimeout(5200);
const initials = await mock.evaluate(() => {
  const el = document.querySelector('[data-waux-initials]');
  return el ? getComputedStyle(el).backgroundImage.startsWith('url("data:image/svg') : false;
});
check('Mock: initials avatars become 3D avatars', initials);
const extra = await mock.evaluate(() => ({
  phone: getComputedStyle(document.querySelector('.phone')).fontFamily,
  msgInitials: document.querySelector('.ini')?.hasAttribute('data-waux-initials'),
}));
check('Mock: sender phone numbers are ciphered', extra.phone.includes('WAUX Cipher'), extra.phone);
check('Mock: initials avatars beside group messages become 3D', !!extra.msgInitials);
const wall = await mock.evaluate(() => {
  const el = document.querySelector('[data-waux-wallpaper]');
  return { marked: !!el, opacity: el ? getComputedStyle(el).opacity : null, ambient: getComputedStyle(document.getElementById('main'), '::before').animationName };
});
check('Mock: doodles replaced by ambient wallpaper', wall.marked && wall.opacity === '0' && wall.ambient === 'waux-drift', JSON.stringify(wall));
const shieldOff = await (async () => {
  await setSettings({ shield: false });
  await mock.waitForTimeout(400);
  const f = await mock.evaluate(() => getComputedStyle(document.querySelector('[data-testid^="conv-msg-"] span[dir="ltr"]')).fontFamily);
  await setSettings({ shield: true });
  await mock.waitForTimeout(400);
  return f;
})();
check('Mock: Shield off shows real text', !shieldOff.includes('WAUX Cipher'), shieldOff);
await mock.screenshot({ path: path.join(shots, 'mock-cipher.png') });
await mock.hover('[data-testid="conv-msg-true_1"] [data-testid="msg-container"]');
await mock.waitForTimeout(400);
const revealed = await mock.evaluate(() => getComputedStyle(document.querySelector('[data-testid="conv-msg-true_1"] span[dir="ltr"]')).fontFamily);
check('Mock: hover decodes a message', !revealed.includes('WAUX Cipher'), revealed);
await mock.screenshot({ path: path.join(shots, 'mock-cipher-hover.png') });
await mock.mouse.move(5, 400);

// Blur style
await setSettings({ shield: true, privacy: { style: 'blur' } });
await mock.waitForTimeout(500);
const blurred = await mock.evaluate(() => {
  const span = document.querySelector('[data-testid^="conv-msg-"] span[dir="ltr"]');
  const bubble = document.querySelector('[data-testid="msg-container"]');
  return { text: getComputedStyle(span).filter, bubble: getComputedStyle(bubble).filter };
});
check('Mock: blur style blurs text, not bubbles', blurred.text.includes('blur') && blurred.bubble === 'none', JSON.stringify(blurred));
await mock.screenshot({ path: path.join(shots, 'mock-blur-shield.png') });

// Focus Mode: chat list hidden, divider gone, Chats tab offered
await setSettings({ shield: false, focus: true, privacy: { style: 'cipher' } });
await mock.waitForTimeout(1500);
const focus = await mock.evaluate(() => ({
  side: getComputedStyle(document.querySelector('[data-waux-col="side"]')).display,
  divider: getComputedStyle(document.querySelector('.divider')).visibility,
  edge: getComputedStyle(document.querySelector('.edgeline')).borderRightColor,
  edgeTab: document.elementFromPoint(document.getElementById('main').getBoundingClientRect().left + 8, innerHeight / 2)?.tagName,
}));
check('Mock: Focus hides chat list and divider, shows Chats tab', focus.side === 'none' && focus.divider === 'hidden' && focus.edgeTab === 'WAUX-OVERLAY', JSON.stringify(focus));
check('Mock: Focus hides the edge line of overlay layers', focus.edge === 'rgba(0, 0, 0, 0)', focus.edge);
await mock.screenshot({ path: path.join(shots, 'mock-focus.png') });
await setSettings({ focus: false });

// Hide from sidebar + declutter
await sw.evaluate(() => chrome.storage.local.set({ vault: { hidden: ['Amarjeet'], lock: null } }));
await setSettings({ declutter: { metaAi: true, communities: true, promo: true } });
await mock.waitForTimeout(1500);
const layout = await mock.evaluate(() => ({
  hidden: document.querySelector('[data-testid="list-item-1"]').hasAttribute('data-waux-hidden'),
  shifted: document.querySelector('[data-testid="list-item-2"]').style.translate,
  meta: getComputedStyle(document.querySelector('[data-waux-nav="meta-ai"]') ?? document.body).display,
  communities: getComputedStyle(document.querySelector('[data-waux-nav="communities"]') ?? document.body).display,
  promo: getComputedStyle(document.querySelector('[data-waux-nav="promo"]') ?? document.body).display,
  dockKeys: document.elementFromPoint(32, document.querySelector('[data-testid="navbar-footer-section"]').getBoundingClientRect().top - 30)?.tagName,
}));
check('Mock: hidden chat removed and list closes the gap', layout.hidden && layout.shifted === '0px -72px', JSON.stringify(layout));
check('Mock: Meta AI, Communities and promo banner hidden', layout.meta === 'none' && layout.communities === 'none' && layout.promo === 'none', JSON.stringify(layout));
check('Mock: WAUX dock sits on the rail', layout.dockKeys === 'WAUX-OVERLAY', layout.dockKeys);
await mock.screenshot({ path: path.join(shots, 'mock-chats.png') });
// WhatsApp slides Calls / Status / Settings panels over the chat list; they must stay on top.
await mock.evaluate(() => (document.querySelector('.drawer').style.display = 'block'));
const drawerHit = await mock.evaluate(() => (document.elementFromPoint(250, 300)?.closest('.drawer') ? 'drawer' : document.elementFromPoint(250, 300)?.tagName));
check('Mock: Calls/Settings panels open over the chat list', drawerHit === 'drawer', drawerHit);
await mock.evaluate(() => (document.querySelector('.drawer').style.display = 'none'));

// No chat open (with Focus Mode still on, the reported failure): the chat
// list must stay visible and the WAUX start panel covers only the content.
await setSettings({ focus: true });
await mock.goto('https://web.whatsapp.com/?waux-mock=nochat');
await mock.waitForTimeout(2500);
const welcome = await mock.evaluate(() => ({
  panel: document.elementFromPoint(innerWidth * 0.8, innerHeight / 2)?.tagName,
  list: document.getElementById('side').getBoundingClientRect().width,
  listHit: document.elementFromPoint(200, 300)?.closest?.('#side') ? 'side' : document.elementFromPoint(200, 300)?.tagName,
}));
check('Mock: no chat + Focus keeps the chat list visible', welcome.list > 300 && welcome.listHit === 'side', JSON.stringify(welcome));
check('Mock: start panel shown when no chat is open', welcome.panel === 'WAUX-OVERLAY', welcome.panel);
// Settings / Profile / Media screens (no download link) must never be covered.
await mock.evaluate(() => document.querySelector('.intro a')?.remove());
await mock.waitForTimeout(1600);
const other = await mock.evaluate(() => document.elementFromPoint(innerWidth * 0.8, innerHeight / 2)?.tagName);
check('Mock: start panel never covers other WhatsApp screens', other !== 'WAUX-OVERLAY', other);
await setSettings({ focus: false });
await mock.screenshot({ path: path.join(shots, 'mock-welcome.png') });
await sw.evaluate(() => chrome.storage.local.set({ vault: { hidden: [], lock: null } }));
await setSettings({ declutter: { metaAi: false, communities: false } });

// Attach to a tab that is already loaded, as happens on install / update.
// (A start-up ordering bug once crashed the script only in this path.)
await setSettings({ shield: true, privacy: { avatars: true, messages: true } });
await sw.evaluate(async () => {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  const tab = tabs.find((t) => t.url.includes('waux-mock'));
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
});
await mock.waitForTimeout(1200);
await mock.keyboard.press('Control+k');
await mock.waitForTimeout(400);
const attached = await mock.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.2)?.tagName);
check('Mock: attaching to an already open tab works', attached === 'WAUX-OVERLAY', attached);
await mock.keyboard.press('Escape');
await setSettings({ shield: false });

if (store) {
  const p = await ctx.newPage();
  await p.emulateMedia({ colorScheme: 'dark' });
  for (const sec of ['settings', 'theme', 'messages']) {
    await p.goto(`${base}/studio.html#${sec}`);
    await p.waitForSelector('.studio.is-ready');
    await p.waitForTimeout(300);
    if (sec === 'messages') await p.click('.qm-item__main').catch(() => {});
    await p.screenshot({ path: path.join(root, 'store', `screenshot-${sec}-1280x800.png`) });
  }
}

await ctx.close();
await rm(profile, { recursive: true, force: true });

const appErrors = errors.filter((e) => !e.startsWith('whatsapp:') || /waux|content\.js|chrome-extension/i.test(e));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(appErrors.length ? `\nConsole errors:\n${appErrors.join('\n')}` : '\nNo extension console errors.');
console.log(`Screenshots: ${path.relative(root, shots)}/`);
process.exit(results.every((r) => r.ok) && !appErrors.length ? 0 : 1);
