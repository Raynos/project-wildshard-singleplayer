import { expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { bakedSpill } from '../src/shards/nine-dragon-stack/generators/spillBake';
import { hashImmutableBytes } from '../src/sdk/immutable';
import rows from '../src/shards/nine-dragon-stack/data/lightSpill.generated.json' with { type: 'json' };

for (const tier of ['phone', 'desktop'] as const) for (const caps of [false, true]) it(`Nine ${tier}/${caps ? 'capped' : 'open'} spill retains final vertex streams and ordered light accumulation`, () => {
  const { geometry, emitters } = bakedSpill(caps, tier);
  expect(geometry.size).toBeGreaterThan(20);
  expect(emitters.length).toBeGreaterThan(1000);
  let compared = 0;
  for (const [name, mesh] of geometry) {
    const position = mesh.getAttribute('position'), normal = mesh.getAttribute('normal'), spill = mesh.getAttribute('aSpill');
    const actual = new Float32Array(position.count * 3);
    for (let i = 0; i < actual.length; i += 196608) {
      const path = `lighting/spill/${tier}/${caps ? 'capped' : 'open'}/${name}-${i / 196608}.bin`;
      const row = rows.find(value => value.name === path);
      if (row === undefined) throw new Error(`Missing named spill ${path}`);
      const bytes = unzlibSync(Uint8Array.from(atob(row.packed), char => char.codePointAt(0) ?? 0));
      expect(bytes.length).toBe(row.decoded);
      const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true), header = 4 + Math.ceil(length / 4) * 4;
      expect(new TextDecoder().decode(bytes.subarray(4, 4 + length))).toBe(path);
      actual.set(new Float32Array(bytes.buffer, bytes.byteOffset + header, (bytes.byteLength - header) / 4), i);
    }
    expect(hashImmutableBytes(new Uint8Array(actual.buffer))).toBe(hashImmutableBytes(new Uint8Array(spill.array.buffer, spill.array.byteOffset, spill.array.byteLength)));
    // Independent unaccelerated reference: original radius, hard cutoff,
    // facing and left-to-right summation at deterministic distributed vertices.
    for (let i = 0; i < position.count; i += Math.max(1, Math.floor(position.count / 71))) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
      const expected = new Float32Array(3), sum = [0, 0, 0];
      for (const light of emitters) {
        if (light.spill <= 0) continue;
        const radius = 2.2 * Math.max(light.w, light.h) + 1.5, r2 = radius * radius;
        const dx = light.at.x - px, dy = light.at.y - py, dz = light.at.z - pz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 9 * r2) continue;
        const dot = nx * dx + ny * dy + nz * dz;
        const facing = dot > 0 ? Math.max(dot / Math.sqrt(Math.max(d2, 1e-4)), 0) * 0.75 + 0.25 : 0.25;
        const k = (light.spill * facing) / (1 + d2 * (1 / r2));
        sum[0] = (sum[0] ?? 0) + light.color.r * k; sum[1] = (sum[1] ?? 0) + light.color.g * k; sum[2] = (sum[2] ?? 0) + light.color.b * k;
      }
      expected.set(sum);
      expect(Array.from(actual.subarray(i * 3, i * 3 + 3))).toEqual(Array.from(expected));
      compared++;
    }
    mesh.dispose();
  }
  expect(compared).toBeGreaterThan(1500);
}, 60_000);
