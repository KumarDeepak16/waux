import type { ComponentChildren } from 'preact';

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      class="w-switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="w-switch__knob" />
    </button>
  );
}

export function Seg<T extends string>(props: {
  value: T;
  options: { value: T; label: ComponentChildren; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="w-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === props.value}
          title={o.title}
          class="w-seg__opt"
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ComponentChildren }) {
  return <kbd class="w-kbd">{children}</kbd>;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';
export const ALT = isMac ? '⌥' : 'Alt';

/** Settings row: label + optional hint on the left, control on the right. */
export function Row(props: { label: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; icon?: ComponentChildren }) {
  return (
    <div class="w-row">
      {props.icon && <span class="w-row__icon">{props.icon}</span>}
      <div class="w-row__text">
        <div class="w-row__label">{props.label}</div>
        {props.hint && <div class="w-row__hint">{props.hint}</div>}
      </div>
      <div class="w-row__control">{props.children}</div>
    </div>
  );
}
