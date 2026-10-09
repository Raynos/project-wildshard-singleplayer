import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hashes the geometry and texture bytes against the recorded ones.
import { createHash } from 'node:crypto';
import { CylinderGeometry, Vector3, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { braidColours, coilPoints, LashCord, plaitedCord, plaitTextures, type PlaitStyle } from '../../../src/game/systems/items/lashView';
import { COIL_A, LASH_CORD, LOOP, PLAIT, POPPER, RADIAL, STRAND_A, STRAND_B } from '../../../src/shards/sunscar-dunes/data/whip';
// The bullwhip's cord, plait tile and held coil as Signal Dunes' own code built them before they became rows (HEAD d91bc1a63, weapons/whipModel.ts).
import before from './whip-view.json' with { type: 'json' };

const sha = (a: ArrayBufferView | null): string => {
  if (a === null) throw new Error('no data');
  return createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
};
const floats = (a: BufferAttribute | InterleavedBufferAttribute): string => sha(Float32Array.from({ length: a.count * a.itemSize }, (_, i) => a.getComponent(Math.floor(i / a.itemSize), i % a.itemSize)));

describe('the lash item\'s view draws a shard\'s cord from rows (SHARD-PLATFORM SF72, declared item view)', () => {
  it('Signal Dunes\' rows build exactly the lash, plait tile, coil and braid its own code built (pixel parity by construction)', () => {
    const lash = new LashCord(LASH_CORD); lash.shape(new Vector3(0.01, 0.02, -0.1), new Vector3(0.5, 0.3, -7), 0.7, 0.4, 1.3);
    const g = lash.mesh.geometry, index = g.getIndex();
    if (index === null) throw new Error('lash index');
    expect({ position: floats(g.getAttribute('position')), normal: floats(g.getAttribute('normal')), color: floats(g.getAttribute('color')), index: sha(Uint32Array.from(index.array)),
      roughness: lash.mesh.material.roughness, emissive: lash.mesh.material.emissive.getHex(), visible: lash.mesh.visible }).toEqual(before.lash);
    const tile = plaitTextures(PLAIT);
    expect({ map: sha(tile.map.image.data), normal: sha(tile.normal.image.data), rough: sha(tile.rough.image.data) }).toEqual(before.plait);
    const coil = plaitedCord(coilPoints(LOOP), LOOP.cord, PLAIT), cg = coil.geometry, map = coil.material.map;
    if (map === null) throw new Error('coil map');
    expect({ position: floats(cg.getAttribute('position')), uv: floats(cg.getAttribute('uv')), normal: floats(cg.getAttribute('normal')), repeat: map.repeat.toArray(), count: cg.getAttribute('position').count }).toEqual(before.loop);
    const handle = new CylinderGeometry(0.017, 0.021, 0.26, RADIAL, 12, true); braidColours(handle, 13, RADIAL + 1, 0, STRAND_A, STRAND_B, POPPER);
    expect(floats(handle.getAttribute('color'))).toBe(before.handleBraid);
  });

  it('a second cord look builds its own braid and tile (the view is generic, the look is data)', () => {
    const rope: PlaitStyle = { size: 32, columns: 2, rows: 3, crease: [30, 30, 30], crown: [120, 110, 90], relief: 2, rough: [0.9, 0.3] };
    const tile = plaitTextures(rope);
    expect([tile.map.image.width, tile.map.image.data?.length]).toEqual([32, 32 * 32 * 4]);
    expect(sha(tile.map.image.data)).not.toBe(before.plait.map);
    const cord = new LashCord({ ...LASH_CORD, segments: 8, radial: 4, strandA: COIL_A, popperRings: 0 });
    expect(cord.mesh.geometry.getAttribute('position').count).toBe(9 * 4);
    const pts = coilPoints({ ...LOOP, turns: 1, tail: [] });
    expect(pts).toHaveLength(41);
  });
});
