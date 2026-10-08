// oxlint-disable-next-line import/no-nodejs-modules -- Prove the workspace CLI builds without an installed SDK distribution.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture output and subprocess paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the gate's own Node binary.
import { execPath } from 'node:process';
import { expect, it, vi } from 'vitest';
import { parseShardfile } from '../src/game/shardfile/schema';
import { runWildshard } from '../scripts/wildshard.mjs';

it('builds the template through the real workspace author CLI with deterministic product bytes', async () => {
  const output = mkdtempSync(join(tmpdir(), 'sdk-repo-build-'));
  try {
    const args = ['scripts/wildshard.mjs', 'build', 'src/shards/_template', output, '--product-only'];
    execFileSync(execPath, args, { encoding: 'utf8' });
    const first = readFileSync(join(output, 'shard.json'), 'utf8');
    const shard = parseShardfile(JSON.parse(first)); expect(shard.identity.slug).toBe('template');
    // Keep the first cold subprocess proof; reuse the CLI's one tooling bundle for subsequent builds/refusals.
    await runWildshard(args.slice(1));
    expect(readFileSync(join(output, 'shard.json'), 'utf8')).toBe(first);
    const info = vi.spyOn(console, 'info');
    await runWildshard(['validate', join(output, 'shard.json')]);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/60 sim ticks, 92 edge lanes, \d+ capsule steps/u));
    info.mockRestore();
    const originalProps = shard.props;
    shard.props = { ...(originalProps ?? { version: 1, family: 'toon', tiles: [], models: [], panels: [], textures: [], far: null }),
      colliders: [...(originalProps?.colliders ?? []), { id: 'entry-wall', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 2, z: 240, hx: 8, hy: 2, hz: 0.5 }] }] };
    writeFileSync(join(output, 'shard.json'), JSON.stringify(shard));
    await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('illegal shard: entryway footprint must be clear of props and colliders above road height');
    // Beyond the reserved 15 m footprint, the real 50 m capsule walk must still refuse a blocked route.
    const wall = shard.props.colliders.at(-1)?.shapes[0]; if (wall?.kind !== 'box') throw new Error('Missing wall fixture');
    wall.z = 220;
    writeFileSync(join(output, 'shard.json'), JSON.stringify(shard));
    await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('Blocked edge entry north');
    shard.props = originalProps;
    shard.water = [{ id: 'entry-pool', kind: 'pool', level: 2, shape: { kind: 'circle', x: 0, z: 240, radius: 4 } }];
    writeFileSync(join(output, 'shard.json'), JSON.stringify(shard));
    await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('illegal shard: entryway footprint must be dry');
    const pool = shard.water[0]; if (pool?.kind !== 'pool' || pool.shape.kind !== 'circle') throw new Error('Missing pool fixture');
    pool.shape.z = 220;
    writeFileSync(join(output, 'shard.json'), JSON.stringify(shard));
    await expect(runWildshard(['validate', join(output, 'shard.json')])).rejects.toThrow('Submerged edge entry north');
  } finally { rmSync(output, { recursive: true, force: true }); }
// Cold-process build plus the cached CLI runner retain both real builds and every native entry refusal without seven tooling bundles.
}, 120_000);
