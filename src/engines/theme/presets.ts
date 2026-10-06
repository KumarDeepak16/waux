import type { Theme } from '../../shared/types.ts';

const base = { radius: 8, density: 'comfortable', depth: 0.7, blur: 18, font: 'geist', wallpaper: 'ambient' } as const;

/** Default. Neutral graphite surfaces, warm off-white ink, one ember signal. */
export const OBSIDIAN: Theme = {
  ...base,
  name: 'Obsidian',
  dark: {
    primary: '#f26a3d',
    background: '#0b0c0e',
    foreground: '#e9e7e2',
    card: '#121316',
    muted: '#1a1b1f',
    accent: '#1e2025',
    border: '#25272c',
    incoming: '#17181c',
    outgoing: '#2a1d17',
  },
  light: {
    primary: '#d9522a',
    background: '#eeeef0',
    foreground: '#141416',
    card: '#fbfbfc',
    muted: '#e6e6e9',
    accent: '#e4e4e8',
    border: '#d9d9de',
    incoming: '#ffffff',
    outgoing: '#fbe6dc',
  },
};

export const COBALT: Theme = {
  ...base,
  name: 'Cobalt',
  radius: 10,
  dark: {
    primary: '#5b8cff',
    background: '#090b10',
    foreground: '#e4e8f1',
    card: '#10131a',
    muted: '#171b24',
    accent: '#1b2030',
    border: '#232838',
    incoming: '#141822',
    outgoing: '#17223d',
  },
  light: {
    primary: '#2f5fe0',
    background: '#eef0f5',
    foreground: '#10131a',
    card: '#fcfcfe',
    muted: '#e5e8ef',
    accent: '#e2e7f3',
    border: '#d6dae5',
    incoming: '#ffffff',
    outgoing: '#dfe8ff',
  },
};

export const MOSS: Theme = {
  ...base,
  name: 'Moss',
  radius: 4,
  depth: 0.5,
  dark: {
    primary: '#a3c46b',
    background: '#0a0c0a',
    foreground: '#e3e6dc',
    card: '#111411',
    muted: '#181c17',
    accent: '#1c211b',
    border: '#252a23',
    incoming: '#151914',
    outgoing: '#1d2817',
  },
  light: {
    primary: '#4d7a1f',
    background: '#eef0eb',
    foreground: '#121510',
    card: '#fbfcfa',
    muted: '#e5e8e1',
    accent: '#e2e7dc',
    border: '#d5dacd',
    incoming: '#ffffff',
    outgoing: '#e3edd3',
  },
};

export const PRESETS: Theme[] = [OBSIDIAN, COBALT, MOSS];
