// Shared bootstrap for extension pages (popup, studio): state hook plus
// live theming of the page itself with the user's tokens.
import { useEffect, useState } from 'preact/hooks';
import { pageCss } from '../engines/theme/compile.ts';
import { loadState, normalize, onState, save } from '../shared/storage.ts';
import type { State } from '../shared/types.ts';

const style = document.createElement('style');
document.head.append(style);

export function paint(s: State) {
  style.textContent = pageCss(s.theme, s.settings.mode);
  document.documentElement.classList.toggle('w-reduce-motion', s.settings.reduceMotion);
}

const initial = normalize({});
paint(initial);

export function usePageState() {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      setReady(true);
    });
    return onState((next) => setState((prev) => ({ ...prev, ...next })));
  }, []);
  useEffect(() => paint(state), [state.theme, state.settings.mode, state.settings.reduceMotion]);

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    // Drags (color pickers, sliders) fire continuously; write at most every 60ms.
    pending[key] = value;
    clearTimeout(timer);
    timer = window.setTimeout(flush, 60);
  }
  return { state, ready, update };
}

export type Page = ReturnType<typeof usePageState>;

let pending: Partial<State> = {};
let timer = 0;
function flush() {
  const batch = pending;
  pending = {};
  for (const [k, v] of Object.entries(batch)) save(k as keyof State, v as never);
}
addEventListener('pagehide', flush);
