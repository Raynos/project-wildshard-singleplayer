// The marketing site's author waitlist (MARKETING-SITE MS7 / MS16, E465): every signup from the site's form and the
// cells authors claimed, read live from the game's /api/waitlist. Unlike the other tabs this one is not in the bundle:
// it holds emails, so it is fetched with the review password (the inbox's REVIEW_PASSWORD), kept in this browser only.
import { h, s } from './dom.ts';

const API = 'https://wildshard-singleplayer.vercel.app/api/waitlist';
const KEY = 'wildshard-admin.review-password';
const COLS = 'ABCDE';
/** the cells that already hold a playable shard on the site's map, and the fixed centre */
const TAKEN: Readonly<Record<string, string>> = { B2: 'Driftwood', C2: 'Pine', D2: 'Nalati', B3: 'Dunes', D3: 'Sky Reach', C4: '9 Dragon', B4: 'Template', C3: 'Centre' };

interface Entry { readonly id: string; readonly email: string; readonly build: string; readonly cell: string | null; readonly receivedAt: string }

function fields(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
}

function toEntry(v: unknown): Entry[] {
  const { id, email, build, cell, receivedAt } = fields(v) ?? {};
  if (typeof id !== 'string' || typeof email !== 'string' || typeof receivedAt !== 'string') return [];
  return [{ id, email, build: typeof build === 'string' ? build : '', cell: typeof cell === 'string' ? cell : null, receivedAt }];
}

function storedPassword(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

function claimMap(entries: readonly Entry[]): SVGSVGElement {
  const count = new Map<string, number>();
  for (const e of entries) if (e.cell !== null) count.set(e.cell, (count.get(e.cell) ?? 0) + 1);
  const svg = s('svg', { viewBox: '0 0 300 300', class: 'claim-grid', role: 'img', 'aria-label': 'Cells authors claimed on the 5 by 5 grid' });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const id = `${COLS[c] ?? ''}${r + 1}`, x = 22 + c * 57, y = 22 + r * 57, n = count.get(id) ?? 0;
    const taken = TAKEN[id];
    svg.append(s('rect', { x, y, width: 48, height: 48, rx: 4, class: taken !== undefined ? 'taken' : n > 0 ? 'claimed' : 'free' }));
    svg.append(s('text', { x: x + 4, y: y + 11, class: 'id' }, id));
    if (taken !== undefined) svg.append(s('text', { x: x + 4, y: y + 43, class: 'name' }, taken));
    else if (n > 0) svg.append(s('text', { x: x + 24, y: y + 34, class: 'n', 'text-anchor': 'middle' }, String(n)));
  }
  return svg;
}

function table(entries: readonly Entry[]): HTMLElement {
  return h('section', { class: 'card flat' }, h('table', { class: 'waitlist' },
    h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'Email'), h('th', {}, 'Cell'), h('th', {}, 'Would build'))),
    h('tbody', {}, ...entries.toReversed().map((e) => h('tr', {},
      h('td', { class: 'small' }, e.receivedAt.slice(0, 16).replace('T', ' ')),
      h('td', {}, h('a', { href: `mailto:${e.email}` }, e.email)),
      h('td', {}, e.cell ?? '—'),
      h('td', {}, e.build))))));
}

async function load(root: HTMLElement, password: string): Promise<void> {
  const status = h('p', { class: 'small' }, 'Loading…');
  root.replaceChildren(h('h1', {}, 'Waitlist'), status);
  const res = await fetch(API, { headers: { 'x-review-password': password }, cache: 'no-store' });
  if (res.status === 401) {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    passwordForm(root, 'That password was wrong.');
    return;
  }
  if (!res.ok) { status.textContent = `The waitlist API answered ${res.status}.`; return; }
  const { entries } = fields(await res.json()) ?? {};
  const list = Array.isArray(entries) ? entries.flatMap(toEntry) : [];
  const claimed = list.filter((e) => e.cell !== null).length;
  root.replaceChildren(
    h('h1', {}, 'Waitlist'),
    h('section', { class: 'card' },
      h('div', { class: 'hard-count' }, String(list.length)),
      h('p', { class: 'small' }, `authors on the waitlist · ${claimed} claimed a cell · from the site's Become an author form`)),
    h('section', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Claimed cells'), claimMap(list),
      h('p', { class: 'small' }, 'Violet: shards already on the map. A number: how many authors wished for that cell.')),
    list.length === 0 ? h('section', { class: 'card empty' }, h('p', {}, 'No signups yet.')) : table(list));
}

function passwordForm(root: HTMLElement, note = ''): void {
  const input = h('input', { type: 'password', class: 'search', placeholder: 'Review password', autocomplete: 'current-password' });
  const form = h('form', { class: 'card' }, h('p', { class: 'small' }, 'The waitlist holds emails, so it needs the review password (the in-game inbox\'s). It stays in this browser.'),
    note ? h('p', { class: 'small', style: 'color:var(--bad, #e66)' }, note) : null, input);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const pw = input.value.trim();
    if (pw === '') return;
    try { localStorage.setItem(KEY, pw); } catch { /* private mode: ask again next time */ }
    void load(root, pw);
  });
  root.replaceChildren(h('h1', {}, 'Waitlist'), form);
  input.focus();
}

export function waitlistView(root: HTMLElement): void {
  const pw = storedPassword();
  if (pw === '') passwordForm(root);
  else load(root, pw).catch((e: unknown) => {
    root.replaceChildren(h('h1', {}, 'Waitlist'), h('div', { class: 'card err' }, `Could not load the waitlist: ${e instanceof Error ? e.message : String(e)}`));
  });
}
