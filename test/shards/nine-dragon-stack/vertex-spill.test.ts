// oxlint-disable-next-line import/no-nodejs-modules -- Compare actual committed geometry bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual layout used by the page.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Inflate the committed layout like the page.
import { inflateSync } from 'node:zlib';
import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bakeSpill, type Emitter } from '../../../src/shards/nine-dragon-stack/runtime/looks/vertexSpill';
import { originalSpill } from '../../fixtures/nine-spill/vertexSpill';
import { oracleLayout } from './oracleBakes';

function geometry(positions: readonly number[], normals: readonly number[]): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return result;
}

function emitter(x: number, y: number, z: number, w: number, spill: number): Emitter {
  return { at: new Vector3(x, y, z), color: new Color(0.7, 0.2, 0.9), w, h: w, power: 0.1, spill };
}

async function compare(geos: readonly BufferGeometry[], lights: readonly Emitter[]): Promise<void> {
  const before = geos.map(g => g.clone());
  const originals = geos.map(g => ({ position: g.getAttribute('position').array.slice(), normal: g.getAttribute('normal').array.slice() }));
  await originalSpill(before, lights);
  await bakeSpill(geos, lights);
  for (let i = 0; i < geos.length; i++) {
    const actual = geos[i], expected = before[i], source = originals[i];
    if (actual === undefined || expected === undefined || source === undefined) throw new Error('Missing spill geometry');
    const a = actual.getAttribute('aSpill'), b = expected.getAttribute('aSpill');
    expect(a).toBeInstanceOf(BufferAttribute);
    expect(b).toBeInstanceOf(BufferAttribute);
    expect(a.array).toEqual(b.array);
    expect(actual.getAttribute('position').array).toEqual(source.position);
    expect(actual.getAttribute('normal').array).toEqual(source.normal);
  }
}

describe('occupied-cell Nine spill preserves the frozen light law', () => {
  it('matches all Float32 channels for ordered overlapping lights across the city height range', async () => {
    let state = 357;
    const random = (): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const positions: number[] = [], normals: number[] = [], lights: Emitter[] = [];
    for (let i = 0; i < 5000; i++) {
      positions.push(random() * 240 - 120, random() * 360 - 20, random() * 240 - 160);
      normals.push(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
    }
    for (let i = 0; i < 80; i++) {
      lights.push(emitter(random() * 240 - 120, random() * 360 - 20, random() * 240 - 160, 0.2 + random() * 8, random()));
    }
    const dense = geometry(positions.slice(0, 600), normals.slice(0, 600));
    const repeat = geometry(positions.slice(0, 600), normals.slice(0, 600));
    await compare([geometry(positions, normals), dense, repeat], lights);
    expect(dense.getAttribute('aSpill').array).toEqual(repeat.getAttribute('aSpill').array);
  });

  it('matches every spill byte on the real baked layout and its authored emitters', async () => {
    const layout = oracleLayout(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/nine-dragon/baked/layout.bin', import.meta.url)))));
    const geos = layout.rows.geometries.map((_row, i) => layout.geometry(i));
    const lights = layout.rows.emitters.map(row => ({
      at: new Vector3(...row.at), color: new Color(...row.color), w: row.w, h: row.h, power: row.power, spill: row.spill,
    }));
    const fingerprint = (g: BufferGeometry): string => {
      const a = g.getAttribute('aSpill');
      if (!(a instanceof BufferAttribute)) return 'absent';
      return createHash('sha256').update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)).digest('hex');
    };
    await originalSpill(geos, lights);
    const expected = geos.map(fingerprint);
    await bakeSpill(geos, lights);
    expect(geos.map(fingerprint)).toEqual(expected);
    expect(lights.length).toBeGreaterThan(100);
  });

  it('keeps cutoff tangencies, negative bin boundaries and disabled lights exact', async () => {
    const positions: number[] = [], normals: number[] = [];
    for (const x of [-16, -8, -2, 0, 2, 8, 16]) {
      for (const delta of [-0.00001, 0, 0.00001]) {
        positions.push(x + delta, 0, 0); normals.push(1, 0, 0);
      }
    }
    // R=2 gives a six metre cutoff through an exact cell boundary. R=0 and a
    // slightly negative radius cover the old zero-reach bin's unusual arithmetic.
    positions.push(6, 0, 0, -6, 0, 0, 0, 0, 0);
    normals.push(1, 0, 0, -1, 0, 0, 0, 1, 0);
    await compare([geometry(positions, normals)], [
      emitter(0, 0, 0, 0.5 / 2.2, 1), emitter(-8, 0, 0, 2, 0.8),
      emitter(0, 0, 0, -1.5 / 2.2, 1), emitter(0, 0, 0, -1.6 / 2.2, 1),
      emitter(0, 0, 0, 12, 0), emitter(0, 0, 0, 12, -1),
    ]);
  });

  it('does not create spill for geometry without both attributes', async () => {
    const missing = new BufferGeometry(), empty = geometry([], []);
    missing.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
    await bakeSpill([missing, empty], [emitter(0, 0, 0, 20, 1)]);
    expect(missing.getAttribute('aSpill')).toBeUndefined();
    expect(empty.getAttribute('aSpill').count).toBe(0);
  });
});
