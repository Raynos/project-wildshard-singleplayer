// oxlint-disable-next-line import/no-nodejs-modules -- Witness the exact committed native terrain payloads used by both live worlds.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes as hash } from '../src/sdk/immutable';
import { assetCost } from '../src/game/shardfile/assets';
import { validateNativeGround, nativeGroundRules } from '../src/game/shardfile/nativeGround';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { parseShardfile } from '../src/game/shardfile/schema';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { loadRapier } from '../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

function fixture(slug: 'pine-hollow' | 'nalati-grasslands') {
  const bytes = Uint8Array.from(readFileSync(new URL(`../public/assets/baked/${slug}/terrain.bin`, import.meta.url)));
  const view = new DataView(bytes.buffer), file = hash(bytes), seed = view.getUint32(16, true);
  const source = emptyShardfile({ slug, name: 'Native fixture', author: 'Fixture', revision: 1, seed });
  source.nativeGround = { version: 1, file }; source.runtime = { entry: 'runtime/index.ts' };
  const cost = assetCost('binary', bytes);
  source.files.push({ hash: file, kind: 'binary', compressed: bytes.length, ...cost, dependencies: [], critical: true });
  source.critical.push(file); source.budgets.sim = { resident: cost.decoded + cost.gpu, compressed: bytes.length };
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    const heights = Array.from({ length: 256 }, (_, i) => {
      const x = side === 'east' ? 255 : side === 'west' ? 0 : i, z = side === 'north' ? 255 : side === 'south' ? 0 : i;
      return view.getFloat32(24 + (z * 256 + x) * 4, true);
    });
    source.edge[side] = { heights, colours: heights.map(() => [0.5, 0.5, 0.5]), roadHeight: 0 };
  }
  return { source, bytes, assets: new Map([[file, bytes]]), file };
}

describe('runtime-owned native ground declaration', () => {
  it.each(['pine-hollow', 'nalati-grasslands'] as const)('witnesses every original %s height, full boundary and continuous 8×15 entry without another collision owner', slug => {
    const { source, bytes, assets } = fixture(slug), grid = validateNativeGround(source, assets);
    expect(grid?.res).toBe(256); expect(grid?.size).toBe(500); expect(grid?.seed).toBe(source.identity.seed);
    expect(grid?.heights).toEqual(new Float32Array(bytes.buffer, 24, 256 ** 2));
    expect(parseShardfile(source).nativeGround).toEqual(source.nativeGround);
    if (slug === 'pine-hollow') expect(validateShardfileAssets(source, assets, hash).nativeGround).toEqual(source.nativeGround);
  });

  it('refuses a rounded edge, changed interior footprint, seed/header and nonfinite native sample', () => {
    const { source, bytes, assets, file } = fixture('pine-hollow');
    const edge = source.edge.north.heights[0]; if (edge === undefined) throw new Error('Missing edge');
    source.edge.north.heights[0] = edge + 0.0001;
    expect(() => validateNativeGround(source, assets)).toThrow('boundary differs'); source.edge.north.heights[0] = edge;
    const changed = Uint8Array.from(bytes), view = new DataView(changed.buffer);
    assets.set(file, changed);
    const interior = 24 + (250 * 256 + 127) * 4, original = view.getFloat32(interior, true);
    view.setFloat32(interior, 0.1, true);
    expect(() => validateNativeGround(source, assets)).toThrow('footprint must be flat'); view.setFloat32(interior, original, true);
    view.setFloat32(24 + 128 * 256 * 4, Number.NaN, true);
    expect(() => validateNativeGround(source, assets)).toThrow('heights must be finite');
    assets.set(file, bytes); source.identity.seed++;
    expect(() => validateNativeGround(source, assets)).toThrow('identity seed');
    source.identity.seed--; view.setUint32(8, 257, true);
    expect(() => validateNativeGround(source, assets.set(file, changed))).toThrow('WSTR v1 / 256');
  });

  it('requires one runtime owner and an independent admitted critical binary', () => {
    const { source } = fixture('pine-hollow');
    source.runtime = null;
    expect(nativeGroundRules(source)).toContain('native ground requires a trusted runtime declaration');
    expect(() => parseShardfile(source)).toThrow('semantic rules');
    source.runtime = { entry: 'runtime/index.ts' }; source.critical = [];
    expect(nativeGroundRules(source)).toContain('native ground is an independent critical binary root');
    source.terrain = { version: 1, family: 'pbr', collider: 'a'.repeat(64), tiles: [] };
    expect(nativeGroundRules(source)).toContain('native ground and compiled collision are mutually exclusive');
  });

  it('refuses a standalone flat simulation proxy before allocating its native world', async () => {
    const { source, assets } = fixture('pine-hollow');
    const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    expect(() => createShardfileSim(source, assets, { rapier })).toThrow('flat declared proxy is forbidden');
  });
});
