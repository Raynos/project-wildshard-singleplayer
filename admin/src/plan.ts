// The plan dashboard (SF68 tool 4): the SHARD-PLATFORM card first (G458, outcome-only: the whole-plan %, M3 and M2, the
// current wave, each shard's custom % of legacy and the custom-vs-hours chart, all from the committed ruler file), then
// what's waiting for Jake, the milestones, the rows by status, and every G decision (searchable).
import type { PlanData, PlanRow, ProgressData, RowStatus, RulerShardView } from './bundle.ts';
import { h, rich } from './dom.ts';
import { openMedia } from './playtests.ts';

type RowFilter = 'open' | 'closed' | 'all';

const state = { filter: 'open' as RowFilter, query: '', decisions: 20, rows: 40 };

const ST_CLASS: Record<RowStatus, string> = { done: 'done', open: 'open', 'needs pick': 'pick', 'in flight': 'flight', dropped: 'dropped' };

function rowEl(r: PlanRow): HTMLElement {
  return h('details', { class: 'row' },
    h('summary', {}, h('span', { class: 'rid' }, r.id), h('span', { class: 'rwhat' }, rich(r.what)), h('span', { class: `st ${ST_CLASS[r.status]}` }, r.status)),
    h('div', { class: 'rbody' },
      r.doneWhen ? h('p', {}, h('b', {}, 'Done when: '), rich(r.doneWhen)) : null,
      h('p', {}, [r.lane ? `Lane ${r.lane}` : '', r.size === '' ? '' : `size ${r.size}`].filter(Boolean).join(' · '))));
}

const num = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** An ISO time in Cancun (UTC−5, no DST: where Jake is): "Fri Oct 16, 11:51". */
function cancun(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t - 5 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()] ?? ''} ${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}, ${hh}:${mm}`;
}

/** The custom % scale runs to 110 % so Nalati (above its legacy) still fits; 100 % is the legacy shard. */
const SCALE = 110;
const at = (pct: number): string => `${(Math.min(pct, SCALE) / SCALE) * 100}%`;

function deltaEl(d: number | null): HTMLElement | null {
  if (d === null) return null;
  const cls = d < 0 ? 'pdown' : d > 0 ? 'pup' : 'pflat';
  return h('span', { class: `pdelta ${cls}`, title: 'points since the previous measured commit' }, d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${num(Math.abs(d))}`);
}

const GRID: Record<RulerShardView['grid'], string> = { pass: 'grid ready', fail: 'grid fails', unknown: 'grid unknown' };

function shardRow(r: RulerShardView): HTMLElement {
  const met = r.pct <= r.goal;
  return h('li', { class: `pshard${met ? ' met' : ''}` },
    h('div', { class: 'phead' },
      h('b', {}, r.name),
      h('span', { class: 'pchip' }, r.wave),
      h('span', { class: 'pnum' }, deltaEl(r.delta), h('span', { class: 'pshare' }, `${num(r.pct)} %`))),
    h('span', { class: 'ptrack', 'aria-hidden': 'true' },
      h('i', { style: `width:${at(r.pct)}` }),
      h('em', { class: 'pgoal', style: `left:${at(r.goal)}` }),
      h('em', { class: 'plegacy', style: `left:${at(100)}` })),
    h('div', { class: 'pmeta' },
      h('span', {}, `${num(r.custom)} / ${num(r.legacy)} lines · goal ${r.goal} %`),
      h('span', { class: `pgrid ${r.grid}` }, GRID[r.grid]),
      r.gridOpen.length > 0 ? h('span', {}, r.gridOpen.join(', ')) : null));
}

/** The SHARD-PLATFORM card: whole-plan %, M3, M2, the current wave, the six shards and the chart. Lower custom % is better. */
function progressCard(p: ProgressData): HTMLElement {
  const range = p.plan.lower === p.plan.upper ? `${num(p.plan.lower)} %` : `${num(p.plan.lower)}–${num(p.plan.upper)} %`;
  const m2 = [p.m2.unknown > 0 ? `${p.m2.unknown} unknown` : '', p.m2.fail > 0 ? `${p.m2.fail} failing` : ''].filter(Boolean).join(', ');
  const rebase = p.events.findLast((e) => e.label.startsWith('P4 re-base'));
  return h('section', { class: 'card progress', 'aria-label': 'SHARD-PLATFORM progress' },
    h('div', { class: 'ptop' }, h('h2', {}, 'Progress'), h('span', { class: 'small mono' }, `ruler @ ${p.revision}`)),
    h('div', { class: 'phero' },
      h('div', { class: 'plabel' }, 'Whole plan · 60 % M3 + 40 % M2'),
      h('div', { class: 'pbig' }, range),
      p.plan.lower === p.plan.upper ? null : h('div', { class: 'small' }, 'A range until every grid-ready check has a reading.')),
    h('div', { class: 'ptiles' },
      h('div', { class: 'ptile' }, h('div', { class: 'plabel' }, 'M3 custom code cut'), h('div', { class: 'pmid' }, `${num(p.m3.pct)} %`),
        h('div', { class: 'small' }, `${num(p.m3.cut)} of ${num(Math.round(p.m3.mustGo))} must-go lines`)),
      h('div', { class: 'ptile' }, h('div', { class: 'plabel' }, 'M2 grid-ready'), h('div', { class: 'pmid' }, `${p.m2.ready} of ${p.m2.total}`),
        h('div', { class: 'small' }, m2 || 'every check has a reading'))),
    h('div', { class: 'pwave' },
      h('div', { class: 'phead' }, h('span', { class: 'pchip now' }, p.wave.id), h('b', {}, p.wave.label.replace(/^[^·]*·\s*/, '')),
        h('span', { class: 'pnum' }, `${num(p.wave.pct)} %`)),
      h('span', { class: 'ptrack wave', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.min(100, p.wave.pct)}%` })),
      h('div', { class: 'small' }, p.wave.until ? `closes ${cancun(p.wave.until)} Cancun, wherever its shards stand` : 'closes when its shards reach their goal')),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--accent)' }), 'custom % of legacy, lower is better'),
      h('span', {}, h('i', { class: 'sw ptick' }), 'goal'),
      h('span', {}, h('i', { class: 'sw ptick legacy' }), '100 % = the legacy shard')),
    h('ul', { class: 'pshards' }, ...p.shards.map(shardRow)),
    h('p', { class: 'small pfoot' }, `${p.native.join(', ')}: native shards with no legacy to compare against, so not in the six.`),
    p.chart ? h('button', { class: 'pchart', type: 'button', 'aria-label': 'Open the custom code vs agent-hours chart',
      onclick: () => { if (p.chart) openMedia({ kind: 'image', name: 'Custom code vs agent-hours', src: p.chart, poster: null }); } },
    h('img', { src: `/${p.chart}`, alt: 'Custom code as a % of legacy against port agent-hours, per shard', loading: 'lazy', decoding: 'async' })) : null,
    h('p', { class: 'small pnote' },
      h('b', {}, 'Measured: '), `${p.basis} ruler (scripts/shard-platform.mjs) on ${p.revision}, committed ${cancun(p.committedAt)} Cancun, read ${cancun(p.measuredAt)}. `,
      p.previous ? `Changes are since ${p.previous.revision} (${cancun(p.previous.at)}). ` : '',
      rebase ? `Re-based ${cancun(rebase.at)}: ${rebase.label}. ` : 'P4 has not landed: the ruler still reads the shard source, and re-bases on out/<slug>/runtime when it does. ',
      'No effort, hours or projections count (G458). ', h('code', {}, p.source)));
}

function clip(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n).replace(/\s\S*$/, '')}…` : text;
}

export function planView(root: HTMLElement, p: PlanData): void {
  const rerender = () => planView(root, p);
  const parts: HTMLElement[] = [
    h('h1', {}, p.slug),
    h('p', { class: 'sub' }, p.title.replace(new RegExp(`^${p.slug}\\s*—\\s*`), '')),
    progressCard(p.progress),
    h('h2', {}, 'Ready to share'),
    h('section', { class: 'card' }, p.readiness
      ? h('p', { class: 'statelead', style: 'margin:0' }, rich(p.readiness))
      : h('p', { class: 'small' }, 'No current checklist reported in State.')),
  ];

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

  parts.push(h('h2', {}, `Decisions ${p.decisionRange} (${p.decisions.length})`));
  const search = h('input', { class: 'search', type: 'search', placeholder: `Search ${p.decisionRange}…`, value: state.query, 'aria-label': 'Search decisions' });
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
