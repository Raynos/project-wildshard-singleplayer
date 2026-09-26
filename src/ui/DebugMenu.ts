/**
 * pause ▸ Settings ▸ Debug and main menu ▸ Settings ▸ Debug (E172: one registry, both menus), rendered from the registry (E162, src/ui/debugOptions.ts): a filter box, then one section per
 * group — collapsed by default, its header says how many toggles it holds here, its open / closed state remembered
 * (localStorage `ws.debug.open`). Only the rows that apply to this shard (and the weapons held) show, and a group with none
 * is hidden. Typing in the filter opens every group with a match and hides the rest. Styled by src/ui/styles/debug.css
 * (prefix ws-dbg-); the rows reuse the menu's own row / segmented-picker look (gmenu.css).
 *
 *   const dm = buildDebugMenu(card, { onPick: (id) => … });
 *   dm.applies(ctx)          // every menu open: re-read which rows apply and their choices (the shard may have changed)
 *   dm.paint()               // re-read the readouts (DEBUG_READOUTS: Shards in memory) that can be seen — the caller's timer
 *   dm.row('musicStyle')     // a row's element (the audio pickers' busy spinner)
 *
 * A button row (debugOptions.ts action()) with a `confirm` takes two taps (E172: Clear downloads); its `status` is a line
 * under the row.
 */
import './styles/debug.css';
import { DEBUG_GROUPS, DEBUG_READOUTS, DEBUG_ROWS, type DebugActionSpec, type DebugCtx, type DebugGroupId, type DebugRow } from './debugOptions';
import { settingsReloadUrl } from './Settings';
import { markUnload } from '../boot/lastEnd';

const OPEN_KEY = 'ws.debug.open';
const loadOpen = (): Set<string> => {
  try { const raw = localStorage.getItem(OPEN_KEY); const v: unknown = raw === null ? [] : JSON.parse(raw); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []); } catch { return new Set(); }
};
const saveOpen = (s: ReadonlySet<string>): void => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...s])); } catch { /* storage blocked: not remembered */ } };

const make = (cls: string, text = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

export interface DebugMenu {
  applies: (c: DebugCtx) => void;
  /** re-read the readouts that can be seen (E172) */
  paint: () => void;
  row: (id: string) => HTMLElement | undefined;
}

/** a rendered row: its element, the lines after it (a readout, an action's status), and how to refresh it */
interface Rendered { el: HTMLElement; extra: HTMLElement[]; rebuild: () => void; paint: () => void }
interface Section { id: DebugGroupId; box: HTMLElement; head: HTMLButtonElement; count: HTMLElement; rows: { def: DebugRow; r: Rendered; text: string }[] }

/** how long an armed two-tap action waits for its second tap */
const ARM_MS = 6000;
/** on screen: not inside a folded card, a closed group or a hidden panel */
const seen = (e: HTMLElement): boolean => e.isConnected && e.getClientRects().length > 0;

/** a button row: one tap runs it, or (with `confirm`, E172) the first tap arms it and a second within ARM_MS runs it */
function renderAction(r: DebugRow, a: DebugActionSpec, row: HTMLElement, label: HTMLElement, onPick: (id: string) => void): Rendered {
  const b = make('ws-gmenu-segbtn ws-dbg-action', a.text, 'button') as HTMLButtonElement; b.type = 'button';
  const status = make('ws-gmenu-note ws-dbg-status');
  const say = (text: string, line: string): void => { b.textContent = text; status.textContent = line; status.hidden = line === ''; };
  let armed = false, disarm = 0;
  const rest = (): void => { armed = false; b.classList.remove('armed'); say(a.text, a.status?.() ?? ''); };
  const run = (): void => {
    b.disabled = true;
    void Promise.resolve().then(() => a.run(say)).catch((e: unknown) => { console.warn(`[debug] ${r.id} failed`, e); }).finally(() => {
      b.disabled = false; onPick(r.id);
      if (r.reload) { markUnload(`debug action ${r.id} (reloads)`); location.href = settingsReloadUrl(location.href); }
    });
  };
  b.addEventListener('click', () => {
    const confirm = a.confirm;
    if (confirm === undefined || armed) { window.clearTimeout(disarm); armed = false; b.classList.remove('armed'); run(); return; }
    b.disabled = true; b.textContent = 'Measuring…';
    void confirm().then((text) => {
      b.disabled = false; armed = true; b.classList.add('armed'); b.textContent = text;
      window.clearTimeout(disarm); disarm = window.setTimeout(rest, ARM_MS);
      return undefined;
    }).catch((e: unknown) => { console.warn(`[debug] ${r.id} confirm failed`, e); rest(); b.disabled = false; });
  });
  rest();
  row.append(label, b);
  return { el: row, extra: [status], rebuild: () => undefined, paint: () => undefined };
}

function renderRow(r: DebugRow, onPick: (id: string) => void): Rendered {
  const row = make('ws-gmenu-row ws-dbg-row');
  const label = make('ws-gmenu-swlabel', r.label, 'span');
  if (r.reload) label.append(make('ws-dbg-reload', 'reload', 'i'));
  label.append(make('ws-dbg-note', r.note, 'small'));
  if (r.action) return renderAction(r, r.action, row, label, onPick);
  const box = make('ws-gmenu-seg ws-dbg-seg');
  const paint = (): void => { for (const c of box.children) if (c instanceof HTMLElement) c.classList.toggle('active', c.dataset['v'] === r.get()); };
  const build = (): void => {
    box.replaceChildren(...r.choices().map((c) => {
      const b = make('ws-gmenu-segbtn', c.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = c.v;
      b.addEventListener('click', () => {
        if (r.get() === c.v) return;
        r.set(c.v); paint(); onPick(r.id);
        if (r.reload) { markUnload(`debug row ${r.id} → ${c.v} (reloads)`); location.href = settingsReloadUrl(location.href); }
      });
      return b;
    }));
    paint();
  };
  build(); r.on(paint);
  row.append(label, box);
  // E172: a readout under the row (DEBUG_READOUTS), read only while the row can be seen (the card unfolded, the group open)
  const readout = DEBUG_READOUTS[r.id];
  const out = readout ? make('ws-gmenu-note ws-gmenu-mem') : null;
  const paintOut = (): void => { if (out && readout && seen(row)) { const t = readout(); if (out.textContent !== t) out.textContent = t; out.hidden = false; } };
  return { el: row, extra: out ? [out] : [], rebuild: build, paint: paintOut };
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
    const rows = defs.map((def) => {
      const r = renderRow(def, (id) => { onPick(id); paintAll(); });
      byId.set(def.id, r.el); body.append(r.el, ...r.extra);
      return { def, r, text: `${def.label} ${def.note} ${g.label} ${def.id}`.toLowerCase() };
    });
    if (g.note !== undefined) body.append(make('ws-gmenu-note', g.note));
    box.append(head, body);
    card.append(box);
    const s: Section = { id: g.id, box, head, count, rows };
    head.addEventListener('click', () => {
      if (filter.value.trim() !== '') return; // while filtering, the matches decide what is open
      if (open.has(g.id)) open.delete(g.id); else open.add(g.id);
      saveOpen(open); paintOpen(s); paintAll();
    });
    sections.push(s);
  }
  card.append(empty);

  let ctx: DebugCtx | null = null;
  function paintAll(): void { for (const s of sections) for (const r of s.rows) r.r.paint(); }
  const repaint = (): void => {
    const q = filter.value.trim().toLowerCase();
    let any = false;
    for (const s of sections) {
      let applies = 0, shown = 0;
      for (const r of s.rows) {
        const ok = ctx === null || r.def.when(ctx);
        if (ok) applies++;
        const match = ok && (q === '' || r.text.includes(q));
        r.r.el.hidden = !match;
        for (const x of r.r.extra) x.hidden = !match || x.textContent === '';
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
    applies: (c) => { ctx = c; for (const s of sections) for (const r of s.rows) r.r.rebuild(); repaint(); paintAll(); },
    paint: paintAll,
    row: (id) => byId.get(id),
  };
}
