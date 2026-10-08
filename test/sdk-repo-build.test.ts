// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture output and subprocess paths.
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { parseShardfile } from '../src/game/shardfile/schema';
import { runWildshard } from '../scripts/wildshard.mjs';
import { canonicalJson } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';

const output = mkdtempSync(join(tmpdir(), 'sdk-repo-build-'));
beforeAll(async () => {
  // One workspace tooling bundle and one full product build; small baker fixtures cover repeat-bake identity.
  await runWildshard(['build', 'src/shards/_template', output, '--product-only']);
}, 60_000);
afterAll(() => { rmSync(output, { recursive: true, force: true }); });

it('builds a canonical template product through the real workspace author CLI', () => {
  const first = readFileSync(join(output, 'shard.json'), 'utf8');
  const shard = parseShardfile(JSON.parse(first)); expect(shard.identity.slug).toBe('template');
  expect(first).toBe(canonicalJson(shard));
});

it('validates the built template simulation and all 92 native entry lanes through the CLI', async () => {
  const info = vi.spyOn(console, 'info');
  try {
    await runWildshard(['validate', join(output, 'shard.json')]);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/60 sim ticks, 92 edge lanes, \d+ capsule steps/u));
  } finally { info.mockRestore(); }
// The native entry walk has a separate phase budget rather than sharing a cumulative build/refusal deadline.
}, 60_000);

it('refuses blocked or submerged entry footprints and edge walks through the CLI', async () => {
  // Keep the refusal probes asset-free: the real template has already passed complete byte admission and all 92 lanes.
  const refusal = emptyShardfile({ slug: 'entry-fixture', name: 'Entry fixture', author: 'Fixture', revision: 1, seed: 435 });
  const originalProps = refusal.props;
  refusal.props = { ...(originalProps ?? { version: 1, family: 'toon', tiles: [], models: [], panels: [], textures: [], far: null }),
    colliders: [...(originalProps?.colliders ?? []), { id: 'entry-wall', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 2, z: 240, hx: 8, hy: 2, hz: 0.5 }] }] };
  writeFileSync(join(output, 'shard.json'), JSON.stringify(refusal));
  await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('illegal shard: entryway footprint must be clear of props and colliders above road height');
  // Beyond the reserved 15 m footprint, the real 50 m capsule walk must still refuse a blocked route.
  const wall = refusal.props.colliders.at(-1)?.shapes[0]; if (wall?.kind !== 'box') throw new Error('Missing wall fixture');
  wall.z = 220;
  writeFileSync(join(output, 'shard.json'), JSON.stringify(refusal));
  await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('Blocked edge entry north');
  refusal.props = originalProps;
  refusal.water = [{ id: 'entry-pool', kind: 'pool', level: 2, shape: { kind: 'circle', x: 0, z: 240, radius: 4 } }];
  writeFileSync(join(output, 'shard.json'), JSON.stringify(refusal));
  await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('illegal shard: entryway footprint must be dry');
  const pool = refusal.water[0]; if (pool?.kind !== 'pool' || pool.shape.kind !== 'circle') throw new Error('Missing pool fixture');
  pool.shape.z = 220;
  writeFileSync(join(output, 'shard.json'), JSON.stringify(refusal));
  await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('Submerged edge entry north');
// The same built product/tooling bundle is reused; refusal probes have no assets and retain every native assertion.
}, 60_000);
