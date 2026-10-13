import { afterEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { unzlibSync } from 'fflate';
import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, RGBAFormat } from 'three';
import { bakeSignalSand } from '../../../src/shards/sunscar-dunes/generators/sand';
import { GRAIN_TILE, SAND_FILES, SAND_MAP } from '../../../src/shards/sunscar-dunes/data/sand';
import sandMeans from '../../../src/shards/sunscar-dunes/data/sand.json' with { type: 'json' };
import { bootFiles } from '../../../src/shards/sunscar-dunes/boot/files';
import { loadSandMaps, SKIRT } from '../../../src/shards/sunscar-dunes/look/render';
import { bakeSignalSkirt } from '../../../src/shards/sunscar-dunes/generators/skirt';
import skirtRows from '../../../src/shards/sunscar-dunes/data/skirt.json' with { type: 'json' };

const committed = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
const serve = (bytes: (url: string) => Uint8Array | null): void => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const body = bytes(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url);
    return Promise.resolve(body === null ? new Response(null, { status: 404 }) : new Response(new Blob([body.slice().buffer])));
  });
};
afterEach(() => { vi.restoreAllMocks(); });

describe('Signal Dunes bakes its sand maps offline (SHARD-PLATFORM SF72, RENDERING.md)', () => {
  const bake = bakeSignalSand();

  it('the committed maps and means are byte-exact against the generator (the stale gate: rerun src/shards/sunscar-dunes/generators/bake-signal-sand.mjs)', () => {
    expect(unzlibSync(committed(SAND_FILES.shadow))).toEqual(bake.shadow);
    expect(unzlibSync(committed(SAND_FILES.trail))).toEqual(bake.trail);
    expect(unzlibSync(committed(SAND_FILES.grain))).toEqual(bake.grain);
    expect(sandMeans).toEqual({ meanR: bake.meanR, meanGlint: bake.meanGlint });
    const skirt = bakeSignalSkirt();
    expect(unzlibSync(committed(SAND_FILES.skirt))).toEqual(skirt.bytes);
    expect(JSON.stringify(skirtRows)).toBe(JSON.stringify(skirt.rows));
    // the folder holds exactly this bake, and the boot fetches every map
    expect(readdirSync('public/assets/sunscar-dunes/sand').sort()).toEqual(['grain.bin', 'shadow.bin', 'skirt.bin', 'trail.bin']);
    for (const url of Object.values(SAND_FILES)) expect(bootFiles()).toContain(url);
  });

  it('the client uploads the bake as the textures it computed: the same bytes, formats and filters', async () => {
    serve(committed);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { shadow, trail, grain } = await loadSandMaps();
    expect(errors).not.toHaveBeenCalled();
    for (const [texture, bytes] of [[shadow, bake.shadow], [trail, bake.trail]] as const) {
      expect([texture.image.width, texture.image.height, texture.format, texture.magFilter, texture.minFilter, texture.wrapS, texture.wrapT])
        .toEqual([SAND_MAP, SAND_MAP, RedFormat, LinearFilter, LinearFilter, ClampToEdgeWrapping, ClampToEdgeWrapping]);
      expect(texture.image.data).toEqual(bytes);
    }
    expect([grain.image.width, grain.format, grain.wrapS, grain.minFilter, grain.generateMipmaps, grain.anisotropy]).toEqual([GRAIN_TILE, RGBAFormat, RepeatWrapping, LinearMipmapLinearFilter, true, 8]);
    expect(grain.image.data).toEqual(bake.grain);
  });

  it('the client reads the baked skirt back exact: the standalone reach and the cube cut, indexed as built', async () => {
    serve(committed);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const skirt = await SKIRT.load(SAND_FILES.skirt, skirtRows, 'skirt');
    expect(errors).not.toHaveBeenCalled();
    if (skirt === null) throw new Error('no skirt');
    for (const [geometry, reach] of [[skirt.standalone, 520], [skirt.cube, 250]] as const) {
      expect(Object.keys(geometry.attributes)).toEqual(['position', 'normal', 'uv', 'color']);
      expect(geometry.getIndex()?.array).toBeInstanceOf(Uint16Array);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox?.max.x).toBe(reach);
    }
    expect(skirt.half).toBe(250);
    serve(() => null);
    expect(await SKIRT.load(SAND_FILES.skirt, skirtRows, 'skirt fault')).toBeNull();
    expect(String(errors.mock.calls[0]?.[0])).toBe('skirt fault');
  });

  it('a map that fails to load is a page fault and the sand draws without it (lit, no trail, flat grain)', async () => {
    serve((url) => url === SAND_FILES.shadow ? null : committed(url));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { shadow, trail } = await loadSandMaps();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0]?.[0])).toContain('baked sand map');
    expect(shadow.image.data).toEqual(new Uint8Array(SAND_MAP * SAND_MAP).fill(255));
    expect(trail.image.data).toEqual(bake.trail);
  });
});
