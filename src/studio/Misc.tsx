import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, DEFAULT_VAULT, normalize, save, starterTemplates } from '../shared/storage.ts';
import { OBSIDIAN } from '../engines/theme/presets.ts';
import { Icon } from '../ui/icons.tsx';
import { Kbd, MOD, Row, Switch } from '../ui/kit.tsx';
import type { Page } from '../ui/page.ts';

const VERSION = chrome.runtime.getManifest().version;

// ---- Data ---------------------------------------------------------------------

export function DataSection({ state }: Page) {
  const [withHidden, setWithHidden] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [armed, setArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chrome.storage.local.getBytesInUse(null).then(setBytes);
  }, [state]);

  const exportAll = () => {
    const data = {
      format: 'waux-backup@1',
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      theme: state.theme,
      templates: state.templates,
      ...(withHidden ? { vault: { hidden: state.vault.hidden, lock: null } } : {}),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `waux-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importAll = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (raw?.format !== 'waux-backup@1') throw new Error('Not a WAUX backup file.');
      const next = normalize(raw);
      await Promise.all([
        save('settings', next.settings),
        save('theme', next.theme),
        save('templates', next.templates),
        ...(raw.vault ? [save('vault', { ...state.vault, hidden: next.vault.hidden })] : []),
      ]);
      setMsg({ ok: true, text: `Restored ${next.templates.length} quick messages and your theme.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  };

  const resetAll = async () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS, theme: OBSIDIAN, templates: starterTemplates(), vault: DEFAULT_VAULT });
    setMsg({ ok: true, text: 'Everything was reset.' });
  };

  return (
    <div class="sec sec--narrow">
      <header class="sec__head">
        <h1>Your data</h1>
        <p>Settings, theme and quick messages live in this browser profile only. Nothing is synced or uploaded.</p>
      </header>
      <div class="group">
        <Row icon={<Icon name="database" />} label="Stored on this device" hint="chrome.storage.local">
          <span class="w-mono">{bytes === null ? '...' : `${(bytes / 1024).toFixed(1)} KB`}</span>
        </Row>
        <Row icon={<Icon name="download" />} label="Export backup" hint="Settings, theme and quick messages as JSON. PINs are never exported.">
          <button class="w-btn w-btn--sm" onClick={exportAll}>
            Export
          </button>
        </Row>
        <Row label="Include hidden chat names" hint="Off by default. Anyone with the file can read them.">
          <Switch label="Include hidden chat names" checked={withHidden} onChange={setWithHidden} />
        </Row>
        <Row icon={<Icon name="upload" />} label="Restore backup" hint="Replaces current settings, theme and quick messages">
          <button class="w-btn w-btn--sm" onClick={() => fileRef.current?.click()}>
            Choose file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) importAll(f);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </Row>
        <Row icon={<Icon name="reset" />} label="Reset everything" hint="Deletes all WAUX data in this browser. Cannot be undone.">
          <button class={`w-btn w-btn--sm w-btn--danger${armed ? ' is-armed' : ''}`} onClick={resetAll} onBlur={() => setArmed(false)}>
            {armed ? 'Confirm reset' : 'Reset'}
          </button>
        </Row>
      </div>
      {msg && (
        <p class={`io__msg${msg.ok ? '' : ' is-error'}`} role="status">
          {msg.text}
        </p>
      )}
      <Compatibility />
    </div>
  );
}

// ---- WhatsApp compatibility ---------------------------------------------------------

type Diag = Partial<Record<string, boolean>> & { at?: number };

const HOOKS: { key: string; label: string; needsChat?: boolean }[] = [
  { key: 'app', label: 'WhatsApp app loaded' },
  { key: 'tokens', label: 'Theme tokens applied' },
  { key: 'chatList', label: 'Chat list' },
  { key: 'chatRows', label: 'Chat rows' },
  { key: 'chatNames', label: 'Chat names (hide, per-chat)' },
  { key: 'openChat', label: 'Open conversation', needsChat: true },
  { key: 'chatTitle', label: 'Conversation title', needsChat: true },
  { key: 'messages', label: 'Messages (blur, bubbles)', needsChat: true },
  { key: 'composer', label: 'Composer (quick messages)', needsChat: true },
];

export function Compatibility() {
  const [diag, setDiag] = useState<Diag | null>(null);
  useEffect(() => {
    chrome.storage.local.get('diag').then((r) => setDiag((r.diag as Diag) ?? null));
    const on = (ch: Record<string, chrome.storage.StorageChange>) => ch.diag && setDiag(ch.diag.newValue as Diag);
    chrome.storage.onChanged.addListener(on);
    return () => chrome.storage.onChanged.removeListener(on);
  }, []);

  return (
    <div class="group">
      <div class="group__head">
        <h2>WhatsApp compatibility</h2>
        <span class="w-mono w-muted">{diag?.at ? `checked ${new Date(diag.at).toLocaleTimeString()}` : 'not checked yet'}</span>
      </div>
      {!diag ? (
        <p class="compat__empty">Open web.whatsapp.com in a tab. WAUX checks the page every few seconds and reports here.</p>
      ) : (
        <ul class="compat">
          {HOOKS.map((h) => {
            const ok = !!diag[h.key];
            const pending = !ok && h.needsChat && !diag.openChat;
            return (
              <li class={`compat__row ${ok ? 'is-ok' : pending ? 'is-wait' : 'is-bad'}`}>
                <span class="compat__dot" aria-hidden="true" />
                <span>{h.label}</span>
                <span class="w-mono compat__state">{ok ? 'Found' : pending ? 'Open a chat' : 'Not found'}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p class="note">
        <Icon name="info" size={13} />
        <span>
          If something shows Not found after a WhatsApp update, press <Kbd>{MOD}</Kbd> <Kbd>K</Kbd> in WhatsApp and run Save
          layout report. The file holds page structure only, no messages or names.
        </span>
      </p>
    </div>
  );
}

// ---- About, privacy policy, disclaimer ------------------------------------------

export function AboutSection(_: Page) {
  return (
    <div class="sec sec--narrow sec--about">
      <header class="about-hero">
        <img class="about-hero__mark" src="icons/icon.svg" width={72} height={72} alt="" />
        <div>
          <h1>WhatsApp Web, redesigned.</h1>
          <p>
            WAUX {VERSION}. Made by{' '}
            <a href="https://1619.in" target="_blank" rel="noopener noreferrer">
              Deepak Kumar, 1619.in
            </a>
          </p>
        </div>
      </header>

      <div class="group">
        <div class="group__head">
          <h2>Get started</h2>
        </div>
        <ol class="steps">
          <li>
            <strong>Open web.whatsapp.com.</strong> The Obsidian theme is already on.
          </li>
          <li>
            <strong>
              Press <Kbd>{MOD}</Kbd> <Kbd>K</Kbd>.
            </strong>{' '}
            Shield, Focus Mode, hidden chats and quick messages are all there.
          </li>
          <li>
            <strong>Make it yours.</strong> <a href="#theme">Theme Studio</a> and the <a href="#privacy">Privacy Center</a> hold the rest.
          </li>
        </ol>
      </div>

      <div class="group legal" id="privacy-policy">
        <div class="group__head">
          <h2>Privacy policy</h2>
          <span class="w-mono w-muted">Effective 6 October 2026</span>
        </div>
        <h3>What WAUX collects</h3>
        <p>Nothing. WAUX has no servers, no accounts, no analytics and no tracking. It makes no network requests of any kind.</p>
        <h3>What stays on your device</h3>
        <p>
          Your settings, theme, quick messages, per-chat preferences, the names of chats you hide, and a salted hash of your
          optional PIN. They are kept in your browser's extension storage on this device and are never synced or uploaded.
        </p>
        <h3>What WAUX reads on WhatsApp Web</h3>
        <p>
          To work, WAUX runs inside web.whatsapp.com and reads the page in your browser: the open chat's name (for per-chat
          preferences), chat names in the list (to hide the ones you chose), and the text you type before a ;shortcut. This
          stays in memory on your device. Messages, contacts, media, phone numbers and chat history are never stored, copied or
          transmitted.
        </p>
        <h3>Permissions</h3>
        <p>
          <span class="w-mono">storage</span> to save your settings locally, and access to{' '}
          <span class="w-mono">web.whatsapp.com</span> only. No other sites, no tabs, history or clipboard access. All code
          ships inside the extension; nothing is loaded remotely.
        </p>
        <h3>Deleting your data</h3>
        <p>
          Use <a href="#data">Data, Reset everything</a>, or remove the extension. Both delete all WAUX data from this browser.
        </p>
        <h3>Contact</h3>
        <p>
          Questions about this policy:{' '}
          <a href="https://1619.in" target="_blank" rel="noopener noreferrer">
            1619.in
          </a>
        </p>
      </div>

      <div class="group legal" id="disclaimer">
        <div class="group__head">
          <h2>Disclaimer</h2>
        </div>
        <p>
          WAUX is an independent project. It is not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta
          Platforms, Inc. WhatsApp is a trademark of WhatsApp LLC, used here only to describe compatibility.
        </p>
        <p>
          WAUX changes how WhatsApp Web looks and behaves inside your own browser. It does not access your WhatsApp account,
          encryption keys or servers, and it never sends a message for you.
        </p>
        <p>
          Blur, Privacy Shield, Hide from sidebar and the PIN are visual privacy features for your screen. They are not
          security controls: anyone with access to this browser profile or your phone can still read your chats.
        </p>
        <p>
          WhatsApp updates its website often. Some WAUX features may stop working until WAUX is updated. WAUX is provided as is,
          without warranty of any kind. Use it in line with WhatsApp's Terms of Service.
        </p>
      </div>

      <div class="group legal">
        <div class="group__head">
          <h2>Open source</h2>
        </div>
        <ul class="licenses">
          <li>
            <span>Geist and Geist Mono</span>
            <span class="w-mono w-muted">SIL Open Font License 1.1, Vercel</span>
          </li>
          <li>
            <span>Phosphor Icons</span>
            <span class="w-mono w-muted">MIT</span>
          </li>
          <li>
            <span>Preact</span>
            <span class="w-mono w-muted">MIT</span>
          </li>
        </ul>
      </div>

      <footer class="about-foot">
        <span>
          Made by{' '}
          <a href="https://1619.in" target="_blank" rel="noopener noreferrer">
            Deepak Kumar
          </a>
        </span>
        <span class="w-mono w-muted">1619.in</span>
      </footer>
    </div>
  );
}
