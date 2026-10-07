import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fuzzyScore, searchTemplates } from '../engines/quick/search.ts';
import { hashPin } from '../shared/storage.ts';
import type { ChatPrefs, State, Template, Wallpaper } from '../shared/types.ts';
import { chatWallKey, pickWallpaper } from '../shared/wallpaper.ts';
import { Icon, type IconName } from '../ui/icons.tsx';
import { ALT, Kbd, MOD, Seg, Switch } from '../ui/kit.tsx';
import { Logo } from '../ui/Logo.tsx';
import { useStore, type Store } from './store.ts';

export type View = 'palette' | 'chat' | 'hidden' | null;

export interface Suggest {
  items: Template[];
  index: number;
  token: string;
}

export interface Toast {
  text: string;
  undo?: () => void;
}

export interface Dock {
  left: number;
  bottom: number;
  compact: boolean;
}

export interface Stage {
  rect: { left: number; top: number; width: number; height: number } | null;
  /** Left edge for the Chats tab: the right side of WhatsApp's nav rail. */
  edgeLeft: number;
  /** No chat open: show the WAUX start panel. */
  welcome: boolean;
  /** Focus Mode is hiding the chat list: show the Chats edge tab. */
  edge: boolean;
}

export interface UiState {
  view: View;
  /** Initial palette query, e.g. ';' to open on quick messages. */
  query: string;
  suggest: Suggest | null;
  toast: Toast | null;
  dock: Dock | null;
  stage: Stage | null;
  unlocked: boolean;
  version: number;
}

export interface Actions {
  state(): State;
  activeChat(): string | null;
  /** Chat names currently rendered in WhatsApp's list. */
  visibleChats(): string[];
  hasChat(): boolean;
  close(): void;
  show(view: View, query?: string): void;
  toast(msg: string, undo?: () => void): void;
  saveLayoutReport(): void;
  toggleShield(): void;
  toggleFocus(): void;
  cycleMode(): void;
  cycleDensity(): void;
  insertTemplate(t: Template): void;
  acceptSuggest(t: Template): void;
  setChatPrefs(name: string, patch: { [K in keyof ChatPrefs]?: ChatPrefs[K] | undefined }): void;
  /** undefined follows the theme; an image is stored per chat. */
  setChatWallpaper(name: string, wallpaper: Wallpaper | undefined, image?: string): void;
  setHidden(name: string, hidden: boolean): void;
  openChat(name: string): void;
  openStudio(section: string): void;
  unlock(): void;
  lockNow(): void;
}

export function Overlay({ store, actions }: { store: Store<UiState>; actions: Actions }) {
  const ui = useStore(store);
  return (
    <div class="w-root">
      {ui.view && (
        <div class="o-scrim" onMouseDown={(e) => e.target === e.currentTarget && actions.close()}>
          {ui.view === 'palette' && <Palette actions={actions} initial={ui.query} />}
          {ui.view === 'chat' && <ChatPanel actions={actions} />}
          {ui.view === 'hidden' && <HiddenPanel actions={actions} unlocked={ui.unlocked} />}
        </div>
      )}
      {ui.suggest && <SuggestBox suggest={ui.suggest} actions={actions} />}
      {ui.stage?.welcome && ui.stage.rect && <Welcome rect={ui.stage.rect} actions={actions} />}
      {ui.stage?.edge && <EdgeTab left={ui.stage.edgeLeft} actions={actions} />}
      {ui.dock && <DockBar dock={ui.dock} actions={actions} />}
      {ui.toast && (
        <div class="o-toast" role="status">
          <span>{ui.toast.text}</span>
          {ui.toast.undo && (
            <button class="o-toast__undo" onClick={ui.toast.undo}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Command palette --------------------------------------------------------

interface Item {
  id: string;
  group: string;
  icon: IconName;
  label: string;
  hint?: string;
  meta?: ComponentChildren;
  keywords?: string;
  run: () => void;
}

const on = (v: boolean) => <span class={`o-state${v ? ' is-on' : ''}`}>{v ? 'On' : 'Off'}</span>;

function Palette({ actions, initial }: { actions: Actions; initial: string }) {
  const [query, setQuery] = useState(initial);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const s = actions.state();
  const chat = actions.activeChat();

  const items = useMemo(() => {
    const st = s.settings;
    const act: Item[] = [
      { id: 'shield', group: 'Actions', icon: st.shield ? 'shieldCheck' : 'shield', label: 'Privacy Shield', hint: 'Blur everything on screen', meta: on(st.shield), keywords: 'blur hide privacy', run: actions.toggleShield },
      { id: 'focus', group: 'Actions', icon: 'crosshair', label: 'Focus Mode', hint: 'Hide the chat list', meta: on(st.focus), keywords: 'zen distraction', run: actions.toggleFocus },
      { id: 'mode', group: 'Actions', icon: st.mode === 'light' ? 'sun' : st.mode === 'dark' ? 'moon' : 'monitor', label: 'Appearance', hint: 'System, dark, light', meta: <span class="o-state">{st.mode}</span>, keywords: 'theme dark light system', run: actions.cycleMode },
      { id: 'density', group: 'Actions', icon: 'rows', label: 'Density', hint: 'Compact, comfortable, spacious', meta: <span class="o-state">{s.theme.density}</span>, keywords: 'layout spacing compact', run: actions.cycleDensity },
      { id: 'hidden', group: 'Actions', icon: 'lock', label: 'Hidden chats', hint: 'Chats kept out of the sidebar', run: () => actions.show('hidden') },
    ];
    if (chat) {
      act.push({ id: 'chat', group: 'This chat', icon: 'paintBrush', label: 'Customize this chat', hint: chat, keywords: 'accent color blur nickname alias text size font wallpaper background image wide bubbles', run: () => actions.show('chat') });
      if (!s.vault.hidden.includes(chat)) {
        act.push({ id: 'hide', group: 'This chat', icon: 'eyeSlash', label: 'Hide from sidebar', hint: chat, run: () => { actions.setHidden(chat, true); actions.close(); } });
      }
    }
    act.push(
      { id: 'studio', group: 'WAUX', icon: 'palette', label: 'Theme Studio', keywords: 'colors tokens customize', run: () => actions.openStudio('theme') },
      { id: 'qm', group: 'WAUX', icon: 'chatText', label: 'Manage quick messages', keywords: 'templates', run: () => actions.openStudio('messages') },
      { id: 'privacy', group: 'WAUX', icon: 'sliders', label: 'Privacy Center', keywords: 'blur settings', run: () => actions.openStudio('privacy') },
      { id: 'report', group: 'WAUX', icon: 'download', label: 'Save layout report', hint: 'Page structure only, for fixing WAUX after a WhatsApp update', keywords: 'debug diagnostics broken', run: actions.saveLayoutReport },
    );

    const q = query.trim();
    const acts = q
      ? act
          .map((i) => ({ i, sc: fuzzyScore(`${i.label} ${i.keywords ?? ''}`, q) }))
          .filter((x) => x.sc >= 0)
          .sort((a, b) => b.sc - a.sc)
          .map((x) => x.i)
      : act;
    const tpls = searchTemplates(s.templates, q)
      .slice(0, q ? 8 : 5)
      .map<Item>((t) => ({
        id: `t:${t.id}`,
        group: 'Quick messages',
        icon: t.favorite ? 'starFill' : 'chatText',
        label: t.title || 'Untitled',
        hint: t.body.replace(/\s+/g, ' ').slice(0, 64),
        meta: t.shortcut ? <span class="w-mono o-short">;{t.shortcut}</span> : undefined,
        run: () => actions.insertTemplate(t),
      }));
    const chats: Item[] = [];
    if (q && !q.startsWith(';')) {
      for (const name of actions.visibleChats()) {
        if (fuzzyScore(name, q) < 0 || chats.length >= 5) continue;
        chats.push({ id: `c:${name}`, group: 'Chats', icon: 'chatText', label: name, hint: 'Open chat', run: () => actions.openChat(name) });
      }
      chats.push({ id: 'c:search', group: 'Chats', icon: 'search', label: `Open chat "${q}"`, hint: 'Find it with WhatsApp search', run: () => actions.openChat(q) });
    }
    // Typing a ";shortcut" puts quick messages first.
    return q.startsWith(';') ? [...tpls, ...acts] : [...acts, ...chats, ...tpls];
  }, [query, s, chat]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setIndex((i) => Math.min(items.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setIndex((i) => Math.max(0, i - 1));
    else if (e.key === 'Enter') items[index]?.run();
    else if (e.key === 'Escape') actions.close();
    else return;
    e.preventDefault();
  };

  let lastGroup = '';
  return (
    <div class="o-panel o-palette" role="dialog" aria-label="WAUX command palette">
      <div class="o-search">
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          class="o-search__input"
          placeholder="Search actions and quick messages"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={onKey}
          spellcheck={false}
          role="combobox"
          aria-expanded="true"
          aria-controls="o-list"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div class="o-list" id="o-list" role="listbox" ref={listRef}>
        {items.length === 0 && (
          <div class="w-empty">
            <strong>No matches</strong>
            <span>Try an action name, a template title, or ;shortcut.</span>
          </div>
        )}
        {items.map((it, i) => {
          const header = it.group !== lastGroup ? <div class="o-group w-label">{it.group}</div> : null;
          lastGroup = it.group;
          return (
            <Fragment key={it.id}>
              {header}
              <div
                class="o-item"
                role="option"
                aria-selected={i === index}
                onMouseMove={() => i !== index && setIndex(i)}
                onClick={() => it.run()}
              >
                <span class="o-item__icon">
                  <Icon name={it.icon} size={15} />
                </span>
                <span class="o-item__text">
                  <span class="o-item__label">{it.label}</span>
                  {it.hint && <span class="o-item__hint">{it.hint}</span>}
                </span>
                {it.meta}
              </div>
            </Fragment>
          );
        })}
      </div>
      <div class="o-foot">
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> Move</span>
        <span><Kbd>Enter</Kbd> Run</span>
        <span class="o-foot__end"><Kbd>{ALT}</Kbd> Hold to peek</span>
      </div>
    </div>
  );
}

// ---- Per-chat customization -------------------------------------------------

const TEXT_SIZES = ['0.9', '1', '1.1', '1.25'] as const;
type ChatWall = Wallpaper | 'theme';

export const SWATCHES = ['#f26a3d', '#e0a23b', '#8fb35a', '#3fa596', '#5b8cff', '#8b7cf6', '#e0607e', '#8a94a6'];

function ChatPanel({ actions }: { actions: Actions }) {
  const chat = actions.activeChat();
  const s = actions.state();
  if (!chat) {
    return (
      <div class="o-panel o-sheet">
        <div class="w-empty">
          <strong>No chat open</strong>
          <span>Open a conversation, then customize it here.</span>
        </div>
      </div>
    );
  }
  const prefs = s.settings.chats[chat] ?? {};
  const hidden = s.vault.hidden.includes(chat);
  const hasImage = !!s.walls[chatWallKey(chat)];
  const uploadWall = async () => {
    try {
      const url = await pickWallpaper();
      if (url) actions.setChatWallpaper(chat, 'custom', url);
    } catch (e) {
      actions.toast(e instanceof Error ? e.message : 'Could not read that image');
    }
  };
  const setWall = (w: ChatWall) => {
    if (w === 'custom' && !hasImage) return void uploadWall();
    actions.setChatWallpaper(chat, w === 'theme' ? undefined : w);
  };
  return (
    <div class="o-panel o-sheet" role="dialog" aria-label="Customize this chat">
      <header class="o-sheet__head">
        <div>
          <div class="w-label">This chat</div>
          <div class="o-sheet__title">{chat}</div>
        </div>
        <button class="w-btn w-btn--ghost w-btn--icon" aria-label="Close" onClick={actions.close}>
          <Icon name="x" />
        </button>
      </header>
      <div class="o-sheet__body">
        <div class="o-field-label">Accent</div>
        <div class="o-swatches" role="radiogroup" aria-label="Chat accent">
          <button
            class="o-swatch o-swatch--none"
            role="radio"
            aria-checked={!prefs.accent}
            title="Theme default"
            onClick={() => actions.setChatPrefs(chat, { accent: undefined })}
          />
          {SWATCHES.map((c) => (
            <button
              class="o-swatch"
              role="radio"
              aria-checked={prefs.accent === c}
              style={{ '--sw': c }}
              title={c}
              onClick={() => actions.setChatPrefs(chat, { accent: c })}
            />
          ))}
        </div>
        <label class="w-field">
          <span>Nickname</span>
          <input
            class="w-input"
            placeholder={chat}
            value={prefs.nickname ?? ''}
            maxLength={40}
            aria-label="Nickname"
            onChange={(e) => actions.setChatPrefs(chat, { nickname: (e.target as HTMLInputElement).value.trim() })}
          />
          <small class="o-field-hint">Shown instead of the name in your list and this header. Stays on this device.</small>
        </label>
        <div class="o-field-label">Text size</div>
        <Seg
          label="Text size"
          value={String(prefs.textScale ?? 1)}
          onChange={(v) => actions.setChatPrefs(chat, { textScale: v === '1' ? undefined : Number(v) })}
          options={TEXT_SIZES.map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))}
        />
        <div class="o-field-label">Wallpaper</div>
        <Seg<ChatWall>
          label="Wallpaper"
          value={prefs.wallpaper ?? 'theme'}
          onChange={setWall}
          options={[
            { value: 'theme', label: 'Theme' },
            { value: 'ambient', label: 'Soft' },
            { value: 'plain', label: 'Plain' },
            { value: 'doodles', label: 'Doodles' },
            { value: 'custom', label: 'Image' },
          ]}
        />
        {prefs.wallpaper === 'custom' && (
          <button class="w-btn" onClick={uploadWall}>
            <Icon name="image" size={14} /> Change image
          </button>
        )}
        <div class="o-rows">
          <label class="o-toggle">
            <span>
              <strong>Wide bubbles</strong>
              <small>Long messages use the full width of the chat.</small>
            </span>
            <Switch label="Wide bubbles" checked={!!prefs.wide} onChange={(v) => actions.setChatPrefs(chat, { wide: v })} />
          </label>
          <label class="o-toggle">
            <span>
              <strong>Always blur this chat</strong>
              <small>Messages and media stay blurred until revealed.</small>
            </span>
            <Switch label="Always blur this chat" checked={!!prefs.blur} onChange={(v) => actions.setChatPrefs(chat, { blur: v })} />
          </label>
          <label class="o-toggle">
            <span>
              <strong>Hide from sidebar</strong>
              <small>Moves it to Hidden chats. Nothing is archived.</small>
            </span>
            <Switch label="Hide from sidebar" checked={hidden} onChange={(v) => actions.setHidden(chat, v)} />
          </label>
        </div>
      </div>
    </div>
  );
}

// ---- Hidden chats -----------------------------------------------------------

function HiddenPanel({ actions, unlocked }: { actions: Actions; unlocked: boolean }) {
  const s = actions.state();
  const lock = s.vault.lock;
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);
  const locked = !!lock && !unlocked;
  const chat = actions.activeChat();

  useEffect(() => {
    if (locked) pinRef.current?.focus();
  }, [locked]);

  const tryUnlock = async (e: Event) => {
    e.preventDefault();
    if (!lock) return;
    if ((await hashPin(pin, lock.salt)) === lock.hash) {
      setErr('');
      actions.unlock();
    } else {
      setErr('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <div class="o-panel o-sheet" role="dialog" aria-label="Hidden chats">
      <header class="o-sheet__head">
        <div>
          <div class="w-label">Visual privacy</div>
          <div class="o-sheet__title">Hidden chats</div>
        </div>
        <div class="o-head-actions">
          {lock && unlocked && (
            <button class="w-btn w-btn--ghost w-btn--sm" onClick={actions.lockNow}>
              <Icon name="lock" size={14} /> Lock
            </button>
          )}
          <button class="w-btn w-btn--ghost w-btn--icon" aria-label="Close" onClick={actions.close}>
            <Icon name="x" />
          </button>
        </div>
      </header>

      {locked ? (
        <form class="o-lock" onSubmit={tryUnlock}>
          <span class="o-lock__glyph">
            <Icon name="lock" size={20} />
          </span>
          <label class="w-field">
            <span>Enter PIN</span>
            <input
              ref={pinRef}
              class="w-input o-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={pin}
              onInput={(e) => setPin((e.target as HTMLInputElement).value)}
              aria-invalid={!!err}
              aria-describedby="o-pin-err"
            />
          </label>
          <div class="o-err" id="o-pin-err" role="alert">
            {err}
          </div>
          <button class="w-btn w-btn--primary" type="submit" disabled={!pin}>
            Unlock
          </button>
        </form>
      ) : (
        <div class="o-sheet__body">
          {s.vault.hidden.length === 0 ? (
            <div class="w-empty">
              <span class="w-empty__glyph">
                <Icon name="eyeSlash" />
              </span>
              <strong>No hidden chats</strong>
              <span>Hidden chats disappear from the chat list and live here.</span>
            </div>
          ) : (
            <ul class="o-hidden">
              {s.vault.hidden.map((name) => (
                <li class="o-hidden__row">
                  <span class="o-avatar" aria-hidden="true">
                    {name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span class="o-hidden__name">{name}</span>
                  <button class="w-btn w-btn--sm" onClick={() => actions.openChat(name)}>
                    Open
                  </button>
                  <button
                    class="w-btn w-btn--ghost w-btn--sm w-btn--icon"
                    title="Unhide"
                    aria-label={`Unhide ${name}`}
                    onClick={() => actions.setHidden(name, false)}
                  >
                    <Icon name="eye" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <HidePicker actions={actions} />
        </div>
      )}
      <footer class="o-note">
        <Icon name="info" size={13} />
        <span>
          Visual privacy on this device only. Chats are never archived, deleted or changed in WhatsApp.
          {!lock && (
            <>
              {' '}
              <button class="o-link" onClick={() => actions.openStudio('privacy')}>
                Add a PIN
              </button>
            </>
          )}
        </span>
      </footer>
    </div>
  );
}

// ---- ;shortcut suggestions -------------------------------------------------

function SuggestBox({ suggest, actions }: { suggest: Suggest; actions: Actions }) {
  const composer = document.querySelector('#main footer [contenteditable="true"]');
  const rect = composer?.getBoundingClientRect();
  if (!rect) return null;
  const style = {
    left: `${Math.max(8, rect.left)}px`,
    bottom: `${Math.max(8, innerHeight - rect.top + 10)}px`,
    width: `${Math.min(440, Math.max(300, rect.width))}px`,
  };
  return (
    <div class="o-panel o-suggest" style={style} role="listbox" aria-label="Quick messages">
      {suggest.items.map((t, i) => (
        <div
          class="o-item"
          role="option"
          aria-selected={i === suggest.index}
          onMouseDown={(e) => {
            e.preventDefault();
            actions.acceptSuggest(t);
          }}
        >
          <span class="w-mono o-short">;{t.shortcut}</span>
          <span class="o-item__text">
            <span class="o-item__label">{t.title || 'Untitled'}</span>
            <span class="o-item__hint">{t.body.replace(/\s+/g, ' ').slice(0, 80)}</span>
          </span>
        </div>
      ))}
      <div class="o-foot">
        <span><Kbd>Tab</Kbd> Insert</span>
        <span><Kbd>Esc</Kbd> Dismiss</span>
        <span class="o-foot__end">Never sends</span>
      </div>
    </div>
  );
}

// ---- Dock: WAUX keys on WhatsApp's left rail --------------------------------------

function DockBar({ dock, actions }: { dock: Dock; actions: Actions }) {
  const s = actions.state().settings;
  const keys: { id: string; icon: IconName; tip: string; on?: boolean; run: () => void }[] = [
    { id: 'shield', icon: s.shield ? 'shieldCheck' : 'shield', tip: 'Privacy Shield', on: s.shield, run: actions.toggleShield },
    { id: 'hidden', icon: 'lock', tip: 'Hidden chats', run: () => actions.show('hidden') },
    { id: 'quick', icon: 'lightning', tip: 'Quick messages', run: () => actions.show('palette', ';') },
    { id: 'focus', icon: 'crosshair', tip: 'Focus Mode', on: s.focus, run: actions.toggleFocus },
    { id: 'theme', icon: 'palette', tip: 'Theme Studio', run: () => actions.openStudio('theme') },
  ];
  return (
    <nav class="o-dock" style={{ left: `${dock.left}px`, bottom: `${dock.bottom}px` }} aria-label="WAUX">
      <button class="o-dock__key o-dock__brand" data-tip="WAUX  Ctrl K" aria-label="Open WAUX" onClick={() => actions.show('palette')}>
        <Logo size={26} shadow={false} />
      </button>
      {!dock.compact &&
        keys.map((k, i) => (
          <button
            class={`o-dock__key${k.on ? ' is-on' : ''}`}
            style={{ '--i': i + 1 }}
            data-tip={k.tip}
            aria-label={k.tip}
            aria-pressed={k.on}
            onClick={k.run}
          >
            <Icon name={k.icon} size={18} />
          </button>
        ))}
      <span class="o-dock__rule" />
    </nav>
  );
}
// ---- Start panel (replaces "Download WhatsApp for Windows") ------------------------

type Rect = NonNullable<Stage['rect']>;
const place = (r: Rect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });

function Welcome({ rect, actions }: { rect: Rect; actions: Actions }) {
  const keys: { keys: ComponentChildren; label: string; run: () => void }[] = [
    { keys: <><Kbd>{MOD}</Kbd><Kbd>K</Kbd></>, label: 'Command palette', run: () => actions.show('palette') },
    { keys: <><span class="w-mono o-short">;thanks</span><Kbd>Tab</Kbd></>, label: 'Quick message', run: () => actions.show('palette', ';') },
    { keys: <Kbd>{ALT}</Kbd>, label: 'Hold to peek', run: () => actions.toast(`Hold ${ALT} anywhere in WhatsApp to read hidden text`) },
    { keys: <><Kbd>{ALT}</Kbd><Kbd>Shift</Kbd><Kbd>S</Kbd></>, label: 'Privacy Shield', run: actions.toggleShield },
  ];
  return (
    <section class="o-welcome" style={place(rect)} aria-label="WAUX">
      <div class="o-welcome__inner">
        <div class="o-welcome__logo">
          <Logo size={84} />
        </div>
        <h1 class="o-welcome__title">
          WhatsApp Web, <em>redesigned.</em>
        </h1>
        <p class="o-welcome__sub">Pick a chat on the left. Everything else is one shortcut away.</p>
        <div class="o-welcome__keys">
          {keys.map((k, i) => (
            <button class="o-tile" style={{ '--i': i }} onClick={k.run}>
              <span class="o-tile__keys">{k.keys}</span>
              <span class="o-tile__label">{k.label}</span>
            </button>
          ))}
        </div>
        <div class="o-welcome__actions">
          <button class="w-btn w-btn--primary" onClick={() => actions.show('palette')}>
            Open WAUX
          </button>
          <button class="w-btn" onClick={() => actions.openStudio('theme')}>
            Theme Studio
          </button>
        </div>
      </div>
      <p class="o-welcome__foot">
        <Icon name="lock" size={12} /> Messages stay end-to-end encrypted by WhatsApp. WAUX runs only on this device.
      </p>
    </section>
  );
}

// ---- Focus Mode: a tab to bring the chat list back ---------------------------------

function EdgeTab({ left, actions }: { left: number; actions: Actions }) {
  return (
    <button
      class="o-edge"
      style={{ left: `${left}px`, top: '50%' }}
      onClick={actions.toggleFocus}
      aria-label="Show chat list (exit Focus Mode)"
      title="Show chats (Alt+Shift+F)"
    >
      <Icon name="caretRight" size={12} />
      <span>Chats</span>
    </button>
  );
}
function HidePicker({ actions }: { actions: Actions }) {
  const s = actions.state();
  const [name, setName] = useState('');
  const hidden = new Set(s.vault.hidden.map((n) => n.toLowerCase()));
  const chat = actions.activeChat();
  const candidates = [...new Set([...(chat ? [chat] : []), ...actions.visibleChats()])]
    .filter((n) => !hidden.has(n.toLowerCase()))
    .filter((n) => !name || n.toLowerCase().includes(name.trim().toLowerCase()))
    .slice(0, 6);
  const add = (n: string) => {
    const v = n.trim();
    if (!v) return;
    actions.setHidden(v, true);
    setName('');
  };
  return (
    <div class="o-picker">
      <div class="o-field-label">Hide a chat</div>
      <form
        class="o-picker__form"
        onSubmit={(e) => {
          e.preventDefault();
          add(name);
        }}
      >
        <input class="w-input" placeholder="Type or pick a chat name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} aria-label="Chat name" />
        <button class="w-btn" type="submit" disabled={!name.trim()}>
          <Icon name="eyeSlash" size={14} /> Hide
        </button>
      </form>
      {candidates.length > 0 && (
        <div class="o-picker__chips">
          {candidates.map((n) => (
            <button class="o-chip" onClick={() => add(n)} title={`Hide ${n}`}>
              <Icon name="plus" size={11} /> {n}
              {n === chat && <span class="o-chip__tag">open</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
