// Phosphor (bold) icons. The build turns each SVG into its path data, so
// icons render as plain elements: no innerHTML, safe under Trusted Types.
import shieldCheck from '@phosphor-icons/core/assets/bold/shield-check-bold.svg';
import shield from '@phosphor-icons/core/assets/bold/shield-bold.svg';
import eye from '@phosphor-icons/core/assets/bold/eye-bold.svg';
import eyeSlash from '@phosphor-icons/core/assets/bold/eye-slash-bold.svg';
import lightning from '@phosphor-icons/core/assets/bold/lightning-bold.svg';
import chatText from '@phosphor-icons/core/assets/bold/chat-text-bold.svg';
import search from '@phosphor-icons/core/assets/bold/magnifying-glass-bold.svg';
import palette from '@phosphor-icons/core/assets/bold/palette-bold.svg';
import sliders from '@phosphor-icons/core/assets/bold/sliders-horizontal-bold.svg';
import star from '@phosphor-icons/core/assets/bold/star-bold.svg';
import starFill from '@phosphor-icons/core/assets/fill/star-fill.svg';
import trash from '@phosphor-icons/core/assets/bold/trash-bold.svg';
import plus from '@phosphor-icons/core/assets/bold/plus-bold.svg';
import pencil from '@phosphor-icons/core/assets/bold/pencil-simple-bold.svg';
import lock from '@phosphor-icons/core/assets/bold/lock-simple-bold.svg';
import lockOpen from '@phosphor-icons/core/assets/bold/lock-simple-open-bold.svg';
import keyboard from '@phosphor-icons/core/assets/bold/keyboard-bold.svg';
import moon from '@phosphor-icons/core/assets/bold/moon-bold.svg';
import sun from '@phosphor-icons/core/assets/bold/sun-bold.svg';
import monitor from '@phosphor-icons/core/assets/bold/monitor-bold.svg';
import crosshair from '@phosphor-icons/core/assets/bold/crosshair-simple-bold.svg';
import x from '@phosphor-icons/core/assets/bold/x-bold.svg';
import check from '@phosphor-icons/core/assets/bold/check-bold.svg';
import download from '@phosphor-icons/core/assets/bold/download-simple-bold.svg';
import upload from '@phosphor-icons/core/assets/bold/upload-simple-bold.svg';
import reset from '@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg';
import power from '@phosphor-icons/core/assets/bold/power-bold.svg';
import caretRight from '@phosphor-icons/core/assets/bold/caret-right-bold.svg';
import paintBrush from '@phosphor-icons/core/assets/bold/paint-brush-bold.svg';
import rows from '@phosphor-icons/core/assets/bold/rows-bold.svg';
import arrowUpRight from '@phosphor-icons/core/assets/bold/arrow-up-right-bold.svg';
import copy from '@phosphor-icons/core/assets/bold/copy-bold.svg';
import database from '@phosphor-icons/core/assets/bold/database-bold.svg';
import bell from '@phosphor-icons/core/assets/bold/bell-simple-slash-bold.svg';
import user from '@phosphor-icons/core/assets/bold/user-circle-bold.svg';
import image from '@phosphor-icons/core/assets/bold/image-bold.svg';
import textAa from '@phosphor-icons/core/assets/bold/text-aa-bold.svg';
import info from '@phosphor-icons/core/assets/bold/info-bold.svg';

const ICONS = {
  shieldCheck, shield, eye, eyeSlash, lightning, chatText, search, palette, sliders, star, starFill,
  trash, plus, pencil, lock, lockOpen, keyboard, moon, sun, monitor, crosshair, x, check, download,
  upload, reset, power, caretRight, paintBrush, rows, arrowUpRight, copy, database, bell, user, image,
  textAa, info,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, class: cls }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={`w-icon${cls ? ` ${cls}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name].map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}
