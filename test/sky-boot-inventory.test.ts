import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Check cold offline manifest prerequisites.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { bootFileList, bootSourceFiles } from '@wildshard/engine/boot/filePolicy';
import { BOOT_FILES, BOOT_SOURCES, LATE_READS } from '../src/shards/far-reach/generators/bootInventory';
import * as authorAssets from '../src/shards/far-reach/generators/fileInventory';
import { SKY_AO_FLOOR } from '../src/shards/far-reach/generators/modelFrames';
import { ISLET_POOL } from '../src/shards/far-reach/generators/restFiles';
import assets from '../src/shards/far-reach/boot/assets.generated.json' with { type: 'json' };
import files from '../src/shards/far-reach/boot/files.generated.json' with { type: 'json' };
import sources from '../src/shards/far-reach/boot/sources.generated.json' with { type: 'json' };
import lateReads from '../src/shards/far-reach/boot/lateReads.generated.json' with { type: 'json' };
import rigs from '../src/shards/far-reach/boot/rigs.generated.json' with { type: 'json' };
import worldTextures from '../src/shards/far-reach/boot/worldTextures.generated.json' with { type: 'json' };
import { SKY_RIG_LIBRARY, SKY_MODEL_SPECIMENS } from '../src/shards/far-reach/generators/rigLibrary';
import { SKY_WORLD_PREPARATION } from '../src/shards/far-reach/generators/worldTextures';
import { SKY_RIG_LIBRARY as decodedRigs, SKY_PAGE_PROGRAM } from '../src/shards/far-reach/data/population';

describe('Sky pre-admission boot metadata', () => {
  it.each(['phone', 'desktop'] as const)('preserves ordered %s reads and the pinned phone inventory', (tier) => {
    expect(files).toEqual(bootFileList(BOOT_FILES, tier));
    for (const mode of ['img', 'ktx2'] as const) {
      expect(bootSourceFiles(sources, tier, mode)).toEqual(bootSourceFiles(BOOT_SOURCES, tier, mode));
    }
  });

  it('retains every authored asset identity and the late grade read', () => {
    expect(assets).toEqual({ ...authorAssets, SKY_AO_FLOOR, ISLET_POOL });
    expect(lateReads).toEqual(LATE_READS);
    expect(rigs).toEqual({ library: SKY_RIG_LIBRARY, models: SKY_MODEL_SPECIMENS });
    expect(decodedRigs).toEqual(rigs.library);
    expect(SKY_PAGE_PROGRAM.species.library).toBe(decodedRigs);
    expect(worldTextures).toEqual(SKY_WORLD_PREPARATION);
  });

  it('publishes boot metadata after its generated inputs without a manifest cycle', () => {
    const { jobs } = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), command: v.array(v.string()), inputRoots: v.array(v.string()), outputs: v.array(v.string()) })) }),
      JSON.parse(readFileSync(new URL('../scripts/generation-jobs.json', import.meta.url), 'utf8')));
    const producer = jobs.findIndex(job => job.id === 'sky-boot-metadata');
    expect(producer).toBeGreaterThanOrEqual(0);
    const metadata = jobs[producer];
    if (metadata === undefined) throw new Error('Missing Sky boot metadata producer');
    for (const input of metadata.inputRoots) {
      const dependency = jobs.findIndex(job => job.outputs.includes(input));
      if (dependency !== -1) expect(dependency).toBeLessThan(producer);
    }
    expect(jobs.findIndex(job => job.id === 'sky-world')).toBeLessThan(producer);
    for (const job of jobs.filter(row => row.id === 'sky-rigs' || row.id === 'sky-world')) {
      expect(job.command).not.toContain('./scripts/generation-level.mjs');
      expect(job.inputRoots.some(input => metadata.outputs.includes(input))).toBe(false);
    }
  });
});
