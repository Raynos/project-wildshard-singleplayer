// oxlint-disable-next-line import/no-nodejs-modules -- Compare the cold product with the actual retained byte corpus.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The pre-adoption immutable corpus hash is independent of the producer.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Audit this isolated source tree, without loading game services.
import process from 'node:process';
import { expect, it } from 'vitest';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { Color } from 'three';
import { SEED, SPAWN, TOWER, TRAIL } from '../src/shards/sunscar-dunes/data/layout';
import { SCOUT_AT } from '../src/shards/sunscar-dunes/data/flags';
import { SAND_TINT } from '../src/shards/sunscar-dunes/data/duneField';
import { signalManifestGround } from '../src/shards/sunscar-dunes/generators/manifestGround';
import { signalNativeTerrain } from '../src/shards/sunscar-dunes/generators/nativeTerrain';
import { signalDunesTiles } from '../src/shards/sunscar-dunes/generators/tiles';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { duneHeight } from './fixtures/signal-dune-law';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('cold-compiles unchanged WSTR bytes and bakes every original Float32 tint vertex into the tiles', () => {
  const product = signalNativeTerrain(), original = readFileSync('public/assets/baked/sunscar-dunes/terrain.bin');
  expect(product.bytes).toEqual(new Uint8Array(original));
  expect(createHash('sha256').update(product.bytes).digest('hex')).toBe('2565ac9a803b9f828292d1d088a437fade6c7419bdf8c1d25db91cf8a645d6bd');
  const { metadata } = signalManifestGround();
  const native = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
  // the tint the runtime once painted per tile (three's Color lerp over the f64 ring mean), against the baked L0 tile colours
  const color = new Color(), sand = new Color(...SAND_TINT.sand), hollow = new Color(...SAND_TINT.hollow), crest = new Color(...SAND_TINT.crest);
  const baked = signalDunesTiles();
  let exact = 0;
  for (const tile of baked.terrain.tiles.filter((row) => row.lod === 0)) {
    const data = decodeTerrainTile(baked.assets.get(tile.file) ?? new Uint8Array()), r = data.resolution;
    for (let z = 0; z < r; z++) for (let x = 0; x < r; x++) {
      const ix = tile.x * 32 + x, iz = tile.z * 32 + z, px = -250 + ix * 500 / 256, pz = -250 + iz * 500 / 256, ring = SAND_TINT.ring;
      const mean = (native.heightAt(px + ring, pz) + native.heightAt(px - ring, pz) + native.heightAt(px, pz + ring) + native.heightAt(px, pz - ring)) / 4;
      // the tile height remains the existing persisted f32 sample
      const height = Math.fround(native.heightAt(px, pz)), rel = Math.max(-1, Math.min(1, (height - mean) / SAND_TINT.span)), v = (z * r + x) * 3;
      color.copy(sand); if (rel < 0) color.lerp(hollow, -rel * SAND_TINT.hollowGain); else color.lerp(crest, rel * SAND_TINT.crestGain);
      if (data.heights[z * r + x] !== height || ![color.r, color.g, color.b].every((value, i) => Math.fround(value) === data.colours?.[v + i])) throw new Error(`Changed tint bytes ${String(ix)},${String(iz)}`);
      exact++;
    }
  }
  expect(exact).toBe(64 * 33 * 33);
  expect(metadata.mean.ring).toBe(14);
  expect(metadata.spawnY).toBe(native.heightAt(SPAWN.x, SPAWN.z));
  expect(metadata.towerY).toBe(native.heightAt(TOWER.x, TOWER.z));
  expect(metadata.heights).toEqual({ scout: native.heightAt(SCOUT_AT.x, SCOUT_AT.z), spawn: metadata.spawnY, ray: metadata.spawnY,
    whip: native.heightAt(SPAWN.x, SPAWN.z - 4), quest: native.heightAt(TOWER.x - 4, TOWER.z + 12) });
});

it('declares the exact cold author closure with no retained seed or runtime import', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-manifest-ground');
  if (job?.buildOutputs === undefined) throw new Error('Missing required Signal ground producer');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/package.json', 'src/format/package.json', 'src/commons/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toHaveLength(3);
  expect(Object.keys(job.buildOutputs)).toEqual(['src/shards/sunscar-dunes/data/manifestGround.generated.json']);
});
