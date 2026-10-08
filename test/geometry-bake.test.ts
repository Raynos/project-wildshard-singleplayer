// SF67 fix 3 part 4 (E461): code-built geometry is baked at build (scripts/bake-geometry.mjs); bake-check rebuilds the tables
// byte for byte (the stale gate) and `--verify` builds each world as the page does, with every wrapped call answered.
// This pins the engine side: a recorded call answers the same inputs and rng state bit for bit and leaves the rng where the
// build would have, any other input builds; and the rock / blob / granite builders are bit-identical with and without a table.
import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { Rng } from '../src/engine/core/rng';
import { blob } from '../src/engine/world/geometryKit';
import { addGeometryBake, decodeGeometryBake, encodeGeometryBake, geometryBakeStats, recordGeometryBake } from '../src/engine/world/geometryBake';
import { REEF_ROCK, rockGeometry, SHORE_ROCK } from '../src/shards/driftwood-isle/world/rockKit';
import { graniteBlock } from '../src/shards/nalati-grasslands/world/granite';

const hex = (a: ArrayBufferView): string => Array.from(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), (b) => b.toString(16).padStart(2, '0')).join('');
const bytesOf = (g: BufferGeometry): string[] => {
  const out = Object.entries(g.attributes).map(([name, a]) => `${name}:${a.itemSize}:${hex(a.array)}`);
  const ix = g.getIndex();
  if (ix !== null) out.push(`index:${hex(ix.array)}`);
  return out;
};
const toBuffer = (bytes: Uint8Array): ArrayBuffer => { const b = new ArrayBuffer(bytes.byteLength); new Uint8Array(b).set(bytes); return b; };

describe('geometry bake (SF67)', () => {
  it('answers recorded calls bit for bit, moves the rng on, and builds any other', () => {
    const build = (seed: number): { g: BufferGeometry[]; state: number } => {
      const rng = new Rng(seed);
      const g = [rockGeometry(1.4, rng, { squash: 0.62, palette: REEF_ROCK, moss: 0.5 }), rockGeometry(0.3, rng, { detail: -1 }), blob(0.8, rng, 2), graniteBlock(3, 1.6, 2.2, seed, 0.2)];
      return { g, state: rng.snapshot().state };
    };
    const rec = recordGeometryBake();
    const recorded = build(17);
    rec.stop();
    expect(rec.entries.size).toBe(4);
    const bytes = encodeGeometryBake(rec.entries);
    expect(decodeGeometryBake(toBuffer(bytes))?.size).toBe(4);
    expect(encodeGeometryBake(decodeGeometryBake(toBuffer(bytes)) ?? new Map())).toEqual(bytes);
    const plain = build(17), other = build(18);
    expect(plain.g.map(bytesOf)).toEqual(recorded.g.map(bytesOf));
    const drop = addGeometryBake(toBuffer(bytes));
    const before = geometryBakeStats();
    const hit = build(17);
    expect(hit.g.map(bytesOf)).toEqual(recorded.g.map(bytesOf));
    expect(hit.state).toBe(recorded.state);
    expect(geometryBakeStats().hits - before.hits).toBe(4);
    const miss = build(18);
    expect(miss.g.map(bytesOf)).toEqual(other.g.map(bytesOf));
    expect(geometryBakeStats().misses - before.misses).toBe(4);
    // a different palette is a different key
    const rng = new Rng(17);
    expect(bytesOf(rockGeometry(1.4, rng, { squash: 0.62, palette: SHORE_ROCK, moss: 0.5 }))).not.toEqual(bytesOf(recorded.g[0] ?? hit.g[0] ?? blob(1, new Rng(1))));
    drop();
    expect(geometryBakeStats().entries).toBe(before.entries - 4);
  });

  it('adds nothing for bytes that are not a table', () => {
    const before = geometryBakeStats().entries;
    addGeometryBake(new ArrayBuffer(64));
    addGeometryBake(null);
    expect(geometryBakeStats().entries).toBe(before);
  });
});
