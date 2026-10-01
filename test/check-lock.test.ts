// The E357 lock check (GAME-NORMALIZATION F0, plan spec 02 F0 step 5; R1-09, R2-19, C3-14).
import { describe, expect, it } from 'vitest';
import { lockVerdict, type Lock } from '../scripts/check-lock.mjs';

const LEAD = 'E357 F1: tooling\n\nBody.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nE357-Lead: yes\n';
const PLAIN = 'Nine Dragon: a new prop\n\nBody.\n';
const locked = (reopened: Record<string, string[]> = {}): Lock => ({ locked: true, reopened });
const nd = locked({ 'nine-dragon-stack': ['public/assets/models/nine-dragon/**'] });

describe('lockVerdict', () => {
  it('refuses an engine path without the trailer and passes it with E357-Lead: yes', () => {
    expect(lockVerdict(PLAIN, ['src/engine/app/app.ts'], nd, {}).ok).toBe(false);
    expect(lockVerdict(PLAIN, ['src/main.ts'], locked(), {}).refused).toEqual(['src/main.ts']);
    expect(lockVerdict(LEAD, ['src/engine/app/app.ts', 'src/main.ts'], locked(), {}).ok).toBe(true);
  });

  it('a trailer in the body (not the last paragraph) does not count', () => {
    expect(lockVerdict('x\n\nE357-Lead: yes\n\nmore prose here', ['src/main.ts'], locked(), {}).ok).toBe(false);
  });

  const shardPaths = [
    'src/shards/nine-dragon-stack/x.ts',
    'src/shards/nine-dragon-stack/ktx2.generated.ts',
    'public/assets/gpu/nine-dragon-stack/x.ktx2',
    'public/assets/baked/nine-dragon-stack/terrain.bin',
    'public/assets/models/nine-dragon/tower.glb',
    'public/assets/horizon/nine-dragon-stack-day.webp',
    'test/parity/baselines/m5/nine-dragon-stack.json',
    'docs/tasks/asks/E400.md',
  ];

  it('passes a reopened shard allowlist and refuses it for a shard that is not reopened', () => {
    expect(lockVerdict(PLAIN, shardPaths, nd, {})).toMatchObject({ ok: true, refused: [] });
    const other = locked({ 'pine-hollow': [] });
    const v = lockVerdict(PLAIN, shardPaths, other, {});
    expect(v.ok).toBe(false);
    // docs/tasks/asks/** is on every reopened lane's list, so only the shard's own paths are refused
    expect(v.refused).toEqual(shardPaths.filter((x) => !x.startsWith('docs/tasks/asks/')));
    expect(lockVerdict(PLAIN, shardPaths, locked(), {}).refused).toEqual(shardPaths);
  });

  it('refuses another shard, the kit and the engine for a reopened lane', () => {
    const v = lockVerdict(PLAIN, ['src/shards/pine-hollow/x.ts', 'src/kit/bow.ts', 'src/engine/app/app.ts'], nd, {});
    expect(v.refused).toHaveLength(3);
  });

  const targets = (t: Record<string, unknown>): string => JSON.stringify({ about: 'x', targets: t }, null, 1);
  it('scopes scripts/blender/targets.json to the slug targets', () => {
    const before = targets({ 'pine-hollow/cave': { script: 'a' } });
    const add = targets({ 'pine-hollow/cave': { script: 'a' }, 'nine-dragon-stack/x': { script: 'b' } });
    const both = targets({ 'pine-hollow/cave': { script: 'c' }, 'nine-dragon-stack/x': { script: 'b' } });
    const p = 'scripts/blender/targets.json';
    expect(lockVerdict(PLAIN, [p], nd, { [p]: { before, after: add } }).ok).toBe(true);
    const v = lockVerdict(PLAIN, [p], nd, { [p]: { before, after: both } });
    expect(v.ok).toBe(false);
    expect(v.refused[0]).toContain('pine-hollow/cave');
  });

  it('scopes art/README.md to lines naming art/<slug>/', () => {
    const p = 'art/README.md';
    const before = '# art\n- art/pine-hollow/round-1/\n';
    const ok = `${before}- art/nine-dragon-stack/round-2-tower/ — the tower\n`;
    const bad = '# art\n- art/pine-hollow/round-1/ (moved)\n';
    expect(lockVerdict(PLAIN, [p], nd, { [p]: { before, after: ok } }).ok).toBe(true);
    expect(lockVerdict(PLAIN, [p], nd, { [p]: { before, after: bad } }).ok).toBe(false);
  });

  it('scopes the KTX2 list and cache to the slug asset folders', () => {
    const list = 'scripts/bake-ktx2.list.json';
    const cache = 'scripts/bake-ktx2.cache.json';
    const lb = JSON.stringify({ $doc: 'x', phone: ['/assets/baked/pine-hollow/tex/a.webp'] });
    const lOk = JSON.stringify({ $doc: 'x', phone: ['/assets/baked/pine-hollow/tex/a.webp', '/assets/nine-dragon-stack/b.webp#layer'] });
    const lBad = JSON.stringify({ $doc: 'x', phone: ['/assets/nine-dragon-stack/b.webp'] });
    expect(lockVerdict(PLAIN, [list], nd, { [list]: { before: lb, after: lOk } }).ok).toBe(true);
    expect(lockVerdict(PLAIN, [list], nd, { [list]: { before: lb, after: lBad } }).ok).toBe(false);

    const cb = JSON.stringify({ k1: '/assets/gpu/pine-hollow/a.ktx2', k2: 'none' });
    const cOk = JSON.stringify({ k1: '/assets/gpu/pine-hollow/a.ktx2', k2: 'none', k3: '/assets/gpu/nine-dragon-stack/b.ktx2', k4: 'none' });
    const cBad = JSON.stringify({ k1: '/assets/gpu/pine-hollow/a2.ktx2', k2: 'none' });
    const cDropNone = JSON.stringify({ k1: '/assets/gpu/pine-hollow/a.ktx2' });
    expect(lockVerdict(PLAIN, [cache], nd, { [cache]: { before: cb, after: cOk } }).ok).toBe(true);
    expect(lockVerdict(PLAIN, [cache], nd, { [cache]: { before: cb, after: cBad } }).ok).toBe(false);
    expect(lockVerdict(PLAIN, [cache], nd, { [cache]: { before: cb, after: cDropNone } }).ok).toBe(false);
  });

  it('allows only reopened derived entries and keeps measured GL provenance lead-only', () => {
    const p = 'budgets/ceiling-sources.json';
    const before = JSON.stringify({ derived: { 'nine-dragon-stack': { phone: 1 }, 'pine-hollow': { phone: 2 } }, reRecords: [{ ceiling: 7 }], baselines: ['proof'], calibration: 'fixed' });
    const data: { derived: Record<string, { phone: number }>; reRecords: { ceiling: number }[]; baselines: string[]; calibration: string } = JSON.parse(before) as { derived: Record<string, { phone: number }>; reRecords: { ceiling: number }[]; baselines: string[]; calibration: string };
    const verdict = (after: string): boolean => lockVerdict(PLAIN, [p], nd, { [p]: { before, after } }).ok;
    data.derived['nine-dragon-stack'] = { phone: 3 };
    expect(verdict(JSON.stringify(data))).toBe(true);
    data.derived['pine-hollow'] = { phone: 3 };
    expect(verdict(JSON.stringify(data))).toBe(false);
    data.derived['pine-hollow'] = { phone: 2 };
    for (const patch of [{ reRecords: [] }, { baselines: [] }, { calibration: 'changed' }, { calibrationSha256: 'new' }, { derived: [] }]) expect(verdict(JSON.stringify({ ...data, ...patch }))).toBe(false);
    delete data.derived['nine-dragon-stack'];
    expect(verdict(JSON.stringify(data))).toBe(false);
    expect(verdict('broken JSON')).toBe(false);
    expect(lockVerdict(LEAD, [p], nd, { [p]: { before, after: JSON.stringify({ ...data, reRecords: [] }) } }).ok).toBe(true);
  });

  it('always passes a sweepguard-ledger-only commit', () => {
    expect(lockVerdict(PLAIN, ['project/sweepguard-ledger.md'], locked(), {}).ok).toBe(true);
    expect(lockVerdict(PLAIN, ['project/sweepguard-ledger.md', 'src/main.ts'], locked(), {}).ok).toBe(false);
  });

  it('passes everything when unlocked', () => {
    expect(lockVerdict(PLAIN, ['src/main.ts'], { locked: false, reopened: {} }, {}).ok).toBe(true);
  });
});
