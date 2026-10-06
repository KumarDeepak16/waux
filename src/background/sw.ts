// Service worker: seeds defaults, attaches WAUX to WhatsApp tabs that were
// already open at install/update time, routes browser-level shortcuts into
// storage, and opens the Studio. No network.

import { patchSettings, starterTemplates } from '../shared/storage.ts';

const WA = 'https://web.whatsapp.com/*';

/** Toolbar icon follows the master switch: ember when on, graphite when off. */
function syncIcon(enabled: boolean) {
  const p = enabled ? '' : 'off-';
  chrome.action.setIcon({ path: { 16: `icons/${p}16.png`, 32: `icons/${p}32.png`, 48: `icons/${p}48.png`, 128: `icons/${p}128.png` } });
  chrome.action.setTitle({ title: enabled ? 'WAUX' : 'WAUX (off)' });
}
chrome.storage.local.get('settings').then(({ settings }) => syncIcon((settings as { enabled?: boolean } | undefined)?.enabled !== false));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) syncIcon((changes.settings.newValue as { enabled?: boolean } | undefined)?.enabled !== false);
});

/** Declared content scripts only reach tabs loaded after install. */
async function attachToOpenTabs() {
  const tabs = await chrome.tabs.query({ url: WA });
  for (const tab of tabs) {
    if (!tab.id) continue;
    const target = { tabId: tab.id };
    try {
      await chrome.scripting.insertCSS({ target, files: ['skin.css', 'avatars.css'] });
      await chrome.scripting.executeScript({ target, files: ['main-world.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target, files: ['content.js'] });
    } catch {
      // Tab is discarded or still loading; the declared content script covers it on next load.
    }
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const { templates } = await chrome.storage.local.get('templates');
    if (!templates) await chrome.storage.local.set({ templates: starterTemplates() });
    chrome.tabs.create({ url: chrome.runtime.getURL('studio.html#about') });
  }
  if (reason === 'install' || reason === 'update') attachToOpenTabs();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-shield') patchSettings((s) => void (s.shield = !s.shield));
  if (command === 'toggle-focus') patchSettings((s) => void (s.focus = !s.focus));
});

const SECTIONS = new Set(['theme', 'privacy', 'messages', 'shortcuts', 'data', 'about', 'interface', 'settings']);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'open-studio') {
    const section = SECTIONS.has(msg.section) ? msg.section : 'settings';
    chrome.tabs.create({ url: chrome.runtime.getURL(`studio.html#${section}`) });
  }
});
