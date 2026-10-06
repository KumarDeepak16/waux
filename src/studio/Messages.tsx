import { useMemo, useRef, useState } from 'preact/hooks';
import { categories, exportTemplates, importTemplates, newTemplate, normalizeShortcut, searchTemplates } from '../engines/quick/search.ts';
import type { Template } from '../shared/types.ts';
import { Icon } from '../ui/icons.tsx';
import { Kbd, MOD, Switch } from '../ui/kit.tsx';
import type { Page } from '../ui/page.ts';

export function MessagesSection({ state, update }: Page) {
  const list = state.templates;
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    const res = importTemplates(list, await file.text());
    if ('error' in res) return setNote({ ok: false, text: res.error });
    update('templates', res.list);
    setNote({ ok: true, text: `Imported ${res.added} quick message${res.added === 1 ? '' : 's'}${res.skipped ? `, skipped ${res.skipped} duplicate or empty` : ''}.` });
  };
  const exportFile = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportTemplates(list)], { type: 'application/json' }));
    a.download = 'waux-quick-messages.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const cats = useMemo(() => categories(list), [list]);
  const shown = useMemo(() => searchTemplates(list, query, cat || undefined), [list, query, cat]);

  const save = (t: Template) => {
    const exists = list.some((x) => x.id === t.id);
    update('templates', exists ? list.map((x) => (x.id === t.id ? t : x)) : [t, ...list]);
    setEditing(null);
  };
  const remove = (id: string) => {
    update('templates', list.filter((x) => x.id !== id));
    setEditing(null);
  };
  const toggleFav = (t: Template) => update('templates', list.map((x) => (x.id === t.id ? { ...x, favorite: !x.favorite } : x)));

  return (
    <div class="sec sec--messages">
      <header class="sec__head sec__head--row">
        <div>
          <h1>Quick messages</h1>
          <p>
            Type <span class="w-mono accent">;shortcut</span> in any chat, or press <Kbd>{MOD}</Kbd> <Kbd>K</Kbd>. WAUX inserts the
            text and never sends it for you.
          </p>
        </div>
        <div class="qm-actions">
          <button class="w-btn w-btn--ghost" onClick={() => fileRef.current?.click()} title="Import from JSON">
            <Icon name="upload" size={14} /> Import
          </button>
          <button class="w-btn w-btn--ghost" onClick={exportFile} disabled={!list.length} title="Export as JSON">
            <Icon name="download" size={14} /> Export
          </button>
          <button class="w-btn w-btn--primary" onClick={() => setEditing(newTemplate({ category: cat }))}>
            <Icon name="plus" size={14} /> New message
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) importFile(file);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>
      </header>
      {note && (
        <p class={`io__msg${note.ok ? '' : ' is-error'}`} role="status">
          {note.text}
        </p>
      )}

      <div class="qm-toolbar">
        <div class="qm-search">
          <Icon name="search" size={14} />
          <input class="w-input" placeholder="Search title, text or ;shortcut" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="Search quick messages" />
        </div>
        {cats.length > 0 && (
          <div class="chips" role="tablist" aria-label="Categories">
            <button class="chip" role="tab" aria-selected={!cat} onClick={() => setCat('')}>
              All
            </button>
            {cats.map((c) => (
              <button class="chip" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div class={`qm-layout${editing ? ' has-editor' : ''}`}>
        <div class="qm-list">
          {list.length === 0 ? (
            <div class="w-empty">
              <span class="w-empty__glyph">
                <Icon name="chatText" />
              </span>
              <strong>No quick messages yet</strong>
              <span>Save replies you type often, then insert them with a shortcut.</span>
              <button class="w-btn" onClick={() => setEditing(newTemplate())}>
                <Icon name="plus" size={14} /> Create the first one
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div class="w-empty">
              <strong>Nothing matches</strong>
              <span>Try another word or clear the category filter.</span>
            </div>
          ) : (
            shown.map((t) => (
              <article class={`qm-item${editing?.id === t.id ? ' is-editing' : ''}`}>
                <button class={`qm-fav${t.favorite ? ' is-on' : ''}`} aria-pressed={t.favorite} aria-label="Favorite" onClick={() => toggleFav(t)}>
                  <Icon name={t.favorite ? 'starFill' : 'star'} size={15} />
                </button>
                <button class="qm-item__main" onClick={() => setEditing(t)}>
                  <span class="qm-item__top">
                    <span class="qm-item__title">{t.title || 'Untitled'}</span>
                    {t.shortcut && <span class="w-mono accent">;{t.shortcut}</span>}
                    {t.category && <span class="tag">{t.category}</span>}
                  </span>
                  <span class="qm-item__body">{t.body}</span>
                </button>
              </article>
            ))
          )}
        </div>
        {editing && <Editor key={editing.id} t={editing} all={list} cats={cats} onSave={save} onDelete={remove} onCancel={() => setEditing(null)} />}
      </div>
    </div>
  );
}

function Editor(props: { t: Template; all: Template[]; cats: string[]; onSave: (t: Template) => void; onDelete: (id: string) => void; onCancel: () => void }) {
  const [t, setT] = useState(props.t);
  const [armed, setArmed] = useState(false);
  const isNew = !props.all.some((x) => x.id === t.id);
  const clash = t.shortcut && props.all.find((x) => x.id !== t.id && x.shortcut === t.shortcut);
  const valid = t.body.trim().length > 0 && !clash;
  const set = (patch: Partial<Template>) => setT({ ...t, ...patch });

  const submit = (e: Event) => {
    e.preventDefault();
    if (!valid) return;
    const title = t.title.trim() || t.body.trim().split('\n')[0].slice(0, 40);
    props.onSave({ ...t, title, category: t.category.trim(), updatedAt: Date.now() });
  };

  return (
    <form class="qm-editor w-card" onSubmit={submit}>
      <div class="qm-editor__head">
        <h2>{isNew ? 'New quick message' : 'Edit quick message'}</h2>
        <button type="button" class="w-btn w-btn--ghost w-btn--icon w-btn--sm" aria-label="Close editor" onClick={props.onCancel}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <label class="w-field">
        <span>Title</span>
        <input class="w-input" value={t.title} placeholder="Received, thanks" onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
      </label>
      <div class="qm-editor__pair">
        <label class="w-field">
          <span>Shortcut</span>
          <span class="prefixed">
            <span class="prefixed__pre w-mono">;</span>
            <input
              class="w-input w-mono"
              value={t.shortcut}
              placeholder="thanks"
              aria-invalid={!!clash}
              aria-describedby="sc-help"
              onInput={(e) => set({ shortcut: normalizeShortcut((e.target as HTMLInputElement).value) })}
            />
          </span>
        </label>
        <label class="w-field">
          <span>Category</span>
          <input class="w-input" list="qm-cats" value={t.category} placeholder="Work" onInput={(e) => set({ category: (e.target as HTMLInputElement).value })} />
          <datalist id="qm-cats">
            {props.cats.map((c) => (
              <option value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <p id="sc-help" class={`field-help${clash ? ' is-error' : ''}`}>
        {clash ? `;${t.shortcut} is already used by "${clash.title}"` : 'Letters, numbers, - and _. Optional.'}
      </p>
      <label class="w-field">
        <span>Message</span>
        <textarea class="w-textarea" rows={6} value={t.body} placeholder="Thanks, received. I will get back to you shortly." onInput={(e) => set({ body: (e.target as HTMLTextAreaElement).value })} />
      </label>
      <label class="qm-editor__fav">
        <span>Favorite</span>
        <Switch label="Favorite" checked={t.favorite} onChange={(favorite) => set({ favorite })} />
      </label>
      <div class="qm-editor__actions">
        <button class="w-btn w-btn--primary" type="submit" disabled={!valid}>
          <Icon name="check" size={14} /> Save
        </button>
        <button class="w-btn w-btn--ghost" type="button" onClick={props.onCancel}>
          Cancel
        </button>
        {!isNew && (
          <button
            type="button"
            class={`w-btn w-btn--ghost w-btn--danger qm-editor__delete${armed ? ' is-armed' : ''}`}
            onClick={() => (armed ? props.onDelete(t.id) : setArmed(true))}
            onBlur={() => setArmed(false)}
          >
            <Icon name="trash" size={14} /> {armed ? 'Confirm delete' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
