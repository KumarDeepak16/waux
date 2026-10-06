export type Mode = 'system' | 'dark' | 'light';
export type Scheme = 'dark' | 'light';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type FontChoice = 'geist' | 'system';

export const COLOR_KEYS = [
  'primary',
  'background',
  'foreground',
  'card',
  'muted',
  'accent',
  'border',
  'incoming',
  'outgoing',
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type ColorTokens = Record<ColorKey, string>;

export interface Theme {
  name: string;
  dark: ColorTokens;
  light: ColorTokens;
  /** Base corner radius in px. */
  radius: number;
  density: Density;
  /** 0..1, strength of elevation shadows and edge highlights. */
  depth: number;
  /** Backdrop blur in px for floating WAUX surfaces. */
  blur: number;
  font: FontChoice;
  /** Conversation background: drifting ember light, WhatsApp's doodles, or flat. */
  wallpaper: 'ambient' | 'doodles' | 'plain';
}

/** What Privacy Shield hides when it is on. */
export interface PrivacySettings {
  messages: boolean;
  names: boolean;
  avatars: boolean;
  media: boolean;
  notifications: boolean;
  /** Cipher redraws text as dot-matrix glyphs; blur softens it. Media always blurs. */
  style: 'cipher' | 'blur';
  /** Blur radius in px. */
  strength: number;
  reveal: 'hover' | 'click';
}

export interface ChatPrefs {
  accent?: string;
  blur?: boolean;
}

/** WhatsApp surfaces the user can switch off. */
export interface Declutter {
  communities: boolean;
  channels: boolean;
  status: boolean;
  calls: boolean;
  metaAi: boolean;
  /** The 'Get WhatsApp for Windows' banner under the chat list. */
  promo: boolean;
  /** Replace the 'Download WhatsApp for Windows' start panel with WAUX's. */
  intro: boolean;
}

export interface Settings {
  enabled: boolean;
  mode: Mode;
  shield: boolean;
  focus: boolean;
  reduceMotion: boolean;
  privacy: PrivacySettings;
  declutter: Declutter;
  /** Keyed by chat display name. Stored locally only. */
  chats: Record<string, ChatPrefs>;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  category: string;
  /** Without the leading ';'. Empty for none. */
  shortcut: string;
  favorite: boolean;
  uses: number;
  updatedAt: number;
}

export interface Vault {
  /** Chat display names hidden from the WhatsApp sidebar. */
  hidden: string[];
  lock: { salt: string; hash: string } | null;
}

export interface State {
  settings: Settings;
  theme: Theme;
  templates: Template[];
  vault: Vault;
}
