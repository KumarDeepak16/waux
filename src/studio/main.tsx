import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon, type IconName } from '../ui/icons.tsx';
import { Logo } from '../ui/Logo.tsx';
import { usePageState } from '../ui/page.ts';
import { MessagesSection } from './Messages.tsx';
import { AboutSection, DataSection } from './Misc.tsx';
import { SettingsSection } from './Settings.tsx';
import { ThemeSection } from './Theme.tsx';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'WAUX',
    items: [
      { id: 'settings', label: 'Settings', icon: 'sliders' },
      { id: 'theme', label: 'Theme Studio', icon: 'palette' },
      { id: 'messages', label: 'Quick messages', icon: 'chatText' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'data', label: 'Data', icon: 'database' },
      { id: 'about', label: 'About', icon: 'info' },
    ],
  },
];
/** Old section links now live on the Settings page. */
const ALIASES: Record<string, string> = { privacy: 'settings', interface: 'settings', shortcuts: 'settings' };
const ALL = NAV.flatMap((g) => g.items);
const VERSION = chrome.runtime.getManifest().version;

const currentHash = () => {
  const raw = location.hash.slice(1);
  const h = ALIASES[raw] ?? raw;
  return ALL.some((n) => n.id === h) ? h : 'settings';
};

function Studio() {
  const page = usePageState();
  const [section, setSection] = useState(currentHash);
  const current = ALL.find((n) => n.id === section)!;

  useEffect(() => {
    const onHash = () => {
      setSection(currentHash());
      document.querySelector('.content')?.scrollTo({ top: 0 });
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `${current.label} · WAUX Studio`;
  }, [current]);

  return (
    <div class={`w-root studio${page.ready ? ' is-ready' : ''}`}>
      <aside class="rail">
        <a class="brand" href="#about" aria-label="About WAUX">
          <Logo size={32} />
          <span class="brand__text">
            <span class="brand__name">WAUX</span>
            <span class="brand__sub">Studio</span>
          </span>
          <span class="brand__ver w-mono">v{VERSION}</span>
        </a>

        <nav class="rail__nav" aria-label="Sections">
          {NAV.map((g) => (
            <div class="rail__group">
              <div class="rail__label">{g.group}</div>
              {g.items.map((n) => (
                <a href={`#${n.id}`} class="rail__link" aria-current={n.id === section ? 'page' : undefined}>
                  <Icon name={n.icon} size={16} />
                  {n.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div class="rail__foot">
          <div class="rail__local">
            <Icon name="lock" size={13} />
            <span>Local only. No network requests.</span>
          </div>
          <a class="maker" href="https://1619.in" target="_blank" rel="noopener noreferrer">
            <span class="maker__avatar" aria-hidden="true">DK</span>
            <span class="maker__text">
              <span class="maker__label">Made by</span>
              <span class="maker__name">Deepak Kumar</span>
            </span>
            <Icon name="arrowUpRight" size={14} />
          </a>
        </div>
      </aside>

      <div class="inset">
        <div class="inset__panel">
          <header class="topbar">
            <nav class="crumbs" aria-label="Breadcrumb">
              <span class="w-muted">Studio</span>
              <Icon name="caretRight" size={11} />
              <span class="crumbs__current">{current.label}</span>
            </nav>
            <a class="w-btn w-btn--sm" href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer">
              Open WhatsApp <Icon name="arrowUpRight" size={12} />
            </a>
          </header>
          <main class="content" id="content">
            {section === 'settings' && <SettingsSection {...page} />}
            {section === 'theme' && <ThemeSection {...page} />}
            {section === 'messages' && <MessagesSection {...page} />}
            {section === 'data' && <DataSection {...page} />}
            {section === 'about' && <AboutSection {...page} />}
          </main>
        </div>
      </div>
    </div>
  );
}

render(<Studio />, document.getElementById('app')!);
