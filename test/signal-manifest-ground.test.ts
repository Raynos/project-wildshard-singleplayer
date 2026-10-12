// oxlint-disable-next-line import/no-nodejs-modules -- Compare the cold product with the actual retained byte corpus.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The pre-adoption immutable corpus hash is independent of the producer.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Audit this isolated source tree, without loading game services.
import process from 'node:process';
import { expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import { Color } from 'three';
import { SEED, SPAWN, TOWER, TRAIL } from '../src/shards/sunscar-dunes/data/layout';
import { SCOUT_AT } from '../src/shards/sunscar-dunes/data/flags';
import { SAND_TINT } from '../src/shards/sunscar-dunes/data/duneField';
import { signalManifestGround } from '../src/shards/sunscar-dunes/generators/manifestGround';
import { signalNativeTerrain } from '../src/shards/sunscar-dunes/generators/nativeTerrain';
import { decodeSignalRingMeans } from '../src/shards/sunscar-dunes/runtime/looks/ringMeans';
import { duneHeight } from './fixtures/signal-dune-law';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('cold-compiles the unchanged WSTR bytes and preserves every original tint vertex', () => {
  const product = signalNativeTerrain(), original = readFileSync('public/assets/baked/sunscar-dunes/terrain.bin');
  expect(product.bytes).toEqual(new Uint8Array(original));
  expect(createHash('sha256').update(product.bytes).digest('hex')).toBe('2565ac9a803b9f828292d1d088a437fade6c7419bdf8c1d25db91cf8a645d6bd');
  const { metadata, means } = signalManifestGround();
  const native = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] });
  const bytes = unzlibSync(readFileSync('public/assets/sunscar-dunes/ground/ring-mean.bin')), meanAt = decodeSignalRingMeans(bytes);
  const a = new Color(), b = new Color(), sand = new Color(...SAND_TINT.sand), hollow = new Color(...SAND_TINT.hollow), crest = new Color(...SAND_TINT.crest);
  const tint = (mean: number, height: number, color: Color): Float32Array => {
    const rel = Math.max(-1, Math.min(1, (height - mean) / SAND_TINT.span));
    color.copy(sand); if (rel < 0) color.lerp(hollow, -rel * SAND_TINT.hollowGain); else color.lerp(crest, rel * SAND_TINT.crestGain);
    return new Float32Array([color.r, color.g, color.b]);
  };
  let exact = 0;
  for (let iz = 0; iz < 257; iz++) for (let ix = 0; ix < 257; ix++) {
    const x = -250 + ix * 500 / 256, z = -250 + iz * 500 / 256, ring = SAND_TINT.ring;
    const mean = (native.heightAt(x + ring, z) + native.heightAt(x - ring, z) + native.heightAt(x, z + ring) + native.heightAt(x, z - ring)) / 4;
    if (mean !== means[iz * 257 + ix] || mean !== meanAt(x, z)) throw new Error(`Changed tint mean ${ix},${iz}`);
    // The tile height remains the existing persisted f32 sample.
    const height = Math.fround(native.heightAt(x, z));
    if (!tint(mean, height, a).every((value, i) => value === tint(meanAt(x, z), height, b)[i])) throw new Error(`Changed tint bytes ${ix},${iz}`);
    exact++;
  }
  expect(exact).toBe(66049);
  expect(metadata.mean.ring).toBe(14);
  expect(metadata.spawnY).toBe(native.heightAt(SPAWN.x, SPAWN.z));
  expect(metadata.towerY).toBe(native.heightAt(TOWER.x, TOWER.z));
  expect(metadata.heights).toEqual({ scout: native.heightAt(SCOUT_AT.x, SCOUT_AT.z), spawn: metadata.spawnY, ray: metadata.spawnY,
    whip: native.heightAt(SPAWN.x, SPAWN.z - 4), quest: native.heightAt(TOWER.x - 4, TOWER.z + 12) });
});

it('refuses missing, nonfinite and non-vertex mean data', () => {
  expect(() => decodeSignalRingMeans(new Uint8Array())).toThrow('Invalid authored');
  const bytes = unzlibSync(readFileSync('public/assets/sunscar-dunes/ground/ring-mean.bin'));
  const mean = decodeSignalRingMeans(bytes);
  for (const point of [[0.01, 0], [251, 0], [Number.NaN, 0], [0, Infinity]] as const) expect(() => mean(point[0], point[1])).toThrow('not an authored tile vertex');
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat64(8, Number.NaN, true);
  expect(() => decodeSignalRingMeans(bytes)).toThrow('Nonfinite');
});

it('declares the exact cold author closure with no retained seed or runtime import', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-manifest-ground');
  if (job?.buildOutputs === undefined) throw new Error('Missing required Signal ground producer');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/package.json', 'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toHaveLength(4);
  expect(Object.keys(job.buildOutputs)).toEqual(['public/assets/sunscar-dunes/ground/ring-mean.bin', 'src/shards/sunscar-dunes/data/manifestGround.generated.json']);
});
