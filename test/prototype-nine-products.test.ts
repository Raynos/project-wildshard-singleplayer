import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Tests verify exact retained source bytes on disk.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROTOTYPE_PRODUCTS } from '../practice/prototype-nine/products/catalogue';
import { createPrototypeOutput, createPrototypeSource, prototypeCombat, prototypeMetadata } from '../practice/prototype-nine/products/author';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { prototypePose } from '../practice/prototype-nine/products/pose';

describe('missing-five explicitly scoped playable prototype author products', () => {
  it('contains exactly the approved missing five, not rejected concepts', () => {
    expect(PROTOTYPE_PRODUCTS.map(row => row.id)).toEqual(['bellback', 'pitcher', 'medusa', 'keelmaw', 'iguana']);
  });
  for (const row of PROTOTYPE_PRODUCTS) {
    it(`${row.id} preserves pinned source payload and bones while omitting corpse requests`, async () => {
      const bytes = readFileSync(row.metadataPath), payload = readFileSync(row.payloadPath);
      expect(hashImmutableBytes(payload)).toBe(row.payloadSha256);
      const metadata = prototypeMetadata(row.id, bytes), body = metadata.bodies[0];
      if (body === undefined) throw new Error('Missing source body');
      expect(body.dims).not.toHaveProperty('rigidCorpse');
      expect(metadata.file).toBe(row.bodyFile);
      const original = v.parse(v.object({ bodies: v.array(v.object({ bones: v.array(v.unknown()) })) }), JSON.parse(bytes.toString()));
      expect(body.bones).toEqual(original.bodies[0]?.bones);
      const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(payload));
      await bodies.preload();
      const model = bodies.copy(row.kind, row.variant);
      expect(model.bones.length).toBe(body.bones.length);
      expect(model.hardParts.length).toBeGreaterThan(0);
      if (row.id === 'medusa') {
        const heights = model.hardParts.flatMap(part => {
          const positions = part.getAttribute('position');
          return Array.from({ length: positions.count }, (_, index) => (positions.getY(index) + row.hoverHeight) * row.scale);
        });
        expect(Math.min(...heights)).toBeCloseTo(.502343, 5);
        expect(Math.max(...heights)).toBeCloseTo(2.053092, 5);
        expect(body.dims.bodyY * row.scale).toBeCloseTo(1.6, 10);
      }
      for (const part of [...model.hardParts, ...model.eyeParts, ...model.furParts]) part.dispose();
    });
    it(`${row.id} declares actual supported combat and validates its numeric pose`, () => {
      const bytes = readFileSync(row.metadataPath), metadata = prototypeMetadata(row.id, bytes), body = metadata.bodies[0];
      if (body === undefined) throw new Error('Missing source body');
      const combat = prototypeCombat(row.id);
      expect(combat.species.brain?.archetype).toBe('stalker');
      expect(combat.species.body?.motion).toBe('ground');
      expect(combat.species.body?.actions?.actions.length).toBe(1);
      expect(combat.strikes[0]?.damage).toBeGreaterThan(0);
      expect(() => numericCreaturePose(prototypePose(row.id, body.bones.map(bone => bone.name), body.dims.bodyY))).not.toThrow();
      expect(() => createPrototypeSource(row.id)).not.toThrow();
      expect(() => createPrototypeOutput(row.id, bytes)).not.toThrow();
    });
    it(`${row.id} refuses unpinned metadata`, () => {
      expect(() => prototypeMetadata(row.id, new TextEncoder().encode('{}'))).toThrow('source metadata');
    });
  }
});
