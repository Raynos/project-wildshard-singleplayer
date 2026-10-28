import { expect, test } from 'vitest';
import { BufferAttribute, type BufferGeometry } from 'three';
import * as nativeGeometry from '../src/engine/entities/species/loft';
import { Rng } from '../src/sdk/random';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { withSpeciesGeometry, isLowPoly, toonPaint, type AnimalSpecies, type Paint, type VariantDef } from '../src/sdk/bake/species';
import { pineLofts, PINE_LOFTS } from '../src/shards/pine-hollow/generators/creatureLofts';
import { DEER } from '../src/shards/pine-hollow/generators/deerRows';
import { ELK } from '../src/shards/pine-hollow/generators/elkRows';
import { PINE_ELK_THRALL } from '../src/shards/pine-hollow/generators/speciesRows';

const original = pineLofts(nativeGeometry);
const paintA = (variant?: VariantDef): Paint => (out, x, y, z, nx, ny, nz, _part, t, a) => {
  out.setRGB(x + nx + (variant?.id.length ?? 0) / 100, y + ny + t, z + nz + a);
};
const paintB = (variant?: VariantDef): Paint => (out, x, y, z, nx, ny, nz, _part, t, a) => {
  out.setRGB(z - nx, x - ny + (variant?.id.length ?? 0) / 100, y - nz + t + a);
};

function expectGeometry(actual: BufferGeometry, expected: BufferGeometry): void {
  expect(actual.groups).toEqual(expected.groups);
  expect(actual.drawRange).toEqual(expected.drawRange);
  expect(actual.index?.array).toEqual(expected.index?.array);
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
  for (const name of Object.keys(expected.attributes)) {
    const a = actual.getAttribute(name), b = expected.getAttribute(name);
    if (!(a instanceof BufferAttribute) || !(b instanceof BufferAttribute)) throw new Error('Loft requires native plain channels');
    expect(a.array.constructor).toBe(b.array.constructor);
    expect(a.itemSize).toBe(b.itemSize);
    expect(a.normalized).toBe(b.normalized);
    expect(a.array.byteLength).toBe(b.array.byteLength);
    expect(hashImmutableBytes(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)))
      .toBe(hashImmutableBytes(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength)));
  }
}

function metadata({ furParts: _fur, hardParts: _hard, eyeParts: _eyes, ...rows }: AnimalSpecies) { return rows; }

for (const kind of ['deer', 'elk'] as const) for (const style of ['pbr', 'toon-a', 'toon-b'] as const) {
  test(`${kind} ${style} retains all original variant geometry, rig metadata and random state`, () => {
    const variants = kind === 'deer' ? DEER.variants : [...ELK.variants, PINE_ELK_THRALL];
    const compare = (): void => {
      for (const variant of variants) {
        const a = new Rng(123), b = new Rng(123);
        const actual = PINE_LOFTS[kind](variant, a), expected = original[kind](variant, b);
        try {
          expect(metadata(actual)).toEqual(metadata(expected));
          expect(a.snapshot()).toEqual(b.snapshot());
          for (const key of ['furParts', 'hardParts', 'eyeParts'] as const) {
            expect(actual[key]).toHaveLength(expected[key].length);
            expected[key].forEach((geometry, index) => {
              const candidate = actual[key][index]; if (candidate === undefined) throw new Error('Missing original loft part');
              expectGeometry(candidate, geometry);
            });
          }
        } finally { for (const part of [...actual.furParts, ...actual.hardParts, ...actual.eyeParts, ...expected.furParts, ...expected.hardParts, ...expected.eyeParts]) part.dispose(); }
      }
    };
    if (style === 'pbr') compare();
    else withSpeciesGeometry({ deer: style === 'toon-a' ? paintA : paintB, elk: style === 'toon-a' ? paintA : paintB }, compare);
    expect(isLowPoly()).toBe(false); expect(nativeGeometry.isLowPoly()).toBe(false);
    expect(toonPaint('unregistered-author-kind')).toBeNull();
  });
}
