// oxlint-disable-next-line import/no-nodejs-modules -- Audit this isolated source tree, without loading game services.
import process from 'node:process';
import { expect, it } from 'vitest';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { Color } from 'three';
import { SEED, SPAWN, TOWER, TRAIL } from '../src/shards/sunscar-dunes/data/layout';
import { SCOUT_AT } from '../src/shards/sunscar-dunes/data/flags';
import { SAND_TINT } from '../src/shards/sunscar-dunes/data/duneField';
import { signalManifestGround, signalNativeGround } from '../src/shards/sunscar-dunes/generators/manifestGround';
import { signalDunesTiles } from '../src/shards/sunscar-dunes/generators/tiles';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { duneHeight } from './fixtures/signal-dune-law';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('bakes every original Float32 tint vertex into the tiles and the original pose heights into the manifest', () => {
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
  expect(job.outputs).toEqual(['src/shards/sunscar-dunes/data/manifestGround.generated.json', 'src/shards/sunscar-dunes/data/drapeGround.generated.json', 'src/shards/sunscar-dunes/data/nativeGround.generated.json']);
  expect(Object.keys(job.buildOutputs)).toEqual(['src/shards/sunscar-dunes/data/manifestGround.generated.json', 'src/shards/sunscar-dunes/data/drapeGround.generated.json', 'src/shards/sunscar-dunes/data/nativeGround.generated.json']);
});

it('keeps every native navigation sample on the original WSTR256 Float32 lattice', () => {
  const actual = signalNativeGround();
  const native = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
  const step = actual.size / (actual.res - 1);
  expect(actual.seed).toBe(SEED);
  expect(actual.heights).toHaveLength(actual.res * actual.res);
  for (let i = 0; i < actual.heights.length; i++) {
    expect(actual.heights[i]).toBe(Math.fround(native.heightAt(-250 + (i % actual.res) * step, -250 + Math.floor(i / actual.res) * step)));
  }
});
