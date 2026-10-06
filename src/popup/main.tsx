import { render } from 'preact';
import { Icon } from '../ui/icons.tsx';
import { Kbd, MOD } from '../ui/kit.tsx';
import { Logo } from '../ui/Logo.tsx';
import { usePageState } from '../ui/page.ts';

const VERSION = chrome.runtime.getManifest().version;

function openStudio(section: string) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`studio.html#${section}`) });
  window.close();
}

/** One job: switch WAUX on or off. Everything else lives in WhatsApp (Ctrl K) and Settings. */
function Popup() {
  const { state, ready, update } = usePageState();
  const s = state.settings;
  const on = s.enabled;

  return (
    <main class={`w-root pop${on ? ' is-on' : ' is-off'}${ready ? ' is-ready' : ''}`}>
      <header class="pop__head">
        <span class="pop__logo">
          <Logo size={22} shadow={false} />
        </span>
        <span class="pop__name">WAUX</span>
        <span class="pop__ver w-mono">v{VERSION}</span>
      </header>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Turn WAUX off' : 'Turn WAUX on'}
        class="power"
        onClick={() => update('settings', { ...s, enabled: !on })}
      >
        <span class="power__ring" aria-hidden="true" />
        <span class="power__key">
          <Icon name="power" size={28} />
        </span>
      </button>

      <p class="pop__status" role="status">
        <span class="pop__dot" aria-hidden="true" />
        {on ? 'On for WhatsApp Web' : 'Off. WhatsApp looks normal.'}
      </p>

      <footer class="pop__foot">
        <button class="pop__link" onClick={() => openStudio('settings')}>
          <Icon name="sliders" size={13} /> Settings
        </button>
        <span class="pop__hint">
          <Kbd>{MOD}</Kbd>
          <Kbd>K</Kbd> in WhatsApp
        </span>
      </footer>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
