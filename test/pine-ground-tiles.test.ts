// oxlint-disable-next-line import/no-nodejs-modules -- the committed native Pine terrain is the tiles' source.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { canopyMapOf } from '../src/engine/world/forest/placement';
import { parseGlb } from '../src/sdk/assets';
import { bakeSplatGround, splatGroundSource } from '../src/sdk/bake/splatGround';
import { PINE_GROUND, PINE_GROUND_MATERIAL } from '../src/shards/pine-hollow/generators/groundTiles';

// Tile streaming P1 (sdk/bake/splatGround): Pine's ground as 64 L0 + 16 L1 splat tiles cut from the live chunk's own mesh, with the canopy as a
// channel and the drawn openings left out of the indices.
const bin = new Uint8Array(readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.bin', import.meta.url)));
const canopy = canopyMapOf([{ x: 0, z: 0, height: 60 }]); // a 9.6 m crown over the origin

test('the source is the live 256² lattice with its channels, the canopy and the openings cut', () => {
  const whole = splatGroundSource(bin, canopy);
  expect(whole.positions.length).toBe(256 * 256 * 3);
  expect(whole.indices.length).toBe(255 * 255 * 6);
  expect(Object.fromEntries(Object.entries(whole.attributes).map(([name, a]) => [name, a.itemSize]))).toEqual({ normal: 3, splat: 4, canopy: 1 });
  expect(Math.max(...whole.attributes['canopy']?.values ?? [])).toBeGreaterThan(0.5); // the crown at the origin
  // an opening over the origin's cells removes exactly the triangles it hits
  const hole = (ax: number, _ay: number, az: number, bx: number, _by: number, bz: number, cx: number, _cy: number, cz: number): boolean =>
    Math.max(Math.abs(ax), Math.abs(bx), Math.abs(cx)) < 4 && Math.max(Math.abs(az), Math.abs(bz), Math.abs(cz)) < 4;
  const cut = splatGroundSource(bin, canopy, hole);
  expect(cut.indices.length).toBeLessThan(whole.indices.length);
  expect(cut.indices.length).toBeGreaterThan(whole.indices.length - 300);
  expect(() => splatGroundSource(bin, new Float32Array(16))).toThrow('256²');
});

test('64 L0 tiles at native detail and 16 simplified L1 tiles, each one pine.ground primitive', async () => {
  const tiles = await bakeSplatGround(splatGroundSource(bin, canopy), PINE_GROUND);
  expect(tiles.filter(t => t.tile.lod === 0)).toHaveLength(64);
  expect(tiles.filter(t => t.tile.lod === 1)).toHaveLength(16);
  const l0 = tiles.filter(t => t.tile.lod === 0).reduce((n, t) => n + t.cost.triangles, 0);
  const l1 = tiles.filter(t => t.tile.lod === 1).reduce((n, t) => n + t.cost.triangles, 0);
  expect(l0).toBeGreaterThanOrEqual(255 * 255 * 2);
  expect(l1).toBeLessThan(l0 / 2);
  expect(Math.max(...tiles.map(t => t.geometricError))).toBeLessThanOrEqual(1);
  const first = tiles[0]; if (first === undefined) throw new Error('no tile');
  const glb = parseGlb(first.bytes);
  expect(glb.draws).toBe(1);
  const json = new TextDecoder().decode(first.bytes.subarray(20, 20 + new DataView(first.bytes.buffer, first.bytes.byteOffset).getUint32(12, true)));
  expect(json).toContain(`"name":"${PINE_GROUND_MATERIAL}"`);
  expect(json).toContain('"_SPLAT"'); expect(json).toContain('"_CANOPY"');
}, 120_000);
