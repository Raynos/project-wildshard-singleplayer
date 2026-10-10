// The plan dashboard (SF68 tool 4): the Progress card first (each shard's measured share, proofs and runtime from
// scripts/shard-platform.mjs at this build's revision, next to the newest effort recount), then State's own effort %,
// the milestones, what's waiting for Jake, the rows by status, and every G decision (searchable).
import type { Effort, PlanData, PlanRow, ProgressData, ProgressEffort, ProgressShard, ProgressTotal, RowStatus } from './bundle.ts';
import { h, rich, s } from './dom.ts';
import { openMedia } from './playtests.ts';

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

const num = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

function hoursText(e: { spent: number | null; left: number | null; approx?: boolean; range?: number[] | null }): string {
  const parts: string[] = [];
  if (e.spent !== null) parts.push(`${num(e.spent)} h spent`);
  if (e.left !== null) {
    const range = e.range?.length === 2 ? ` (${e.range.map(num).join('–')})` : '';
    parts.push(e.left === 0 ? 'none left' : `${e.approx === false ? '' : '~'}${num(e.left)} h left${range}`);
  }
  return parts.join(' · ');
}

/** "2026-10-12T18:00:00Z" → "Oct 12, 18:00 UTC" (the recount's own UTC times, never local-shifted). */
function utc(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] ?? m[2];
  return `${month} ${Number(m[3])}${m[4] ? `, ${m[4]}:${m[5] ?? '00'} UTC` : ''}`;
}

const PACE: Record<string, string> = { todayPace: 'at today’s pace', allLanes: 'with every lane on the plan' };

function shareBar(sharePct: number, effortPct: number | null, target: number): HTMLElement {
  return h('div', { class: 'pbars', 'aria-hidden': 'true' },
    h('span', { class: 'ptrack share' }, h('i', { style: `width:${Math.min(100, sharePct)}%` }), h('em', { style: `left:${target}%` })),
    effortPct === null ? null : h('span', { class: 'ptrack effort' }, h('i', { style: `width:${Math.min(100, effortPct)}%` })));
}

function shardRow(r: ProgressShard, target: number): HTMLElement {
  const over = r.runtime > r.ceiling;
  return h('li', { class: `pshard${r.at8020 ? ' met' : ''}` },
    h('div', { class: 'phead' },
      h('b', {}, r.name),
      r.at8020 ? h('span', { class: 'pmet' }, '80/20 ✓') : null,
      h('span', { class: 'pnum' }, h('span', { class: 'pshare' }, `${num(r.sharePct)} %`),
        r.effort ? h('span', { class: 'peffort' }, ` · ${num(r.effort.pct)} %`) : null)),
    shareBar(r.sharePct, r.effort?.pct ?? null, target),
    h('div', { class: 'pmeta' },
      h('span', {}, `proofs ${r.proofs}/6`),
      h('span', { class: over ? 'pover' : '' }, `runtime ${num(r.runtime)} / ${num(r.ceiling)}`),
      r.effort ? h('span', {}, hoursText(r.effort)) : h('span', {}, 'no recount row')));
}

function totalTile(t: ProgressTotal): HTMLElement {
  return h('div', { class: 'ptile' },
    h('div', { class: 'plabel' }, `${t.label} by effort`),
    h('div', { class: 'pbig' }, `${num(t.pct)} %`),
    h('div', { class: 'small' }, hoursText(t)));
}

function extraRow(e: ProgressEffort): HTMLElement {
  return h('li', { class: 'pshard' },
    h('div', { class: 'phead' }, h('b', {}, e.name), h('span', { class: 'pnum' }, h('span', { class: 'peffort' }, `${num(e.pct)} %`))),
    h('div', { class: 'pbars', 'aria-hidden': 'true' }, h('span', { class: 'ptrack effort' }, h('i', { style: `width:${Math.min(100, e.pct)}%` }))),
    h('div', { class: 'pmeta' }, h('span', {}, hoursText(e))));
}

/** The Progress card: the hard count, M3 / Part A effort, every shard's share next to its effort, and the chart. */
function progressCard(p: ProgressData, stateCount: PlanData['hardCount']): HTMLElement {
  const r = p.recount;
  const finish = r.finish.at(0);
  return h('section', { class: 'card progress', 'aria-label': 'Progress' },
    h('div', { class: 'ptop' }, h('h2', {}, 'Progress'), h('span', { class: 'small mono' }, `share @ ${p.revision}`)),
    h('div', { class: 'phard' },
      h('span', { class: 'hard-count' }, `${p.hardCount.done} of ${p.hardCount.total}`),
      h('span', {}, 'shipping shards at 80/20', h('br'),
        h('span', { class: 'small' }, `public share ≥ ${p.targetPct} % and runtime ≤ its ceiling`))),
    stateCount && (stateCount.done !== p.hardCount.done || stateCount.total !== p.hardCount.total)
      ? h('p', { class: 'small' }, `The plan's State still says ${stateCount.done} of ${stateCount.total}.`) : null,
    h('div', { class: 'ptiles' }, ...r.totals.map(totalTile)),
    finish ? h('p', { class: 'small pfinish' }, `Part A finish, projected ${PACE[finish.label] ?? finish.label}: ${utc(finish.central)} (${utc(finish.from)} – ${utc(finish.to)}), before Jake’s gates.`) : null,
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--accent)' }), 'public SDK share (measured)'),
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--warn)' }), 'effort done (projected)'),
      h('span', {}, h('i', { class: 'sw ptick' }), `${p.targetPct} % target`)),
    h('ul', { class: 'pshards' }, ...p.shipping.map((x) => shardRow(x, p.targetPct)), ...p.extra.map(extraRow)),
    p.others.length > 0 ? h('details', { class: 'disc pothers' },
      h('summary', {}, `Templates and style shards (${p.others.length})`),
      h('ul', { class: 'pshards' }, ...p.others.map((x) => shardRow(x, p.targetPct)))) : null,
    r.chart ? h('button', { class: 'pchart', type: 'button', 'aria-label': 'Open the share vs hours chart',
      onclick: () => { if (r.chart) openMedia({ kind: 'image', name: 'Share vs agent-hours', src: r.chart, poster: null }); } },
    h('img', { src: `/${r.chart}`, alt: 'Public SDK share against agent-hours spent, per shard', loading: 'lazy', decoding: 'async' })) : null,
    h('p', { class: 'small pnote' },
      h('b', {}, 'Measured: '), `public share, proofs and runtime lines (scripts/shard-platform.mjs on ${p.revision}, this build) and hours spent (session logs, recount ${utc(r.asOf)}). `,
      h('b', {}, 'Projected: '), 'hours left, so effort % (spent ÷ (spent + left)) and the finish. ',
      `Recount confidence: ${r.confidence}. `, h('code', {}, r.source)));
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
    progressCard(p.progress, p.hardCount),
    h('h2', {}, 'Ready to share'),
    h('section', { class: 'card' }, p.readiness
      ? h('p', { class: 'statelead', style: 'margin:0' }, rich(p.readiness))
      : h('p', { class: 'small' }, 'No current checklist reported in State.')),
    h('h2', {}, 'State’s own estimate'),
    h('section', { class: 'card' },
      h('details', { class: 'disc', style: 'border-top:0' },
        h('summary', {}, `Effort % as State reports it${p.effortWhen ? ` (${p.effortWhen})` : ''}`),
        h('div', { class: 'hero' }, whole ? ring(whole.pct, 'by effort') : h('span', {}), bars(milestones)),
        shards.length > 0 ? h('h3', {}, 'M3: effort toward 80/20') : null,
        shards.length > 0 ? bars(shards) : null),
      h('p', { class: 'small', style: 'margin:10px 0 0' }, 'Hand-written in the plan; the Progress card above is the measured, current one.')),
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
