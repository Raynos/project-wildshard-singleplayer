// The admin site's view mapping (SF68): sp-x2's `wildshard-admin/1` bundle → the page's view, on inline fixtures (no
// dependence on progress/ or art/, which the game's Vercel export drops).
import { describe, expect, it } from 'vitest';
import type { AdminBundle, ShardShare } from '../../scripts/admin-data/types.mjs';
import { finding, plain, poseTitle, rowStatus, sectionBullets, toView } from '../tools/view.ts';

const src = (path: string) => ({ path, sha256: 'a'.repeat(64), bytes: 1 });
const shareRow = (slug: string, publicShare: number, runtimeLines: number, ceiling: number, proofsPassing: number): ShardShare => ({
  slug, publicLines: Math.round(publicShare * 1000), customLines: 1000 - Math.round(publicShare * 1000), runtimeLines, trustedRuntimeLines: 0,
  publicShare, baseline: ceiling * 5, ceiling, enforced: ceiling === 0, proofsPassing,
  proofs: { boot: true, headless: true, replay: true, ledger: true, gridReady: true, compatible: true, transitional: runtimeLines > 0 },
});

const ADMIN: AdminBundle = {
  schema: 'wildshard-admin/1',
  revision: '0123456789abcdef0123456789abcdef01234567',
  memory: [
    { id: 'progress/memory/x/itemized.json', source: src('progress/memory/x/itemized.json'), pins: ['abc'], format: 'itemized', data: {
      protocol: 'E456',
      situations: [{ id: '1-home', title: 'Home', subtitle: 'spawn', pin: 'abc1234', build: 'abc1234-xyz', settings: 'phone', heapSource: 'none',
        wcBytes: 600, glBytes: 200, totalBytes: 800, blocks: [
          { side: 'GPU', owner: 'Platform', system: 'signs', conf: 'M', bytes: 200 },
          { side: 'RAM', owner: 'Engine & game', system: 'audio', conf: 'E', bytes: 100 },
          { side: 'RAM', owner: 'Unknown owner', system: 'malloc', conf: 'U', bytes: 500 },
        ] }],
    } },
    { id: 'progress/memory/y/pages/report.json', source: src('progress/memory/y/pages/report.json'), pins: ['def'], format: 'sf64', data: {
      schema: 'memory-report/1', pin: 'mixed', device: 'iPhone 16 Pro Simulator', settings: { tier: 'phone', renderScale: 2 }, cap: { bytes: 1_000_000_000 },
      poses: [
        { name: 'road', measured: { wc: 700, gl: 300, total: 1000, time: '2026-10-08T07:39:01Z', source: 'native#road', pid: 1 },
          accounted: { total: 400, allocations: [
            { id: 'a', domain: 'gpu', bytes: 250, owner: 'Platform / road deck', asset: 'road deck', kind: 'k', precision: 'exact' },
            { id: 'b', domain: 'ram', bytes: 150, owner: 'unattributed', asset: 'wasm', kind: 'k', precision: 'estimate' },
          ], unattributed: { ram: null, gpu: null }, storageTotals: { ram: null, gpu: null } }, missing: ['no crossing witness'] },
        { name: 'far-reach-centre', measured: null, accounted: { total: null, allocations: [], unattributed: { ram: null, gpu: null },
          storageTotals: { ram: null, gpu: null } }, missing: ['No native source supplied'] },
      ],
    } },
  ],
  loading: { status: 'unavailable', reports: [], missing: ['No committed SF67 report'] },
  playtests: [{ id: 'round-2-2026-10-08', source: src('art/playtest/round-2-2026-10-08/README.md'), title: 'Agent playtest, round 2',
    builds: ['bf396ec', 'bf396ec-muyyjsyh'], markdown: '# R2\n\n## (d) What works now\n\n- Driving\n  works.\n- Pine loads.\n',
    findings: [{ rank: 1, title: '**Crash.**', line: 3, media: ['art/playtest/round-2-2026-10-08/clip-03-crash.mp4'],
      markdown: '1. **Re-entering Pine crashes.**\n   - **Builds:** bf396ec.\n   - **Repro:** 2 in 3, each after\n     an unload.' }],
    tables: [], media: ['art/playtest/round-2-2026-10-08/clip-03-crash.mp4'], missing: [] }],
  plan: {
    source: src('docs/plans/SHARD-PLATFORM.md'), title: 'Plan: SHARD-PLATFORM — MMO-compatible shardfiles',
    state: '`in progress` 2026-10-08 — whole plan ≈ 53 %; template ≈ 95 % ; Pine ≈ 35 %', stateLine: 3,
    reportedPercent: [{ label: 'whole plan', percent: 53, approximate: true }, { label: 'M2', percent: 88, approximate: true }],
    effort: { context: '', rows: [] },
    milestones: [{ title: '6. Done when', line: 564, markdown: '## 6. Done when\n\n- **M1:** every boolean\n  true.' }],
    rows: [{ id: 'SF0', line: 346, cells: ['SF0', 'X', '**The frame floor**', '**done** `417db57d2`', 'M'] },
      { id: 'SF68', line: 461, cells: ['SF68', 'X + O', 'admin site', 'The site deploys', 'L'] }],
    decisions: [{ id: 'G248', line: 972, cells: ['G248', 'The admin site', '**A new site**'] }],
    waitingForJake: [{ id: 'G148', line: 870, cells: ['G148', 'Pick', 'needs pick'] }],
  },
  progress: {
    share: { command: 'node scripts/shard-platform.mjs --json', target: 0.8, shards: [
      shareRow('_template', 0.955, 0, 0, 6), shareRow('blender-template', 0.902, 0, 0, 6), shareRow('driftwood-isle', 0.191, 4864, 3753, 3),
      shareRow('far-reach', 0.447, 1130, 1377, 5), shareRow('nalati-grasslands', 0.14, 9592, 6618, 0),
      shareRow('nine-dragon-stack', 0.82, 6000, 5033, 5), shareRow('pine-hollow', 0.237, 4866, 4339, 3), shareRow('sunscar-dunes', 0.603, 260, 965, 6),
    ] },
    effort: {
      folder: 'progress/shard-platform/effort-recount-2026-10-09', date: '2026-10-09', asOf: '2026-10-09', confidence: 'low to medium', format: 'readme',
      source: src('progress/shard-platform/effort-recount-2026-10-09/README.md'),
      chart: 'progress/shard-platform/effort-recount-2026-10-09/share-vs-hours.jpg',
      shards: [
        { slug: null, name: 'Template 1', spentHours: 57, remainingHours: 0, approximate: false, effortPercent: 100, line: 10 },
        { slug: null, name: 'Sky Reach', spentHours: 20, remainingHours: 50, approximate: true, effortPercent: 28, line: 12 },
        { slug: 'pine-hollow', name: 'Pine', spentHours: 21, remainingHours: 205, approximate: true, effortPercent: 9, line: 0 },
        { slug: null, name: 'Shared systems', spentHours: 41, remainingHours: 100, approximate: true, effortPercent: 29, line: 17 },
      ],
      totals: [{ label: 'M3', spentHours: 205, remainingHours: 950, remainingRange: [700, 1200], effortPercent: 18 }],
      finish: [],
    },
  },
  media: [{ path: 'art/playtest/round-2-2026-10-08/clip-03-crash.mp4', sha256: 'b'.repeat(64), bytes: 9, url: `media/${'b'.repeat(64)}.mp4`, kind: 'video' },
    { path: 'progress/shard-platform/effort-recount-2026-10-09/share-vs-hours.jpg', sha256: 'c'.repeat(64), bytes: 9, url: `media/${'c'.repeat(64)}.jpg`, kind: 'image' }],
};

describe('admin view mapping', () => {
  it('reads a ranked finding with wrapped lines and labelled sub-lines', () => {
    const item = finding(1, '1. **Re-entering Pine crashes.** It stops.\n   - **Builds:** bf396ec.\n   - **Repro:** 2 in 3, each after\n     an unload.\n   Where: Pine S.');
    expect(item.title).toBe('Re-entering Pine crashes.');
    expect(item.lines).toEqual(['It stops.', 'Builds: bf396ec.', 'Repro: 2 in 3, each after an unload.', 'Where: Pine S.']);
  });

  it('maps memory with its rulers intact and keeps the uncovered remainder unattributed', () => {
    const view = toView(ADMIN, '2026-10-08T00:00:00Z', new Set());
    const itemized = view.memory.reports.at(0);
    const sf64 = view.memory.reports.at(1);
    expect(itemized?.situations.at(0)?.blocks.map((b) => b.conf)).toEqual(['measured', 'estimated', 'unattributed']);
    const road = sf64?.situations.at(0);
    expect(road?.blocks.map((b) => [b.side, b.owner, b.conf, b.bytes])).toEqual([
      ['gpu', 'Platform', 'measured', 250], ['ram', 'Unknown owner', 'unattributed', 150],
      ['gpu', 'Unknown owner', 'unattributed', 50], ['ram', 'Unknown owner', 'unattributed', 550]]);
    expect(sf64?.situations.at(1)).toMatchObject({ title: 'Far Reach centre', totalBytes: null, missing: ['No native source supplied'] });
  });

  it('maps playtests, the plan and loading without inventing numbers', () => {
    const view = toView(ADMIN, '2026-10-08T00:00:00Z', new Set(['b'.repeat(64)]));
    const round = view.playtests.at(0);
    expect(round?.builds).toEqual(['bf396ec-muyyjsyh']);
    expect(round?.top.at(0)?.media).toEqual(['clip-03-crash.mp4']);
    expect(round?.media.at(0)?.poster).toBe(`media/posters/${'b'.repeat(64)}.jpg`);
    expect(round?.works).toEqual(['Driving works.', 'Pine loads.']);
    expect(view.plans.effort).toEqual([{ label: 'Whole plan', pct: 53 }, { label: 'M2 the grid', pct: 88 },
      { label: 'Template (M3)', pct: 95 }, { label: 'Pine (M3)', pct: 35 }]);
    expect(view.plans.rows.map((r) => r.status)).toEqual(['done', 'open']);
    expect(view.plans.waiting.at(0)?.id).toBe('G148');
    expect(view.plans.milestones.at(0)).toEqual({ title: 'Done when', lines: ['M1: every boolean true.'] });
    expect(view.loading).toEqual({ runs: [], note: 'No committed SF67 report' });
    expect(view.build).toBe('012345678');
  });

  it('small readers', () => {
    expect(rowStatus('needs pick (2026-10-08)', '')).toBe('needs pick');
    expect(plain('**Bold** and *it* with [a link](../x.md) and `code`')).toBe('Bold and it with a link and `code`');
    expect(poseTitle('_template-centre')).toBe('Template centre');
    expect(sectionBullets('## (d) What works\n- a\n  b\n## next\n- c', /what work/i)).toEqual(['a b']);
  });

  it('reads the hard count and current checklist from State, keeping effort separate', () => {
    const data = structuredClone(ADMIN);
    data.plan.state = 'Hard count first: shards at 80/20: 1 of 7 (template). Ready-to-share checklist: no known P0 — OPEN; phone fps — met. Then effort: whole plan ≈ 57 %. Ready-to-share checklist: stale handoff.';
    const plan = toView(data, '2026-10-09T00:00:00Z', new Set()).plans;
    expect(plan.hardCount).toEqual({ done: 1, total: 7 });
    expect(plan.readiness).toBe('no known P0 — OPEN; phone fps — met.');
    expect(toView(ADMIN, '2026-10-09T00:00:00Z', new Set()).plans.hardCount).toBeNull();
    data.plan.state = 'shards at 80/20: 0 of 7';
    expect(toView(data, '', new Set()).plans.hardCount).toEqual({ done: 0, total: 7 });
    data.plan.state = 'shards at 80/20: 8 of 7';
    expect(toView(data, '', new Set()).plans.hardCount).toBeNull();
  });

  it('builds the Progress card: the hard count on both measures, the seven apart from style shards, effort matched by slug or name', () => {
    const plan = toView(ADMIN, '2026-10-10T00:00:00Z', new Set()).plans;
    const p = plan.progress;
    // Nine Dragon has 82 % share but runtime over its ceiling, so only the template is at 80/20.
    expect(p.hardCount).toEqual({ done: 1, total: 7 });
    expect(p.revision).toBe('012345678');
    expect(p.shipping.map((s) => [s.name, s.sharePct, s.at8020])).toEqual([['Template', 95.5, true], ['Nine Dragon', 82, false],
      ['Signal Dunes', 60.3, false], ['Sky Reach', 44.7, false], ['Pine Hollow', 23.7, false], ['Driftwood', 19.1, false], ['Nalati', 14, false]]);
    expect(p.others.map((s) => s.name)).toEqual(['Blender Template']);
    expect(p.shipping.find((s) => s.slug === 'far-reach')?.effort).toEqual({ name: 'Sky Reach', pct: 28, spent: 20, left: 50, approx: true });
    expect(p.shipping.find((s) => s.slug === 'pine-hollow')?.effort?.pct).toBe(9);
    expect(p.shipping.find((s) => s.slug === 'driftwood-isle')?.effort).toBeNull();
    expect(p.extra.map((e) => e.name)).toEqual(['Shared systems']);
    expect(p.recount).toMatchObject({ date: '2026-10-09', confidence: 'low to medium', chart: `media/${'c'.repeat(64)}.jpg`,
      totals: [{ label: 'M3', pct: 18, spent: 205, left: 950, range: [700, 1200] }] });
    expect(plan.decisionRange).toBe('G248–G248');
  });

  it('uses G291 for the hard count and keeps legacy-share separate', () => {
    const data = structuredClone(ADMIN);
    const pine = data.progress.share.shards.find(row => row.slug === 'pine-hollow');
    if (pine === undefined) throw new Error('Missing Pine fixture');
    pine.conversion = { metric: 'runtime-vs-legacy', customRuntimeLines: 20, shardRuntimeLines: 20, legacyLines: 100, legacyFolder: 'pine-hollow-legacy',
      legacyRevision: 'a'.repeat(40), runtimeShare: 0.2, passed: true, gameSystemAttribution: { status: 'import-graph', review: 'pending-opus-audit', lines: 0, modules: [] } };
    const result = toView(data, '', new Set()).plans.progress;
    expect(result.hardCount).toEqual({ done: 2, total: 7 });
    expect(result.shipping.find(row => row.slug === 'pine-hollow')).toMatchObject({ sharePct: 80, legacySharePct: 23.7,
      measure: 'runtime-vs-legacy', runtime: 20, ceiling: 20, at8020: true });
    pine.conversion = { ...pine.conversion, customRuntimeLines: 21, shardRuntimeLines: 21, runtimeShare: 0.21, passed: false };
    expect(toView(data, '', new Set()).plans.progress.hardCount).toEqual({ done: 1, total: 7 });
  });

  it('fails when the share script lost a shipping shard', () => {
    const data = structuredClone(ADMIN);
    data.progress.share.shards = data.progress.share.shards.filter((s) => s.slug !== 'nalati-grasslands');
    expect(() => toView(data, '', new Set())).toThrow('nalati-grasslands');
  });

  it('labels decisions by the ids the plan has, and keeps State effort dated', () => {
    const data = structuredClone(ADMIN);
    data.plan.decisions = [1, 2, 289].map((n) => ({ id: `G${n}`, line: n, cells: [`G${n}`, 't', 'a'] }));
    data.plan.state = 'Then effort (coordinator, 2026-10-08 evening): the whole plan ≈ 57 %';
    const plan = toView(data, '', new Set()).plans;
    expect(plan.decisionRange).toBe('G1–G289');
    expect(plan.decisions).toHaveLength(3);
    expect(plan.effortWhen).toBe('coordinator, 2026-10-08 evening');
  });
});
