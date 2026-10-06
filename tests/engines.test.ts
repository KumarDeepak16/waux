import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, mix, normalizeHex, onColor, parseColor } from '../src/shared/color.ts';
import { chatAccentCss, derive, whatsappCss, whatsappVars } from '../src/engines/theme/compile.ts';
import { exportTheme, importTheme } from '../src/engines/theme/io.ts';
import { OBSIDIAN, PRESETS } from '../src/engines/theme/presets.ts';
import { exportTemplates, fuzzyScore, importTemplates, newTemplate, normalizeShortcut, searchTemplates, shortcutToken, templatesForShortcut } from '../src/engines/quick/search.ts';
import { planSidebar, type HiddenCache } from '../src/adapter/sidebar-plan.ts';

test('parseColor handles hex, rgb, hsl, bare hsl, oklch', () => {
  assert.equal(normalizeHex('#abc'), '#aabbcc');
  assert.equal(normalizeHex('rgb(255, 0, 0)'), '#ff0000');
  assert.equal(normalizeHex('rgb(255 0 0 / 50%)'), '#ff0000');
  assert.equal(normalizeHex('hsl(0, 100%, 50%)'), '#ff0000');
  assert.equal(normalizeHex('0 0% 100%'), '#ffffff');
  assert.equal(normalizeHex('oklch(1 0 0)'), '#ffffff');
  assert.equal(normalizeHex('oklch(0% 0 0)'), '#000000');
  assert.equal(normalizeHex('oklch(0.628 0.2577 29.23)'), '#ff0000');
  assert.equal(parseColor('nonsense'), null);
  assert.equal(parseColor('#12'), null);
});

test('mix endpoints and onColor contrast', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.ok(contrast(onColor('#f26a3d'), '#f26a3d') >= 4.5);
  assert.ok(contrast(onColor('#0b0c0e'), '#0b0c0e') >= 4.5);
});

test('every preset keeps text readable on every surface', () => {
  for (const theme of PRESETS) {
    for (const scheme of ['dark', 'light'] as const) {
      const p = derive(theme[scheme], scheme, theme.depth);
      const where = `${theme.name}/${scheme}`;
      assert.ok(contrast(p.fg, p.card) >= 7, `${where} fg/card`);
      assert.ok(contrast(p.fgMuted, p.card) >= 4.5, `${where} muted/card`);
      assert.ok(contrast(p.inFg, p.incoming) >= 4.5, `${where} incoming`);
      assert.ok(contrast(p.outFg, p.outgoing) >= 4.5, `${where} outgoing`);
      assert.ok(contrast(p.primaryFg, p.primary) >= 4.5, `${where} primary`);
    }
  }
});

test('changing one token re-derives dependent surfaces', () => {
  const a = derive(OBSIDIAN.dark, 'dark', 1);
  const b = derive({ ...OBSIDIAN.dark, card: '#202020' }, 'dark', 1);
  for (const k of ['s2', 's3', 'pressed', 'fgMuted'] as const) assert.notEqual(a[k], b[k], k);
  assert.equal(a.bg, b.bg);
});

test('WDS vars include rgb triplets; css covers system mode', () => {
  const vars = whatsappVars(derive(OBSIDIAN.dark, 'dark', 1));
  assert.equal(vars['--WDS-accent'], '#f26a3d');
  assert.equal(vars['--WDS-accent-rgb'], '242, 106, 61');
  assert.ok(vars['--WDS-systems-bubble-surface-outgoing']);
  const css = whatsappCss(OBSIDIAN, 'system');
  assert.match(css, /@media \(prefers-color-scheme: light\)/);
  assert.match(css, /--WDS-accent:#f26a3d !important/);
  assert.doesNotMatch(whatsappCss(OBSIDIAN, 'dark'), /@media/);
  assert.match(chatAccentCss(OBSIDIAN, 'dark', '#5b8cff'), /^html\.waux #main\{.*--WDS-accent:#5b8cff/);
});

test('import: tweakcn CSS with oklch, both schemes, radius in rem', () => {
  const css = `
    :root { --background: oklch(1 0 0); --foreground: oklch(0.145 0 0); --primary: oklch(0.205 0 0);
            --card: oklch(1 0 0); --border: oklch(0.922 0 0); --radius: 0.625rem; }
    .dark { --background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0); --primary: oklch(0.922 0 0); }`;
  const res = importTheme(css, OBSIDIAN);
  if ('error' in res) assert.fail(res.error);
  assert.equal(res.theme.light.background, '#ffffff');
  assert.equal(res.theme.radius, 10);
  assert.equal(res.theme.dark.foreground, normalizeHex('oklch(0.985 0 0)'));
  // Untouched tokens are kept from the base theme.
  assert.equal(res.theme.dark.muted, OBSIDIAN.dark.muted);
});

test('import: legacy shadcn bare HSL and single dark block', () => {
  const res = importTheme(':root{--background: 240 10% 3.9%; --primary: 0 72% 51%;}', OBSIDIAN);
  if ('error' in res) assert.fail(res.error);
  assert.equal(res.theme.dark.primary, normalizeHex('hsl(0, 72%, 51%)'));
  assert.equal(res.theme.light.primary, OBSIDIAN.light.primary);
});

test('import: WAUX JSON round-trips; registry JSON; errors', () => {
  const t = { ...structuredClone(OBSIDIAN), name: 'Mine', radius: 3, density: 'compact' as const };
  const back = importTheme(exportTheme(t), OBSIDIAN);
  if ('error' in back) assert.fail(back.error);
  assert.deepEqual(back.theme, t);
  const reg = importTheme(JSON.stringify({ cssVars: { light: { primary: '#112233' }, dark: { primary: '#445566' } } }), OBSIDIAN);
  if ('error' in reg) assert.fail(reg.error);
  assert.equal(reg.theme.dark.primary, '#445566');
  assert.ok('error' in importTheme('{bad json', OBSIDIAN));
  assert.ok('error' in importTheme('body { color: red }', OBSIDIAN));
  assert.ok('error' in importTheme('', OBSIDIAN));
});

test('quick messages: shortcut token and search ranking', () => {
  assert.equal(shortcutToken('hello ;tha'), 'tha');
  assert.equal(shortcutToken(';omw'), 'omw');
  assert.equal(shortcutToken('mail;tha'), null);
  assert.equal(shortcutToken('hello ;'), null);
  assert.equal(normalizeShortcut(';Thanks!'), 'thanks');
  const list = [
    newTemplate({ title: 'Thanks, received', shortcut: 'thanks', body: 'Thanks, got it.' }),
    newTemplate({ title: 'Thank you note', shortcut: 'thx', body: 'Thank you!' }),
    newTemplate({ title: 'On my way', shortcut: 'omw', body: 'On my way, ten minutes out.', favorite: true }),
  ];
  assert.deepEqual(templatesForShortcut(list, 'th').map((t) => t.shortcut), ['thanks', 'thx']);
  assert.deepEqual(templatesForShortcut(list, 'thx').map((t) => t.shortcut), ['thx']);
  assert.equal(searchTemplates(list, ';omw')[0].shortcut, 'omw');
  assert.equal(searchTemplates(list, '')[0].shortcut, 'omw'); // favorite first
  assert.equal(searchTemplates(list, 'zzz').length, 0);
  assert.ok(fuzzyScore('Hidden chats', 'hc') > 0);
  assert.equal(fuzzyScore('Focus', 'xyz'), -1);
});

test('sidebar plan: hides rows, shifts later rows, remembers off-screen rows', () => {
  const hidden = new Set(['Ana']);
  const cache: HiddenCache = new Map();
  const rows = (names: string[], start: number) => names.map((name, i) => ({ index: start + i, name, height: 72 }));

  let plan = planSidebar(rows(['A', 'Ana', 'B', 'C'], 0), hidden, cache);
  assert.deepEqual([...plan.hide], [1]);
  assert.equal(plan.shift.get(0), undefined);
  assert.equal(plan.shift.get(2), 72);
  assert.equal(plan.removed, 72);

  // Scrolled: Ana's row is no longer rendered but still counts.
  plan = planSidebar(rows(['X', 'Y'], 10), hidden, cache);
  assert.equal(plan.shift.get(10), 72);

  // Ana moved; a visible chat now occupies index 1, so the cache entry is stale.
  plan = planSidebar(rows(['A', 'Z', 'B'], 0), hidden, cache);
  assert.equal(plan.removed, 0);
  assert.equal(plan.shift.size, 0);

  // Exempt (temporarily revealed) chats are not hidden.
  plan = planSidebar(rows(['Ana', 'B'], 0), hidden, cache, new Set(['Ana']));
  assert.equal(plan.hide.size, 0);
});

test('quick messages: JSON import merges, dedupes and keeps shortcuts unique', () => {
  const existing = [newTemplate({ title: 'Hi', body: 'Hello there', shortcut: 'hi' })];
  const res = importTemplates(
    existing,
    JSON.stringify([
      { title: 'Hi', body: 'Hello there', shortcut: 'hi' },
      { text: 'On my way', shortcut: ';OMW' },
      { title: 'Clash', body: 'Different text', shortcut: 'hi' },
      { title: 'Empty' },
    ]),
  );
  if ('error' in res) assert.fail(res.error);
  assert.equal(res.added, 2);
  assert.equal(res.skipped, 2);
  assert.equal(res.list[1].shortcut, 'omw');
  assert.equal(res.list[1].title, 'On my way');
  assert.equal(res.list[2].shortcut, '');
  const round = importTemplates([], exportTemplates(res.list));
  if ('error' in round) assert.fail(round.error);
  assert.equal(round.added, 3);
  assert.ok('error' in importTemplates([], '{nope'));
  assert.ok('error' in importTemplates([], '{"a":1}'));
});
