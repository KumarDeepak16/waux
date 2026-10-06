import { useEffect, useState } from 'preact/hooks';
import { hashPin, makeLock } from '../shared/storage.ts';
import type { Declutter, PrivacySettings } from '../shared/types.ts';
import { Icon, type IconName } from '../ui/icons.tsx';
import { ALT, Kbd, MOD, Row, Seg, Switch } from '../ui/kit.tsx';
import type { Page } from '../ui/page.ts';

const SCOPE: { key: 'messages' | 'names' | 'avatars' | 'media'; label: string; icon: IconName }[] = [
  { key: 'messages', label: 'Messages', icon: 'chatText' },
  { key: 'names', label: 'Names', icon: 'textAa' },
  { key: 'avatars', label: 'Photos', icon: 'user' },
  { key: 'media', label: 'Media', icon: 'image' },
];

const RAIL: { key: keyof Declutter; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'channels', label: 'Channels' },
  { key: 'communities', label: 'Communities' },
  { key: 'calls', label: 'Calls' },
  { key: 'metaAi', label: 'Meta AI' },
  { key: 'promo', label: '"Get WhatsApp for Windows"' },
];

/** Everything that changes how WhatsApp behaves, on one page. */
export function SettingsSection({ state, update }: Page) {
  const s = state.settings;
  const p = s.privacy;
  const d = s.declutter;
  const setS = (patch: Partial<typeof s>) => update('settings', { ...s, ...patch });
  const setP = (patch: Partial<PrivacySettings>) => update('settings', { ...s, privacy: { ...p, ...patch } });
  const setD = (patch: Partial<Declutter>) => update('settings', { ...s, declutter: { ...d, ...patch } });

  return (
    <div class="sec sec--narrow">
      <header class="sec__head">
        <h1>Settings</h1>
        <p>How WAUX behaves inside WhatsApp. Changes apply instantly in open WhatsApp tabs.</p>
      </header>

      {/* Privacy: one switch, a clear scope, one style. */}
      <div class={`group shield-card${s.shield ? ' is-on' : ''}`} id="privacy">
        <div class="shield-card__top">
          <span class="shield-card__icon">
            <Icon name={s.shield ? 'shieldCheck' : 'shield'} size={20} />
          </span>
          <span class="shield-card__text">
            <strong>Privacy Shield</strong>
            <span>
              Hides what you pick below, on this screen only. Toggle anywhere with <Kbd>{ALT}</Kbd> <Kbd>Shift</Kbd> <Kbd>S</Kbd>.
            </span>
          </span>
          <Switch label="Privacy Shield" checked={s.shield} onChange={(shield) => setS({ shield })} />
        </div>

        <div class="shield-card__label">Shield hides</div>
        <div class="scope" role="group" aria-label="Shield hides">
          {SCOPE.map((x) => (
            <button class="scope__opt" aria-pressed={p[x.key]} onClick={() => setP({ [x.key]: !p[x.key] })}>
              <Icon name={x.icon} size={15} />
              {x.label}
              <span class="scope__check" aria-hidden="true">
                <Icon name="check" size={11} />
              </span>
            </button>
          ))}
        </div>

        <div class="blur-demo">
          <div class={`privacy-sample is-${p.style}`} style={{ '--sample-blur': `${p.strength}px` }}>
            <span class="privacy-sample__name">Anchal</span>
            <span class="privacy-sample__text">Sent the revised floor plan, page 3 has the changes</span>
            <span class="privacy-sample__hint w-mono">Hover to read</span>
          </div>
        </div>

        <Row label="Style" hint={p.style === 'cipher' ? 'Text becomes dot-matrix glyphs. Layout stays readable.' : 'Text is softly blurred.'}>
          <Seg
            label="Style"
            value={p.style}
            onChange={(style) => setP({ style })}
            options={[
              { value: 'cipher', label: 'Cipher' },
              { value: 'blur', label: 'Blur' },
            ]}
          />
        </Row>
        <Row label="Read hidden text" hint={<>Or hold <Kbd>{ALT}</Kbd> to see everything at once</>}>
          <Seg
            label="Read hidden text"
            value={p.reveal}
            onChange={(reveal) => setP({ reveal })}
            options={[
              { value: 'hover', label: 'On hover' },
              { value: 'click', label: 'On click' },
            ]}
          />
        </Row>
        <Row label="Blur strength" hint="For media, and for text in Blur style">
          <input
            class="w-range strength"
            type="range"
            min={2}
            max={20}
            value={p.strength}
            style={{ '--fill': `${((p.strength - 2) / 18) * 100}%` }}
            onInput={(e) => setP({ strength: Number((e.target as HTMLInputElement).value) })}
            aria-label="Blur strength"
          />
        </Row>
      </div>

      <div class="group">
        <Row icon={<Icon name="bell" />} label="Hide notification text" hint='Desktop alerts say "New message". Works even with Shield off.'>
          <Switch label="Hide notification text" checked={p.notifications} onChange={(notifications) => setP({ notifications })} />
        </Row>
      </div>

      <div class="group">
        <div class="group__head">
          <h2>Chat list</h2>
        </div>
        <Row
          icon={<Icon name="crosshair" />}
          label="Focus Mode"
          hint="Hides the chat list while a chat is open. The Chats tab on the left edge brings it back."
        >
          <Switch label="Focus Mode" checked={s.focus} onChange={(focus) => setS({ focus })} />
        </Row>
      </div>

      <HiddenChats {...{ state, update }} />

      <div class="group" id="interface">
        <div class="group__head">
          <h2>Interface</h2>
        </div>
        <Row icon={<Icon name="palette" />} label="WAUX start screen" hint="Replaces WhatsApp's download screen when no chat is open">
          <Switch label="WAUX start screen" checked={d.intro} onChange={(intro) => setD({ intro })} />
        </Row>
        <div class="declutter">
          <div class="shield-card__label">Hide from WhatsApp</div>
          <div class="scope scope--wrap" role="group" aria-label="Hide from WhatsApp">
            {RAIL.map((x) => (
              <button class="scope__opt" aria-pressed={d[x.key]} onClick={() => setD({ [x.key]: !d[x.key] })}>
                {x.label}
                <span class="scope__check" aria-hidden="true">
                  <Icon name="check" size={11} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Shortcuts />
    </div>
  );
}

function Shortcuts() {
  const [cmds, setCmds] = useState<Record<string, string>>({});
  useEffect(() => {
    chrome.commands.getAll((all) => setCmds(Object.fromEntries(all.map((c) => [c.name ?? '', c.shortcut ?? '']))));
  }, []);
  const keys = (s: string) => (s ? s.split('+').map((k) => <Kbd>{k}</Kbd>) : <span class="w-muted">Not set</span>);
  return (
    <div class="group" id="shortcuts">
      <div class="group__head">
        <h2>Shortcuts</h2>
        <button class="w-btn w-btn--sm" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
          Change <Icon name="arrowUpRight" size={12} />
        </button>
      </div>
      <div class="keys">
        <div class="keys__row"><span>Command palette</span><span><Kbd>{MOD}</Kbd><Kbd>K</Kbd></span></div>
        <div class="keys__row"><span>Quick message</span><span><span class="w-mono accent">;shortcut</span> <Kbd>Tab</Kbd></span></div>
        <div class="keys__row"><span>Peek at hidden text</span><span><Kbd>{ALT}</Kbd></span></div>
        <div class="keys__row"><span>Privacy Shield</span><span>{keys(cmds['toggle-shield'] ?? '')}</span></div>
        <div class="keys__row"><span>Focus Mode</span><span>{keys(cmds['toggle-focus'] ?? '')}</span></div>
        <div class="keys__row"><span>Close WAUX panels</span><span><Kbd>Esc</Kbd></span></div>
      </div>
    </div>
  );
}

function HiddenChats({ state, update }: Pick<Page, 'state' | 'update'>) {
  const vault = state.vault;
  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle');
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState('');
  const [gateErr, setGateErr] = useState('');

  const unlockList = async (e: Event) => {
    e.preventDefault();
    if (vault.lock && (await hashPin(gate, vault.lock.salt)) !== vault.lock.hash) return setGateErr('Incorrect PIN');
    setGate('');
    setGateErr('');
    setOpen(true);
  };
  const unhide = (name: string) => update('vault', { ...vault, hidden: vault.hidden.filter((n) => n !== name) });

  const reset = () => {
    setMode('idle');
    setCurrent('');
    setPin('');
    setConfirm('');
    setErr('');
  };

  const checkCurrent = async () => !vault.lock || (await hashPin(current, vault.lock.salt)) === vault.lock.hash;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!(await checkCurrent())) return setErr('Current PIN is incorrect');
    if (mode === 'remove') {
      update('vault', { ...vault, lock: null });
      return reset();
    }
    if (!/^\d{4,12}$/.test(pin)) return setErr('Use 4 to 12 digits');
    if (pin !== confirm) return setErr('PINs do not match');
    update('vault', { ...vault, lock: await makeLock(pin) });
    reset();
  };

  const count = vault.hidden.length;
  return (
    <div class="group">
      <div class="group__head">
        <h2>Hidden chats</h2>
      </div>
      <Row
        icon={<Icon name={vault.lock ? 'lock' : 'lockOpen'} />}
        label={`${count} hidden ${count === 1 ? 'chat' : 'chats'}`}
        hint={vault.lock ? 'Protected by a PIN in WhatsApp' : 'Not protected. Add a PIN to lock the Hidden chats area.'}
      >
        {mode === 'idle' && (
          <>
            <button class="w-btn w-btn--sm" onClick={() => setMode('set')}>
              {vault.lock ? 'Change PIN' : 'Add PIN'}
            </button>
            {vault.lock && (
              <button class="w-btn w-btn--sm w-btn--ghost" onClick={() => setMode('remove')}>
                Remove
              </button>
            )}
          </>
        )}
      </Row>
      {mode !== 'idle' && (
        <form class="pin-form" onSubmit={submit}>
          {vault.lock && (
            <label class="w-field">
              <span>Current PIN</span>
              <input class="w-input w-mono" type="password" inputMode="numeric" value={current} onInput={(e) => setCurrent((e.target as HTMLInputElement).value)} autoFocus />
            </label>
          )}
          {mode === 'set' && (
            <>
              <label class="w-field">
                <span>New PIN</span>
                <input class="w-input w-mono" type="password" inputMode="numeric" value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} autoFocus={!vault.lock} />
              </label>
              <label class="w-field">
                <span>Confirm PIN</span>
                <input class="w-input w-mono" type="password" inputMode="numeric" value={confirm} onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} />
              </label>
            </>
          )}
          <p class="pin-form__err" role="alert">
            {err}
          </p>
          <div class="pin-form__actions">
            <button class="w-btn w-btn--primary" type="submit">
              {mode === 'remove' ? 'Remove PIN' : 'Save PIN'}
            </button>
            <button class="w-btn w-btn--ghost" type="button" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {count > 0 &&
        (open || !vault.lock ? (
          <ul class="hidden-list">
            {vault.hidden.map((name) => (
              <li>
                <span class="hidden-list__avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
                <span class="hidden-list__name">{name}</span>
                <button class="w-btn w-btn--sm" onClick={() => unhide(name)}>
                  <Icon name="eye" size={13} /> Unhide
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form class="pin-form pin-form--inline" onSubmit={unlockList}>
            <input class="w-input w-mono" type="password" inputMode="numeric" placeholder="PIN to view" value={gate} aria-label="PIN" onInput={(e) => setGate((e.target as HTMLInputElement).value)} />
            <button class="w-btn" type="submit" disabled={!gate}>
              <Icon name="lockOpen" size={13} /> Show
            </button>
            <span class="pin-form__err" role="alert">{gateErr}</span>
          </form>
        ))}
      <p class="note">
        <Icon name="info" size={13} />
        <span>
          Hide from sidebar is visual privacy for this browser. Chats are never archived, deleted or changed in WhatsApp, they
          still notify you, and they still appear on your phone. The PIN is stored as a salted hash on this device. It is a
          screen lock for WAUX, not account security.
        </span>
      </p>
    </div>
  );
}
