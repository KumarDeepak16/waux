import { useEffect, useRef, useState } from 'preact/hooks';
import { resolveScheme } from '../engines/theme/compile.ts';
import { exportTheme, importTheme } from '../engines/theme/io.ts';
import { OBSIDIAN, PRESETS } from '../engines/theme/presets.ts';
import { normalizeHex } from '../shared/color.ts';
import { pickWallpaper } from '../shared/wallpaper.ts';
import { COLOR_KEYS, type ColorKey, type Density, type Scheme, type Theme, type ThemeStyle } from '../shared/types.ts';
import { Icon } from '../ui/icons.tsx';
import { Row, Seg, Switch } from '../ui/kit.tsx';
import type { Page } from '../ui/page.ts';
import { Preview } from './Preview.tsx';

const TOKEN_INFO: Record<ColorKey, [string, string]> = {
  primary: ['Primary', 'Actions, focus, selected chat, read receipts'],
  secondary: ['Secondary', 'Unread badges and search focus'],
  background: ['Background', 'App canvas and chat wallpaper'],
  foreground: ['Foreground', 'Text and icons'],
  card: ['Card', 'Panels, chat list, headers'],
  muted: ['Muted', 'Inputs, chips, system notices'],
  accent: ['Accent', 'Hover and selected chat'],
  border: ['Border', 'Dividers and outlines'],
  incoming: ['Incoming', 'Messages you receive'],
  outgoing: ['Outgoing', 'Messages you send'],
};

export function ThemeSection({ state, update }: Page) {
  const [wallError, setWallError] = useState('');
  const uploadWall = async () => {
    setWallError('');
    try {
      const url = await pickWallpaper();
      if (!url) return;
      update('walls', { ...state.walls, global: url });
      setTheme({ wallpaper: 'custom' });
    } catch (e) {
      setWallError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };
  const theme = state.theme;
  const [scheme, setScheme] = useState<Scheme>(() => resolveScheme(state.settings.mode));
  const setTheme = (patch: Partial<Theme>) => update('theme', { ...theme, ...patch });
  const setColor = (k: ColorKey, v: string) => setTheme({ [scheme]: { ...theme[scheme], [k]: v } });

  return (
    <div class="sec sec--theme">
      <div class="sec__controls">
        <header class="sec__head">
          <h1>Theme Studio</h1>
          <p>Ten tokens drive every surface. Hover, pressed, elevation and text contrast are derived for you.</p>
        </header>

        <div class="presets" role="radiogroup" aria-label="Presets">
          {PRESETS.map((p) => {
            const c = p[scheme];
            const active = theme.name === p.name;
            return (
              <button
                class="preset"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme({ ...structuredClone(p), density: theme.density, font: theme.font })}
              >
                <span class="preset__swatch" style={{ background: c.background }}>
                  <span style={{ background: c.card }} />
                  <span style={{ background: c.outgoing }} />
                  <span style={{ background: c.primary }} />
                </span>
                <span class="preset__name">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div class="group">
          <div class="group__head">
            <h2>Colors</h2>
            <Seg<Scheme>
              label="Editing scheme"
              value={scheme}
              onChange={setScheme}
              options={[
                { value: 'dark', label: <><Icon name="moon" size={13} /> Dark</> },
                { value: 'light', label: <><Icon name="sun" size={13} /> Light</> },
              ]}
            />
          </div>
          <div class="tokens">
            {COLOR_KEYS.map((k) => (
              <TokenRow key={`${scheme}-${k}`} k={k} value={theme[scheme][k]} onChange={(v) => setColor(k, v)} />
            ))}
          </div>
        </div>

        <div class="group">
          <div class="group__head">
            <h2>Shape and depth</h2>
          </div>
          <Row label="Style" hint="Hard offsets, or soft 3D with a bottom lip and multicolor accents">
            <Seg<ThemeStyle>
              label="Style"
              value={theme.style}
              onChange={(style) => setTheme({ style })}
              options={[
                { value: 'brutal', label: 'Hard' },
                { value: 'soft', label: 'Soft 3D' },
              ]}
            />
          </Row>
          <Slider label="Radius" value={theme.radius} min={0} max={20} unit="px" onChange={(radius) => setTheme({ radius })} />
          <Slider label="Depth" value={Math.round(theme.depth * 100)} min={0} max={100} unit="%" onChange={(d) => setTheme({ depth: d / 100 })} />
          <Slider label="Glass blur" value={theme.blur} min={0} max={32} unit="px" onChange={(blur) => setTheme({ blur })} />
        </div>

        <div class="group">
          <div class="group__head">
            <h2>Layout and type</h2>
          </div>
          <Row label="Density" hint="Spacing in WhatsApp and WAUX panels">
            <Seg<Density>
              label="Density"
              value={theme.density}
              onChange={(density) => setTheme({ density })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Spacious' },
              ]}
            />
          </Row>
          <Row label="Typeface" hint="Geist ships inside WAUX, nothing is downloaded">
            <Seg
              label="Typeface"
              value={theme.font}
              onChange={(font) => setTheme({ font })}
              options={[
                { value: 'geist', label: 'Geist' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Row>
          <Row label="Chat wallpaper" hint="Soft is a still color wash with a fine dot grid">
            <Seg
              label="Chat wallpaper"
              value={theme.wallpaper}
              onChange={(wallpaper) => (wallpaper === 'custom' && !state.walls.global ? uploadWall() : setTheme({ wallpaper }))}
              options={[
                { value: 'ambient', label: 'Soft' },
                { value: 'doodles', label: 'Doodles' },
                { value: 'plain', label: 'Plain' },
                { value: 'custom', label: 'Image' },
              ]}
            />
          </Row>
          {theme.wallpaper === 'custom' && (
            <>
              <Row label="Wallpaper image" hint={wallError || 'Stored on this device only, resized to 1600px'}>
                <button class="w-btn" onClick={uploadWall}>
                  <Icon name="upload" size={14} /> Choose image
                </button>
              </Row>
              <Slider label="Image blur" value={theme.wallBlur} min={0} max={60} unit="px" onChange={(wallBlur) => setTheme({ wallBlur })} />
              <Slider label="Image dim" value={Math.round(theme.wallDim * 100)} min={0} max={90} unit="%" onChange={(d) => setTheme({ wallDim: d / 100 })} />
            </>
          )}
          <Row label="Reduce motion" hint="Also follows your system setting">
            <Switch
              label="Reduce motion"
              checked={state.settings.reduceMotion}
              onChange={(reduceMotion) => update('settings', { ...state.settings, reduceMotion })}
            />
          </Row>
        </div>

        <ImportExport theme={theme} onApply={(t) => update('theme', t)} />
      </div>

      <div class="sec__preview">
        <div class="preview-frame">
          <div class="preview-frame__bar">
            <span class="w-label">Live preview</span>
            <span class="w-mono w-muted">
              {theme.name} / {scheme}
            </span>
          </div>
          <Preview theme={theme} scheme={scheme} />
        </div>
      </div>
    </div>
  );
}

function TokenRow({ k, value, onChange }: { k: ColorKey; value: string; onChange: (v: string) => void }) {
  const [label, desc] = TOKEN_INFO[k];
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex) onChange(hex);
    else setDraft(value);
  };
  return (
    <div class="tok">
      <label class="tok__swatch" style={{ background: value }} title={`Pick ${label}`}>
        <input type="color" value={value} onInput={(e) => onChange((e.target as HTMLInputElement).value)} aria-label={`${label} color`} />
      </label>
      <span class="tok__text">
        <span class="tok__name">{label}</span>
        <span class="tok__desc">{desc}</span>
      </span>
      <input
        class="w-input w-mono tok__hex"
        value={draft}
        spellcheck={false}
        aria-label={`${label} value`}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  const fill = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label class="slider">
      <span class="slider__label">{props.label}</span>
      <input
        class="w-range"
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        style={{ '--fill': `${fill}%` }}
        onInput={(e) => props.onChange(Number((e.target as HTMLInputElement).value))}
      />
      <output class="slider__value w-mono">
        {props.value}
        {props.unit}
      </output>
    </label>
  );
}

function ImportExport({ theme, onApply }: { theme: Theme; onApply: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimer = useRef(0);

  const apply = () => {
    const res = importTheme(text, theme);
    if ('error' in res) return setMsg({ ok: false, text: res.error });
    onApply(res.theme);
    setMsg({ ok: true, text: `Applied ${res.applied.join('; ')}` });
    setText('');
  };

  const download = () => {
    const blob = new Blob([exportTheme(theme)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `waux-theme-${theme.name.toLowerCase().replace(/\W+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(exportTheme(theme));
    setMsg({ ok: true, text: 'Theme JSON copied' });
  };

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    onApply(structuredClone(OBSIDIAN));
    setMsg({ ok: true, text: 'Reset to Obsidian' });
  };

  return (
    <div class="group">
      <div class="group__head">
        <h2>Import and export</h2>
      </div>
      <div class="io">
        <button class="w-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="upload" size={14} /> Import
        </button>
        <button class="w-btn" onClick={download}>
          <Icon name="download" size={14} /> Export JSON
        </button>
        <button class="w-btn w-btn--ghost" onClick={copy}>
          <Icon name="copy" size={14} /> Copy
        </button>
        <button class={`w-btn w-btn--ghost io__reset${confirmReset ? ' is-armed' : ''}`} onClick={reset}>
          <Icon name="reset" size={14} /> {confirmReset ? 'Confirm reset' : 'Reset'}
        </button>
      </div>
      {open && (
        <div class="io__panel">
          <label class="w-field">
            <span>Paste WAUX JSON, a shadcn/tweakcn theme, or CSS variables</span>
            <textarea
              class="w-textarea w-mono"
              rows={7}
              spellcheck={false}
              placeholder={':root {\n  --primary: oklch(0.65 0.19 40);\n  --background: oklch(0.14 0 0);\n}\n.dark { ... }'}
              value={text}
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <div class="io__actions">
            <button class="w-btn w-btn--primary" disabled={!text.trim()} onClick={apply}>
              Apply theme
            </button>
            <span class="w-muted io__hint">Missing tokens keep their current values. Bubbles are derived if absent.</span>
          </div>
        </div>
      )}
      {msg && (
        <p class={`io__msg${msg.ok ? '' : ' is-error'}`} role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
