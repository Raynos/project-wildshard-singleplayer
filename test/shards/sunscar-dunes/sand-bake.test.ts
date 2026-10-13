import { afterEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate supercompresses the maps as the bake does, and decodes them back.
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { unzlibSync } from 'fflate';
import { bakeSandFiles, bakeSignalSand, SAND_ZSTD_LEVEL } from '../../../src/shards/sunscar-dunes/generators/sand';
import { GRAIN_TILE, SAND_FILES, SAND_MAP } from '../../../src/shards/sunscar-dunes/data/sand';
import sandMeans from '../../../src/shards/sunscar-dunes/data/sand.json' with { type: 'json' };
import { bootFiles } from '../../../src/shards/sunscar-dunes/boot/files';
import { SKIRT } from '../../../src/shards/sunscar-dunes/look/render';
import sandMaps from '../../../src/shards/sunscar-dunes/data/sandMaps.json' with { type: 'json' };
import source from '../../../src/shards/sunscar-dunes/shard.config';
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
const zstd = (bytes: Uint8Array): Uint8Array => new Uint8Array(zstdCompressSync(bytes, { params: { [constants.ZSTD_c_compressionLevel]: SAND_ZSTD_LEVEL } }));

describe('Signal Dunes bakes its sand maps offline (SHARD-PLATFORM SF72, RENDERING.md)', () => {
  const bake = bakeSignalSand();

  it('the committed maps and means are byte-exact against the generator (the stale gate: rerun src/shards/sunscar-dunes/generators/bake-signal-sand.mjs)', () => {
    const files = bakeSandFiles(bake, zstd);
    expect(structuredClone(files.rows)).toEqual(sandMaps);
    for (const [hash, bytes] of files.bytes) expect(new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${hash}`))).toEqual(bytes);
    expect(sandMeans).toEqual({ meanR: bake.meanR, meanGlint: bake.meanGlint });
    const skirt = bakeSignalSkirt();
    expect(unzlibSync(committed(SAND_FILES.skirt))).toEqual(skirt.bytes);
    expect(JSON.stringify(skirtRows)).toBe(JSON.stringify(skirt.rows));
    // the folder holds exactly this bake, and the boot fetches every map
    // the retired zlib map streams are still produced (G320 retains a tracked output); nothing reads them
    for (const [name, bytes] of [['shadow', bake.shadow], ['trail', bake.trail], ['grain', bake.grain]] as const) expect(unzlibSync(committed(`/assets/sunscar-dunes/sand/${name}.bin`))).toEqual(bytes);
    expect(readdirSync('public/assets/sunscar-dunes/sand').sort()).toEqual(['grain.bin', 'shadow.bin', 'skirt.bin', 'trail.bin']);
    for (const url of Object.values(SAND_FILES)) expect(bootFiles()).toContain(url);
  });

  it('each map is a single-level zstd-supercompressed KTX2 whose decoded level 0 is the bake byte for byte, a library file of the sand look', () => {
    for (const [name, bytes, size, format] of [['grain', bake.grain, GRAIN_TILE, 37], ['trail', bake.trail, SAND_MAP, 9], ['shadow', bake.shadow, SAND_MAP, 9]] as const) {
      const row = sandMaps[name], file = new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${row.hash}`)), view = new DataView(file.buffer, file.byteOffset, file.byteLength);
      // KTX2 header: vkFormat, width, height, levels, supercompression (2: zstd); the descriptor's transfer function (1: linear)
      expect([view.getUint32(12, true), view.getUint32(20, true), view.getUint32(24, true), view.getUint32(40, true), view.getUint32(44, true), file[118]]).toEqual([format, size, size, 1, 2, 1]);
      const at = Number(view.getBigUint64(80, true)), length = Number(view.getBigUint64(88, true)), raw = Number(view.getBigUint64(96, true));
      expect([raw, at + length]).toEqual([bytes.length, file.length]);
      expect(new Uint8Array(zstdDecompressSync(file.subarray(at, at + length)))).toEqual(bytes);
      expect(source.library).toContain(row.hash);
    }
    // the wire stays the size of the old zlib streams (G345: 15 KB of masks, not 1.6 MB of raw texels)
    expect(sandMaps.trail.compressed + sandMaps.shadow.compressed).toBeLessThan(16_000);
    expect(source.look.samplers).toEqual({ [sandMaps.grain.hash]: { wrap: 'repeat', anisotropy: 8, mips: 'gpu' }, [sandMaps.trail.hash]: { filter: 'linear' }, [sandMaps.shadow.hash]: { filter: 'linear' } });
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

});
