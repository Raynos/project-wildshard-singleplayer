// The plan dashboard (SF68 tool 4): State's own effort %, the milestones, what's waiting for Jake, the rows by status,
// and decisions G1–G251 (searchable).
import type { Effort, PlanData, PlanRow, RowStatus } from './bundle.ts';
import { h, rich, s } from './dom.ts';

type RowFilter = 'open' | 'closed' | 'all';

const state = { filter: 'open' as RowFilter, query: '', decisions: 20, rows: 40 };

const ST_CLASS: Record<RowStatus, string> = { done: 'done', open: 'open', 'needs pick': 'pick', 'in flight': 'flight', dropped: 'dropped' };

function ring(pct: number, label: string): SVGSVGElement {
  const r = 40;
  const c = 2 * Math.PI * r;
  return s('svg', { class: 'ring', viewBox: '0 0 96 96', role: 'img', 'aria-label': `${label} ${pct} %` },
    s('circle', { cx: 48, cy: 48, r, fill: 'none', stroke: 'var(--panel-2)', 'stroke-width': 9 }),
    s('circle', { cx: 48, cy: 48, r, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 9, 'stroke-linecap': 'round',
      'stroke-dasharray': `${(pct / 100) * c} ${c}`, transform: 'rotate(-90 48 48)' }),
    s('text', { x: 48, y: 52, 'text-anchor': 'middle' }, `${pct}%`),
    s('text', { class: 'rs', x: 48, y: 66, 'text-anchor': 'middle' }, label.toUpperCase()));
}

function bars(items: Effort[]): HTMLElement {
  return h('div', { class: 'bars' }, ...items.map((e) => h('div', { class: `bar ${e.pct >= 80 ? 'hi' : e.pct < 40 ? 'lo' : ''}` },
    h('span', {}, e.label), h('b', {}, `${e.pct} %`), h('span', { class: 'track' }, h('i', { style: `width:${e.pct}%` })))));
}

function rowEl(r: PlanRow): HTMLElement {
  return h('details', { class: 'row' },
    h('summary', {}, h('span', { class: 'rid' }, r.id), h('span', { class: 'rwhat' }, rich(r.what)), h('span', { class: `st ${ST_CLASS[r.status]}` }, r.status)),
    h('div', { class: 'rbody' },
      r.doneWhen ? h('p', {}, h('b', {}, 'Done when: '), rich(r.doneWhen)) : null,
      h('p', {}, [r.lane ? `Lane ${r.lane}` : '', r.size === '' ? '' : `size ${r.size}`].filter(Boolean).join(' · '))));
}

function clip(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n).replace(/\s\S*$/, '')}…` : text;
}

export function planView(root: HTMLElement, p: PlanData): void {
  const rerender = () => planView(root, p);
  const whole = p.effort.find((e) => e.label === 'Whole plan');
  const milestones = p.effort.filter((e) => e !== whole && !e.label.endsWith('(M3)'));
  const shards = p.effort.filter((e) => e.label.endsWith('(M3)')).map((e) => ({ label: e.label.replace(/ \(M3\)$/, ''), pct: e.pct }));
  const parts: HTMLElement[] = [
    h('h1', {}, p.slug),
    h('p', { class: 'sub' }, p.title.replace(new RegExp(`^${p.slug}\\s*—\\s*`), '')),
    h('section', { class: 'card' },
      h('div', { class: 'hero' }, whole ? ring(whole.pct, 'by effort') : h('span', {}), bars(milestones)),
      h('p', { class: 'small', style: 'margin:10px 0 0' }, "The plan State's own reported percentages.")),
  ];
  if (shards.length > 0) parts.push(h('h2', {}, 'M3: each shard toward 80/20'), h('section', { class: 'card' }, bars(shards)));

  parts.push(h('h2', {}, `Waiting for Jake (${p.waiting.length})`));
  parts.push(h('section', { class: 'card' }, p.waiting.length === 0
    ? h('p', { class: 'small', style: 'margin:0' }, 'Nothing is waiting on a pick.')
    : h('ul', { class: 'waiting', style: 'margin:0;padding-left:18px' }, ...p.waiting.map((w) =>
      h('li', {}, h('b', { class: 'mono' }, w.id), ' ', rich(clip(w.what, 260)), h('br'), h('span', { class: 'small' }, w.source))))));

  parts.push(h('h2', {}, 'State'), h('section', { class: 'card' },
    h('details', { class: 'disc', style: 'border-top:0' }, h('summary', {}, clip(p.state.replaceAll('`', ''), 90)), h('p', { class: 'statelead' }, rich(p.state))),
    ...p.milestones.map((m) => h('details', { class: 'disc' }, h('summary', {}, m.title),
      ...m.lines.map((l) => h('p', { class: 'statelead' }, rich(l)))))));

  const closed = (r: PlanRow) => r.status === 'done' || r.status === 'dropped';
  const done = p.rows.filter((r) => r.status === 'done').length;
  const counts = { open: 0, closed: 0, all: p.rows.length };
  for (const r of p.rows) counts[closed(r) ? 'closed' : 'open']++;
  parts.push(h('h2', {}, `Rows (${done} of ${counts.all} done)`));
  parts.push(h('div', { class: 'seg', role: 'group', 'aria-label': 'Row filter' },
    ...(['open', 'closed', 'all'] as const).map((k) => h('button', { type: 'button', 'aria-pressed': state.filter === k ? 'true' : 'false',
      onclick: () => {
        state.filter = k;
        state.rows = 40;
        rerender();
      } }, `${k[0]?.toUpperCase() ?? ''}${k.slice(1)} · ${counts[k]}`))));
  const shown = p.rows.filter((r) => state.filter === 'all' || (state.filter === 'closed') === closed(r));
  const rowsCard = h('section', { class: 'card flat' },
    h('div', { class: 'secthead' }, h('span', {}, 'Done'), h('span', { class: 'small' }, `${done}/${counts.all}`),
      h('span', { class: 'track' }, h('i', { style: `width:${counts.all === 0 ? 0 : (done / counts.all) * 100}%` }))),
    ...shown.slice(0, state.rows).map(rowEl));
  if (shown.length > state.rows) {
    rowsCard.append(h('button', { class: 'more', type: 'button', onclick: () => {
      state.rows += 60;
      rerender();
    } }, `Show more (${shown.length - state.rows} left)`));
  }
  parts.push(rowsCard);

  parts.push(h('h2', {}, `Decisions (${p.decisions.length})`));
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Search G1–G251…', value: state.query, 'aria-label': 'Search decisions' });
  const decCard = h('section', { class: 'card flat' });
  const fill = () => {
    const q = state.query.toLowerCase();
    const hits = [...p.decisions].reverse().filter((d) => !q || `${d.id} ${d.topic} ${d.answer}`.toLowerCase().includes(q));
    decCard.replaceChildren(...hits.slice(0, state.decisions).map((d) =>
      h('div', { class: 'dec' }, h('b', {}, d.id), h('span', { class: 'topic' }, d.topic), h('p', {}, rich(d.answer)))));
    if (hits.length > state.decisions) {
      decCard.append(h('button', { class: 'more', type: 'button', onclick: () => {
        state.decisions += 40;
        fill();
      } }, `Show more (${hits.length - state.decisions} left)`));
    }
    if (hits.length === 0) decCard.append(h('p', { class: 'dec small' }, 'No decision matches.'));
  };
  search.addEventListener('input', () => {
    state.query = search.value;
    state.decisions = 20;
    fill();
  });
  fill();
  parts.push(search, decCard, h('p', { class: 'small', style: 'margin-top:16px' }, 'Source ', h('code', {}, p.source)));
  root.replaceChildren(...parts);
}
