// The admin site's view mapping (SF68): sp-x2's `wildshard-admin/1` bundle → the page's view, on inline fixtures (no
// dependence on progress/ or art/, which the game's Vercel export drops).
import { describe, expect, it } from 'vitest';
import type { AdminBundle } from '../../scripts/admin-data/types.mjs';
import { finding, plain, poseTitle, rowStatus, sectionBullets, toView } from '../tools/view.ts';

const src = (path: string) => ({ path, sha256: 'a'.repeat(64), bytes: 1 });

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
  media: [{ path: 'art/playtest/round-2-2026-10-08/clip-03-crash.mp4', sha256: 'b'.repeat(64), bytes: 9, url: `media/${'b'.repeat(64)}.mp4`, kind: 'video' }],
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
});
