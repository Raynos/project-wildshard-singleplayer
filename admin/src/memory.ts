// The memory explorer (SF68 tool 1): every itemized / SF64 situation as GPU vs RAM by owner → asset, the 1.0 GB cap line,
// measured / estimated / unattributed drawn distinctly, and a build-to-build compare. Tap-only: nothing needs hover.
import type { Confidence, MemBlock, MemReport, MemSituation, MemoryData, Side } from './bundle.ts';
import { MB, h, mb, rich, s } from './dom.ts';

type SideFilter = 'both' | Side;

interface MemState {
  report: string;
  situation: string;
  side: SideFilter;
  owner: string;
  compare: string;
}

const state: MemState = { report: '', situation: '', side: 'both', owner: '', compare: '' };

const OWNER_COLORS: Record<string, string> = {
  Platform: '#4f8ff7',
  'Engine & game': '#8796ab',
  'Kit & player': '#e6c34a',
  'Browser & OS': '#a77bf3',
  Driftwood: '#2fb8a6',
  'Driftwood Isle': '#2fb8a6',
  'Pine Hollow': '#3f9d4e',
  Nalati: '#e08a3c',
  'Nalati Grasslands': '#e08a3c',
  'Unknown owner': '#59616d',
};
const FALLBACK = ['#d9668f', '#46b3d9', '#b5c949', '#c98a5b', '#6f7fe0'];

function ownerColor(owner: string): string {
  const known = OWNER_COLORS[owner];
  if (known) return known;
  let hash = 0;
  for (const ch of owner) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return FALLBACK[hash % FALLBACK.length] ?? '#888';
}

const CONF_LABEL: Record<Confidence, string> = { measured: 'Measured', estimated: 'Estimated', unattributed: 'Unattributed' };
const CONF_BADGE: Record<Confidence, string> = { measured: 'm', estimated: 'e', unattributed: 'u' };

interface OwnerSum {
  owner: string;
  bytes: number;
  gpu: number;
  ram: number;
  conf: Record<Confidence, number>;
  blocks: MemBlock[];
}

function sideBlocks(sit: MemSituation, side: SideFilter): MemBlock[] {
  return side === 'both' ? sit.blocks : sit.blocks.filter((b) => b.side === side);
}

function owners(blocks: MemBlock[]): OwnerSum[] {
  const map = new Map<string, OwnerSum>();
  for (const b of blocks) {
    let o = map.get(b.owner);
    if (!o) {
      o = { owner: b.owner, bytes: 0, gpu: 0, ram: 0, conf: { measured: 0, estimated: 0, unattributed: 0 }, blocks: [] };
      map.set(b.owner, o);
    }
    o.bytes += b.bytes;
    o[b.side] += b.bytes;
    o.conf[b.conf] += b.bytes;
    o.blocks.push(b);
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

function confTotals(blocks: MemBlock[]): Record<Confidence, number> {
  const t: Record<Confidence, number> = { measured: 0, estimated: 0, unattributed: 0 };
  for (const b of blocks) t[b.conf] += b.bytes;
  return t;
}

function key(r: MemReport, sit: MemSituation): string {
  return `${r.id}/${sit.id}`;
}

function findSituation(data: MemoryData, k: string): [MemReport, MemSituation] | null {
  for (const r of data.reports) {
    for (const sit of r.situations) if (key(r, sit) === k) return [r, sit];
  }
  return null;
}

// ── the chart ────────────────────────────────────────────────────────────────────────────────────────────────────

let chartSeq = 0;

function chart(sit: MemSituation, capBytes: number, rerender: () => void): SVGSVGElement {
  const id = `c${chartSeq++}`;
  const gpu = sit.blocks.filter((b) => b.side === 'gpu');
  const ram = sit.blocks.filter((b) => b.side === 'ram');
  const total = sit.totalBytes ?? 0;
  const max = Math.max(capBytes * 1.25, total * 1.06);
  const W = 360;
  const L = 44;
  const R = 8;
  const plotW = W - L - R;
  const x = (bytes: number) => L + (bytes / max) * plotW;
  const rowH = 30;
  const rows: { label: string; y: number }[] = [
    { label: 'Total', y: 22 },
    { label: 'GPU', y: 22 + rowH + 14 },
    { label: 'RAM', y: 22 + 2 * (rowH + 14) },
  ];
  const H = rows[2] ? rows[2].y + rowH + 26 : 160;
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `${sit.title}: ${mb(total)} MB total, GPU ${mb(sit.gpuBytes ?? 0)} MB, RAM ${mb(sit.ramBytes ?? 0)} MB, cap ${mb(capBytes, 0)} MB` });
  const defs = s('defs', {},
    s('pattern', { id: `${id}h`, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 2, height: 5, fill: 'rgba(255,255,255,0.55)' })),
    s('pattern', { id: `${id}u`, width: 6, height: 6, patternUnits: 'userSpaceOnUse' },
      s('rect', { width: 6, height: 6, fill: 'var(--unattr)' }),
      s('rect', { width: 2, height: 6, fill: 'rgba(0,0,0,0.28)' })));
  svg.append(defs);

  // 50 MB ticks every 100 MB labelled at 250s
  for (let t = 0; t <= max; t += 250 * MB) {
    svg.append(s('line', { class: 'axis', x1: x(t), x2: x(t), y1: 14, y2: H - 18 }));
    svg.append(s('text', { x: x(t), y: H - 4, 'text-anchor': 'middle' }, t === 0 ? '0' : `${Math.round(t / MB)}`));
  }

  const seg = (y: number, from: number, bytes: number, fill: string, conf: Confidence, owner: string, label: string) => {
    const w = Math.max(0, x(from + bytes) - x(from));
    const dim = state.owner !== '' && owner !== state.owner;
    const g = s('g', { class: dim ? 'seg-r dim' : 'seg-r', role: 'button', tabindex: 0, 'aria-label': label });
    const select = () => {
      state.owner = state.owner === owner ? '' : owner;
      rerender();
    };
    g.addEventListener('click', select);
    g.addEventListener('keydown', (e) => {
      if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) select();
    });
    g.append(s('rect', { x: x(from), y, width: w, height: rowH, fill: conf === 'unattributed' ? `url(#${id}u)` : fill }));
    if (conf === 'estimated') g.append(s('rect', { x: x(from), y, width: w, height: rowH, fill: `url(#${id}h)` }));
    if (w > 1.5) g.append(s('rect', { x: x(from + bytes) - 0.5, y, width: 0.8, height: rowH, fill: 'var(--panel)' }));
    svg.append(g);
  };

  const [tRow, gRow, rRow] = rows;
  if (tRow && gRow && rRow) {
    // total: GPU then RAM, side-coloured
    if (sit.gpuBytes !== null && sit.ramBytes !== null) {
      seg(tRow.y, 0, sit.gpuBytes, 'var(--accent)', 'measured', '', `GPU ${mb(sit.gpuBytes)} MB`);
      seg(tRow.y, sit.gpuBytes, sit.ramBytes, '#c58bff', 'measured', '', `RAM ${mb(sit.ramBytes)} MB`);
    }
    for (const [row, blocks] of [[gRow, gpu], [rRow, ram]] as const) {
      let at = 0;
      for (const o of owners(blocks)) {
        for (const conf of ['measured', 'estimated', 'unattributed'] as const) {
          const bytes = o.conf[conf];
          if (bytes <= 0) continue;
          seg(row.y, at, bytes, ownerColor(o.owner), conf, o.owner, `${o.owner}, ${CONF_LABEL[conf].toLowerCase()}: ${mb(bytes)} MB`);
          at += bytes;
        }
      }
    }
    for (const row of rows) svg.append(s('text', { x: 0, y: row.y + rowH / 2 + 4 }, row.label));
  }

  const cx = x(capBytes);
  svg.append(s('line', { class: 'cap', x1: cx, x2: cx, y1: 8, y2: H - 18 }));
  svg.append(s('text', { class: 'capt', x: cx, y: 9, 'text-anchor': 'middle' }, `${mb(capBytes, 0)} MB cap`));
  return svg;
}

// ── panels ───────────────────────────────────────────────────────────────────────────────────────────────────────

function pressed(on: boolean): string {
  return on ? 'true' : 'false';
}

function totalCard(sit: MemSituation, capBytes: number, rerender: () => void): HTMLElement {
  const total = sit.totalBytes ?? 0;
  const over = total - capBytes;
  const ct = confTotals(sit.blocks);
  return h('section', { class: 'card' },
    h('div', { class: 'total' },
      h('span', { class: 'big' }, `${mb(total, 0)} MB`),
      h('span', { class: over > 0 ? 'verdict over' : 'verdict under' }, over > 0 ? `${mb(over, 0)} over` : `${mb(-over, 0)} under`)),
    h('div', { class: 'split' },
      h('span', {}, 'GPU ', h('b', {}, mb(sit.gpuBytes ?? 0, 0))),
      h('span', {}, 'RAM ', h('b', {}, mb(sit.ramBytes ?? 0, 0))),
      h('span', {}, 'WebContent + labelled GL')),
    chart(sit, capBytes, rerender),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'sw', style: 'background:var(--accent)' }), 'GPU'),
      h('span', {}, h('i', { class: 'sw', style: 'background:#c58bff' }), 'RAM'),
      h('span', {}, h('i', { class: 'sw est', style: 'background-color:#8796ab' }), 'estimated'),
      h('span', {}, h('i', { class: 'sw una' }), 'unattributed'),
      h('span', {}, 'tap a bar to pick its owner')),
    h('div', { class: 'conf3' },
      ...(['measured', 'estimated', 'unattributed'] as const).map((c) =>
        h('div', {}, h('b', {}, `${mb(ct[c], 0)} MB`), h('span', {}, CONF_LABEL[c].toLowerCase())))));
}

function ownerList(sit: MemSituation, rerender: () => void): HTMLElement {
  const blocks = sideBlocks(sit, state.side);
  const sum = blocks.reduce((t, b) => t + b.bytes, 0);
  const list = h('ul', { class: 'owners' });
  for (const o of owners(blocks)) {
    const open = state.owner === o.owner;
    const sub = state.side === 'both' ? `GPU ${mb(o.gpu)} · RAM ${mb(o.ram)}` : `${o.blocks.length} item${o.blocks.length === 1 ? '' : 's'}`;
    const bar = h('span', { class: 'minibar' },
      ...(['measured', 'estimated', 'unattributed'] as const).map((c) =>
        o.conf[c] > 0 ? h('i', { style: `width:${(o.conf[c] / o.bytes) * 100}%;background:${c === 'measured' ? 'var(--good)' : c === 'estimated' ? 'var(--warn)' : 'var(--unattr)'}` }) : null));
    const row = h('button', { class: 'orow', type: 'button', 'aria-expanded': pressed(open), onclick: () => {
      state.owner = open ? '' : o.owner;
      rerender();
    } },
    h('i', { class: 'sw', style: `background:${ownerColor(o.owner)}` }),
    h('span', {}, h('span', { class: 'name' }, o.owner), h('br'), h('span', { class: 'small' }, sub)),
    h('span', { class: 'mb' }, `${mb(o.bytes)} MB`, h('small', {}, `${((o.bytes / sum) * 100).toFixed(1)} %`)),
    bar);
    const li = h('li', {}, row);
    if (open) {
      const assets = h('ul', { class: 'assets' });
      for (const b of [...o.blocks].sort((a, c) => c.bytes - a.bytes)) {
        assets.append(h('li', {},
          h('span', {}, h('span', { class: `badge ${CONF_BADGE[b.conf]}`, title: CONF_LABEL[b.conf] }, CONF_BADGE[b.conf].toUpperCase()),
            ' ', h('span', { class: `badge ${b.side}` }, b.side.toUpperCase())),
          h('span', {}, b.asset),
          h('span', { class: 'v' }, mb(b.bytes))));
      }
      li.append(assets);
    }
    list.append(li);
  }
  return h('section', { class: 'card flat' }, list);
}

function compareCard(data: MemoryData, report: MemReport, sit: MemSituation, rerender: () => void): HTMLElement {
  const sel = h('select', { class: 'pick', 'aria-label': 'Compare with', onchange: (e) => {
    const t = e.target;
    if (t instanceof HTMLSelectElement) {
      state.compare = t.value;
      rerender();
    }
  } }, h('option', { value: '' }, 'Compare with another build or situation…'));
  for (const r of data.reports) {
    const group = h('optgroup', { label: r.title });
    for (const other of r.situations) {
      if (other.totalBytes === null || (r === report && other === sit)) continue;
      const k = key(r, other);
      group.append(h('option', { value: k, selected: state.compare === k }, `${other.title} · ${other.build} · ${mb(other.totalBytes, 0)} MB`));
    }
    sel.append(group);
  }
  const card = h('section', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Compare'), sel);
  const found = state.compare ? findSituation(data, state.compare) : null;
  if (!found) return card;
  const [, other] = found;
  const deltaLine = (label: string, a: number | null, b: number | null) => {
    if (a === null || b === null) return null;
    const d = a - b;
    return h('div', { class: 'drow' }, h('span', {}, label),
      h('span', { class: `delta ${d > 0 ? 'up' : 'down'}`, style: 'text-align:right' }, `${d > 0 ? '+' : ''}${mb(d)}`));
  };
  card.append(h('p', { class: 'small' }, `${sit.title} (${sit.build}) minus ${other.title} (${other.build}), MB. Red grew, green shrank.`));
  card.append(deltaLine('Total', sit.totalBytes, other.totalBytes) ?? '', deltaLine('GPU', sit.gpuBytes, other.gpuBytes) ?? '',
    deltaLine('RAM', sit.ramBytes, other.ramBytes) ?? '');
  const a = new Map(owners(sideBlocks(sit, state.side)).map((o) => [o.owner, o.bytes]));
  const b = new Map(owners(sideBlocks(other, state.side)).map((o) => [o.owner, o.bytes]));
  const deltas = [...new Set([...a.keys(), ...b.keys()])].map((o) => ({ owner: o, d: (a.get(o) ?? 0) - (b.get(o) ?? 0) }))
    .filter((x) => Math.abs(x.d) >= 0.05 * MB).sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
  const maxD = Math.max(1, ...deltas.map((x) => Math.abs(x.d)));
  card.append(h('h3', {}, `By owner (${state.side === 'both' ? 'GPU + RAM' : state.side.toUpperCase()})`));
  for (const x of deltas) {
    const w = (Math.abs(x.d) / maxD) * 50;
    card.append(h('div', { class: 'drow' },
      h('span', {}, h('i', { class: 'sw', style: `background:${ownerColor(x.owner)};width:10px;height:10px;margin-right:6px` }), x.owner),
      h('span', { class: `delta ${x.d > 0 ? 'up' : 'down'}`, style: 'text-align:right' }, `${x.d > 0 ? '+' : ''}${mb(x.d)}`),
      h('span', { class: 'dbar' }, h('i', { style: `${x.d > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${x.d > 0 ? 'var(--bad)' : 'var(--good)'}` }))));
  }
  return card;
}

// ── the view ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function memoryView(root: HTMLElement, data: MemoryData, route: string[]): void {
  const [routeReport, routeSit] = route;
  if (routeReport && data.reports.some((r) => r.id === routeReport)) state.report = routeReport;
  const report = data.reports.find((r) => r.id === state.report) ?? data.reports[0];
  if (!report) {
    root.replaceChildren(h('div', { class: 'card empty' }, h('p', {}, 'No memory reports are committed yet.')));
    return;
  }
  state.report = report.id;
  if (routeSit && report.situations.some((x) => x.id === routeSit)) state.situation = routeSit;
  const sit = report.situations.find((x) => x.id === state.situation) ?? report.situations.find((x) => x.totalBytes !== null) ?? report.situations[0];
  if (!sit) return;
  state.situation = sit.id;

  const rerender = () => memoryView(root, data, []);
  const go = (r: string, si: string) => {
    state.report = r;
    state.situation = si;
    state.owner = '';
    history.replaceState(null, '', `#memory/${r}/${si}`);
    rerender();
  };

  const reportChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Report' },
    ...data.reports.map((r) => h('button', { class: 'chip', type: 'button', 'aria-pressed': pressed(r.id === report.id),
      onclick: () => go(r.id, '') }, r.title, h('span', { class: 'n' }, r.date))));
  const sitChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Situation' },
    ...report.situations.map((x) => h('button', {
      class: x.totalBytes === null ? 'chip missing' : 'chip', type: 'button', 'aria-pressed': pressed(x.id === sit.id),
      onclick: () => go(report.id, x.id),
    }, x.title, h('span', { class: 'n' }, x.totalBytes === null ? 'missing' : mb(x.totalBytes, 0)))));

  const head = h('div', {},
    h('h1', {}, sit.title),
    h('p', { class: 'sub' }, sit.subtitle ? `${sit.subtitle} · ` : '', 'build ', h('span', { class: 'mono' }, sit.build || 'unknown')));

  const parts: HTMLElement[] = [reportChips, sitChips, head];
  if (sit.totalBytes === null) {
    parts.push(h('section', { class: 'card' },
      h('h3', { style: 'margin-top:0' }, 'Not measured'),
      h('ul', { class: 'missing-list' }, ...sit.missing.map((m) => h('li', {}, rich(m))))));
  } else {
    const sideSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Memory side' },
      ...(['both', 'gpu', 'ram'] as const).map((sd) => h('button', { type: 'button', 'aria-pressed': pressed(state.side === sd),
        onclick: () => {
          state.side = sd;
          rerender();
        } }, sd === 'both' ? 'GPU + RAM' : sd.toUpperCase())));
    parts.push(totalCard(sit, data.capBytes, rerender));
    parts.push(h('h2', {}, 'By owner'), sideSeg, ownerList(sit, rerender));
    if (sit.missing.length > 0) {
      parts.push(h('section', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'What this reading lacks'),
        h('ul', { class: 'missing-list' }, ...sit.missing.map((m) => h('li', {}, rich(m))))));
    }
    parts.push(compareCard(data, report, sit, rerender));
  }
  const about = h('section', { class: 'card' },
    h('details', { class: 'disc' }, h('summary', {}, 'About this reading'),
      h('p', { class: 'small' }, sit.settings),
      h('p', { class: 'small' }, report.note),
      h('p', { class: 'small' }, 'Source ', h('code', {}, report.source), ` · ${report.device}`)),
    sit.image ? h('details', { class: 'disc' }, h('summary', {}, 'The report’s own page'),
      h('img', { class: 'report', src: `/${sit.image}`, alt: `${report.title}: ${sit.title}`, loading: 'lazy' })) : null);
  parts.push(about);
  root.replaceChildren(...parts);
}
