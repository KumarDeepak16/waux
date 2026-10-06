// Pure layout math for hiding chats from WhatsApp's virtualized chat list.
//
// WhatsApp positions each row absolutely with `transform: translateY(...)`
// and exposes the row index as `data-testid="list-item-N"`. We never touch
// WhatsApp's transform. Instead we hide matching rows and pull every later
// row up using the independent CSS `translate` property.
//
// Rows above the viewport are not rendered, so hidden rows seen earlier are
// remembered by index. The cache self-corrects: when a visible, non-hidden
// row occupies a cached index, that entry is stale and dropped.

export interface RowInfo {
  index: number;
  name: string | null;
  height: number;
}

export type HiddenCache = Map<string, { index: number; height: number }>;

export interface SidebarPlan {
  /** Rows to hide, by index. */
  hide: Set<number>;
  /** Upward shift in px per visible row index (only non-zero entries). */
  shift: Map<number, number>;
  /** Total px removed from the list height. */
  removed: number;
}

export function planSidebar(
  rows: RowInfo[],
  hidden: ReadonlySet<string>,
  cache: HiddenCache,
  exempt: ReadonlySet<string> = new Set(),
): SidebarPlan {
  for (const name of cache.keys()) if (!hidden.has(name) || exempt.has(name)) cache.delete(name);
  for (const row of rows) {
    const isHidden = row.name !== null && hidden.has(row.name) && !exempt.has(row.name);
    if (isHidden) {
      cache.set(row.name!, { index: row.index, height: row.height });
      continue;
    }
    for (const [name, entry] of cache) if (entry.index === row.index) cache.delete(name);
  }

  const entries = [...cache.values()].sort((a, b) => a.index - b.index);
  const hide = new Set(entries.map((e) => e.index));
  const shift = new Map<number, number>();
  for (const row of rows) {
    if (hide.has(row.index)) continue;
    let px = 0;
    for (const e of entries) {
      if (e.index >= row.index) break;
      px += e.height;
    }
    if (px) shift.set(row.index, px);
  }
  return { hide, shift, removed: entries.reduce((n, e) => n + e.height, 0) };
}
