/**
 * pause ▸ Settings ▸ Debug, rendered from the registry (E162, src/ui/debugOptions.ts): a filter box, then one section per
 * group — collapsed by default, its header says how many toggles it holds here, its open / closed state remembered
 * (localStorage `ws.debug.open`). Only the rows that apply to this shard (and the weapons held) show, and a group with none
 * is hidden. Typing in the filter opens every group with a match and hides the rest. Styled by src/ui/styles/debug.css
 * (prefix ws-dbg-); the rows reuse the menu's own row / segmented-picker look (gmenu.css).
 *
 *   const dm = buildDebugMenu(card, { onPick: (id) => …, settingsReloadUrl });
 *   dm.applies(ctx)          // every menu open: re-read which rows apply (the shard may have changed)
 *   dm.row('shardCap')       // a row's element, to hang a readout under it
 */
import './styles/debug.css';
import { DEBUG_GROUPS, DEBUG_ROWS, type DebugCtx, type DebugGroupId, type DebugRow } from './debugOptions';
import { settingsReloadUrl } from './Settings';

const OPEN_KEY = 'ws.debug.open';
const loadOpen = (): Set<string> => {
  try { const raw = localStorage.getItem(OPEN_KEY); const v: unknown = raw === null ? [] : JSON.parse(raw); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []); } catch { return new Set(); }
};
const saveOpen = (s: ReadonlySet<string>): void => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch { /* storage blocked: not remembered */ } };

const make = (cls: string, text = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

export interface DebugMenu {
  applies: (c: DebugCtx) => void;
  row: (id: string) => HTMLElement | undefined;
}

interface Section { id: DebugGroupId; box: HTMLElement; head: HTMLButtonElement; count: HTMLElement; rows: { def: DebugRow; el: HTMLElement; text: string }[] }

function renderRow(r: DebugRow, onPick: (id: string) => void): HTMLElement {
  const row = make('ws-gmenu-row ws-dbg-row');
  const label = make('ws-gmenu-swlabel', r.label, 'span');
  if (r.reload) label.append(make('ws-dbg-reload', 'reload', 'i'));
  label.append(make('ws-dbg-note', r.note, 'small'));
  const box = make('ws-gmenu-seg ws-dbg-seg');
  const paint = (): void => { for (const c of box.children) if (c instanceof HTMLElement) c.classList.toggle('active', c.dataset['v'] === r.get()); };
  const build = (): void => {
    box.replaceChildren(...r.choices().map((c) => {
      const b = make('ws-gmenu-segbtn', c.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = c.v;
      b.addEventListener('click', () => {
        if (r.get() === c.v) return;
        r.set(c.v); paint(); onPick(r.id);
        if (r.reload) location.href = settingsReloadUrl(location.href);
      });
      return b;
    }));
    paint();
  };
  build(); r.on(paint);
  row.append(label, box);
  return row;
}

export function buildDebugMenu(card: HTMLElement, opts: { onPick?: (id: string) => void } = {}): DebugMenu {
  const onPick = opts.onPick ?? ((): void => undefined);
  const open = loadOpen();
  const byId = new Map<string, HTMLElement>();
  const filter = document.createElement('input');
  filter.type = 'search'; filter.className = 'ws-gmenu-input ws-dbg-filter'; filter.placeholder = 'Filter toggles'; filter.autocomplete = 'off'; filter.enterKeyHint = 'done';
  // the menu listens for M / Esc and the player for WASD on document: typing a filter must not reach them
  filter.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
  filter.addEventListener('keyup', (e) => { e.stopPropagation(); });
  filter.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  const filterRow = make('ws-dbg-filterrow'); filterRow.append(filter);
  const empty = make('ws-gmenu-note ws-dbg-empty', 'No toggle matches.'); empty.hidden = true;
  card.append(filterRow);

  const paintOpen = (s: Section, forced = false): void => {
    const isOpen = forced || open.has(s.id);
    s.box.classList.toggle('open', isOpen); s.head.setAttribute('aria-expanded', String(isOpen));
  };
  const sections: Section[] = [];
  for (const g of DEBUG_GROUPS) {
    const defs = DEBUG_ROWS.filter((r) => r.group === g.id);
    if (defs.length === 0) continue;
    const box = make('ws-dbg-group');
    const head = make('ws-dbg-head', '', 'button') as HTMLButtonElement; head.type = 'button';
    const count = make('ws-dbg-count', '', 'b');
    head.append(make('ws-dbg-caret', '', 'i'), make('ws-dbg-title', g.label, 'span'), count);
    const body = make('ws-dbg-body');
    const rows = defs.map((def) => { const el = renderRow(def, onPick); byId.set(def.id, el); body.append(el); return { def, el, text: `${def.label} ${def.note} ${g.label} ${def.id}`.toLowerCase() }; });
    if (g.note !== undefined) body.append(make('ws-gmenu-note', g.note));
    box.append(head, body);
    card.append(box);
    const s: Section = { id: g.id, box, head, count, rows };
    head.addEventListener('click', () => {
      if (filter.value.trim() !== '') return; // while filtering, the matches decide what is open
      if (open.has(g.id)) open.delete(g.id); else open.add(g.id);
      saveOpen(open); paintOpen(s);
    });
    sections.push(s);
  }
  card.append(empty);

  let ctx: DebugCtx | null = null;
  const repaint = (): void => {
    const q = filter.value.trim().toLowerCase();
    let any = false;
    for (const s of sections) {
      let applies = 0, shown = 0;
      for (const r of s.rows) {
        const ok = ctx === null || r.def.when(ctx);
        if (ok) applies++;
        const match = ok && (q === '' || r.text.includes(q));
        r.el.hidden = !match;
        if (match) shown++;
      }
      s.count.textContent = String(q === '' ? applies : shown);
      s.box.hidden = shown === 0;
      if (shown > 0) any = true;
      paintOpen(s, q !== '');
    }
    empty.hidden = any;
  };
  filter.addEventListener('input', repaint);
  repaint();
  return {
    applies: (c) => { ctx = c; repaint(); },
    row: (id) => byId.get(id),
  };
}
