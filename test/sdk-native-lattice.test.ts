// oxlint-disable-next-line import/no-nodejs-modules -- Pin both committed native terrains in the shared SDK slicer proof.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceNativeLattice, type NativeLatticeSource, type NativeLatticeTile } from '../src/sdk/bake/nativeLattice';

function source(slug: string): NativeLatticeSource {
  const bytes = readFileSync(new URL(`../public/assets/baked/${slug}/terrain.bin`, import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== 256) throw new Error('Expected actual native 256 source');
  const resolution = 256, n = resolution ** 2, positions = new Float64Array(n * 3), splat = new Float64Array(n * 4), uv = new Float64Array(n * 2);
  const normal = new Float64Array(n * 3), surf = new Float64Array(n * 4), rdir = new Float64Array(n * 2), zone = new Float64Array(n * 3);
  const indices: number[] = [];
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    const i = z * resolution + x, px = -250 + x * 500 / 255, pz = -250 + z * 500 / 255;
    positions.set([px, view.getFloat32(24 + i * 4, true), pz], i * 3);
    splat.set(bytes.subarray(24 + n * 4 + i * 4, 24 + n * 4 + i * 4 + 4), i * 4);
    uv.set([x / 255, z / 255], i * 2); normal.set([0, 2, 0], i * 3);
    surf.set([px, pz, px + pz, 1], i * 4); rdir.set([px - pz, 0.25], i * 2); zone.set([px, 0.5, pz], i * 3);
    if (x < 255 && z < 255) indices.push(i, i + 256, i + 1, i + 1, i + 256, i + 257);
  }
  return { resolution, positions, indices: Uint32Array.from(indices), attributes: {
    splat: { itemSize: 4, values: splat }, uv: { itemSize: 2, values: uv }, normal: { itemSize: 3, values: normal },
    surf: { itemSize: 4, values: surf }, rdir: { itemSize: 2, values: rdir }, zone: { itemSize: 3, values: zone },
  } };
}
function projectedArea(tiles: readonly NativeLatticeTile[]): number {
  let sum = 0;
  for (const tile of tiles) for (let i = 0; i < tile.indices.length; i += 3) {
    const a = tile.indices[i], b = tile.indices[i + 1], c = tile.indices[i + 2];
    if (a === undefined || b === undefined || c === undefined) throw new Error('Missing triangle');
    const ax = tile.positions[a * 3], az = tile.positions[a * 3 + 2], bx = tile.positions[b * 3], bz = tile.positions[b * 3 + 2], cx = tile.positions[c * 3], cz = tile.positions[c * 3 + 2];
    if (ax === undefined || az === undefined || bx === undefined || bz === undefined || cx === undefined || cz === undefined) throw new Error('Missing position');
    sum += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
  }
  return sum;
}
function verify(original: NativeLatticeSource, tiles: readonly NativeLatticeTile[]): void {
  const vertices = new Map<string, { tile: NativeLatticeTile; i: number }>();
  for (const tile of tiles) for (let i = 0; i < tile.positions.length / 3; i++) {
    const x = tile.positions[i * 3], y = tile.positions[i * 3 + 1], z = tile.positions[i * 3 + 2];
    if (x === undefined || y === undefined || z === undefined) throw new Error('Missing position');
    if (x < tile.bounds.min[0] || x > tile.bounds.max[0] || z < tile.bounds.min[2] || z > tile.bounds.max[2]) throw new Error('Triangle escaped its tile');
    const key = `${x}/${z}`, prior = vertices.get(key);
    if (prior !== undefined) {
      if (prior.tile.positions[prior.i * 3 + 1] !== y) throw new Error('Cracked shared height');
      for (const [name, channel] of Object.entries(tile.attributes)) {
        const other = prior.tile.attributes[name];
        if (other === undefined) throw new Error('Missing shared attribute');
        for (let c = 0; c < channel.itemSize; c++) if (other.values[prior.i * channel.itemSize + c] !== channel.values[i * channel.itemSize + c]) throw new Error(`Cracked shared ${name}`);
      }
    }
    vertices.set(key, { tile, i });
  }
  for (let i = 0; i < original.positions.length / 3; i++) {
    const found = vertices.get(`${original.positions[i * 3]}/${original.positions[i * 3 + 2]}`);
    if (found === undefined || found.tile.positions[found.i * 3 + 1] !== original.positions[i * 3 + 1]) throw new Error(`Native height ${i} changed or disappeared`);
    for (const [name, channel] of Object.entries(original.attributes)) {
      const output = found.tile.attributes[name];
      if (output === undefined) throw new Error('Missing output attribute');
      for (let c = 0; c < channel.itemSize; c++) if (output.values[found.i * channel.itemSize + c] !== channel.values[i * channel.itemSize + c]) throw new Error(`Native ${name} changed`);
    }
  }
}
describe('native lattice render slicing', () => {
  it.each([['pine-hollow', 0], ['nalati-grasslands', 1]] as const)('keeps every native %s height/attribute and welds exact L%s boundaries', (slug, lod) => {
    const native = source(slug), before = native.positions.slice(), indices = native.indices.slice();
    const tiles = sliceNativeLattice(native, lod);
    expect(tiles).toHaveLength(lod === 0 ? 64 : 16);
    verify(native, tiles);
    expect(projectedArea(tiles)).toBeCloseTo(500 ** 2, 5);
    expect(native.positions).toEqual(before); expect(native.indices).toEqual(indices);
    expect(tiles.every(tile => tile.attributes['normal']?.values.every((value, i) => value === (i % 3 === 1 ? 2 : 0)))).toBe(true);
  }, 20000);
  it('retains native holes and produces byte-identical output without making collision or LOD replacements', () => {
    const native = source('pine-hollow');
    // One actual triangle crosses the x=0 and z=0 tile boundaries. All other source faces are holes.
    const at = (127 * 255 + 127) * 6;
    native.indices = native.indices.slice(at, at + 3);
    const first = sliceNativeLattice(native, 0), second = sliceNativeLattice(native, 0);
    expect(first).toEqual(second);
    expect(first.filter(tile => tile.indices.length > 0)).toHaveLength(3);
    expect(projectedArea(first)).toBeCloseTo((500 / 255) ** 2 / 2, 10);
    const cuts = first.flatMap(tile => Array.from(tile.positions).filter((_, i) => i % 3 === 0));
    expect(cuts).toContain(0);
  });
  it('refuses unsupported lattices, invalid indices and nonfinite or oversized channels before slicing', () => {
    const native = source('pine-hollow'); native.indices = Uint32Array.of(0, 1, 65536);
    expect(() => sliceNativeLattice(native, 0)).toThrow('bounded original');
    native.indices = new Uint32Array();
    const values = new Float64Array(256 ** 2 * 4); values[10] = Infinity;
    expect(() => sliceNativeLattice({ ...native, attributes: { surf: { itemSize: 4, values } } }, 1)).toThrow('attribute surf');
    expect(() => sliceNativeLattice({ ...native, attributes: { zone: { itemSize: 5, values } } }, 1)).toThrow('attribute zone');
  });
});
