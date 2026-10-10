// sp-x2's admin data (`wildshard-admin/1`, scripts/admin-data.mjs) → the page's view bundle (SHARD-PLATFORM SF68).
// A pure mapping: no file reads, no inference. The memory rulers stay as the reports wrote them (measured / estimated /
// unattributed); the plan's percentages are State's own; loading stays unavailable until SF67 commits a report.
import type {
  AdminBundle, EffortShard, ItemizedReport, Media, Plan, Playtest as AdminPlaytest, Progress, ShardShare,
} from '../../scripts/admin-data/types.mjs';
import type { MemoryReport } from '../../scripts/memory-report-data.mjs';
import {
  BUNDLE_SCHEMA, type Bundle, type Confidence, type Decision, type LoadingData, type MemBlock, type MemReport,
  type MemSituation, type Milestone, type PlanData, type PlanRow, type Playtest, type PlaytestItem, type PlaytestMedia,
  type ProgressData, type ProgressEffort, type ProgressShard, type RowStatus,
} from '../src/bundle.ts';

const CAP_BYTES = 1_000_000_000;

/** A video's poster still, published at `media/posters/<sha>.jpg` when the build can make one. */
export function posterUrl(m: Media): string {
  return `media/posters/${m.sha256}.jpg`;
}

// ── text ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Markdown inline → plain text (bold / italics markers dropped; `code` and links' text kept). */
export function plain(md: string): string {
  return md.replaceAll('**', '').replaceAll('~~', '').replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1').replaceAll(/(^|\s)\*([^*]+)\*/g, '$1$2').trim();
}

const LABELLED = /^(Where|Files|Rows?|Code|Repro|Builds?|Console|Recovery|Likely code|Evidence):/;

/** One ranked finding's Markdown (`1. **Title.** body…` with bullets and wrapped lines) → title + plain lines. */
export function finding(rank: number, markdown: string): Omit<PlaytestItem, 'media'> {
  const [first = '', ...rest] = markdown.split('\n');
  const text = first.replace(/^\d+\.\s+/, '');
  const bold = /^\*\*(.+?)\*\*\s*(.*)$/.exec(text);
  const item: Omit<PlaytestItem, 'media'> = { rank, title: plain(bold?.[1] ?? text), lines: [] };
  const tail = bold?.[2]?.trim();
  if (tail) item.lines.push(plain(tail));
  for (const line of rest) {
    const body = line.trim();
    if (!body) continue;
    const unbulleted = plain(body.replace(/^[-*]\s+/, ''));
    const prev = item.lines.length - 1;
    if (/^[-*]\s/.test(body) || LABELLED.test(unbulleted) || prev < 0) item.lines.push(unbulleted);
    else item.lines[prev] = `${item.lines[prev] ?? ''} ${plain(body)}`; // a wrapped continuation
  }
  return item;
}

/** The `## …` section of a Markdown document whose heading matches, as bullet items. */
export function sectionBullets(markdown: string, heading: RegExp): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && heading.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const t = line.trim();
    if (!t) continue;
    if (/^[-*]\s/.test(line)) out.push(plain(t.replace(/^[-*]\s+/, '')));
    else if (out.length > 0) out[out.length - 1] = `${out.at(-1) ?? ''} ${plain(t)}`;
  }
  return out;
}

export function rowStatus(doneWhen: string, what: string): RowStatus {
  const d = doneWhen.toLowerCase();
  const all = `${what} ${d}`.toLowerCase();
  // the plan marks a landed row "**done** `sha`" / "**done** (…)" in its done-when cell, sometimes after **Evidence:**
  if (/^\*\*done\*\*|^done\b/.test(d) || /\*\*done\*\*\s*[`(:]/.test(all)) return 'done';
  if (/\bdropped\b/.test(d.slice(0, 40)) || (what.startsWith('~~') && all.includes('dropped'))) return 'dropped';
  if (all.includes('needs pick')) return 'needs pick';
  if (/in flight|in progress/.test(d.slice(0, 80))) return 'in flight';
  return 'open';
}

// ── memory ───────────────────────────────────────────────────────────────────────────────────────────────────────

const ITEMIZED_CONF: Record<'M' | 'E' | 'U', Confidence> = { M: 'measured', E: 'estimated', U: 'unattributed' };

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function itemized(id: string, source: string, data: ItemizedReport, media: Map<string, Media>): MemReport {
  const dir = dirOf(source);
  const situations = data.situations.map((s): MemSituation => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    build: s.build || s.pin,
    settings: s.settings,
    totalBytes: s.totalBytes,
    ramBytes: s.wcBytes,
    gpuBytes: s.glBytes,
    blocks: s.blocks.map((b): MemBlock => ({ side: b.side === 'GPU' ? 'gpu' : 'ram', owner: b.owner, asset: b.system,
      conf: ITEMIZED_CONF[b.conf], bytes: b.bytes })),
    missing: [],
    image: media.get(`${dir}/${s.id}.jpg`)?.url ?? null,
  }));
  return {
    id,
    title: 'Itemized memory (E456)',
    date: /(\d{4}-\d{2}-\d{2})/.exec(source)?.[1] ?? '',
    kind: 'itemized',
    source,
    device: 'iPhone 16 Pro Simulator, Safari',
    note: 'Single cold runs (±50 MB). GPU is fully measured; RAM estimates come from heap snapshots of another process or pin.',
    situations,
  };
}

const POSE_TITLES: Record<string, string> = { road: 'Empty road', 'worst-crossing': 'Worst crossing' };

export function poseTitle(name: string): string {
  const known = POSE_TITLES[name];
  if (known) return known;
  const label = name.replace(/-centre$/, '').replace(/^_/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return name.endsWith('-centre') ? `${label} centre` : label;
}

/** "Owner / asset" → [owner, asset]; the report writes unowned rows as "unattributed". */
function splitOwner(owner: string, asset: string): [string, string] {
  if (owner === 'unattributed') return ['Unknown owner', asset];
  const cut = owner.indexOf(' / ');
  return cut === -1 ? [owner, asset] : [owner.slice(0, cut), asset || owner.slice(cut + 3)];
}

function settingText(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

function sf64(id: string, source: string, data: MemoryReport, media: Map<string, Media>): MemReport {
  const dir = dirOf(source);
  const st = data.settings;
  const settingsLine = [data.device, `${settingText(st['tier'])} tier`, `${settingText(st['renderScale'])}×`, settingText(st['textures']),
    st['developer'] === true ? 'Developer ON' : 'Developer OFF', st['memorySaver'] === true ? 'Memory saver ON' : 'Memory saver OFF'].join(', ');
  const pages = [...media.values()].filter((m) => m.path.startsWith(`${dir}/`) && m.path.endsWith('.jpg'));
  const situations = data.poses.map((p): MemSituation => {
    const image = pages.find((m) => m.path.endsWith(`-${p.name}.jpg`))?.url ?? null;
    const pin = settingText(p.evidence?.['pin']);
    if (p.measured === null) {
      return { id: p.name, title: poseTitle(p.name), subtitle: '', build: pin, settings: settingsLine, totalBytes: null,
        ramBytes: null, gpuBytes: null, blocks: [], missing: p.missing, image };
    }
    const blocks = p.accounted.allocations.map((a): MemBlock => {
      const [owner, asset] = splitOwner(a.owner, a.asset);
      return { side: a.domain, owner, asset, conf: owner === 'Unknown owner' ? 'unattributed' : a.precision === 'exact' ? 'measured' : 'estimated',
        bytes: a.bytes };
    });
    // The part of each measured total that no row covers stays visible as its own unattributed block (never zeroed,
    // never assigned): the report's native WC / GL totals minus its own rows.
    for (const [side, total] of [['gpu', p.measured.gl], ['ram', p.measured.wc]] as const) {
      const covered = blocks.filter((b) => b.side === side).reduce((t, b) => t + b.bytes, 0);
      if (total - covered > 0.5) {
        blocks.push({ side, owner: 'Unknown owner', asset: side === 'ram' ? 'WebContent no row covers' : 'GL no row covers',
          conf: 'unattributed', bytes: total - covered });
      }
    }
    return { id: p.name, title: poseTitle(p.name), subtitle: p.measured.source, build: pin, settings: settingsLine,
      totalBytes: p.measured.total, ramBytes: p.measured.wc, gpuBytes: p.measured.gl, blocks, missing: p.missing, image };
  });
  return {
    id,
    title: 'SF64 memory report',
    date: /(\d{4}-\d{2}-\d{2})/.exec(p0(data))?.[1] ?? '',
    kind: data.schema,
    source,
    device: data.device,
    note: settingText(st['provenance']),
    situations,
  };
}

/** The first measured pose's timestamp, the report's date. */
function p0(data: MemoryReport): string {
  return data.poses.find((p) => p.measured !== null)?.measured?.time ?? '';
}

// ── playtests ────────────────────────────────────────────────────────────────────────────────────────────────────

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function playtest(p: AdminPlaytest, media: Map<string, Media>, posters: ReadonlySet<string>): Playtest {
  const toMedia = (path: string): PlaytestMedia | null => {
    const m = media.get(path);
    if (!m) return null;
    return { kind: m.kind, name: baseName(path), src: m.url, poster: m.kind === 'video' && posters.has(m.sha256) ? posterUrl(m) : null };
  };
  const all = p.media.map(toMedia).filter((m): m is PlaytestMedia => m !== null);
  return {
    id: p.id,
    title: plain(p.title),
    date: /(\d{4}-\d{2}-\d{2})/.exec(p.id)?.[1] ?? '',
    builds: p.builds.filter((b) => b.includes('-')),
    source: p.source.path,
    top: p.findings.map((f): PlaytestItem => ({ ...finding(f.rank, f.markdown), media: f.media.map(baseName) })),
    works: sectionBullets(p.markdown, /what work/i),
    media: all,
  };
}

// ── plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const EFFORT_LABELS: Record<string, string> = { 'whole plan': 'Whole plan', M1: 'M1 the package', M2: 'M2 the grid', M3: 'M3 the seven' };
const SHARD_LABELS = ['template', 'Signal Dunes', 'Sky Reach', 'Driftwood', 'Pine', 'Nalati', 'Nine Dragon'];

/** The seven shards M3 ships at 80/20 (§6), with the names a recount README may use for them. */
export const SHIPPING: readonly { slug: string; name: string; aliases: readonly string[] }[] = [
  { slug: 'driftwood-isle', name: 'Driftwood', aliases: ['driftwood', 'driftwood isle'] },
  { slug: 'pine-hollow', name: 'Pine Hollow', aliases: ['pine', 'pine hollow'] },
  { slug: 'nalati-grasslands', name: 'Nalati', aliases: ['nalati', 'nalati grasslands'] },
  { slug: 'far-reach', name: 'Sky Reach', aliases: ['sky reach', 'far reach'] },
  { slug: 'sunscar-dunes', name: 'Signal Dunes', aliases: ['signal dunes', 'sunscar dunes'] },
  { slug: 'nine-dragon-stack', name: 'Nine Dragon', aliases: ['nine dragon', 'nine dragon stack'] },
  { slug: '_template', name: 'Template', aliases: ['template', 'template 1'] },
];

function shardName(slug: string): string {
  return slug.replace(/^_/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** The share script's rows + the newest recount → the Progress card. A shipping shard missing from the script fails. */
export function progress(p: Progress, revision: string, media: Map<string, Media>): ProgressData {
  const target = p.share.target;
  const known = (slug: string) => SHIPPING.find((s) => s.slug === slug);
  const used = new Set<EffortShard>();
  const effortFor = (slug: string): ProgressEffort | null => {
    const names = new Set([slug, shardName(slug).toLowerCase(), ...(known(slug)?.aliases ?? [])]);
    const row = p.effort.shards.find((e) => e.slug === slug) ?? p.effort.shards.find((e) => e.slug === null && names.has(e.name.toLowerCase()));
    if (!row) return null;
    used.add(row);
    return { name: row.name, pct: row.effortPercent, spent: row.spentHours, left: row.remainingHours, approx: row.approximate };
  };
  const toShard = (row: ShardShare): ProgressShard => {
    const runtimeShare = row.conversion?.runtimeShare ?? null, legacyLines = row.conversion?.legacyLines ?? null;
    return {
    slug: row.slug,
    name: known(row.slug)?.name ?? shardName(row.slug),
    measure: row.conversion?.metric ?? 'legacy-share',
    legacySharePct: Math.round(row.publicShare * 1000) / 10,
    sharePct: Math.round((runtimeShare === null ? row.publicShare : Math.max(0, 1 - runtimeShare)) * 1000) / 10,
    publicLines: row.publicLines,
    customLines: row.customLines,
    runtime: legacyLines === null ? row.runtimeLines : (row.conversion?.customRuntimeLines ?? row.runtimeLines),
    ceiling: legacyLines === null ? row.ceiling : Math.floor(legacyLines * 0.2),
    at8020: row.conversion?.passed ?? (row.publicShare >= target && row.runtimeLines <= row.ceiling),
    proofs: row.proofsPassing,
    effort: effortFor(row.slug),
    };
  };
  const shipping = SHIPPING.map(({ slug }) => {
    const row = p.share.shards.find((s) => s.slug === slug);
    if (!row) throw new Error(`Progress: ${p.share.command} has no row for the shipping shard ${slug}`);
    return toShard(row);
  }).sort((a, b) => b.sharePct - a.sharePct);
  const others = p.share.shards.filter((s) => !known(s.slug)).map(toShard);
  const extra = p.effort.shards.filter((e) => !used.has(e)).map((e): ProgressEffort =>
    ({ name: e.name, pct: e.effortPercent, spent: e.spentHours, left: e.remainingHours, approx: e.approximate }));
  return {
    revision: revision.slice(0, 9),
    targetPct: Math.round(target * 100),
    hardCount: { done: shipping.filter((s) => s.at8020).length, total: shipping.length },
    shipping,
    others,
    extra,
    recount: {
      date: p.effort.date,
      asOf: p.effort.asOf,
      confidence: p.effort.confidence,
      source: p.effort.source.path,
      totals: p.effort.totals.map((t) => ({ label: t.label, pct: t.effortPercent, spent: t.spentHours, left: t.remainingHours, range: t.remainingRange })),
      finish: p.effort.finish,
      chart: media.get(p.effort.chart)?.url ?? null,
    },
  };
}

function plan(p: Plan, prog: ProgressData): PlanData {
  const rows = p.rows.map((r): PlanRow => {
    // Row | Lane | What | Done when | Size, or with one more column before Done when (the systems table)
    const [id = r.id, lane = '', what = ''] = r.cells;
    const size = r.cells.at(-1) ?? '';
    const doneWhen = r.cells.length >= 5 ? r.cells.at(-2) ?? '' : '';
    return { id: plain(id), lane: plain(lane), what: plain(what), doneWhen: plain(doneWhen), status: rowStatus(doneWhen, what), size: plain(size) };
  });
  const decisions = p.decisions.map((d): Decision => ({ id: d.id, topic: plain(d.cells[1] ?? ''), answer: plain(d.cells.slice(2).join(' · ')) }));
  const milestones = p.milestones.map((m): Milestone => ({ title: plain(m.title.replace(/^\d+\.\s*/, '')),
    lines: sectionLines(m.markdown) }));
  // State reports each shard's M3 share in prose; read them verbatim, as State's own numbers.
  const shardEffort = SHARD_LABELS.flatMap((label) => {
    const m = new RegExp(`${label} ≈ (\\d+) %`).exec(p.state);
    return m ? [{ label: `${label === 'template' ? 'Template' : label} (M3)`, pct: Number(m[1]) }] : [];
  });
  const source = p.source.path;
  const state = plain(p.state.replace(/^\*\*State:\*\*\s*/, ''));
  const count = /shards at 80\/20:\s*(\d+) of (\d+)/iu.exec(state);
  const done = Number(count?.[1]), total = Number(count?.[2]);
  const hardCount = count && Number.isSafeInteger(done) && Number.isSafeInteger(total) && total > 0 && done <= total ? { done, total } : null;
  const readiness = /Ready-to-share checklist:\s*(.*?)(?:Then effort\b|$)/iu.exec(state)?.[1]?.trim() ?? null;
  const effortWhen = /\beffort \(([^)]*\d{4}-\d{2}-\d{2}[^)]*)\)/u.exec(state)?.[1] ?? null;
  const ids = decisions.map((d) => Number(/^G(\d+)$/.exec(d.id)?.[1])).filter((n) => Number.isSafeInteger(n));
  const decisionRange = ids.length === 0 ? 'decisions' : `G${Math.min(...ids)}–G${Math.max(...ids)}`;
  return {
    progress: prog,
    effortWhen,
    slug: source.slice(source.lastIndexOf('/') + 1).replace(/\.md$/, ''),
    title: plain(p.title.replace(/^Plan:\s*/, '')),
    state,
    source,
    hardCount,
    readiness,
    effort: [...p.reportedPercent.map((e) => ({ label: EFFORT_LABELS[e.label] ?? e.label, pct: e.percent })), ...shardEffort],
    milestones,
    rows,
    decisions,
    decisionRange,
    waiting: p.waitingForJake.map((w) => ({ id: w.id, what: plain(w.cells.slice(1).join(' · ')), source: `${source}:${w.line}` })),
  };
}

function sectionLines(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (/^[-*]\s/.test(t) || out.length === 0) out.push(plain(t.replace(/^[-*]\s+/, '')));
    else if (/^\s/.test(line)) out[out.length - 1] = `${out.at(-1) ?? ''} ${plain(t)}`;
    else out.push(plain(t));
  }
  return out;
}

/** A route-safe report id: its folder under progress/memory (`sf64-report`, `itemized-2026-10-08`). */
export function reportId(path: string): string {
  return path.replace(/^progress\/memory\//, '').split('/')[0] ?? path;
}

// ── the view ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function toView(admin: AdminBundle, builtAt: string, posters: ReadonlySet<string>): Bundle {
  const media = new Map(admin.media.map((m) => [m.path, m]));
  const reports = admin.memory.map((e) => e.format === 'itemized'
    ? itemized(reportId(e.source.path), e.source.path, e.data, media)
    : sf64(reportId(e.source.path), e.source.path, e.data, media));
  const loading: LoadingData = {
    runs: admin.loading.reports.flatMap((r) => r.data.runs.map((run) => ({
      shard: run.shard, mode: run.cache, build: r.data.pin, device: r.data.device, playableMs: run.timeToPlayableMs,
      phases: run.phases.map((ph) => ({ name: ph.name, ms: ph.endMs - ph.startMs, owner: ph.owner })),
      longTasks: run.longTasks.map((t) => ({ ms: t.durationMs, owner: t.owner, label: `at ${Math.round(t.startMs)} ms` })),
    }))),
    note: admin.loading.missing.join(' ') || "SF67's loading benchmark has not landed yet.",
  };
  return {
    schema: BUNDLE_SCHEMA,
    build: admin.revision.slice(0, 9),
    builtAt,
    memory: { capBytes: CAP_BYTES, reports },
    loading,
    playtests: admin.playtests.map((p) => playtest(p, media, posters)).sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true })),
    plans: plan(admin.plan, progress(admin.progress, admin.revision, media)),
  };
}
