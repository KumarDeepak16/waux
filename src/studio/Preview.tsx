// Live preview: a small WhatsApp-shaped composition rendered from the same
// compiled tokens the real skin uses. Real components, not a screenshot.
import { wauxVars } from '../engines/theme/compile.ts';
import type { Scheme, Theme } from '../shared/types.ts';
import { Icon } from '../ui/icons.tsx';

const CHATS = [
  { name: 'Anchal', last: 'Sent the revised floor plan, page 3 has the changes', time: '09:41', unread: 2 },
  { name: 'Amarjeet', last: 'Partner name is updated, we can ship today', time: '09:12' },
  { name: 'Nisha', last: 'Perfect, see you at 6', time: '18:05', active: true },
  { name: 'Vivek', last: 'Voice message (0:42)', time: 'Mon' },
  { name: 'Sahil', last: 'Call me when you land', time: 'Sun' },
];

const MESSAGES = [
  { out: false, text: 'Are we still on for the walkthrough tomorrow?', time: '18:02' },
  { out: true, text: 'Yes. I booked the 6pm slot, the agent will meet us at the gate.', time: '18:04' },
  { out: false, text: 'Perfect, see you at 6', time: '18:05' },
  { out: true, text: 'I will bring the measurements.', time: '18:06' },
];

export function Preview({ theme, scheme }: { theme: Theme; scheme: Scheme }) {
  const vars = wauxVars(theme, scheme);
  return (
    <div class="pv" style={vars} data-density={theme.density}>
      <div class="pv__side">
        <div class="pv__side-head">
          <span class="pv__title">Chats</span>
          <span class="pv__iconbtn">
            <Icon name="pencil" size={13} />
          </span>
        </div>
        <div class="pv__search">
          <Icon name="search" size={12} /> Search
        </div>
        <ul class="pv__chats">
          {CHATS.map((c) => (
            <li class={`pv__chat${c.active ? ' is-active' : ''}`}>
              <span class="pv__avatar">{c.name.charAt(0)}</span>
              <span class="pv__chat-text">
                <span class="pv__chat-row">
                  <span class="pv__chat-name">{c.name}</span>
                  <span class={`pv__chat-time${c.unread ? ' is-unread' : ''}`}>{c.time}</span>
                </span>
                <span class="pv__chat-row">
                  <span class="pv__chat-last">{c.last}</span>
                  {c.unread && <span class="pv__badge">{c.unread}</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div class="pv__main">
        <div class="pv__head">
          <span class="pv__avatar">N</span>
          <span class="pv__head-text">
            <span class="pv__chat-name">Nisha</span>
            <span class="pv__sub">online</span>
          </span>
        </div>
        <div class="pv__msgs">
          <div class="pv__day">Today</div>
          {MESSAGES.map((m) => (
            <div class={`pv__bubble ${m.out ? 'is-out' : 'is-in'}`}>
              {m.text}
              <span class="pv__meta">
                {m.time}
                {m.out && <Icon name="check" size={11} />}
              </span>
            </div>
          ))}
          <div class="pv__suggest">
            <span class="pv__short">;thanks</span>
            <span class="pv__suggest-text">Received, thanks</span>
            <span class="pv__kbd">Tab</span>
          </div>
        </div>
        <div class="pv__composer">
          <span class="pv__iconbtn">
            <Icon name="plus" size={14} />
          </span>
          <span class="pv__input">
            ;tha<span class="pv__caret" />
          </span>
        </div>
      </div>
    </div>
  );
}
